// =============================================================
// アライアンス営業 — 案件管理表の項目と、お金の計算（UI非依存・テスト付き）
//
// ★案件管理表★『全体管理』の1行＝システムの案件1件。シートのプルダウンの値を
// ここに1箇所で持ち、画面・取込・集計はすべてここを参照する。
//
// ■ 商談種別
//   セールス / 販売協力 / セールス兼販売協力。1件の紹介に「売る」と「代理店になってもらう」の
//   2本の線があり、それぞれにフェーズがある（セールスフェーズ / 販売協力フェーズ）。
//
// ■ セールスフェーズ と 既存のステージの関係
//   シートのセールスフェーズは1列19値の直線。システムの案件は
//   stage（1階）× confidence_rank（後追い C/B/A）× fulfillment_status（2階）の3つで表す。
//   アライアンスの案件は sales_phase を正とし、残りの3つはそこから決める（applySalesPhase）。
//   カンバンでカードを動かしたときは逆向きに、列に合うフェーズへ寄せる（phaseForColumn）。
//
// ■ お金
//   商材（プラン・機器）ごとに 売上・自社利益・代理店報酬 の単価を持つ（商材マスタ）。
//   案件の明細は 単価 × 数量 を控える。KGI は 代理店報酬（1次代理店に支払う額）の合計。
//   直販（1次代理店なし）は代理店に支払わないので、報酬ぶんがそのまま自社利益になる
//   （シート『シートの餌』の「直販案件用：売上=利益で入力すれば支払額はゼロ」と同じ結果）。
//
// 【ランタイム依存なし】node の型ストリップでテストできるよう、値の import を持たない。
// =============================================================

import type { Deal, DealProduct, DealStage, Product } from "./types";

// ---------- 商談種別 ----------

export type DealKind = "sales" | "partnership" | "sales_partnership";

export const DEAL_KINDS: Record<DealKind, { label: string; short: string; color: string }> = {
  sales: {
    label: "セールス",
    short: "セールス",
    color: "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300",
  },
  sales_partnership: {
    label: "セールス兼販売協力",
    short: "兼販売協力",
    color: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  },
  partnership: {
    label: "販売協力",
    short: "販売協力",
    color: "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
  },
};

/** シートの並び順（日報・月次集計の列順） */
export const DEAL_KIND_KEYS: DealKind[] = ["sales", "sales_partnership", "partnership"];

/**
 * 案件の商談種別。未設定の案件は stage から推定する
 * （0016 以前に「販売協力」ステージにした案件は販売協力、それ以外はセールス）。
 */
export function kindOf(deal: Pick<Deal, "stage"> & { deal_kind?: string }): DealKind {
  const k = deal.deal_kind;
  if (k === "sales" || k === "partnership" || k === "sales_partnership") return k;
  return deal.stage === "partnership" ? "partnership" : "sales";
}

/** セールスの線があるか（販売協力だけの紹介は売らない） */
export function hasSalesTrack(kind: DealKind): boolean {
  return kind !== "partnership";
}

/** 販売協力の線があるか */
export function hasPartnershipTrack(kind: DealKind): boolean {
  return kind !== "sales";
}

// ---------- セールスフェーズ ----------

export interface SalesPhase {
  key: string;
  label: string;
  /** 画面のまとまり（プルダウンの見出し） */
  group: "before" | "after" | "won" | "lost";
  stage: DealStage;
  /** 後追い（follow_up）のときの確度ランク */
  rank?: "A" | "B" | "C";
  /** 受注後（won）のときの受注後フェーズ（constants.ts の FULFILLMENT_STAGES のキー） */
  fulfillment?: string;
  color: string;
}

const C_SKY = "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300";
const C_INDIGO = "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300";
const C_SLATE = "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300";
const C_AMBER = "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
const C_ORANGE = "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300";
const C_EMERALD = "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
const C_ROSE = "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300";
const C_TEAL = "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300";

