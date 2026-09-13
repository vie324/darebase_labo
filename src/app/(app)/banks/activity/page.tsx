"use client";

// =============================================================
// 支店稼働ダッシュボード — 本システムの中核
//
// 「どこが動いていて、どこが放置されているか」を1画面で示す。
//  - サマリー（総支店数 / 稼働 / 稼働率 / 休眠 / 今月アポ・成約）
//  - 銀行別の稼働率バー（低い銀行を上に）
//  - 休眠支店アラート（経過日数順・閾値でバッジ色）
//  - 担当者別の管理カバレッジ
//  - 銀行×月のヒートマップ
//
// 集計はすべて @/lib/branch-metrics（テスト済みの純粋関数）。
// =============================================================

import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarCheck,
  ChevronLeft,
  Trophy,
  Users,
} from "lucide-react";
import { useCollection } from "@/lib/use-collection";
import { useBranchSettings } from "@/lib/settings";
import {
  buildBranchStats,
  buildHeatmap,
  monthlyAppointmentCounts,
  recentMonths,
  rollupByBank,
  rollupByOwner,
  summarizeBranches,
  toMonth,
} from "@/lib/branch-metrics";
import { cn, formatDate, todayStr } from "@/lib/utils";
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  PageHeader,
  PageSkeleton,
  ProgressBar,
  StatCard,
} from "@/components/ui";
import {
  DORMANCY_STYLE,
  formatDaysSince,
  formatRate,
  rateBarClass,
  rateTextClass,
} from "../shared";
import { useAccess } from "@/lib/use-access";

const HEATMAP_MONTHS = 12;

