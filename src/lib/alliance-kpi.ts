// =============================================================
// アライアンスの数値管理 — 実績の集計（UI非依存・テスト付き）
//
// ★案件管理表★（日報生成・全体管理の集計列）と、事業計画※確定版の『月次実績』を、
// システムの案件から同じ定義で出す。
//
// ■ 数え方（シートの数式と同じ）
//   紹介数     … 紹介日がその期間に入る紹介（商談種別を問わない）
//   商談実施数 … 商談実施日がその期間に入る紹介（商談種別ごと）
//   成約数     … 成約日がその期間に入る成約（1案件＝1成約）
//   ロスト数   … ロスト日がその期間に入る失注
//   売上・自社利益・代理店報酬・機器台数 … その期間に成約した案件の合計
//   成約率     … 成約数 ÷ 紹介数
//
// ■ 代理店数（事業計画の ① 代理店開拓）
//   代理店 ＝ 1次代理店（報酬の支払先。KGI はこの合計）。
//   1次代理店から初めて紹介が来た月を「新規獲得」とし、その月末までに紹介が来ている
//   1次代理店の数を「累計代理店数（稼働社数）」とする。直販は数えない。
//   販売協力で代理店契約を結んだ数（契約締結日）は別の数字として並べて出す。
//
// ■ 紹介の単位
//   案件1件＝紹介1件。まだ案件にしていない紹介アポも1件として数える
//   （アポから案件化したものは案件の側で数え、二重に数えない）。
//
// 【ランタイム依存なし】値の import は alliance.ts / alliance-plan.ts（同じく依存なし）だけ。
// =============================================================

import {
  dealEconomics,
  isAgencyContracted,
  jstDate,
  kindOf,
  lostOnOf,
  monthOf,
  referredOnOf,
  salesPhaseOf,
  wonOnOf,
  DEAL_KIND_KEYS,
  type DealEconomics,
  type DealKind,
  type SalesPhase,
} from "./alliance.ts";
import type { PlanMonth } from "./alliance-plan.ts";
import type { Appointment, Bank, Deal, DealProduct, DealStage, Product } from "./types";

/** 直販（1次代理店なし）の行のキー */
export const DIRECT_KEY = "__direct__";
export const DIRECT_LABEL = "直販";

// ---------- 紹介の一覧（案件＋未案件化のアポ） ----------

export interface Referral {
  id: string;
  dealId: string | null;
  appointmentId: string | null;
  name: string;
  company: string;
  bankId: string | null;
  branchId: string | null;
  kind: DealKind;
  /** 紹介日 YYYY-MM-DD */
  referredOn: string;
  /** 商談実施日 YYYY-MM-DD（"" = 未実施） */
  metOn: string;
  /** 成約日（成約のみ） */
  wonOn: string;
  /** ロスト日（失注のみ） */
  lostOn: string;
  stage: DealStage;
  rank: string;
  salesPhase: SalesPhase | null;
  partnershipPhase: string;
  /** 代理店契約の締結日（販売協力で契約締結以降のとき） */
  partnershipContractedOn: string;
  ownerName: string;
  econ: DealEconomics;
}

const NO_MONEY: DealEconomics = {
  sales: 0,
  profit: 0,
  fee: 0,
  devices: 0,
  contracts: 0,
  plans: [],
  planQty: {},
  direct: true,
};

/** アポの結果から、商談を実施したか */
function appointmentMet(a: Appointment): boolean {
  return a.status === "done" || a.status === "won" || a.status === "lost";
}

const STAGE_OF_APPOINTMENT: Record<Appointment["status"], DealStage> = {
  scheduled: "appointment",
  done: "follow_up",
  won: "won",
  lost: "lost",
  cancelled: "lost",
};

