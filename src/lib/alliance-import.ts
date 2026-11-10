// =============================================================
// ★案件管理表★『全体管理』の取込（UI非依存・テスト付き）
//
// スプレッドシートの『全体管理』を見出し行ごとコピーして貼り付けると、
// 1行＝1案件として取り込む。運用をシステムに移すまでの間は、シートを直したら
// 貼り直せば案件が更新される（同じ紹介は 企業名 × 1次代理店 × 紹介日 で突き合わせる）。
//
//   ・列は見出しの名前で探す（列の並び替え・右側の集計表が一緒に貼られても動く）
//   ・1次代理店／2次代理店がマスタに無ければ、その名前で登録する
//     （「直販」は1次代理店なし、2次代理店の「直紹介」は1次代理店の「直接」窓口）
//   ・プラン・機器台数は商材明細にする（機器代金・販売粗利・代理店支払い分は
//     商材マスタの単価から計算し直すので、シートの値は読まない）
//
// 【ランタイム依存なし】値の import は alliance.ts / partnership.ts（同じく依存なし）だけ。
// =============================================================

import {
  PARTNERSHIP_PHASES,
  SALES_PHASES,
  applySalesPhase,
  countUnitOf,
  lineMoney,
  salesPhaseByKey,
  type DealKind,
} from "./alliance.ts";
import { sameName } from "./partnership.ts";
import type { Bank, Branch, Deal, DealProduct, Product } from "./types";

/** 1次代理店なし（直販）を表す、シート上の名前 */
export const DIRECT_PRIMARY_NAMES = ["直販"];
/** 2次代理店を介さない紹介を表す、シート上の名前 */
export const DIRECT_SECONDARY_NAMES = ["直紹介", "直接"];

// ---------- 表の解析（引用符の中の改行・タブに対応） ----------

/**
 * 貼り付けたテキストを行×列にする。タブがあれば TSV、無ければ CSV。
 * Google スプレッドシートからのコピーは、改行を含むセルを "…" で囲んで渡してくるので、
 * 引用符の中の改行はセルの一部として扱う。行頭の空セルも詰めない（列がずれないように）。
 */
export function parseTable(text: string): string[][] {
  const src = text.replace(/\r\n?/g, "\n");
  const delimiter = src.includes("\t") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let atCellStart = true;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && atCellStart) {
      quoted = true;
      atCellStart = false;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = "";
      atCellStart = true;
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      atCellStart = true;
    } else {
      cell += ch;
      atCellStart = false;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// ---------- 値の正規化 ----------

/** 全角英数・記号を半角に（「１」「２０２６／０９／０１」など） */
function half(value: string): string {
  return value.normalize("NFKC");
}

/**
 * 日付を YYYY-MM-DD に。"2026/09/01" "2026-9-1" "2026年9月1日" のほか、
 * 書式が外れて数値になったセル（"46,325" ＝ 2026/10/30 のシリアル値）も読む。
 * 読めなければ null（空欄は ""）。
 */
export function parseDate(value: string): string | null {
  const v = half(value).trim();
  if (v === "") return "";
  const m = /^(\d{4})[/\-.年](\d{1,2})[/\-.月](\d{1,2})日?$/.exec(v);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  const serial = Number(v.replace(/,/g, ""));
  if (Number.isInteger(serial) && serial > 30_000 && serial < 80_000) {
    // スプレッドシートの日付シリアル（1899-12-30 起点）
    return new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000).toISOString().slice(0, 10);
  }
  return null;
}

/** 金額・個数。"¥847,200" "１" "2台" → 数値。空欄・読めない値は 0 */
export function parseNumber(value: string): number {
  const v = half(value).replace(/[¥￥,円台件社\s]/g, "");
  if (v === "" || v === "-" || v === "‐") return 0;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}

/** 「‐」「-」「ー」だけのセルは空欄と同じ */
function blankish(value: string): boolean {
  return /^[\s\-‐‑–—ー－]*$/.test(value);
}

function clean(value: string | undefined): string {
  const v = (value ?? "").trim();
  return blankish(v) ? "" : v;
}

const KIND_OF_LABEL: Record<string, DealKind> = {
  セールス: "sales",
  販売協力: "partnership",
  セールス兼販売協力: "sales_partnership",
};

