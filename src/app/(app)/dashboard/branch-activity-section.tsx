"use client";

// ダッシュボードの稼働セクション。
// 詳細は /banks/activity に置き、ここでは「今どれだけ放置されているか」だけを出す。
//
// 集計は、いま選んでいる事業部のぶんだけ。絞らずに出すと
// 「支店稼働」の見出しのまま2次代理店が混ざる。

import Link from "next/link";
import { Activity, AlertTriangle, ArrowRight, Building2 } from "lucide-react";
import { useCollection } from "@/lib/use-collection";
import { useBusinessUnit } from "@/lib/use-business-unit";
import { filterByUnit } from "@/lib/business-units";
import { useBranchSettings } from "@/lib/settings";
import { buildBranchStats, summarizeBranches } from "@/lib/branch-metrics";
import { cn, formatDate, todayStr } from "@/lib/utils";
import { Badge, Card, ProgressBar, Skeleton } from "@/components/ui";
import { DORMANCY_STYLE, formatDormancyBadge, formatRate } from "../banks/shared";

const TOP_N = 5;

export function BranchActivitySection() {
  const branches = useCollection("branches");
  const banks = useCollection("banks");
  const appointments = useCollection("appointments");
  const activities = useCollection("branch_activities");
  const { unitId, defaultUnitId, terms, missing, loading: unitLoading } = useBusinessUnit();
  const { settings } = useBranchSettings();

  const loading =
    branches.loading ||
    banks.loading ||
    appointments.loading ||
    activities.loading ||
    unitLoading;

  if (loading) {
    return <Skeleton className="h-64 rounded-2xl" />;
  }

  // 事業部の行が無いときは、絞り込みが効かず他事業部のぶんが出てしまうので何も出さない
  if (missing) return null;

  // いま選んでいる事業部のぶんだけを集計する
  const unitBanks = filterByUnit(banks.items, unitId, defaultUnitId);
  const unitBankIds = new Set(unitBanks.map((b) => b.id));
  const unitBranches = filterByUnit(branches.items, unitId, defaultUnitId).filter((b) =>
    unitBankIds.has(b.bank_id)
  );

  // 窓口が未登録なら（＝この事業部を使っていないチームなら）セクションごと出さない
  if (unitBranches.length === 0) return null;

  const today = todayStr();
  const stats = buildBranchStats(
    unitBranches,
    filterByUnit(appointments.items, unitId, defaultUnitId),
    activities.items,
    today,
    settings
  );
  const summary = summarizeBranches(stats);
  const bankNameOf = (id: string) => unitBanks.find((b) => b.id === id)?.name ?? "";

  const worst = stats
    .filter((s) => s.counted && !s.isActive)
    .sort(
      (a, b) =>
        (b.daysSinceContact ?? Number.MAX_SAFE_INTEGER) -
        (a.daysSinceContact ?? Number.MAX_SAFE_INTEGER)
    )
    .slice(0, TOP_N);

  return (
    <Card className="mt-6 p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2.5 font-bold">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400">
            <Activity className="h-4 w-4" />
          </span>
          <span className="truncate">{terms.child}稼働</span>
        </h2>
        <Link
          href="/banks/activity"
          className="group inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-cyan-600 transition-colors hover:text-cyan-500 dark:text-cyan-400"
        >
          ダッシュボードへ
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {/* 稼働率 */}
        <div className="sm:col-span-1">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">稼働率</p>
          <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">
            {formatRate(summary.activeRate)}
          </p>
          <ProgressBar
            value={summary.activeBranches}
            max={Math.max(1, summary.totalBranches)}
            className="mt-2"
            barClassName={
              summary.activeRate !== null && summary.activeRate < 30
                ? "bg-rose-500"
                : summary.activeRate !== null && summary.activeRate < 60
                  ? "bg-amber-500"
                  : "bg-emerald-500"
            }
          />
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            稼働 {summary.activeBranches} / {summary.totalBranches} {terms.countUnit}
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
            <Building2 className="h-3 w-3" />
            一度も接点なし {summary.neverContacted}
            {terms.countUnit}
          </p>
        </div>

        {/* 放置されている窓口 */}
        <div className="sm:col-span-2">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            放置期間が長い{terms.child}
          </p>
          {worst.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400 dark:border-slate-800">
              休眠中の{terms.child}はありません
            </p>
          ) : (
            <ul className="space-y-1">
              {worst.map((s) => {
                const style = DORMANCY_STYLE[s.dormancyLevel];
                return (
                  <li
                    key={s.branch.id}
                    className="flex items-center gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", style.dot)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {s.branch.name}
                        <span className="ml-1.5 text-xs font-normal text-slate-400">
                          {bankNameOf(s.branch.bank_id)}
                        </span>
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        担当 {s.branch.assigned_name || "未割当"}
                        {s.lastContactAt && ` ・ 最終接点 ${formatDate(s.lastContactAt)}`}
                      </p>
                    </div>
                    <Badge className={style.badge}>
                      {formatDormancyBadge(s.daysSinceContact, s.dormancyLevel)}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}
