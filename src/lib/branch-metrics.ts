// =============================================================
// 支店稼働の集計ロジック（UI非依存の純粋関数）
//
// このシステムの中核。「100支店持っていて30支店しか動かせていない」を
// 数値で示すための計算をここに集約し、ユニットテストで担保する
// （src/lib/branch-metrics.test.ts）。
//
// 【日付の扱い】接点日はすべて YYYY-MM-DD（ローカル日付）で保持する。
// UTC正午ではなく Date.UTC で日数差を取るため、DSTやタイムゾーンで
// 日数がずれない。ISO日時が渡された場合は先頭10文字を日付として扱う。
//
// 【ランタイム依存なし】node の型ストリップでそのままテストできるよう、
// 値のimportを持たない（型のみ import type）。
// =============================================================

import type { Appointment, Branch, BranchActivity } from "./types";

// ---------- 設定（値は app_settings から注入。既定値は settings.ts） ----------
export interface BranchActivityThresholds {
  /** この日数以内に接点があれば「稼働支店」とみなす */
  activeWindowDays: number;
  /** 休眠バッジ: 黄 */
  dormantWarnDays: number;
  /** 休眠バッジ: 橙 */
  dormantAlertDays: number;
  /** 休眠バッジ: 赤 */
  dormantCriticalDays: number;
  /** 支店一覧の「直近アポ数」の集計期間（ヶ月） */
  recentMonths: number;
}

/** 休眠の深刻度。never = 一度も接点がない（最優先で炙り出す対象） */
export type DormancyLevel = "fresh" | "warn" | "alert" | "critical" | "never";

// =============================================================
// 日付ユーティリティ
// =============================================================

/** "2026-08-06T12:00:00Z" / "2026-08-06" → "2026-08-06"（不正値は ""） */
export function toDateOnly(value: string): string {
  if (!value) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return m ? m[0] : "";
}

/** YYYY-MM-DD → 1970-01-01 からの日数（不正値は null） */
function toEpochDay(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(t)) return null;
  return Math.round(t / 86_400_000);
}

/** from → to の日数（to が後なら正）。どちらかが不正なら null */
export function daysBetween(from: string, to: string): number | null {
  const a = toEpochDay(from);
  const b = toEpochDay(to);
  if (a === null || b === null) return null;
  return b - a;
}

/** YYYY-MM-DD → "YYYY-MM" */
export function toMonth(value: string): string {
  const d = toDateOnly(value);
  return d ? d.slice(0, 7) : "";
}

/** month("2026-08") から n ヶ月前の "YYYY-MM"（n が負なら未来） */
export function addMonths(month: string, n: number): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return "";
  const total = Number(m[1]) * 12 + (Number(m[2]) - 1) + n;
  const year = Math.floor(total / 12);
  const mon = total - year * 12;
  return `${String(year).padStart(4, "0")}-${String(mon + 1).padStart(2, "0")}`;
}

// =============================================================
// 支店ごとの指標
// =============================================================

export interface BranchStat {
  branch: Branch;
  /** 最終接点日 YYYY-MM-DD（"" = 一度も接点なし） */
  lastContactAt: string;
  /** 最終接点からの経過日数（null = 接点なし） */
  daysSinceContact: number | null;
  /** 稼働中か（suspended は常に false） */
  isActive: boolean;
  /** 集計対象か（suspended = 取引停止 は母数から除外） */
  counted: boolean;
  dormancyLevel: DormancyLevel;
  /** 直近 recentMonths ヶ月のアポ数 */
  recentAppointments: number;
  /** 累計アポ数（キャンセルを除く） */
  totalAppointments: number;
  /** 累計成約数（status = won） */
  wonCount: number;
  /** 成約率 0-100（母数0なら null。ダミー0で埋めない） */
  winRate: number | null;
}

/**
 * 最終接点日を求める。
 * - branches.last_contact_at（CSV取込時の実績など）
 * - アポイントの受電日 received_at（キャンセルも「接点」として数える）
 * - 活動ログの occurred_at
 * の最大値。未来日は接点として扱わない（誤入力対策）。
 */