/**
 * セールスフェーズ。★案件管理表★『全体管理』G列のプルダウンと同じ値・同じ並び
 * （シートの「‐」は「セールスなし」＝販売協力だけの紹介なので、値としては持たない）。
 */
export const SALES_PHASES: SalesPhase[] = [
  { key: "scheduling", label: "日程調整中", group: "before", stage: "appointment", color: C_SKY },
  { key: "waiting", label: "商談待ち", group: "before", stage: "appointment", color: C_SKY },
  { key: "met", label: "商談済み", group: "after", stage: "follow_up", color: C_INDIGO },
  { key: "todo", label: "対応事項あり", group: "after", stage: "follow_up", color: C_INDIGO },
  { key: "quote_sent", label: "見積り書等送付済み", group: "after", stage: "follow_up", color: C_INDIGO },
  { key: "prospect_c", label: "見込みC", group: "after", stage: "follow_up", rank: "C", color: C_AMBER },
  { key: "prospect_b", label: "見込みB", group: "after", stage: "follow_up", rank: "B", color: C_ORANGE },
  { key: "prospect_a", label: "見込みA", group: "after", stage: "follow_up", rank: "A", color: C_ROSE },
  { key: "won", label: "成約", group: "won", stage: "won", fulfillment: "contract", color: C_EMERALD },
  { key: "signback", label: "サインバック回収", group: "won", stage: "won", fulfillment: "contract", color: C_EMERALD },
  { key: "lease_url", label: "リースURL連携済み", group: "won", stage: "won", fulfillment: "lease_apply", color: C_EMERALD },
  { key: "lease_done", label: "リース契約済み", group: "won", stage: "won", fulfillment: "lease_done", color: C_EMERALD },
  { key: "install_adjust", label: "設置調整中", group: "won", stage: "won", fulfillment: "install_schedule", color: C_TEAL },
  { key: "installed", label: "設置済み", group: "won", stage: "won", fulfillment: "install_done", color: C_TEAL },
  { key: "payment_wait", label: "入金待ち", group: "won", stage: "won", fulfillment: "accepted", color: C_TEAL },
  { key: "paid_in", label: "入金済み", group: "won", stage: "won", fulfillment: "accepted", color: C_TEAL },
  { key: "agency_paid", label: "支払い済み", group: "won", stage: "won", fulfillment: "accepted", color: C_TEAL },
  { key: "lost", label: "ロスト", group: "lost", stage: "lost", color: C_SLATE },
];

export const SALES_PHASE_GROUPS: { key: SalesPhase["group"]; label: string }[] = [
  { key: "before", label: "商談前" },
  { key: "after", label: "商談後" },
  { key: "won", label: "成約後" },
  { key: "lost", label: "ロスト" },
];

export function salesPhaseByKey(key: string | undefined): SalesPhase | undefined {
  return key ? SALES_PHASES.find((p) => p.key === key) : undefined;
}

/**
 * 案件のセールスフェーズ。sales_phase が入っていればそれ、
 * 無ければ（0016 以前の案件・銀行営業と同じ操作をした案件）ステージから推定する。
 * 販売協力だけの案件と「発注書待ち」はシートに対応するフェーズが無いので null。
 */
export function salesPhaseOf(
  deal: Pick<Deal, "stage"> & Partial<Pick<Deal, "confidence_rank">> & { sales_phase?: string }
): SalesPhase | null {
  const own = salesPhaseByKey(deal.sales_phase);
  if (own) return own;
  switch (deal.stage) {
    case "appointment":
      return salesPhaseByKey("waiting") ?? null;
    case "follow_up": {
      const r = deal.confidence_rank;
      if (r === "A" || r === "B" || r === "C") return salesPhaseByKey(`prospect_${r.toLowerCase()}`) ?? null;
      return salesPhaseByKey("met") ?? null;
    }
    case "won":
      return salesPhaseByKey("won") ?? null;
    case "lost":
      return salesPhaseByKey("lost") ?? null;
    default:
      return null;
  }
}

