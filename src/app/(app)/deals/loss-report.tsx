"use client";

// 失注分析 — 件数・金額・確度ランク・担当者・要因カテゴリの集計と、
// AIによる「傾向と打ち手」のまとめ。
// 集計は常に出る。AIは未設定なら案内だけ出す。

import { AlertTriangle, Lightbulb, Sparkles, TrendingDown } from "lucide-react";
import {
  buildLossStats,
  categoryMeta,
  hasAnalyzableLosses,
} from "@/lib/loss-analysis";
import { useAiStatus, useLossInsight } from "@/lib/use-ai";
import { cn, formatYenShort } from "@/lib/utils";
import type { Deal, MeetingLog } from "@/lib/types";
import { Badge, Button, Card, EmptyState, ProgressBar } from "@/components/ui";

export function LossReport({ deals, logs }: { deals: Deal[]; logs: MeetingLog[] }) {
  const stats = buildLossStats(deals, logs);
  const ai = useAiStatus();
  const { analyzing, error, insight, analyze } = useLossInsight();

  if (stats.lostCount === 0) {
    return (
      <Card className="p-5 sm:p-6">
        <h2 className="mb-1 flex items-center gap-2 font-bold">
          <TrendingDown className="h-4 w-4 text-rose-500" />
          失注分析
        </h2>
        <EmptyState
          icon={<TrendingDown className="h-8 w-8" />}
          title="失注した案件がありません"
          description="失注を記録すると、要因の傾向をここで振り返れます"
        />
      </Card>
    );
  }

  const maxCategory = Math.max(...stats.categories.map((c) => c.count), 1);
  const canAnalyze = (ai.configured || ai.isDemo) && hasAnalyzableLosses(stats);

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 font-bold">
          <TrendingDown className="h-4 w-4 text-rose-500" />
          失注分析
        </h2>
        <span className="text-xs text-slate-400">
          失注 {stats.lostCount}件 ・ {formatYenShort(stats.lostAmount)}
          {stats.lossRate !== null && ` ・ 失注率 ${stats.lossRate}%`}
        </span>
        <Button
          size="sm"
          variant="secondary"
          className="ml-auto"
          onClick={() => analyze(stats.cases)}
          disabled={analyzing || !canAnalyze}
        >
          <Sparkles className="h-4 w-4" />
          {analyzing ? "分析中…" : "AIで傾向をまとめる"}
        </Button>
      </div>

      {stats.withoutReasons > 0 && (
        <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
          失注 {stats.lostCount}件のうち {stats.withoutReasons}件は商談ログの解析がないため、
          要因を拾えていません。商談ログを解析すると精度が上がります。
        </p>
      )}

      {error && (
        <p className="mb-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </p>
      )}

      {/* AIのまとめ */}
      {insight && (
        <div className="mb-5 rounded-2xl border border-cyan-100 bg-cyan-50/40 p-4 dark:border-cyan-500/20 dark:bg-cyan-500/5">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-cyan-700 dark:text-cyan-300">
            <Lightbulb className="h-3.5 w-3.5" />
            AIによる傾向と打ち手
          </h3>
          <p className="text-sm leading-relaxed">{insight.summary}</p>
          <ul className="mt-3 space-y-2">
            {insight.themes.map((t, i) => (
              <li key={i} className="rounded-xl bg-white/70 p-3 dark:bg-slate-900/40">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  {t.title}
                  <Badge className="bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                    {t.affected}件
                  </Badge>
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {t.detail}
                </p>
                <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed font-medium text-cyan-700 dark:text-cyan-300">
                  <Lightbulb className="mt-0.5 h-3 w-3 shrink-0" />
                  {t.countermeasure}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed font-semibold text-slate-700 dark:text-slate-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
            {insight.biggest_gap}
          </p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* 要因カテゴリ */}
        <div>
          <h3 className="mb-2 text-xs font-bold text-slate-500 dark:text-slate-400">
            失注要因（商談ログから抽出）
          </h3>
          {stats.categories.length === 0 ? (
            <p className="text-sm text-slate-400">
              まだ要因を拾えていません（商談ログの解析が必要です）
            </p>
          ) : (
            <ul className="space-y-2.5">
              {stats.categories.map((c) => {
                const meta = categoryMeta(c.key);
                return (
                  <li key={c.key}>
                    <div className="flex items-center gap-2">
                      <Badge className={meta.color}>{c.label}</Badge>
                      <span className="text-xs font-semibold text-slate-500 tabular-nums">
                        {c.count}件
                      </span>
                    </div>
                    <ProgressBar
                      value={(c.count / maxCategory) * 100}
                      className="mt-1.5 h-1.5"
                      barClassName="bg-rose-400"
                    />
                    {c.samples.length > 0 && (
                      <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-400">
                        {c.samples.join(" / ")}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* 確度ランク別・担当者別 */}
        <div className="space-y-5">
          <div>
            <h3 className="mb-2 text-xs font-bold text-slate-500 dark:text-slate-400">
              失注時の確度
            </h3>
            {stats.byRank.length === 0 ? (
              <p className="text-sm text-slate-400">確度が未判定です</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {stats.byRank.map((r) => (
                  <li
                    key={r.rank || "none"}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-sm",
                      r.rank === "A"
                        ? "border-rose-200 bg-rose-50/60 dark:border-rose-500/30 dark:bg-rose-500/10"
                        : "border-slate-200 dark:border-slate-700"
                    )}
                  >
                    <span className="font-bold">{r.rank || "未判定"}</span>
                    <span className="ml-1.5 text-xs text-slate-500">{r.count}件</span>
                  </li>
                ))}
              </ul>
            )}
            {stats.byRank.some((r) => r.rank === "A") && (
              <p className="mt-1.5 text-[11px] leading-relaxed text-amber-600 dark:text-amber-400">
                確度Aからも失注しています。判定基準を見直す余地があります
              </p>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-xs font-bold text-slate-500 dark:text-slate-400">
              担当者別の失注
            </h3>
            <ul className="space-y-1.5">
              {stats.byOwner.map((o) => (
                <li key={o.name} className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{o.name}</span>
                  <span className="text-xs text-slate-400 tabular-nums">
                    失注 {o.lost} / 受注 {o.won}
                  </span>
                  {o.rate !== null && (
                    <Badge
                      className={cn(
                        o.rate >= 50
                          ? "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300"
                      )}
                    >
                      {o.rate}%
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Card>
  );
}
