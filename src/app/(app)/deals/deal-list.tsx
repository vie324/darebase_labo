"use client";

// テーブル形式のリストビュー（列ヘッダクリックでソート）

import { useState } from "react";
import { AlertTriangle, ArrowUpDown, Briefcase, ChevronDown, ChevronUp } from "lucide-react";
import { DEAL_STAGES } from "@/lib/constants";
import { cn, formatDate, formatYen } from "@/lib/utils";
import type { Deal } from "@/lib/types";
import { Avatar, Badge, EmptyState, ProgressBar } from "@/components/ui";
import { isOpenStage } from "./shared";

type SortKey =
  | "name"
  | "company"
  | "stage"
  | "amount"
  | "probability"
  | "expected_close"
  | "owner_name";

export function DealList({
  deals,
  today,
  colorOf,
  onRowClick,
}: {
  deals: Deal[];
  today: string;
  colorOf: (name: string) => string;
  onRowClick: (deal: Deal) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("expected_close");
  const [asc, setAsc] = useState(true);

  if (deals.length === 0) {
    return (
      <EmptyState
        icon={<Briefcase className="h-8 w-8" />}
        title="条件に一致する案件がありません"
        description="検索条件を変えるか、新規案件を登録してください"
      />
    );
  }

  const toggle = (k: SortKey) => {
    if (k === sortKey) {
      setAsc((v) => !v);
    } else {
      setSortKey(k);
      setAsc(true);
    }
  };

  const dir = asc ? 1 : -1;
  const sorted = [...deals].sort((a, b) => {
    switch (sortKey) {
      case "amount":
        return (a.amount - b.amount) * dir;
      case "probability":
        return (a.probability - b.probability) * dir;
      case "stage":
        return (DEAL_STAGES[a.stage].order - DEAL_STAGES[b.stage].order) * dir;
      default:
        return a[sortKey].localeCompare(b[sortKey], "ja") * dir;
    }
  });

  const th = (k: SortKey, label: string, align: "left" | "right" = "left") => (
    <th className={cn("px-4 py-3", align === "right" && "text-right")}>
      <button
        onClick={() => toggle(k)}
        className="inline-flex cursor-pointer items-center gap-1 text-xs font-bold whitespace-nowrap text-slate-500 transition-colors hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
      >
        {label}
        {sortKey === k ? (
          asc ? (
            <ChevronUp className="h-3.5 w-3.5 text-indigo-500" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-indigo-500" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </th>
  );

  return (
    <div className="card overflow-hidden">
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/40">
            <tr>
              {th("name", "案件名")}
              {th("company", "会社")}
              {th("stage", "ステージ")}
              {th("amount", "金額", "right")}
              {th("probability", "確度")}
              {th("expected_close", "完了予定")}
              {th("owner_name", "担当")}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {sorted.map((d) => {
              const overdue = isOpenStage(d.stage) && d.expected_close < today;
              return (
                <tr
                  key={d.id}
                  onClick={() => onRowClick(d)}
                  className="cursor-pointer transition-colors hover:bg-indigo-50/40 dark:hover:bg-slate-800/50"
                >
                  <td className="max-w-64 px-4 py-3">
                    <p className="truncate font-semibold">{d.name}</p>
                    {d.next_action && (
                      <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">
                        {d.next_action}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">
                    {d.company}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={DEAL_STAGES[d.stage].color}>
                      {DEAL_STAGES[d.stage].label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold whitespace-nowrap tabular-nums">
                    {formatYen(d.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ProgressBar
                        value={d.probability}
                        className="h-1.5 w-16"
                        barClassName={DEAL_STAGES[d.stage].bar}
                      />
                      <span className="w-9 text-xs font-semibold text-slate-500 tabular-nums dark:text-slate-400">
                        {d.probability}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-xs whitespace-nowrap",
                        overdue
                          ? "font-semibold text-rose-500"
                          : "text-slate-500 dark:text-slate-400"
                      )}
                    >
                      {overdue && <AlertTriangle className="h-3.5 w-3.5" />}
                      {formatDate(d.expected_close)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <Avatar name={d.owner_name} color={colorOf(d.owner_name)} size="xs" />
                      <span className="text-xs whitespace-nowrap text-slate-600 dark:text-slate-300">
                        {d.owner_name}
                      </span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