const BALL_OF_LABEL: Record<string, string> = {
  弊社ボール: "ours",
  アライアンスボール: "alliance",
  クライアントボール: "client",
};

function byLabel<T extends { key: string; label: string }>(list: T[], label: string): T | undefined {
  return list.find((p) => sameName(p.label, label));
}

// ---------- 見出し ----------

export type ImportField =
  | "referred"
  | "met"
  | "primary"
  | "secondary"
  | "company"
  | "kind"
  | "salesPhase"
  | "closedOn"
  | "lossReason"
  | "partnershipPhase"
  | "partnershipContractedOn"
  | "plan"
  | "planQty"
  | "contractNote"
  | "devices"
  | "monthlyFee"
  | "constructionFee"
  | "stock"
  | "installedOn"
  | "agencyPaidOn"
  | "ball"
  | "memo";

/** 見出しの名前（シートの表記ゆれも受ける） */
export const IMPORT_HEADERS: Record<ImportField, string[]> = {
  referred: ["紹介日"],
  met: ["商談実施日", "商談日"],
  primary: ["1次代理店"],
  secondary: ["2次代理店"],
  company: ["企業名", "顧客名", "会社名", "顧客名・案件名"],
  kind: ["商談種別"],
  salesPhase: ["セールスフェーズ"],
  closedOn: ["成約日orロスト日", "成約日/ロスト日", "成約日"],
  lossReason: ["失注理由"],
  partnershipPhase: ["販売協力フェーズ"],
  partnershipContractedOn: ["契約締結日"],
  plan: ["プラン"],
  planQty: ["プラン数"],
  contractNote: ["契約備考"],
  devices: ["機器台数"],
  monthlyFee: ["月額"],
  constructionFee: ["工事費"],
  stock: ["ストック分"],
  installedOn: ["設置日"],
  agencyPaidOn: ["代理店支払日"],
  ball: ["対応"],
  memo: ["備考欄", "備考"],
};

const normHeader = (h: string) => half(h).replace(/\s/g, "");

/**
 * 見出し行を探して、列の位置を返す。同じ見出しが2回出てきたら最初のもの
 * （『全体管理』は右側の集計表にも「代理店支払い分」などがあるため）。
 */
export function findHeader(rows: string[][]): {
  index: number;
  columns: Partial<Record<ImportField, number>>;
} | null {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const cells = rows[i].map(normHeader);
    if (!cells.includes("企業名") && !cells.includes("顧客名") && !cells.includes("会社名")) continue;
    const columns: Partial<Record<ImportField, number>> = {};
    for (const [field, names] of Object.entries(IMPORT_HEADERS) as [ImportField, string[]][]) {
      const idx = cells.findIndex((c) => names.map(normHeader).includes(c));
      if (idx >= 0) columns[field] = idx;
    }
    if (columns.company !== undefined) return { index: i, columns };
  }
  return null;
}

// ---------- 1行の読み取り ----------

/** シート1行を読んだ結果（マスタとの突き合わせ前） */
export interface SheetRow {
  /** シート上の行番号（見出しの次の行が 見出し行+1。メッセージ用） */
  rowNo: number;
  company: string;
  /** "" = 直販 */
  primary: string;
  /** "" = 直紹介（1次代理店の「直接」窓口） */
  secondary: string;
  kind: DealKind;
  referredAt: string;
  visitedAt: string;
  salesPhase: string;
  partnershipPhase: string;
  partnershipContractedAt: string;
  contractedAt: string;
  lostAt: string;
  lossReason: string;
  plan: string;
  planQty: number;
  devices: number;
  contractNote: string;
  monthlyFee: number;
  constructionFee: number;
  stock: number;
  installedAt: string;
  agencyPaidAt: string;
  ball: string;
  memo: string;
  warnings: string[];
}

