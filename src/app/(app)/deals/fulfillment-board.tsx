"use client";

// 受注後カンバン（2階）。受注（発注書受領）した案件だけを扱う。
//
// 列は FULFILLMENT_GROUPS の大分類（契約・見積 / リース審査 / 設置調整中 /
// 設置待ち / 開通済み）。列に落とすとその列の先頭フェーズに設定され、
// カード上のセレクトで詳細フェーズ（FULFILLMENT_STAGES の11段）まで指定できる。

import { useState, type DragEvent } from "react";
import { CheckCircle2, Clock, PackageCheck } from "lucide-react";
import { FULFILLMENT_GROUPS, FULFILLMENT_STAGES } from "@/lib/constants";
import { fulfillmentGroupOf, stagnantDays } from "@/lib/pipeline";
import { cn, formatYenShort } from "@/lib/utils";
import type { Deal } from "@/lib/types";
import { Avatar, EmptyState, Select } from "@/components/ui";
import { sumAmount } from "./shared";

/** この日数以上おなじフェーズで止まっていたら警告を出す */
const STAGNANT_WARN_DAYS = 14;

export function FulfillmentBoard({
  deals,
  today,
  colorOf,
  onCardClick,
  onGroupChange,
  onStageChange,
}: {
  /** 受注済み（stage="won"）の案件のみ */
  deals: Deal[];
  today: string;
  colorOf: (name: string) => string;
  onCardClick: (deal: Deal) => void;
  onGroupChange: (deal: Deal, toGroupKey: string) => void;
  onStageChange: (deal: Deal, toStageKey: string) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);

  if (deals.length === 0) {
    return (
      <EmptyState
        icon={<PackageCheck className="h-8 w-8" />}
        title="受注済みの案件がありません"
        description="商談カンバンで「受注」に移すと、ここで完工までの進捗を追えます"
      />
    );
  }

  const handleDrop = (e: DragEvent, groupKey: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || dragId;
    setDragId(null);
    setDropKey(null);
    const deal = deals.find((d) => d.id === id);
    if (deal && fulfillmentGroupOf(deal.fulfillment_status) !== groupKey) {
      onGroupChange(deal, groupKey);
    }
  };

  return (
    <div className="scrollbar-thin flex items-start gap-3 overflow-x-auto pb-4">
      {FULFILLMENT_GROUPS.map((group) => {
        const cards = deals
          .filter((d) => fulfillmentGroupOf(d.fulfillment_status) === group.key)
          .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
        const total = sumAmount(cards);
        const highlighted = dragId !== null && dropKey === group.key;
        const isLast = group.key === FULFILLMENT_GROUPS[FULFILLMENT_GROUPS.length - 1].key;

        return (
          <section
            key={group.key}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (dropKey !== group.key) setDropKey(group.key);
            }}
            onDrop={(e) => handleDrop(e, group.key)}
            className={cn(
              "flex min-h-48 w-72 shrink-0 flex-col rounded-2xl border p-3 transition-colors duration-150",
              highlighted
                ? "border-cyan-400 bg-cyan-50/70 dark:border-cyan-500/60 dark:bg-cyan-500/10"
                : "border-slate-200/70 bg-slate-100/60 dark:border-slate-800 dark:bg-slate-900/50"
            )}
          >
            <header className="mb-3 flex items-center gap-2 px-1">
              <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", group.bar)} />
              <h2 className="text-sm font-bold">{group.label}</h2>
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
                  const days = stagnantDays(d, today);
                  const stagnant = !isLast && days !== null && days >= STAGNANT_WARN_DAYS;
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
                      className={cn(
                        "card cursor-grab p-3.5 select-none active:cursor-grabbing",
                        dragId === d.id && "opacity-40"
                      )}
                    >
                      <button
                        onClick={() => onCardClick(d)}
                        className="w-full cursor-pointer text-left"
                      >
                        <p className="truncate text-xs font-medium text-slate-400 dark:text-slate-500">
                          {d.company}
                        </p>
                        <h3 className="mt-1 line-clamp-2 text-sm leading-snug font-semibold">
                          {d.name}
                        </h3>
                        <p className="mt-2 text-base font-bold tracking-tight tabular-nums">
                          {formatYenShort(d.contract_amount || d.amount)}
                        </p>
                      </button>

                      {/* 詳細フェーズ（11段）。列は大分類なので、細かい進捗はここで指定する */}
                      <Select
                        value={d.fulfillment_status ?? ""}
                        onChange={(e) => onStageChange(d, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-2.5 h-8 py-0 text-xs"
                        aria-label="受注後フェーズ"
                      >
                        {FULFILLMENT_STAGES.map((s) => (
                          <option key={s.key} value={s.key}>
                            {s.label}
                          </option>
                        ))}
                      </Select>

                      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-[11px]",
                            stagnant
                              ? "font-semibold text-amber-600 dark:text-amber-400"
                              : "text-slate-400 dark:text-slate-500"
                          )}
                        >
                          {isLast ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : (
                            <Clock className="h-3 w-3" />
                          )}
                          {days === null
                            ? "経過日数なし"
                            : isLast
                              ? `${days}日前に完了`
                              : `このフェーズ ${days}日`}
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