export function resolveLastContact(
  branch: Branch,
  appointments: Appointment[],
  activities: BranchActivity[],
  today: string
): string {
  let latest = "";
  const consider = (raw: string) => {
    const d = toDateOnly(raw);
    if (!d || d > today) return;
    if (d > latest) latest = d;
  };
  consider(branch.last_contact_at);
  for (const a of appointments) {
    if (a.branch_id === branch.id) consider(a.received_at);
  }
  for (const a of activities) {
    if (a.branch_id === branch.id) consider(a.occurred_at);
  }
  return latest;
}

/** 経過日数から休眠レベルを判定する（閾値は設定画面から変更可能） */
export function dormancyLevel(
  daysSinceContact: number | null,
  t: BranchActivityThresholds
): DormancyLevel {
  if (daysSinceContact === null) return "never";
  if (daysSinceContact >= t.dormantCriticalDays) return "critical";
  if (daysSinceContact >= t.dormantAlertDays) return "alert";
  if (daysSinceContact >= t.dormantWarnDays) return "warn";
  return "fresh";
}

/**
 * 支店ごとの稼働指標を組み立てる。
 *
 * status="suspended"（取引停止）は稼働率の母数から外す（counted=false）。
 * status="dormant" は運用上のラベルであり、稼働判定そのものは
 * 「最終接点日が activeWindowDays 以内か」で機械的に決める。
 */
export function buildBranchStats(
  branches: Branch[],
  appointments: Appointment[],
  activities: BranchActivity[],
  today: string,
  t: BranchActivityThresholds
): BranchStat[] {
  const fromMonth = addMonths(toMonth(today), -(t.recentMonths - 1));

  return branches.map((branch) => {
    const lastContactAt = resolveLastContact(branch, appointments, activities, today);
    const daysSinceContact = lastContactAt ? daysBetween(lastContactAt, today) : null;
    const counted = branch.status !== "suspended";
    const isActive =
      counted && daysSinceContact !== null && daysSinceContact <= t.activeWindowDays;

    const mine = appointments.filter((a) => a.branch_id === branch.id);
    const effective = mine.filter((a) => a.status !== "cancelled");
    const recentAppointments = effective.filter((a) => {
      const m = toMonth(a.received_at);
      return m !== "" && m >= fromMonth;
    }).length;
    const wonCount = mine.filter((a) => a.status === "won").length;
    // 成約率は「結果が出たアポ（受注 or 失注）」を母数にする。
    // 予定・実施済はまだ結果が出ていないため除外する。
    const decided = mine.filter((a) => a.status === "won" || a.status === "lost").length;

    return {
      branch,
      lastContactAt,
      daysSinceContact,
      isActive,
      counted,
      dormancyLevel: dormancyLevel(daysSinceContact, t),
      recentAppointments,
      totalAppointments: effective.length,
      wonCount,
      winRate: decided > 0 ? Math.round((wonCount / decided) * 100) : null,
    };
  });
}

// =============================================================
// サマリー
// =============================================================

export interface ActivitySummary {
  /** 集計対象の支店数（取引停止を除く） */
  totalBranches: number;
  activeBranches: number;
  dormantBranches: number;
  /** 一度も接点がない支店数 */
  neverContacted: number;
  /** 稼働率 0-100（母数0なら null） */
  activeRate: number | null;
  suspendedBranches: number;
}

export function summarizeBranches(stats: BranchStat[]): ActivitySummary {
  const counted = stats.filter((s) => s.counted);
  const activeBranches = counted.filter((s) => s.isActive).length;
  return {
    totalBranches: counted.length,
    activeBranches,
    dormantBranches: counted.length - activeBranches,
    neverContacted: counted.filter((s) => s.lastContactAt === "").length,
    activeRate: counted.length > 0 ? Math.round((activeBranches / counted.length) * 100) : null,
    suspendedBranches: stats.length - counted.length,
  };
}

/** 指定月（YYYY-MM）のアポ数・成約数。キャンセルはアポ数に数えない */
export function monthlyAppointmentCounts(
  appointments: Appointment[],
  month: string
): { appointments: number; won: number } {
  const inMonth = appointments.filter((a) => toMonth(a.received_at) === month);
  return {
    appointments: inMonth.filter((a) => a.status !== "cancelled").length,
    won: inMonth.filter((a) => a.status === "won").length,
  };
}

// =============================================================
// 銀行別 / 担当者別のロールアップ
// =============================================================

