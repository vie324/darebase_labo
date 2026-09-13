"use client";

// 商談カンバン（1階）。列は PIPELINE_COLUMNS＝ステージ×確度ランク。
// 後追いの列にドロップすると確度ランクもまとめて更新される
// （判定は lib/pipeline.ts に集約。HTML5ドラッグ&ドロップ）。

import { useState, type DragEvent } from "react";
import { AlertTriangle, Briefcase, CalendarDays, Flag, HelpCircle } from "lucide-react";
import { PIPELINE_COLUMNS } from "@/lib/constants";
import { columnKeyOf, needsConfidenceRank } from "@/lib/pipeline";
import { useConfidenceCriteria } from "@/lib/settings";
import { cn, formatDate, formatYenShort } from "@/lib/utils";
import type { Deal } from "@/lib/types";
import { Avatar, Badge, EmptyState, ProgressBar } from "@/components/ui";
import { isOpenStage, probabilityClass, sumAmount } from "./shared";

export function DealBoard({
  deals,
  today,
  colorOf,
  onCardClick,
  onColumnChange,
}: {
  deals: Deal[];
  today: string;
  colorOf: (name: string) => string;
  onCardClick: (deal: Deal) => void;
  /** カードを別の列に落としたとき（列キーは PIPELINE_COLUMNS.key） */
  onColumnChange: (deal: Deal, toColumnKey: string) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);
  // 後追い列の見出しに、設定画面で決めた確度の判定基準を出す
  const { criteria } = useConfidenceCriteria();

  if (deals.length === 0) {
    return (
      <EmptyState
        icon={<Briefcase className="h-8 w-8" />}
        title="条件に一致する案件がありません"
        description="検索条件を変えるか、新規案件を登録してください"
      />
    );
  }

  const handleDrop = (e: DragEvent, columnKey: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || dragId;
    setDragId(null);
    setDropKey(null);
    const deal = deals.find((d) => d.id === id);
    if (deal && columnKeyOf(deal) !== columnKey) onColumnChange(deal, columnKey);
  };

  return (
    <div className="scrollbar-thin flex items-start gap-3 overflow-x-auto pb-4">
      {PIPELINE_COLUMNS.map((col) => {
        const cards = deals
          .filter((d) => columnKeyOf(d) === col.key)
          .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
        const total = sumAmount(cards);
        const highlighted = dragId !== null && dropKey === col.key;

        return (
          <section
            key={col.key}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (dropKey !== col.key) setDropKey(col.key);
            }}
            onDrop={(e) => handleDrop(e, col.key)}
            className={cn(
              "flex min-h-48 w-72 shrink-0 flex-col rounded-2xl border p-3 transition-colors duration-150",
              highlighted
                ? "border-cyan-400 bg-cyan-50/70 dark:border-cyan-500/60 dark:bg-cyan-500/10"
                : "border-slate-200/70 bg-slate-100/60 dark:border-slate-800 dark:bg-slate-900/50"
            )}
          >
            <header
              className="mb-3 flex items-center gap-2 px-1"
              title={col.rank ? `${col.label}: ${criteria[col.rank]}` : col.label}
            >
              <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", col.bar)} />
              <h2 className="text-sm font-bold">{col.label}</h2>
              <span className="rounded-full bg-white px-2 text-xs leading-5 font-semibold text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-400">
                {cards.length}
              </span>
              {total > 0 && (
                <span className="ml-auto text-xs font-semibold text-slate-400 tabular-nums dark:text-slate-500">
                  {formatYenShort(total)}
                </span>
              )}
            </header>

            <div className="flex-1 space-y-2.5">
              {cards.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300/70 py-8 text-center text-xs text-slate-400 dark:border-slate-700 dark:text-slate-600">
                  {dragId ? "ここにドロップ" : "案件なし"}
                </div>
              ) : (
                cards.map((d) => {
                  const overdue = isOpenStage(d.stage) && d.expected_close < today;
                  const unranked = needsConfidenceRank(d);
                  return (
                    <article
                      key={d.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", d.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDragId(d.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setDropKey(null);
                      }}
                      onClick={() => onCardClick(d)}
                      className={cn(
                        "card card-hover cursor-grab p-3.5 select-none active:cursor-grabbing",
                        dragId === d.id && "opacity-40"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-xs font-medium text-slate-400 dark:text-slate-500">
                          {d.company}
                        </p>
                        <Badge className={probabilityClass(d.probability)}>
                          {d.probability}%
                        </Badge>
                      </div>
                      <h3 className="mt-1 line-clamp-2 text-sm leading-snug font-semibold">
                        {d.name}
                      </h3>
                      <p className="mt-2 text-base font-bold tracking-tight tabular-nums">
                        {formatYenShort(d.amount)}
                      </p>
                      <ProgressBar
                        value={d.probability}
                        className="mt-1.5 h-1"
                        barClassName={col.bar}
                      />
                      {unranked && (
                        <p className="mt-2 inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                          <HelpCircle className="h-3 w-3" />
                          確度未判定
                        </p>
                      )}
                      {d.next_action && (
                        <p className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-slate-50 px-2 py-1.5 text-xs leading-relaxed text-slate-500 dark:bg-slate-800/70 dark:text-slate-400">
                          <Flag className="mt-0.5 h-3 w-3 shrink-0 text-cyan-400" />
                          <span className="line-clamp-2">{d.next_action}</span>
                        </p>
                      )}
                      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-[11px]",
                            overdue
                              ? "font-semibold text-rose-500"
                              : "text-slate-400 dark:text-slate-500"
                          )}
                        >
                          {overdue ? (
                            <AlertTriangle className="h-3 w-3" />
                          ) : (
                            <CalendarDays className="h-3 w-3" />
                          )}
                          {formatDate(d.expected_close)}
                        </span>
                        <Avatar name={d.owner_name} color={colorOf(d.owner_name)} size="xs" />
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