export function readSheetRows(
  rows: string[][],
  options: { defaultPrimary?: string } = {}
): { rows: SheetRow[]; error: string | null } {
  const header = findHeader(rows);
  if (!header) {
    return {
      rows: [],
      error: "見出し行（紹介日・1次代理店・企業名 …）が見つかりません。『全体管理』を見出しの行からコピーしてください",
    };
  }
  const { columns } = header;
  const out: SheetRow[] = [];
  for (let i = header.index + 1; i < rows.length; i++) {
    const cells = rows[i];
    const get = (f: ImportField) => (columns[f] === undefined ? "" : clean(cells[columns[f]!]));
    const company = get("company");
    if (!company) continue;
    const warnings: string[] = [];
    const date = (f: ImportField, label: string) => {
      const raw = get(f);
      const d = parseDate(raw);
      if (d === null) {
        warnings.push(`${label}「${raw}」を日付として読めませんでした`);
        return "";
      }
      return d;
    };

    const primaryRaw = columns.primary === undefined ? (options.defaultPrimary ?? "") : get("primary");
    const primary = DIRECT_PRIMARY_NAMES.some((n) => sameName(n, primaryRaw)) ? "" : primaryRaw;
    const secondaryRaw = get("secondary");
    const secondary = DIRECT_SECONDARY_NAMES.some((n) => sameName(n, secondaryRaw)) ? "" : secondaryRaw;

    const salesLabel = get("salesPhase");
    const sales = salesLabel ? byLabel(SALES_PHASES, salesLabel) : undefined;
    if (salesLabel && !sales) warnings.push(`セールスフェーズ「${salesLabel}」は選択肢にありません`);
    const partnerLabel = get("partnershipPhase");
    const partner = partnerLabel ? byLabel(PARTNERSHIP_PHASES, partnerLabel) : undefined;
    if (partnerLabel && !partner) warnings.push(`販売協力フェーズ「${partnerLabel}」は選択肢にありません`);

    const kindLabel = get("kind");
    let kind: DealKind | undefined = KIND_OF_LABEL[half(kindLabel).replace(/\s/g, "")];
    if (kindLabel && !kind) warnings.push(`商談種別「${kindLabel}」は選択肢にありません`);
    if (!kind) kind = sales ? "sales" : partner ? "partnership" : "sales";

    // 成約日orロスト日は、フェーズが成約後なら成約日、ロストならロスト日
    const closed = date("closedOn", "成約日orロスト日");
    let contractedAt = "";
    let lostAt = "";
    if (closed) {
      if (sales?.stage === "won") contractedAt = closed;
      else if (sales?.stage === "lost") lostAt = closed;
      else warnings.push("成約日orロスト日が入っていますが、セールスフェーズが成約・ロストではないため読みませんでした");
    }

    const ballLabel = get("ball");
    const ball = BALL_OF_LABEL[half(ballLabel).replace(/\s/g, "")] ?? "";
    if (ballLabel && !ball) warnings.push(`対応「${ballLabel}」は選択肢にありません`);

    out.push({
      rowNo: i + 1,
      company,
      primary,
      secondary,
      kind,
      referredAt: date("referred", "紹介日"),
      visitedAt: date("met", "商談実施日"),
      salesPhase: sales?.key ?? "",
      partnershipPhase: partner?.key ?? "",
      partnershipContractedAt: date("partnershipContractedOn", "契約締結日"),
      contractedAt,
      lostAt,
      lossReason: get("lossReason"),
      plan: get("plan"),
      planQty: get("plan") ? Math.max(1, parseNumber(get("planQty"))) : 0,
      devices: parseNumber(get("devices")),
      contractNote: get("contractNote"),
      monthlyFee: parseNumber(get("monthlyFee")),
      constructionFee: parseNumber(get("constructionFee")),
      stock: parseNumber(get("stock")),
      installedAt: date("installedOn", "設置日"),
      agencyPaidAt: date("agencyPaidOn", "代理店支払日"),
      ball,
      memo: get("memo"),
      warnings,
    });
  }
  return { rows: out, error: null };
}

// ---------- マスタ・既存の案件との突き合わせ ----------

/** 案件に保存する値（stage などはセールスフェーズから決める） */
export type ImportedDealFields = Pick<
  Deal,
  | "name"
  | "company"
  | "stage"
  | "probability"
  | "expected_close"
  | "memo"
  | "referred_at"
  | "deal_kind"
  | "sales_phase"
  | "partnership_phase"
  | "partnership_contracted_at"
  | "visited_at"
  | "contracted_at"
  | "lost_at"
  | "loss_reason"
  | "confidence_rank"
  | "fulfillment_status"
  | "contract_note"
  | "ball"
  | "installed_at"
  | "agency_paid_at"
  | "monthly_fee"
  | "construction_fee"
  | "stock_amount"
>;

/** 明細（商材 × 数量）。お金は商材マスタの単価から計算する */
export interface ImportedLine {
  product_id: string;
  product_name: string;
  quantity: number;
  amount: number;
  profit: number;
  agency_fee: number;
}