export function buildReferrals(input: {
  deals: Deal[];
  lines: DealProduct[];
  products: Product[];
  appointments: Appointment[];
}): Referral[] {
  const products = new Map(input.products.map((p) => [p.id, p]));
  const apptById = new Map(input.appointments.map((a) => [a.id, a]));
  const dealIds = new Set(input.deals.map((d) => d.id));

  const fromDeals: Referral[] = input.deals.map((d) => {
    const appt = d.appointment_id ? apptById.get(d.appointment_id) : undefined;
    const kind = kindOf(d);
    const metFromAppt = appt && appointmentMet(appt) ? jstDate(appt.scheduled_at) : "";
    return {
      id: d.id,
      dealId: d.id,
      appointmentId: d.appointment_id ?? null,
      name: d.name,
      company: d.company,
      bankId: d.bank_id ?? null,
      branchId: d.branch_id ?? null,
      kind,
      referredOn: referredOnOf(d, appt?.received_at),
      metOn: d.visited_at || metFromAppt,
      wonOn: wonOnOf(d),
      lostOn: lostOnOf(d),
      stage: d.stage,
      rank: d.confidence_rank ?? "",
      salesPhase: salesPhaseOf(d),
      partnershipPhase: d.partnership_phase ?? "",
      partnershipContractedOn: isAgencyContracted(d)
        ? d.partnership_contracted_at || referredOnOf(d, appt?.received_at)
        : "",
      ownerName: d.owner_name,
      econ: dealEconomics(d, input.lines, products),
    };
  });

  // 案件にしていない紹介アポ（案件化したものは案件の側で数える）
  const fromAppointments: Referral[] = input.appointments
    .filter((a) => !a.deal_id || !dealIds.has(a.deal_id))
    .map((a) => ({
      id: `appt:${a.id}`,
      dealId: null,
      appointmentId: a.id,
      name: a.company_name,
      company: a.company_name,
      bankId: a.bank_id,
      branchId: a.branch_id,
      kind: "sales" as DealKind,
      referredOn: a.received_at || jstDate(a.created_at),
      metOn: appointmentMet(a) ? jstDate(a.scheduled_at) : "",
      wonOn: "",
      lostOn: "",
      stage: STAGE_OF_APPOINTMENT[a.status] ?? "appointment",
      rank: "",
      salesPhase: null,
      partnershipPhase: "",
      partnershipContractedOn: "",
      ownerName: a.assigned_name,
      econ: { ...NO_MONEY, direct: !a.bank_id },
    }));

  return [...fromDeals, ...fromAppointments];
}

// ---------- 期間の集計 ----------

export interface Tally {
  referrals: number;
  referralsByKind: Record<DealKind, number>;
  meetings: number;
  meetingsByKind: Record<DealKind, number>;
  /** セールスの商談（セールス＋セールス兼販売協力） */
  salesMeetings: number;
  closings: number;
  lost: number;
  sales: number;
  profit: number;
  fee: number;
  devices: number;
  contracts: number;
  /** 販売協力で代理店契約を結んだ数（契約締結日） */
  partnershipContracts: number;
}

function zeroKinds(): Record<DealKind, number> {
  return { sales: 0, partnership: 0, sales_partnership: 0 };
}

export function emptyTally(): Tally {
  return {
    referrals: 0,
    referralsByKind: zeroKinds(),
    meetings: 0,
    meetingsByKind: zeroKinds(),
    salesMeetings: 0,
    closings: 0,
    lost: 0,
    sales: 0,
    profit: 0,
    fee: 0,
    devices: 0,
    contracts: 0,
    partnershipContracts: 0,
  };
}

/** 日付が期間に入るか。"" は常に入らない */
export type DateFilter = (date: string) => boolean;

export const inMonth =
  (month: string): DateFilter =>
  (d) =>
    d !== "" && monthOf(d) === month;

export const onDay =
  (day: string): DateFilter =>
  (d) =>
    d !== "" && d === day;

export const between =
  (from: string, to: string): DateFilter =>
  (d) =>
    d !== "" && d >= from && d <= to;

export const anyDate: DateFilter = (d) => d !== "";