/** 確度(%)の目安。カンバンの列の既定値（constants.ts の PIPELINE_COLUMNS）と揃える */
const PROBABILITY_OF: Record<string, number> = {
  appointment: 10,
  follow_up: 15,
  follow_up_C: 15,
  follow_up_B: 40,
  follow_up_A: 70,
  won: 100,
  lost: 0,
};

/**
 * セールスフェーズを変えたときに保存するパッチ。
 * stage / confidence_rank / 確度(%) / 受注後フェーズ を揃え、
 * 成約日・ロスト日が空なら当日を入れる（月次の成約数はこの日で数えるため）。
 */
export function applySalesPhase(
  deal: Partial<Pick<Deal, "stage" | "fulfillment_status" | "contracted_at" | "lost_at">>,
  phaseKey: string,
  today: string
): Partial<Deal> {
  const phase = salesPhaseByKey(phaseKey);
  if (!phase) return { sales_phase: "" };
  const patch: Partial<Deal> = {
    sales_phase: phase.key,
    stage: phase.stage,
    confidence_rank: phase.rank ?? "",
  };
  const probKey = phase.stage === "follow_up" && phase.rank ? `follow_up_${phase.rank}` : phase.stage;
  patch.probability = PROBABILITY_OF[probKey] ?? 0;
  if (phase.fulfillment) {
    if (deal.fulfillment_status !== phase.fulfillment) {
      patch.fulfillment_status = phase.fulfillment;
      patch.fulfillment_updated_at = today;
    }
    if (!deal.contracted_at) patch.contracted_at = today;
  }
  if (phase.stage === "lost" && !deal.lost_at) patch.lost_at = today;
  return patch;
}

/**
 * カンバン（1階）の列に動かしたときのセールスフェーズ。
 * いまのフェーズがその列のものならそのまま、違えば列の代表のフェーズにする。
 * 対応するフェーズが無い列（発注書待ち・販売協力）は ""。
 */
export function phaseForColumn(columnKey: string, current: string | undefined): string {
  const now = salesPhaseByKey(current);
  const fits = (p: SalesPhase) => {
    if (columnKey === "appointment") return p.stage === "appointment";
    if (columnKey === "follow_up_c") return p.stage === "follow_up" && (p.rank ?? "C") === "C";
    if (columnKey === "follow_up_b") return p.stage === "follow_up" && p.rank === "B";
    if (columnKey === "follow_up_a") return p.stage === "follow_up" && p.rank === "A";
    if (columnKey === "won") return p.stage === "won";
    if (columnKey === "lost") return p.stage === "lost";
    return false;
  };
  if (now && fits(now)) return now.key;
  const DEFAULT: Record<string, string> = {
    appointment: "waiting",
    follow_up_c: "prospect_c",
    follow_up_b: "prospect_b",
    follow_up_a: "prospect_a",
    won: "won",
    lost: "lost",
  };
  return DEFAULT[columnKey] ?? "";
}

/**
 * 受注後カンバン（2階）の列に動かしたときのセールスフェーズ。
 * 列（FULFILLMENT_GROUPS）に入る成約後フェーズのうち、いまのものを優先し、無ければ先頭。
 */
export function phaseForFulfillmentGroup(
  groupStages: readonly string[],
  current: string | undefined
): string {
  const won = SALES_PHASES.filter((p) => p.group === "won" && p.fulfillment);
  const now = salesPhaseByKey(current);
  if (now?.fulfillment && groupStages.includes(now.fulfillment)) return now.key;
  return won.find((p) => groupStages.includes(p.fulfillment!))?.key ?? "";
}

/** 成約後フェーズ（受注後カンバンのカードで選ぶもの） */
export const WON_PHASES: SalesPhase[] = SALES_PHASES.filter((p) => p.group === "won");

// ---------- 販売協力フェーズ ----------

export interface PartnershipPhase {
  key: string;
  label: string;
  /** 代理店契約を結んだ（＝新規獲得）以降か */
  contracted: boolean;
  color: string;
}