export interface ImportItem {
  row: SheetRow;
  /** 既存の案件（突き合わせできたとき） */
  dealId: string | null;
  status: "new" | "update" | "same";
  fields: ImportedDealFields;
  lines: ImportedLine[];
  /** 変わる項目の名前（更新のときだけ） */
  changes: string[];
}

export interface ImportPlan {
  items: ImportItem[];
  /** マスタに無いので新しく登録する1次代理店 */
  newPrimaries: string[];
  /** マスタに無いので新しく登録する2次代理店（「直接」の窓口を含む） */
  newSecondaries: { primary: string; name: string }[];
  /** 商材マスタに無いプラン名（明細を作れない） */
  unknownPlans: string[];
  error: string | null;
}

/** 紹介を突き合わせるキー（企業名 × 1次代理店 × 紹介日） */
export function matchKey(company: string, primaryKey: string, referredAt: string): string {
  return [company.replace(/[\s　]/g, ""), primaryKey, referredAt].join("|");
}

function addDays(date: string, days: number): string {
  const t = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(t)) return date;
  return new Date(t + days * 86_400_000).toISOString().slice(0, 10);
}

const FIELD_LABELS: Partial<Record<keyof ImportedDealFields, string>> = {
  stage: "ステージ",
  memo: "備考",
  referred_at: "紹介日",
  deal_kind: "商談種別",
  sales_phase: "セールスフェーズ",
  partnership_phase: "販売協力フェーズ",
  partnership_contracted_at: "契約締結日",
  visited_at: "商談実施日",
  contracted_at: "成約日",
  lost_at: "ロスト日",
  loss_reason: "失注理由",
  contract_note: "契約備考",
  ball: "対応",
  installed_at: "設置日",
  agency_paid_at: "代理店支払日",
  monthly_fee: "月額",
  construction_fee: "工事費",
  stock_amount: "ストック分",
};