export function tally(referrals: Referral[], inRange: DateFilter): Tally {
  const t = emptyTally();
  for (const r of referrals) {
    if (inRange(r.referredOn)) {
      t.referrals += 1;
      t.referralsByKind[r.kind] += 1;
    }
    if (inRange(r.metOn)) {
      t.meetings += 1;
      t.meetingsByKind[r.kind] += 1;
      if (r.kind !== "partnership") t.salesMeetings += 1;
    }
    if (inRange(r.wonOn)) {
      t.closings += 1;
      t.sales += r.econ.sales;
      t.profit += r.econ.profit;
      t.fee += r.econ.fee;
      t.devices += r.econ.devices;
      t.contracts += r.econ.contracts;
    }
    if (inRange(r.lostOn)) t.lost += 1;
    if (inRange(r.partnershipContractedOn)) t.partnershipContracts += 1;
  }
  return t;
}

/** 成約率（%・小数第1位）。紹介が無ければ null */
export function closeRateOf(t: Pick<Tally, "closings" | "referrals">): number | null {
  return t.referrals > 0 ? Math.round((t.closings / t.referrals) * 1000) / 10 : null;
}

// ---------- 代理店数（① 代理店開拓） ----------

/** 1次代理店ごとの、初めて紹介が来た日（＝新規獲得の日）。直販は含めない */
export function agencyStarts(referrals: Referral[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const r of referrals) {
    if (!r.bankId || !r.referredOn) continue;
    const prev = out.get(r.bankId);
    if (!prev || r.referredOn < prev) out.set(r.bankId, r.referredOn);
  }
  return out;
}

export function newAgenciesIn(starts: Map<string, string>, month: string): number {
  let n = 0;
  for (const d of starts.values()) if (monthOf(d) === month) n += 1;
  return n;
}

/** その月末までに紹介が来ている1次代理店の数 */
export function cumAgenciesAt(starts: Map<string, string>, month: string): number {
  let n = 0;
  for (const d of starts.values()) if (monthOf(d) <= month) n += 1;
  return n;
}

// ---------- 計画対比（『月次実績』） ----------

export interface MonthResult {
  month: string;
  plan: PlanMonth;
  actual: Tally & {
    newAgencies: number;
    cumAgencies: number;
    /** 1社あたり紹介数（紹介数 ÷ 累計代理店数・小数第1位） */
    perAgencyReferrals: number | null;
    closeRate: number | null;
    /** 当月までの代理店報酬の累計 */
    cumFee: number;
  };
}

/** 達成率（%・小数第1位）。計画が 0 なら null */
export function achievement(actual: number, plan: number): number | null {
  return plan > 0 ? Math.round((actual / plan) * 1000) / 10 : null;
}

export function planVsActual(plan: PlanMonth[], referrals: Referral[]): MonthResult[] {
  const starts = agencyStarts(referrals);
  // 計画期間より前に成約したぶんも累計に入れる（期間の途中から使い始めた場合に備えて）
  let cumFee = plan.length
    ? tally(referrals, (d) => d !== "" && monthOf(d) < plan[0].month).fee
    : 0;
  return plan.map((p) => {
    const t = tally(referrals, inMonth(p.month));
    const cumAgencies = cumAgenciesAt(starts, p.month);
    cumFee += t.fee;
    return {
      month: p.month,
      plan: p,
      actual: {
        ...t,
        newAgencies: newAgenciesIn(starts, p.month),
        cumAgencies,
        perAgencyReferrals:
          cumAgencies > 0 ? Math.round((t.referrals / cumAgencies) * 10) / 10 : null,
        closeRate: closeRateOf(t),
        cumFee,
      },
    };
  });
}

// ---------- 1次代理店別（日報・月次集計・全期間累計） ----------

export interface AgencyRow {
  key: string;
  name: string;
  bankId: string | null;
  tally: Tally;
}

/**
 * 1次代理店ごとの集計。1次代理店マスタの並び（登録順）で全社を出し、最後に直販。
 * 紹介が1件も無い1次代理店も 0 の行として出す（シートと同じく「止まっている」ことが見えるように）。
 */
