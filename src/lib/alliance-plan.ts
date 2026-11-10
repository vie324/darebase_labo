// =============================================================
// アライアンス事業計画 — 月次の目標（UI非依存・テスト付き）
//
// 正は『アライアンス事業計画※確定版』の『前提条件』シート。ここを変えると
// 『代理店獲得計画』『月次計画』『期間サマリー』『月次目標生成』がすべて動く、
// というシートの作りをそのまま関数にしている。
//
//   紹介総数（シナリオ別・月別。第2版準拠の入力値）
//     → 成約数   = ROUNDUP（紹介総数 × 月別成約率）
//     → 売上     = 成約数 × 平均プラン（プラン20）の売上
//     → 自社利益 = 成約数 × 平均プランの自社利益
//     → ★代理店報酬（KGI）= 成約数 ×（売上 − 自社利益）
//   新規獲得数（月別の入力値）→ 累計代理店数
//     → 1社あたり紹介数（切上げ目安）= ROUNDUP（紹介総数 ÷ 累計代理店数）
//
// 数はすべて整数（切り上げ）。成約率は % を 0.01 単位の整数にしてから掛けるので、
// 浮動小数の誤差で 1 件ずれることはない。
//
// 保存先は app_settings の key = 'alliance_plan'（0016 で本部のみ参照可）。
// 未保存のあいだは確定版の値（DEFAULT_ALLIANCE_PLAN）を使う。
//
// 【ランタイム依存なし】node の型ストリップでテストできるよう、値の import を持たない。
// =============================================================

export const ALLIANCE_PLAN_KEY = "alliance_plan";

export type Scenario = "conservative" | "standard" | "aggressive";

export const SCENARIOS: Record<Scenario, { label: string }> = {
  conservative: { label: "保守" },
  standard: { label: "標準" },
  aggressive: { label: "積極" },
};

export const SCENARIO_KEYS: Scenario[] = ["conservative", "standard", "aggressive"];

export interface AlliancePlanSettings {
  /** 計画開始月 YYYY-MM */
  startMonth: string;
  /** 計画期間（月数） */
  months: number;
  /** 選択中のシナリオ */
  scenario: Scenario;
  /** シナリオ別の月次紹介総数（第2版準拠） */
  referrals: Record<Scenario, number[]>;
  /** 月別の成約率（%。小数第2位まで） */
  closeRates: number[];
  /** 月別の新規獲得代理店数 */
  newAgencies: number[];
  /** 平均プランの名前（全成約をこのプランで計上する） */
  planName: string;
  /** 平均プランの売上/件（円） */
  unitSales: number;
  /** 平均プランの自社利益/件（円）。代理店報酬/件 = 売上 − 自社利益 */
  unitProfit: number;
  /** 月次目標文の商材名（例: DDHBOX） */
  productLabel: string;
  /** 目指すべき数字（参考。計算には使わない） */
  longTermGoal: string;
}

/** 『アライアンス事業計画※確定版』の値（2026年9月〜2027年4月・標準シナリオ） */
export const DEFAULT_ALLIANCE_PLAN: AlliancePlanSettings = {
  startMonth: "2026-09",
  months: 8,
  scenario: "standard",
  referrals: {
    conservative: [10, 30, 46, 60, 68, 88, 96, 120],
    standard: [10, 25, 35, 50, 90, 115, 130, 150],
    aggressive: [13, 38, 58, 75, 85, 110, 120, 150],
  },
  closeRates: [10, 20, 23, 27, 30, 33, 35, 35],
  newAgencies: [2, 2, 2, 1, 1, 1, 1, 0],
  planName: "プラン20",
  unitSales: 1_012_800,
  unitProfit: 312_800,
  productLabel: "DDHBOX",
  longTermGoal: "2次代理店 500社（数年後の目安。計画値には含めない）",
};

// ---------- 読み込み（壊れた値・足りない月を既定値で埋める） ----------