export interface RollupRow {
  key: string;
  label: string;
  total: number;
  active: number;
  /** 稼働率 0-100（母数0なら null） */
  activeRate: number | null;
  /** 接点がある支店の平均経過日数（接点ゼロなら null） */
  avgDaysSinceContact: number | null;
  neverContacted: number;
}

function rollup(
  stats: BranchStat[],
  keyOf: (s: BranchStat) => string,
  labelOf: (key: string, s: BranchStat) => string
): RollupRow[] {
  const groups = new Map<string, BranchStat[]>();
  for (const s of stats) {
    if (!s.counted) continue;
    const key = keyOf(s);
    const list = groups.get(key);
    if (list) list.push(s);
    else groups.set(key, [s]);
  }
  return Array.from(groups.entries()).map(([key, list]) => {
    const active = list.filter((s) => s.isActive).length;
    const withContact = list.filter((s) => s.daysSinceContact !== null);
    const avg =
      withContact.length > 0
        ? Math.round(
            withContact.reduce((sum, s) => sum + (s.daysSinceContact ?? 0), 0) /
              withContact.length
          )
        : null;
    return {
      key,
      label: labelOf(key, list[0]),
      total: list.length,
      active,
      activeRate: list.length > 0 ? Math.round((active / list.length) * 100) : null,
      avgDaysSinceContact: avg,
      neverContacted: list.filter((s) => s.lastContactAt === "").length,
    };
  });
}

/** 稼働率の低い順（＝手を打つべき順）に並べる。同率は支店数が多い順 */
export function sortByWorstCoverage(rows: RollupRow[]): RollupRow[] {
  return [...rows].sort((a, b) => {
    const ar = a.activeRate ?? 0;
    const br = b.activeRate ?? 0;
    if (ar !== br) return ar - br;
    return b.total - a.total;
  });
}

/** 銀行別の稼働率 */
export function rollupByBank(
  stats: BranchStat[],
  bankNameOf: (bankId: string) => string
): RollupRow[] {
  return sortByWorstCoverage(
    rollup(
      stats,
      (s) => s.branch.bank_id,
      (key) => bankNameOf(key) || "（銀行未設定）"
    )
  );
}

/** 担当者別の管理カバレッジ。未割当は "" キーでまとめる */
export function rollupByOwner(stats: BranchStat[]): RollupRow[] {
  return sortByWorstCoverage(
    rollup(
      stats,
      (s) => s.branch.assigned_to ?? "",
      (key, s) => (key === "" ? "未割当" : s.branch.assigned_name || "（不明な担当者）")
    )
  );
}

// =============================================================
// ヒートマップ（銀行 × 月の接点有無）
// =============================================================

export interface HeatmapRow {
  bankId: string;
  label: string;
  /** months と同じ長さ。各月の接点件数（アポ + 活動ログ） */
  counts: number[];
}

/** 直近 monthCount ヶ月の月リスト（古い順） */
export function recentMonths(today: string, monthCount: number): string[] {
  const base = toMonth(today);
  if (!base) return [];
  const out: string[] = [];
  for (let i = monthCount - 1; i >= 0; i--) out.push(addMonths(base, -i));
  return out;
}

export function buildHeatmap(
  branches: Branch[],
  appointments: Appointment[],
  activities: BranchActivity[],
  months: string[],
  bankNameOf: (bankId: string) => string
): HeatmapRow[] {
  const bankOfBranch = new Map<string, string>();
  const bankIds: string[] = [];
  for (const b of branches) {
    bankOfBranch.set(b.id, b.bank_id);
    if (!bankIds.includes(b.bank_id)) bankIds.push(b.bank_id);
  }
  const index = new Map(months.map((m, i) => [m, i]));

  const rows = bankIds.map((bankId) => ({
    bankId,
    label: bankNameOf(bankId) || "（銀行未設定）",
    counts: months.map(() => 0),
  }));
  const rowOf = new Map(rows.map((r) => [r.bankId, r]));

  const tally = (branchId: string | null, date: string) => {
    if (!branchId) return;
    const bankId = bankOfBranch.get(branchId);
    if (!bankId) return;
    const i = index.get(toMonth(date));
    if (i === undefined) return;
    const row = rowOf.get(bankId);
    if (row) row.counts[i] += 1;
  };

  for (const a of appointments) {
    if (a.status !== "cancelled") tally(a.branch_id, a.received_at);
  }
  for (const a of activities) tally(a.branch_id, a.occurred_at);

  return rows;
}
