"use client";

// =============================================================
// 回答マトリクス表
//  行 = 回答者 / 列 = 各候補日時。セルに ◯/△/× を色付きで表示し、
//  フッターに集計スコアを表示。最有力列・確定列をハイライトする。
// =============================================================

import { CalendarCheck, Check, Trophy } from "lucide-react";
import { Avatar } from "@/components/ui";
import { cn, formatDate, formatTime } from "@/lib/utils";
import type { SchedulePoll } from "@/lib/types";
import {
  ANSWER_META,
  EMPTY_CELL,
  answerCounts,
  candidateScore,
  type Answer,
} from "./shared";

export function ResponseMatrix({
  poll,
  bestIndex,
  canConfirm,
  colorOf,
  onConfirm,
}: {
  poll: SchedulePoll;
  bestIndex: number;
  canConfirm: boolean;
  colorOf: (name: string) => string;
  onConfirm: (index: number) => void;
}) {
  const { candidates, responses, confirmed_index } = poll;

  const columnTone = (i: number): string => {
    if (confirmed_index === i)
      return "bg-emerald-50/80 dark:bg-emerald-500/10";
    if (bestIndex === i) return "bg-cyan-50/70 dark:bg-cyan-500/10";
    return "";
  };

  return (
    <div className="scrollbar-thin -mx-1 overflow-x-auto px-1 pb-1">
      <table className="w-full min-w-[560px] border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 rounded-tl-xl border-b border-slate-200 bg-white px-3 py-2.5 text-left text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
              回答者
            </th>
            {candidates.map((c, i) => (
              <th
                key={i}
                className={cn(
                  "border-b border-slate-200 px-3 py-2.5 text-center align-top dark:border-slate-800",
                  columnTone(i)
                )}
              >
                <div className="flex flex-col items-center gap-1">
                  {(confirmed_index === i || bestIndex === i) && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
                        confirmed_index === i
                          ? "bg-emerald-500 text-white"
                          : "bg-cyan-500 text-slate-900"
                      )}
                    >
                      {confirmed_index === i ? (
                        <>
                          <CalendarCheck className="h-3 w-3" />
                          確定
                        </>
                      ) : (
                        <>
                          <Trophy className="h-3 w-3" />
                          最有力
                        </>
                      )}
                    </span>
                  )}
                  <span className="text-xs font-semibold whitespace-nowrap text-slate-700 dark:text-slate-200">
                    {formatDate(c.start)}
                  </span>
                  <span className="text-[11px] whitespace-nowrap text-slate-500 dark:text-slate-400">
                    {formatTime(c.start)}〜{formatTime(c.end)}
                  </span>
                  {canConfirm && (
                    <button
                      onClick={() => onConfirm(i)}
                      className="mt-1 inline-flex cursor-pointer items-center gap-1 rounded-lg border border-cyan-200 bg-white px-2 py-1 text-[11px] font-semibold text-cyan-600 transition-colors hover:bg-cyan-50 dark:border-cyan-500/30 dark:bg-slate-900 dark:text-cyan-300 dark:hover:bg-cyan-500/10"
                    >
                      <Check className="h-3 w-3" />
                      この日時で確定
                    </button>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {responses.length === 0 ? (
            <tr>
              <td
                colSpan={candidates.length + 1}
                className="px-3 py-8 text-center text-sm text-slate-400 dark:text-slate-500"
              >
                まだ回答がありません。下のフォームから最初の回答を追加しましょう。
              </td>
            </tr>
          ) : (
            responses.map((r, ri) => (
              <tr key={ri} className="group">
                <td className="sticky left-0 z-10 border-b border-slate-100 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center gap-2">
                    <Avatar name={r.name} color={colorOf(r.name)} size="xs" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                        {r.name}
                      </p>
                      {r.comment && (
                        <p
                          title={r.comment}
                          className="max-w-[160px] truncate text-[11px] text-slate-400 dark:text-slate-500"
                        >
                          {r.comment}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                {candidates.map((_, ci) => {
                  const a = r.answers[ci] as Answer | undefined;
                  const meta = a ? ANSWER_META[a] : null;
                  return (
                    <td
                      key={ci}
                      className={cn(
                        "border-b border-slate-100 px-2 py-2 text-center dark:border-slate-800",
                        columnTone(ci)
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex h-8 w-8 items-center justify-center rounded-lg text-base font-bold",
                          meta ? meta.cell : EMPTY_CELL
                        )}
                        title={meta?.label ?? "未回答"}
                      >
                        {meta ? meta.symbol : "―"}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>

        {responses.length > 0 && (
          <tfoot>
            <tr>
              <td className="sticky left-0 z-10 rounded-bl-xl bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                集計スコア
              </td>
              {candidates.map((_, ci) => {
                const score = candidateScore(poll, ci);
                const counts = answerCounts(poll, ci);
                const isBest = bestIndex === ci;
                return (
                  <td
                    key={ci}
                    className={cn(
                      "px-2 py-2.5 text-center align-middle",
                      isBest
                        ? "bg-cyan-50 dark:bg-cyan-500/10"
                        : confirmed_index === ci
                          ? "bg-emerald-50 dark:bg-emerald-500/10"
                          : "bg-slate-50 dark:bg-slate-800/60"
                    )}
                  >
                    <div
                      className={cn(
                        "text-lg font-bold tabular-nums",
                        isBest
                          ? "text-cyan-600 dark:text-cyan-300"
                          : "text-slate-700 dark:text-slate-200"
                      )}
                    >
                      {score}
                    </div>
                    <div className="mt-0.5 flex items-center justify-center gap-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                      <span className="text-emerald-500">◯{counts.ok}</span>
                      <span className="text-amber-500">△{counts.maybe}</span>
                      <span className="text-rose-500">×{counts.ng}</span>
                    </div>
                  </td>
                );
              })}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
