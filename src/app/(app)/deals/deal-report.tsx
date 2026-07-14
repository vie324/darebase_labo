"use client";

// レポートビュー — ステージ別ファネルと担当者別サマリー

import { BarChart3, Briefcase, Crown, Users } from "lucide-react";
import { DEAL_STAGES } from "@/lib/constants";
import { cn, formatYenShort } from "@/lib/utils";
import type { Deal } from "@/lib/types";
import { Avatar, Card, EmptyState, ProgressBar } from "@/components/ui";
import { STAGE_KEYS, isOpenStage, sumAmount, weightedAmount } from "./shared";

export function DealReport({
  deals,
  colorOf,
}: {
  deals: Deal[];
  colorOf: (name: string) => string;
}) {
  if (deals.length === 0) {
    return (
      <EmptyState
        icon={<Briefcase className="h-8 w-8" />}
        title="案件がありません"
        description="案件を登録するとレポートが表示されます"
      />
    );
  }

  // ---------- ステージ別ファネル ----------
  const stageRows = STAGE_KEYS.map((stage) => {
    const rows = deals.filter((d) => d.stage === stage);
    return { stage, meta: DEAL_STAGES[stage], count: rows.length, amount: sumAmount(rows) };
  });
  const maxCount = Math.max(...stageRows.map((r) => r.count), 1);
  const maxAmount = Math.max(...stageRows.map((r) => r.amount), 1);

  // ---------- 担当者別サマリー ----------
  const owners = Array.from(new Set(deals.map((d) => d.owner_name))).filter(Boolean);
  const ownerRows = owners
    .map((name) => {
      const rows = deals.filter((d) => d.owner_name === name);
      const open = rows.filter((d) => isOpenStage(d.stage));
      const won = rows.filter((d) => d.stage === "won");
      const lost = rows.filter((d) => d.stage === "lost");
      return {
        name,
        total: rows.length,
        openCount: open.length,
        pipeline: sumAmount(open),
        weighted: Math.round(weightedAmount(open)),
        wonCount: won.length,
        wonAmount: sumAmount(won),
        winRate:
          won.length + lost.length > 0
            ? Math.round((won.length / (won.length + lost.length)) * 100)
            : null,
      };
    })
    .sort((a, b) => b.wonAmount - a.wonAmount || b.pipeline - a.pipeline);
  const maxWon = Math.max(...ownerRows.map((r) => r.wonAmount), 0);

  return (
    <div className="grid gap-4">
      {/* ファネル */}
      <Card className="p-5 sm:p-6">
        <h2 className="mb-5 flex items-center gap-2.5 font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
            <BarChart3 className="h-4 w-4" />
          </span>
          ステージ別ファネル
        </h2>
        <div className="space-y-4">
          {stageRows.map((r) => (
            <div key={r.stage} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex w-28 shrink-0 items-center gap-2">
                <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", r.meta.bar)} />
                <span className="text-sm font-semibold">{r.meta.label}</span>
              </div>
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-8 shrink-0 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                    件数
                  </span>
                  <ProgressBar
                    value={r.count}
                    max={maxCount}
                    className="h-2.5 flex-1"
                    barClassName={r.meta.bar}
                  />
                  <span className="w-16 shrink-0 text-right text-xs font-semibold tabular-nums">
                    {r.count}件
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-8 shrink-0 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                    金額
                  </span>
                  <ProgressBar
                    value={r.amount}
                    max={maxAmount}
                    className="h-2.5 flex-1"
                    barClassName={cn(r.meta.bar, "opacity-60")}
                  />
                  <span className="w-16 shrink-0 text-right text-xs font-semibold text-slate-500 tabular-nums dark:text-slate-400">
                    {r.amount > 0 ? formatYenShort(r.amount) : "—"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 担当者別 */}
      <Card className="overflow-hidden">
        <h2 className="flex items-center gap-2.5 p-5 pb-0 font-bold sm:p-6 sm:pb-0">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400">
            <Users className="h-4 w-4" />
          </span>
          担当者別サマリー
        </h2>
        <div className="scrollbar-thin mt-4 overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="border-y border-slate-100 bg-slate-50/70 text-xs font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 sm:px-6">担当者</th>
                <th className="px-4 py-3 text-right">案件数</th>
                <th className="px-4 py-3 text-right">進行中</th>
                <th className="px-4 py-3 text-right">パイプライン</th>
                <th className="px-4 py-3 text-right">加重</th>
                <th className="px-4 py-3 text-right">受注</th>
                <th className="px-4 py-3 text-right">受注額</th>
                <th className="px-5 py-3 text-right sm:px-6">受注率</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {ownerRows.map((r) => (
                <tr
                  key={r.name}
                  className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                >
                  <td className="px-5 py-3 sm:px-6">
                    <span className="flex items-center gap-2.5">
                      <Avatar name={r.name} color={colorOf(r.name)} size="xs" />
                      <span className="font-semibold whitespace-nowrap">{r.name}</span>
                      {maxWon > 0 && r.wonAmount === maxWon && (
                        <Crown className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.total}件</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.openCount}件</td>
                  <td className="px-4 py-3 text-right font-semibold whitespace-nowrap tabular-nums">
                    {r.pipeline > 0 ? formatYenShort(r.pipeline) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap text-slate-500 tabular-nums dark:text-slate-400">
                    {r.weighted > 0 ? formatYenShort(r.weighted) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.wonCount}件</td>
                  <td className="px-4 py-3 text-right font-semibold whitespace-nowrap text-emerald-600 tabular-nums dark:text-emerald-400">
                    {r.wonAmount > 0 ? formatYenShort(r.wonAmount) : "—"}
                  </td>
                  <td className="px-5 py-3 sm:px-6">
                    {r.winRate === null ? (
                      <span className="block text-right text-slate-400 dark:text-slate-500">—</span>
                    ) : (
                      <span className="flex items-center justify-end gap-2">
                        <ProgressBar
                          value={r.winRate}
                          className="h-1.5 w-14"
                          barClassName="bg-emerald-500"
                        />
                        <span className="w-9 text-right text-xs font-semibold tabular-nums">
                          {r.winRate}%
                        </span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