export function byAgency(
  referrals: Referral[],
  banks: Pick<Bank, "id" | "name" | "created_at">[],
  inRange: DateFilter
): AgencyRow[] {
  const ordered = [...banks].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const known = new Set(ordered.map((b) => b.id));
  const rows: AgencyRow[] = ordered.map((b) => ({
    key: b.id,
    name: b.name,
    bankId: b.id,
    tally: tally(
      referrals.filter((r) => r.bankId === b.id),
      inRange
    ),
  }));
  // マスタに無い紹介元（別の事業部に付け替えた・削除したなど）も数字から落とさない
  const strays = Array.from(
    new Set(referrals.map((r) => r.bankId).filter((id): id is string => !!id && !known.has(id)))
  );
  for (const id of strays) {
    rows.push({
      key: id,
      name: "（マスタに無い1次代理店）",
      bankId: id,
      tally: tally(
        referrals.filter((r) => r.bankId === id),
        inRange
      ),
    });
  }
  rows.push({
    key: DIRECT_KEY,
    name: DIRECT_LABEL,
    bankId: null,
    tally: tally(
      referrals.filter((r) => !r.bankId),
      inRange
    ),
  });
  return rows;
}

// ---------- 見込み分析（セールス見込み確度 A/B/C） ----------

export interface ProspectRow {
  key: string;
  name: string;
  A: number;
  B: number;
  C: number;
  count: number;
  sales: number;
  profit: number;
  fee: number;
  /** プランが未定の見込み件数（金額に入っていない） */
  noPlan: number;
}

/** 見込み（後追い中で確度 A/B/C が付いたもの）を1次代理店別に */
export function prospectsByAgency(
  referrals: Referral[],
  banks: Pick<Bank, "id" | "name" | "created_at">[]
): ProspectRow[] {
  const prospects = referrals.filter(
    (r) => r.stage === "follow_up" && (r.rank === "A" || r.rank === "B" || r.rank === "C")
  );
  const keyOf = (r: Referral) => r.bankId ?? DIRECT_KEY;
  const ordered = [...banks].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const rows: ProspectRow[] = [
    ...ordered.map((b) => ({ key: b.id, name: b.name })),
    { key: DIRECT_KEY, name: DIRECT_LABEL },
  ].map(({ key, name }) => ({
    key,
    name,
    A: 0,
    B: 0,
    C: 0,
    count: 0,
    sales: 0,
    profit: 0,
    fee: 0,
    noPlan: 0,
  }));
  const byKey = new Map(rows.map((r) => [r.key, r]));
  for (const p of prospects) {
    let row = byKey.get(keyOf(p));
    if (!row) {
      row = { key: keyOf(p), name: "（マスタに無い1次代理店）", A: 0, B: 0, C: 0, count: 0, sales: 0, profit: 0, fee: 0, noPlan: 0 };
      rows.splice(rows.length - 1, 0, row);
      byKey.set(row.key, row);
    }
    row[p.rank as "A" | "B" | "C"] += 1;
    row.count += 1;
    row.sales += p.econ.sales;
    row.profit += p.econ.profit;
    row.fee += p.econ.fee;
    if (p.econ.contracts === 0 && p.econ.sales === 0) row.noPlan += 1;
  }
  return rows;
}

// ---------- プラン別 実績件数 ----------

export interface PlanBreakdownRow {
  month: string;
  /** プラン名 → 契約数 */
  counts: Record<string, number>;
  devices: number;
  contracts: number;
  sales: number;
}

export function planBreakdown(referrals: Referral[], months: string[]): PlanBreakdownRow[] {
  return months.map((month) => {
    const inThis = referrals.filter((r) => monthOf(r.wonOn) === month);
    const counts: Record<string, number> = {};
    let devices = 0;
    let contracts = 0;
    let sales = 0;
    for (const r of inThis) {
      for (const [name, q] of Object.entries(r.econ.planQty)) counts[name] = (counts[name] ?? 0) + q;
      devices += r.econ.devices;
      contracts += r.econ.contracts;
      sales += r.econ.sales;
    }
    return { month, counts, devices, contracts, sales };
  });
}