export function buildImportPlan(
  text: string,
  ctx: {
    banks: Bank[];
    branches: Branch[];
    deals: Deal[];
    lines: DealProduct[];
    products: Product[];
    today: string;
    defaultPrimary?: string;
  }
): ImportPlan {
  const read = readSheetRows(parseTable(text), { defaultPrimary: ctx.defaultPrimary });
  const empty: ImportPlan = { items: [], newPrimaries: [], newSecondaries: [], unknownPlans: [], error: read.error };
  if (read.error) return empty;

  const bankOf = (name: string) => ctx.banks.find((b) => sameName(b.name, name)) ?? null;
  const device = ctx.products.find((p) => countUnitOf(p) === "device" && p.is_active) ??
    ctx.products.find((p) => countUnitOf(p) === "device");
  const planOf = (name: string) =>
    ctx.products.find((p) => sameName(p.name, name) && countUnitOf(p) === "contract") ?? null;

  const newPrimaries: string[] = [];
  const newSecondaries: { primary: string; name: string }[] = [];
  const unknownPlans: string[] = [];

  // 既存の案件の突き合わせ表
  const existing = new Map<string, Deal>();
  for (const d of ctx.deals) {
    const bank = d.bank_id ? ctx.banks.find((b) => b.id === d.bank_id) : null;
    const key = matchKey(d.company, bank ? bank.name.replace(/[\s　]/g, "") : "", d.referred_at ?? "");
    if (!existing.has(key)) existing.set(key, d);
  }
  const usedDeals = new Set<string>();

  const items: ImportItem[] = read.rows.map((row) => {
    // ---- マスタ ----
    if (row.primary) {
      const bank = bankOf(row.primary);
      if (!bank && !newPrimaries.some((n) => sameName(n, row.primary))) newPrimaries.push(row.primary);
      const secondary = row.secondary || "直接";
      const hasBranch =
        bank && ctx.branches.some((b) => b.bank_id === bank.id && sameName(b.name, secondary));
      if (
        !hasBranch &&
        !newSecondaries.some((s) => sameName(s.primary, row.primary) && sameName(s.name, secondary))
      ) {
        newSecondaries.push({ primary: row.primary, name: secondary });
      }
    }

    // ---- 案件の値 ----
    const phasePatch = row.salesPhase
      ? applySalesPhase({}, row.salesPhase, ctx.today)
      : row.kind === "partnership"
        ? { stage: "partnership" as const, confidence_rank: "", probability: 0 }
        : { stage: "appointment" as const, confidence_rank: "", probability: 10 };
    const phase = salesPhaseByKey(row.salesPhase);
    const base = row.visitedAt || row.referredAt || ctx.today;
    const closedPhase = phase?.stage === "won" || phase?.stage === "lost";
    const fields: ImportedDealFields = {
      name: row.company,
      company: row.company,
      stage: phasePatch.stage!,
      probability: phasePatch.probability ?? 0,
      confidence_rank: phasePatch.confidence_rank ?? "",
      fulfillment_status: phase?.fulfillment ?? "",
      // 成約・ロストで日付が空の行は、商談実施日（無ければ紹介日）を完了予定日にする
      // （月次の成約数・ロスト数は、日付が無いとき完了予定日の月で数えるため）
      expected_close: row.contractedAt || row.lostAt || (closedPhase ? base : addDays(base, 30)),
      memo: row.memo,
      referred_at: row.referredAt,
      deal_kind: row.kind,
      sales_phase: row.salesPhase,
      partnership_phase: row.partnershipPhase,
      partnership_contracted_at: row.partnershipContractedAt,
      visited_at: row.visitedAt,
      contracted_at: row.contractedAt,
      lost_at: row.lostAt,
      loss_reason: row.lossReason,
      contract_note: row.contractNote,
      ball: row.ball,
      installed_at: row.installedAt,
      agency_paid_at: row.agencyPaidAt,
      monthly_fee: row.monthlyFee,
      construction_fee: row.constructionFee,
      stock_amount: row.stock,
    };
    // 成約・ロストなのに日付が無いときは、今日を入れない（シートに合わせて空のまま）
    if (phase?.stage === "won" && !row.contractedAt) {
      fields.contracted_at = "";
      row.warnings.push("成約していますが成約日が空です。月次の成約数は商談実施日（無ければ紹介日）の月で数えます");
    }
    if (phase?.stage === "lost" && !row.lostAt) {
      fields.lost_at = "";
      row.warnings.push("ロストですがロスト日が空です。月次のロスト数は商談実施日（無ければ紹介日）の月で数えます");
    }

    // ---- 明細 ----
    const lines: ImportedLine[] = [];
    if (row.plan) {
      const p = planOf(row.plan);
      if (!p) {
        if (!unknownPlans.some((n) => sameName(n, row.plan))) unknownPlans.push(row.plan);
        row.warnings.push(`プラン「${row.plan}」が商材マスタにありません`);
      } else {
        lines.push({ product_id: p.id, product_name: p.name, quantity: row.planQty, ...lineMoney(p, row.planQty) });
      }
    }
    if (row.devices > 0) {
      if (!device) {
        row.warnings.push("機器台数がありますが、商材マスタに機器（数え方＝機器台数）がありません");
      } else {
        lines.push({
          product_id: device.id,
          product_name: device.name,
          quantity: row.devices,
          ...lineMoney(device, row.devices),
        });
      }
    }

    // ---- 既存との突き合わせ ----
    const key = matchKey(row.company, row.primary.replace(/[\s　]/g, ""), row.referredAt);
    const hit = existing.get(key);
    if (!hit || usedDeals.has(hit.id)) {
      return { row, dealId: null, status: "new" as const, fields, lines, changes: [] };
    }
    usedDeals.add(hit.id);
    const changes: string[] = [];
    for (const [k, label] of Object.entries(FIELD_LABELS) as [keyof ImportedDealFields, string][]) {
      const before = (hit[k] ?? (typeof fields[k] === "number" ? 0 : "")) as unknown;
      if (before !== fields[k]) changes.push(label);
    }
    const ownLines = ctx.lines.filter((l) => l.deal_id === hit.id);
    const sig = (ls: { product_id: string; quantity: number }[]) =>
      ls
        .map((l) => `${l.product_id}×${l.quantity}`)
        .sort()
        .join(",");
    if (sig(ownLines) !== sig(lines)) changes.push("プラン・機器台数");
    return {
      row,
      dealId: hit.id,
      status: changes.length > 0 ? ("update" as const) : ("same" as const),
      fields,
      lines,
      changes,
    };
  });

  return { items, newPrimaries, newSecondaries, unknownPlans, error: null };
}
