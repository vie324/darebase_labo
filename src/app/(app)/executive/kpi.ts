// 経営ダッシュボードの集計ロジック（純関数のみ・UI非依存）
//
// 金額の基準:
// - 売上・粗利・ランキング: 税抜（subtotal）ベース
// - 未入金・キャッシュフロー: 税込の実際の入出金額（total - paid_amount）ベース

import type { Invoice, Partner } from "@/lib/types";
import { isOpenInvoice, isOverdue, openBalance, overdueDays } from "../billing/shared";

export function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

/** 基準日から offset ヶ月ずらした月を YYYY-MM で返す */
export function shiftMonth(base: Date, offset: number): string {
  const d = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** 当月を含む過去 n ヶ月（古→新） */
export function lastMonths(n: number, base: Date): string[] {
  return Array.from({ length: n }, (_, i) => shiftMonth(base, i - n + 1));
}

/** 当月を含む将来 n ヶ月（近→遠） */
export function nextMonths(n: number, base: Date): string[] {
  return Array.from({ length: n }, (_, i) => shiftMonth(base, i));
}

/** "2026-07" → "7月" */
export function monthLabel(ym: string): string {
  const m = Number(ym.slice(5, 7));
  return Number.isNaN(m) ? ym : `${m}月`;
}

/** 集計対象の請求書（下書き・取消は除外） */
export function countable(invoices: Invoice[]): Invoice[] {
  return invoices.filter((i) => i.status !== "cancelled" && i.status !== "draft");
}

// ---------- 売上・粗利トレンド ----------

export interface RevenueSeries {
  months: string[];
  revenue: number[]; // 税抜売上（receivable）
  cost: number[]; // 税抜支払（payable）
  profit: number[]; // 粗利 = revenue - cost
}

export function monthlyRevenueSeries(invoices: Invoice[], months: string[]): RevenueSeries {
  const list = countable(invoices);
  const sumBy = (direction: Invoice["direction"], m: string) =>
    list
      .filter((i) => i.direction === direction && monthKey(i.issue_date) === m)
      .reduce((s, i) => s + i.subtotal, 0);
  const revenue = months.map((m) => sumBy("receivable", m));
  const cost = months.map((m) => sumBy("payable", m));
  return { months, revenue, cost, profit: revenue.map((r, i) => r - cost[i]) };
}

// ---------- 取引先別ランキング ----------

export interface RankRow {
  label: string;
  value: number; // 税抜合計
  count: number; // 請求書件数
}

/**
 * 指定方向の請求書を取引先ごとに集計してランキングを返す。
 * kinds を指定すると partner_id がその区分の取引先のものに限定する。
 */
export function partnerRanking(
  invoices: Invoice[],
  partners: Partner[],
  direction: Invoice["direction"],
  months: string[],
  kinds?: Partner["kind"][],
  limit = 8
): RankRow[] {
  const monthSet = new Set(months);
  const kindOf = new Map(partners.map((p) => [p.id, p.kind]));
  const nameOf = new Map(partners.map((p) => [p.id, p.name]));
  const map = new Map<string, RankRow>();
  for (const inv of countable(invoices)) {
    if (inv.direction !== direction) continue;
    if (!monthSet.has(monthKey(inv.issue_date))) continue;
    if (kinds && (!inv.partner_id || !kinds.includes(kindOf.get(inv.partner_id) ?? "client")))
      continue;
    const label = (inv.partner_id && nameOf.get(inv.partner_id)) || inv.partner_name || "（取引先未設定）";
    const row = map.get(label) ?? { label, value: 0, count: 0 };
    row.value += inv.subtotal;
    row.count += 1;
    map.set(label, row);
  }
  return Array.from(map.values())
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

// ---------- 請求・入金ステータス ----------

export interface OverdueRow {
  invoice: Invoice;
  days: number;
  balance: number;
}

export function overdueList(invoices: Invoice[], today: string): OverdueRow[] {
  return invoices
    .filter((i) => isOverdue(i, today))
    .map((invoice) => ({
      invoice,
      days: overdueDays(invoice, today),
      balance: openBalance(invoice),
    }))
    .sort((a, b) => b.days - a.days);
}

/** 未回収（入金待ち）残高の合計 */
export function totalReceivableBalance(invoices: Invoice[]): number {
  return invoices
    .filter((i) => i.direction === "receivable" && isOpenInvoice(i))
    .reduce((s, i) => s + openBalance(i), 0);
}

/** 支払予定残高の合計 */
export function totalPayableBalance(invoices: Invoice[]): number {
  return invoices
    .filter((i) => i.direction === "payable" && isOpenInvoice(i))
    .reduce((s, i) => s + openBalance(i), 0);
}

// ---------- キャッシュフロー予測 ----------

export interface CashflowForecast {
  /** 先頭は「期限超過（未回収/未払い）」バケット、以降は月次 */
  labels: string[];
  inflow: number[];
  outflow: number[];
  /** 期日未設定のため予測に含まれない残高 */
  undatedInflow: number;
  undatedOutflow: number;
}

export function cashflowForecast(
  invoices: Invoice[],
  months: string[],
  today: string
): CashflowForecast {
  const open = invoices.filter((i) => isOpenInvoice(i) && openBalance(i) > 0);
  const monthSum = (direction: Invoice["direction"], m: string) =>
    open
      .filter(
        (i) =>
          i.direction === direction &&
          i.due_date !== "" &&
          i.due_date >= today &&
          monthKey(i.due_date) === m
      )
      .reduce((s, i) => s + openBalance(i), 0);
  const overdueSum = (direction: Invoice["direction"]) =>
    open
      .filter((i) => i.direction === direction && i.due_date !== "" && i.due_date < today)
      .reduce((s, i) => s + openBalance(i), 0);
  const undatedSum = (direction: Invoice["direction"]) =>
    open
      .filter((i) => i.direction === direction && i.due_date === "")
      .reduce((s, i) => s + openBalance(i), 0);

  return {
    labels: ["超過分", ...months.map(monthLabel)],
    inflow: [overdueSum("receivable"), ...months.map((m) => monthSum("receivable", m))],
    outflow: [overdueSum("payable"), ...months.map((m) => monthSum("payable", m))],
    undatedInflow: undatedSum("receivable"),
    undatedOutflow: undatedSum("payable"),
  };
}

// ---------- 前月比 ----------

/** 前月比の変化率（%表記用、前月0なら null） */
export function momRate(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