export default function BranchActivityPage() {
  const banks = useCollection("banks");
  // 担当振り替えの導線は本部のみ（DB 側も branches の担当変更は本部前提）
  const { can } = useAccess();
  const canEditMaster = can("master_edit");
  const branches = useCollection("branches");
  const appointments = useCollection("appointments");
  const activities = useCollection("branch_activities");
  const profiles = useCollection("profiles");
  const { settings } = useBranchSettings();

  const [bankFilter, setBankFilter] = useState<string>("all");

  const loading =
    banks.loading || branches.loading || appointments.loading || activities.loading;

  if (loading) return <PageSkeleton />;

  // ---------- 派生データ（loading 後のみ計算するのでハイドレーション安全） ----------
  const today = todayStr();
  const thisMonth = toMonth(today);
  const stats = buildBranchStats(
    branches.items,
    appointments.items,
    activities.items,
    today,
    settings
  );

  const bankNameOf = (id: string) => banks.items.find((b) => b.id === id)?.name ?? "";
  const colorOf = (name: string) =>
    profiles.items.find((p) => p.name === name)?.color ?? "cyan";

  const scoped = bankFilter === "all" ? stats : stats.filter((s) => s.branch.bank_id === bankFilter);
  const scopedBranchIds = new Set(scoped.map((s) => s.branch.id));
  const scopedAppointments =
    bankFilter === "all"
      ? appointments.items
      : appointments.items.filter((a) => a.branch_id && scopedBranchIds.has(a.branch_id));

  const summary = summarizeBranches(scoped);
  const month = monthlyAppointmentCounts(scopedAppointments, thisMonth);
  const bankRows = rollupByBank(stats, bankNameOf);
  const ownerRows = rollupByOwner(scoped);
  const months = recentMonths(today, HEATMAP_MONTHS);
  const heatmap = buildHeatmap(
    branches.items,
    appointments.items,
    activities.items,
    months,
    bankNameOf
  );

  // 休眠アラート: 経過日数の長い順（接点なしを最優先）
  const dormant = scoped
    .filter((s) => s.counted && !s.isActive)
    .sort(
      (a, b) =>
        (b.daysSinceContact ?? Number.MAX_SAFE_INTEGER) -
        (a.daysSinceContact ?? Number.MAX_SAFE_INTEGER)
    );

  const maxHeat = Math.max(1, ...heatmap.flatMap((r) => r.counts));

  if (branches.items.length === 0) {
    return (
      <div>
        <PageHeader
          title="支店稼働ダッシュボード"
          description="どこが動いていて、どこが放置されているかを可視化"
          icon={<Activity className="h-5 w-5" />}
        />
        <EmptyState
          icon={<Building2 className="h-10 w-10" />}
          title="支店が登録されていません"
          description="銀行・支店マスタでCSVを取り込むと、ここに稼働状況が表示されます"
          action={
            <Link
              href="/banks"
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-400 px-4 text-sm font-medium text-slate-900"
            >
              銀行・支店マスタへ
              <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="支店稼働ダッシュボード"
        description={`直近${settings.activeWindowDays}日に接点があった支店を「稼働」として集計`}
        icon={<Activity className="h-5 w-5" />}
        actions={
          <Link
            href="/banks"
            className="inline-flex items-center gap-1 text-sm font-semibold text-cyan-600 hover:text-cyan-500 dark:text-cyan-400"
          >
            <ChevronLeft className="h-4 w-4" />
            銀行・支店マスタ
          </Link>
        }
      />

      {/* ---------- 銀行フィルタ ---------- */}
      <div className="scrollbar-thin mb-5 flex gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => setBankFilter("all")}
          className={cn(
            "cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
            bankFilter === "all"
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
              : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
          )}
        >
          全銀行
        </button>
        {banks.items.map((b) => (
          <button
            key={b.id}
            onClick={() => setBankFilter(b.id)}
            className={cn(
              "cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
              bankFilter === b.id
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
            )}
          >
            {b.name}
          </button>
        ))}
      </div>

      {/* ---------- サマリー ---------- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="総支店数"
          value={`${summary.totalBranches}`}
          sub={summary.suspendedBranches > 0 ? `取引停止 ${summary.suspendedBranches}を除く` : "—"}
          icon={<Building2 className="h-5 w-5" />}
          accent="cyan"
        />
        <StatCard
          label="稼働支店"
          value={`${summary.activeBranches}`}
          sub={`直近${settings.activeWindowDays}日に接点`}
          icon={<Activity className="h-5 w-5" />}
          accent="emerald"
        />
        <StatCard
          label="稼働率"
          value={formatRate(summary.activeRate)}
          sub={summary.activeRate === null ? "対象なし" : "稼働 / 総支店"}
          icon={<ArrowRight className="h-5 w-5" />}
          accent="sky"
        />
        <StatCard
          label="休眠支店"
          value={`${summary.dormantBranches}`}
          sub={`うち接点なし ${summary.neverContacted}`}
          icon={<AlertTriangle className="h-5 w-5" />}
          accent="rose"
        />
        <StatCard
          label="今月のアポ"
          value={`${month.appointments}`}
          sub={`${thisMonth} 受電分`}
          icon={<CalendarCheck className="h-5 w-5" />}
          accent="amber"
        />
        <StatCard
          label="今月の成約"
          value={`${month.won}`}
          sub={month.appointments > 0 ? `アポ ${month.appointments}件中` : "アポなし"}
          icon={<Trophy className="h-5 w-5" />}
          accent="emerald"
        />
      </div>

      <div className="mt-6 grid items-start gap-4 lg:grid-cols-2">
        {/* ---------- 銀行別の稼働率 ---------- */}
        <Card className="p-5 sm:p-6">
          <h2 className="mb-1 font-bold">銀行別の稼働率</h2>
          <p className="mb-4 text-xs text-slate-400">稼働率が低い銀行が上に並びます</p>
          {bankRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">データがありません</p>
          ) : (
            <div className="space-y-3.5">
              {bankRows.map((row) => (
                <div key={row.key}>
                  <div className="mb-1 flex items-baseline justify-between gap-3">
                    <p className="min-w-0 truncate text-sm font-medium">{row.label}</p>
                    <p className="shrink-0 text-sm font-bold tabular-nums">
                      {formatRate(row.activeRate)}
                      <span className="ml-1.5 text-xs font-normal text-slate-400">
                        {row.active} / {row.total}支店
                      </span>
                    </p>
                  </div>
                  <ProgressBar
                    value={row.active}
                    max={Math.max(1, row.total)}
                    barClassName={rateBarClass(row.activeRate)}
                  />
                  {row.neverContacted > 0 && (
                    <p className="mt-1 text-[11px] text-rose-500">
                      一度も接点がない支店 {row.neverContacted}件
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ---------- 担当者別カバレッジ ---------- */}
        <Card className="p-5 sm:p-6">
          <h2 className="mb-1 flex items-center gap-2 font-bold">
            <Users className="h-4 w-4 text-slate-400" />
            担当者別の管理カバレッジ
          </h2>
          <p className="mb-4 text-xs text-slate-400">
            担当支店のうち何支店を実際に動かせているか
          </p>
          {ownerRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">データがありません</p>
          ) : (
            <div className="scrollbar-thin -mx-2 overflow-x-auto">
              <table className="w-full min-w-[440px] text-left text-sm">
                <thead>
                  <tr className="text-[11px] font-bold text-slate-400">
                    <th className="px-2 pb-2">担当者</th>
                    <th className="px-2 pb-2 text-right">担当支店</th>
                    <th className="px-2 pb-2 text-right">稼働</th>
                    <th className="px-2 pb-2 text-right">稼働率</th>
                    <th className="px-2 pb-2 text-right">平均経過</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {ownerRows.map((row) => (
                    <tr key={row.key}>
                      <td className="px-2 py-2.5">
                        <span className="flex items-center gap-2">
                          {row.key === "" ? (
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-100 text-[10px] font-bold text-rose-600 dark:bg-rose-500/20 dark:text-rose-300">
                              !
                            </span>
                          ) : (
                            <Avatar name={row.label} color={colorOf(row.label)} size="xs" />
                          )}
                          <span className="truncate text-xs font-medium">{row.label}</span>
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-right font-semibold tabular-nums">
                        {row.total}
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{row.active}</td>
                      <td className="px-2 py-2.5 text-right">
                        <span
                          className={cn(
                            "font-bold tabular-nums",
                            rateTextClass(row.activeRate)
                          )}
                        >
                          {formatRate(row.activeRate)}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">
                        {formatDaysSince(row.avgDaysSinceContact)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* ---------- 休眠支店アラート ---------- */}
      <Card className="mt-4 p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 font-bold">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              休眠支店アラート
              <span className="rounded-full bg-slate-100 px-2 text-xs leading-5 font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {dormant.length}
              </span>
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {canEditMaster
                ? "放置期間が長い順。担当の振り替えは銀行・支店マスタから行えます"
                : "放置期間が長い順。接点を作って稼働に戻しましょう"}
            </p>
          </div>
          {canEditMaster && (
            <Link
              href="/banks"
              className="group inline-flex items-center gap-1 text-xs font-semibold text-cyan-600 hover:text-cyan-500 dark:text-cyan-400"
            >
              担当を振り替える
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
        </div>
        {dormant.length === 0 ? (
          <EmptyState
            icon={<Activity className="h-8 w-8" />}
            title="休眠中の支店はありません"
            description="すべての支店で直近の接点が記録されています"
          />
        ) : (
          <ul className="scrollbar-thin max-h-[28rem] space-y-1.5 overflow-y-auto">
            {dormant.map((s) => {
              const style = DORMANCY_STYLE[s.dormancyLevel];
              return (
                <li
                  key={s.branch.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-2 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", style.dot)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {s.branch.name}
                      <span className="ml-2 text-xs font-normal text-slate-400">
                        {bankNameOf(s.branch.bank_id)}
                      </span>
                    </p>
                    <p className="text-xs text-slate-400">
                      担当: {s.branch.assigned_name || "未割当"}
                      {s.lastContactAt
                        ? ` ・ 最終接点 ${formatDate(s.lastContactAt)}`
                        : " ・ 接点記録なし"}
                    </p>
                  </div>
                  <Badge className={style.badge}>
                    {style.label} · {formatDaysSince(s.daysSinceContact)}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* ---------- ヒートマップ ---------- */}
      <Card className="mt-4 p-5 sm:p-6">
        <h2 className="mb-1 font-bold">接点ヒートマップ（銀行 × 月）</h2>
        <p className="mb-4 text-xs text-slate-400">
          直近{HEATMAP_MONTHS}ヶ月のアポ・活動ログの件数。色が薄い列は接点が途切れた月
        </p>
        <div className="scrollbar-thin overflow-x-auto">
          <table className="min-w-[680px] border-separate border-spacing-1 text-xs">
            <thead>
              <tr>
                <th className="w-36 text-left font-bold text-slate-400" />
                {months.map((m) => (
                  <th key={m} className="text-center font-normal text-slate-400">
                    {Number(m.slice(5))}月
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmap.map((row) => (
                <tr key={row.bankId}>
                  <td className="max-w-36 truncate pr-2 text-slate-600 dark:text-slate-300">
                    {row.label}
                  </td>
                  {row.counts.map((c, i) => (
                    <td key={i} className="p-0">
                      <div
                        title={`${row.label} ${months[i]}: ${c}件`}
                        className={cn(
                          "flex h-8 items-center justify-center rounded-md text-[10px] font-semibold tabular-nums",
                          heatClass(c, maxHeat)
                        )}
                      >
                        {c > 0 ? c : ""}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ---------- 表示ヘルパー ----------

/** 件数を4段階の濃度にマップする（0件はグレー） */
function heatClass(count: number, max: number): string {
  if (count === 0) return "bg-slate-100 text-slate-300 dark:bg-slate-800/60 dark:text-slate-700";
  const ratio = count / max;
  if (ratio > 0.66) return "bg-cyan-600 text-white";
  if (ratio > 0.33) return "bg-cyan-400 text-slate-900";
  return "bg-cyan-100 text-cyan-800 dark:bg-cyan-500/25 dark:text-cyan-200";
}