/** 販売協力フェーズ。★案件管理表★『全体管理』J列のプルダウンと同じ値・同じ並び */
export const PARTNERSHIP_PHASES: PartnershipPhase[] = [
  { key: "scheduling", label: "日程調整中", contracted: false, color: C_SKY },
  { key: "waiting", label: "商談待ち", contracted: false, color: C_SKY },
  { key: "met", label: "商談済み", contracted: false, color: C_INDIGO },
  { key: "todo", label: "対応事項あり", contracted: false, color: C_INDIGO },
  { key: "group_created", label: "グループ作成済み", contracted: false, color: C_AMBER },
  { key: "contracting", label: "契約対応中", contracted: false, color: C_ORANGE },
  { key: "contracted", label: "契約締結", contracted: true, color: C_EMERALD },
  { key: "first_referral", label: "初回紹介済み", contracted: true, color: C_TEAL },
  { key: "first_won", label: "成約獲得", contracted: true, color: C_TEAL },
];

export function partnershipPhaseByKey(key: string | undefined): PartnershipPhase | undefined {
  return key ? PARTNERSHIP_PHASES.find((p) => p.key === key) : undefined;
}

/** 販売協力で代理店契約を結んだ（契約締結・初回紹介済み・成約獲得）か */
export function isAgencyContracted(deal: { partnership_phase?: string }): boolean {
  return partnershipPhaseByKey(deal.partnership_phase)?.contracted ?? false;
}

// ---------- 対応（ボール） ----------

export const BALLS: Record<string, { label: string; color: string }> = {
  ours: { label: "弊社ボール", color: C_ROSE },
  alliance: { label: "アライアンスボール", color: C_AMBER },
  client: { label: "クライアントボール", color: C_SKY },
};

export const BALL_KEYS = Object.keys(BALLS);

// ---------- お金（売上・自社利益・代理店報酬） ----------

/**
 * 件数の数え方。
 *   contract … 契約数（プラン。プラン別の実績件数・DDHBOX契約社数に入る）
 *   device   … 機器台数（契約数とは別に台数で数える）
 *   none     … 件数に数えない（AI などのクロスセル。金額だけ集計に入る）
 */
export type CountUnit = "contract" | "device" | "none";

export const COUNT_UNITS: Record<CountUnit, string> = {
  contract: "契約数（プランなど）",
  device: "機器台数（契約数とは別に数える）",
  none: "件数に数えない（クロスセルなど。金額だけ集計）",
};

export function countUnitOf(product: Pick<Product, "count_unit"> | undefined): CountUnit {
  const u = product?.count_unit;
  return u === "device" || u === "none" ? u : "contract";
}

/** 明細1行のお金。単価 × 数量（マスタの値を控える） */
export interface LineMoney {
  amount: number;
  profit: number;
  agency_fee: number;
}

export function lineMoney(
  product: Pick<Product, "unit_price" | "unit_profit" | "agency_fee">,
  quantity: number
): LineMoney {
  const q = Math.max(0, Math.round(quantity));
  return {
    amount: product.unit_price * q,
    profit: (product.unit_profit ?? 0) * q,
    agency_fee: (product.agency_fee ?? 0) * q,
  };
}

export interface DealEconomics {
  /** 売上（顧客への請求額） */
  sales: number;
  /** 自社利益（自社取り分）。直販は代理店報酬ぶんを含む */
  profit: number;
  /** 代理店報酬（1次代理店に支払う額＝KGI）。直販は 0 */
  fee: number;
  /** 機器台数（契約数とは別に数える） */
  devices: number;
  /** 契約数（プランの数量の合計） */
  contracts: number;
  /** 載っているプラン名（機器を除く） */
  plans: string[];
  /** プラン名ごとの数量（プラン別の実績件数に使う） */
  planQty: Record<string, number>;
  /** 1次代理店を通さない直販か */
  direct: boolean;
}

/**
 * 案件のお金。明細があれば明細の合計、無ければ案件に入っている金額を使う。
 * 直販（1次代理店なし）は代理店報酬を 0 にし、そのぶんを自社利益に寄せる。
 */