// ---------- 成約明細 ----------

/** 成約した案件を成約日の順に（期間を指定すればその中だけ） */
export function closings(referrals: Referral[], inRange: DateFilter = anyDate): Referral[] {
  return referrals
    .filter((r) => r.wonOn !== "" && inRange(r.wonOn))
    .sort((a, b) => a.wonOn.localeCompare(b.wonOn) || a.company.localeCompare(b.company, "ja"));
}

// ---------- 販売協力（代理店開拓の進み具合） ----------

/**
 * 販売協力フェーズ別の件数（"" = 未設定）。
 * 販売協力の線がある紹介と、セールスでも販売協力フェーズが入っている紹介
 * （売ったうえで代理店にもなってもらった会社）を数える。
 */
export function partnershipFunnel(referrals: Referral[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of referrals) {
    if (r.kind === "sales" && !r.partnershipPhase) continue;
    out.set(r.partnershipPhase, (out.get(r.partnershipPhase) ?? 0) + 1);
  }
  return out;
}

// ---------- 日報の文面（『日報生成』をそのまま共有できる文に） ----------

function yen(n: number): string {
  return `¥${n.toLocaleString("ja-JP")}`;
}

function pct(n: number | null): string {
  return n === null ? "—" : `${n.toFixed(1)}%`;
}

export function dailyReportText(input: {
  dayLabel: string;
  day: Tally;
  dayByAgency: AgencyRow[];
  monthLabel: string;
  month: Tally;
  plan?: PlanMonth | null;
}): string {
  const { day, month, plan } = input;
  const kinds = DEAL_KIND_KEYS.map((k) => day.meetingsByKind[k]);
  const lines = [
    `【アライアンス日報】${input.dayLabel}`,
    `紹介 ${day.referrals}件 / 商談 ${day.meetings}件（セールス${kinds[0]}・兼販売協力${kinds[1]}・販売協力${kinds[2]}）`,
    `成約 ${day.closings}件 / ロスト ${day.lost}件`,
    `売上 ${yen(day.sales)} / 粗利 ${yen(day.profit)} / 代理店支払 ${yen(day.fee)}`,
  ];
  const active = input.dayByAgency.filter(
    (r) => r.tally.referrals + r.tally.meetings + r.tally.closings + r.tally.lost > 0
  );
  if (active.length > 0) {
    lines.push("", "▼1次代理店別");
    for (const r of active) {
      const parts = [
        r.tally.referrals ? `紹介${r.tally.referrals}` : "",
        r.tally.meetings ? `商談${r.tally.meetings}` : "",
        r.tally.closings ? `成約${r.tally.closings}` : "",
        r.tally.lost ? `ロスト${r.tally.lost}` : "",
      ].filter(Boolean);
      lines.push(`・${r.name}：${parts.join(" / ")}`);
    }
  }
  lines.push("", `▼${input.monthLabel}の累計`);
  if (plan) {
    lines.push(
      `紹介 ${month.referrals}/${plan.referrals}件（${pct(achievement(month.referrals, plan.referrals))}）`,
      `成約 ${month.closings}/${plan.closings}件（${pct(achievement(month.closings, plan.closings))}）`,
      `売上 ${yen(month.sales)} / 計画 ${yen(plan.sales)}（${pct(achievement(month.sales, plan.sales))}）`,
      `★代理店報酬 ${yen(month.fee)} / 計画 ${yen(plan.fee)}（${pct(achievement(month.fee, plan.fee))}）`
    );
  } else {
    lines.push(
      `紹介 ${month.referrals}件 / 成約 ${month.closings}件`,
      `売上 ${yen(month.sales)} / ★代理店報酬 ${yen(month.fee)}`
    );
  }
  return lines.join("\n");
}