function isMonth(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

function nonNegative(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
}

/** 長さ n の配列にそろえる。足りない月は 0、壊れた値は既定値（無ければ 0） */
function numbers(raw: unknown, n: number, fallback: number[], integer: boolean): number[] {
  const src = Array.isArray(raw) ? raw : fallback;
  return Array.from({ length: n }, (_, i) => {
    const v = nonNegative(src[i]) ?? nonNegative(fallback[i]) ?? 0;
    return integer ? Math.round(v) : Math.round(v * 100) / 100;
  });
}

export function coercePlan(input: Record<string, unknown> | undefined): AlliancePlanSettings {
  const d = DEFAULT_ALLIANCE_PLAN;
  // 未保存でも配列は作り直す（呼び出し側が書き換えても既定値を汚さない）
  const raw = input ?? {};
  const months = Math.min(24, Math.max(1, Math.round(nonNegative(raw.months) ?? d.months)));
  const scenario = SCENARIO_KEYS.includes(raw.scenario as Scenario)
    ? (raw.scenario as Scenario)
    : d.scenario;
  const rawRefs = (raw.referrals ?? {}) as Record<string, unknown>;
  const referrals = Object.fromEntries(
    SCENARIO_KEYS.map((s) => [s, numbers(rawRefs[s], months, d.referrals[s], true)])
  ) as Record<Scenario, number[]>;
  const str = (v: unknown, fallback: string) => (typeof v === "string" ? v : fallback);
  return {
    startMonth: isMonth(raw.startMonth) ? raw.startMonth : d.startMonth,
    months,
    scenario,
    referrals,
    closeRates: numbers(raw.closeRates, months, d.closeRates, false).map((v) => Math.min(100, v)),
    newAgencies: numbers(raw.newAgencies, months, d.newAgencies, true),
    planName: str(raw.planName, d.planName),
    unitSales: Math.round(nonNegative(raw.unitSales) ?? d.unitSales),
    unitProfit: Math.round(nonNegative(raw.unitProfit) ?? d.unitProfit),
    productLabel: str(raw.productLabel, d.productLabel),
    longTermGoal: str(raw.longTermGoal, d.longTermGoal),
  };
}

// ---------- 月の並び ----------

/** "2026-09" から n ヶ月ぶん（"2026-09", "2026-10", …） */
export function monthRange(start: string, n: number): string[] {
  const [y, m] = start.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const idx = y * 12 + (m - 1) + i;
    return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
  });
}

export function planMonths(plan: AlliancePlanSettings): string[] {
  return monthRange(plan.startMonth, plan.months);
}

// ---------- 計算 ----------

/** 紹介 × 成約率（%）の切り上げ。% は 0.01 単位の整数にしてから掛ける */
export function closingsOf(referrals: number, ratePercent: number): number {
  const bp = Math.round(ratePercent * 100); // 23% → 2300
  return Math.ceil((referrals * bp) / 10_000);
}

/** 割り算の切り上げ（0 で割るときは 0） */
export function ceilDiv(a: number, b: number): number {
  return b > 0 ? Math.ceil(a / b) : 0;
}

export interface PlanMonth {
  month: string;
  newAgencies: number;
  /** 累計代理店数（＝稼働社数。全社が期末まで継続稼働する前提） */
  cumAgencies: number;
  referrals: number;
  /** 1社あたり紹介数（切上げ目安） */
  perAgencyReferrals: number;
  /** 成約率の設定値（%） */
  closeRate: number;
  closings: number;
  sales: number;
  profit: number;
  /** ★代理店報酬（KGI） */
  fee: number;
  cumFee: number;
  /** 1社あたり報酬（月額平均） */
  perAgencyFee: number;
}

export function unitFee(plan: Pick<AlliancePlanSettings, "unitSales" | "unitProfit">): number {
  return Math.max(0, plan.unitSales - plan.unitProfit);
}