export function dealEconomics(
  deal: Pick<Deal, "id" | "amount" | "stage"> &
    Partial<Pick<Deal, "bank_id" | "contract_amount" | "gross_profit" | "agency_fee">>,
  lines: DealProduct[],
  products: ReadonlyMap<string, Product>
): DealEconomics {
  const own = lines.filter((l) => l.deal_id === deal.id);
  const direct = !deal.bank_id;
  let sales = 0;
  let profit = 0;
  let fee = 0;
  let devices = 0;
  let contracts = 0;
  const plans: string[] = [];
  const planQty: Record<string, number> = {};
  if (own.length === 0) {
    sales = (deal.stage === "won" ? deal.contract_amount : 0) || deal.amount;
    profit = deal.gross_profit ?? 0;
    fee = deal.agency_fee ?? 0;
  } else {
    for (const l of own) {
      sales += l.amount;
      profit += l.profit ?? 0;
      fee += l.agency_fee ?? 0;
      const unit = countUnitOf(products.get(l.product_id));
      if (unit === "device") {
        devices += l.quantity;
      } else if (unit === "contract") {
        contracts += l.quantity;
        if (!plans.includes(l.product_name)) plans.push(l.product_name);
        planQty[l.product_name] = (planQty[l.product_name] ?? 0) + l.quantity;
      }
    }
  }
  if (direct) {
    profit += fee;
    fee = 0;
  }
  return { sales, profit, fee, devices, contracts, plans, planQty, direct };
}

/**
 * 明細から案件に控えておく金額（amount / gross_profit / agency_fee）。
 * 案件一覧・CSV・受注後カンバンは案件の列を読むので、明細を変えるたびに揃える。
 * 明細が無いときは null（案件に手で入れた金額を消さない）。
 */
export function dealMoneyPatch(
  deal: Pick<Deal, "id" | "amount" | "stage"> & Partial<Pick<Deal, "bank_id">>,
  lines: DealProduct[],
  products: ReadonlyMap<string, Product>
): Pick<Deal, "amount" | "gross_profit" | "agency_fee" | "contract_amount"> | null {
  if (!lines.some((l) => l.deal_id === deal.id)) return null;
  const e = dealEconomics(deal, lines, products);
  return {
    amount: e.sales,
    gross_profit: e.profit,
    agency_fee: e.fee,
    contract_amount: deal.stage === "won" ? e.sales : 0,
  };
}

// ---------- 日付 ----------

/** ISO（UTC）→ 日本時間の YYYY-MM-DD。"" や壊れた値は "" */
export function jstDate(iso: string | undefined | null): string {
  if (!iso) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t + 9 * 3_600_000).toISOString().slice(0, 10);
}

/** "2026-09-01" → "2026-09" */
export function monthOf(date: string): string {
  return /^\d{4}-\d{2}/.test(date) ? date.slice(0, 7) : "";
}

/** "2026-09" → "2026年9月" */
export function monthLabel(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  return m ? `${m[1]}年${Number(m[2])}月` : month;
}

/**
 * 紹介日。案件に入っていればそれ、無ければ紹介アポの受付日、それも無ければ登録日（日本時間）。
 * 月次の「紹介数」はこの日で数える。
 */
export function referredOnOf(
  deal: Pick<Deal, "created_at"> & { referred_at?: string },
  appointmentReceivedAt?: string
): string {
  return deal.referred_at || appointmentReceivedAt || jstDate(deal.created_at);
}

/** 成約日。成約（受注）の案件だけ。未入力なら完了予定日で代用する */
export function wonOnOf(deal: Pick<Deal, "stage" | "expected_close"> & { contracted_at?: string }): string {
  if (deal.stage !== "won") return "";
  return deal.contracted_at || deal.expected_close || "";
}

/** ロスト日。失注の案件だけ。未入力なら完了予定日で代用する */
export function lostOnOf(deal: Pick<Deal, "stage" | "expected_close"> & { lost_at?: string }): string {
  if (deal.stage !== "lost") return "";
  return deal.lost_at || deal.expected_close || "";
}