/** 月次計画（『月次計画』シートの各行） */
export function buildPlan(plan: AlliancePlanSettings, scenario: Scenario = plan.scenario): PlanMonth[] {
  const months = planMonths(plan);
  const refs = plan.referrals[scenario];
  const fee1 = unitFee(plan);
  let cum = 0;
  let cumFee = 0;
  return months.map((month, i) => {
    cum += plan.newAgencies[i] ?? 0;
    const referrals = refs[i] ?? 0;
    const closeRate = plan.closeRates[i] ?? 0;
    const closings = closingsOf(referrals, closeRate);
    const fee = closings * fee1;
    cumFee += fee;
    return {
      month,
      newAgencies: plan.newAgencies[i] ?? 0,
      cumAgencies: cum,
      referrals,
      perAgencyReferrals: ceilDiv(referrals, cum),
      closeRate,
      closings,
      sales: closings * plan.unitSales,
      profit: closings * plan.unitProfit,
      fee,
      cumFee,
      perAgencyFee: cum > 0 ? Math.round(fee / cum) : 0,
    };
  });
}

export interface PlanTotals {
  newAgencies: number;
  /** 期末の累計代理店数 */
  endAgencies: number;
  /** 延べ稼働社月数（各月の累計代理店数の合計） */
  agencyMonths: number;
  referrals: number;
  /** 1社あたり紹介数（期間平均・切上げ）＝紹介総数 ÷ 延べ稼働社月数 */
  perAgencyReferrals: number;
  closings: number;
  /** 成約率（実際の比率 %。小数第1位） */
  closeRate: number;
  sales: number;
  profit: number;
  fee: number;
  /** 稼働1社あたり月間報酬 ＝ 報酬総額 ÷ 延べ稼働社月数 */
  perAgencyFee: number;
}

export function planTotals(rows: PlanMonth[]): PlanTotals {
  const sum = (f: (r: PlanMonth) => number) => rows.reduce((s, r) => s + f(r), 0);
  const agencyMonths = sum((r) => r.cumAgencies);
  const referrals = sum((r) => r.referrals);
  const closings = sum((r) => r.closings);
  const fee = sum((r) => r.fee);
  return {
    newAgencies: sum((r) => r.newAgencies),
    endAgencies: rows.at(-1)?.cumAgencies ?? 0,
    agencyMonths,
    referrals,
    perAgencyReferrals: ceilDiv(referrals, agencyMonths),
    closings,
    closeRate: referrals > 0 ? Math.round((closings / referrals) * 1000) / 10 : 0,
    sales: sum((r) => r.sales),
    profit: sum((r) => r.profit),
    fee,
    perAgencyFee: agencyMonths > 0 ? Math.round(fee / agencyMonths) : 0,
  };
}

/** 前半・後半・期間合計（『期間サマリー』）。前半は ceil(n/2) ヶ月 */
export function planHalves(rows: PlanMonth[]): { label: string; rows: PlanMonth[] }[] {
  const mid = Math.ceil(rows.length / 2);
  return [
    { label: `前半（1〜${mid}ヶ月目）`, rows: rows.slice(0, mid) },
    { label: `後半（${mid + 1}〜${rows.length}ヶ月目）`, rows: rows.slice(mid) },
    { label: `期間合計（${rows.length}ヶ月）`, rows },
  ];
}

// ---------- 月次目標文（『月次目標生成』シート） ----------

/** 6,300,000 → "630万円"。1万円未満の端数は小数で残す */
export function manYen(yen: number): string {
  const man = Math.round(yen / 1000) / 10;
  return `${man.toLocaleString("ja-JP", { maximumFractionDigits: 1 })}万円`;
}

export function yen(n: number): string {
  return `${n.toLocaleString("ja-JP")}円`;
}

/** その月の予算（目標）を、そのまま共有できる文にする */
export function budgetText(plan: AlliancePlanSettings, month: string): string | null {
  const row = buildPlan(plan).find((r) => r.month === month);
  if (!row) return null;
  const [y, m] = month.split("-");
  const label = plan.productLabel || "DDS";
  return [
    `【アライアンス事業　${y}年${Number(m)}月度予算】 概算※修整可能性あり`,
    "",
    "【KGI】",
    `パートナー還元：${manYen(row.fee)}`,
    "",
    "【KPI】",
    `-${label}販売-`,
    `紹介獲得総数：${row.referrals}社`,
    `${label}契約社数：${row.closings}社`,
    `売上：${yen(row.sales)}`,
    `自社利益：${yen(row.profit)}`,
    "",
    "-代理店開拓-",
    `新規代理店契約：${row.newAgencies}社`,
  ].join("\n");
}
