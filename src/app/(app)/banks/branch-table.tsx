"use client";

// 支店一覧テーブル。
// 「どこが放置されているか」を一目で見せ、チェックして担当を振り替えるための画面。
// モバイルではカード表示に切り替える。

import { ArrowUpDown, Building2, ChevronDown, ChevronUp, Pencil, Plus } from "lucide-react";
import type { BranchStat } from "@/lib/branch-metrics";
import { BRANCH_STATUSES } from "@/lib/constants";
import { cn, formatDate } from "@/lib/utils";
import type { Branch } from "@/lib/types";
import { Avatar, Badge, Button, EmptyState } from "@/components/ui";
import {
  DORMANCY_STYLE,
  formatDormancyBadge,
  formatDormancyDetail,
  formatRate,
  type BranchSortKey,
} from "./shared";
import { rowPadding, useDensity } from "@/lib/use-density";
import type { UnitTerms } from "@/lib/business-units";

export function BranchTable({
  stats,
  bankNameOf,
  orgNameOf,
  colorOf,
  selected,
  selectable,
  onToggle,
  onToggleAll,
  sortKey,
  asc,
  onSort,
  onEdit,
  onLogActivity,
  showBankColumn,
  terms,
}: {
  stats: BranchStat[];
  bankNameOf: (id: string) => string;
  orgNameOf: (id: string | null) => string;
  colorOf: (name: string) => string;
  selected: Set<string>;
  /** 一括操作のチェックボックスを出すか（担当の振り替えはマネージャー以上） */
  selectable: boolean;
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[]) => void;
  sortKey: BranchSortKey;
  asc: boolean;
  onSort: (key: BranchSortKey) => void;
  /** 未指定なら編集ボタンを出さない（登録権限が無いロール） */
  onEdit?: (branch: Branch) => void;
  onLogActivity: (branch: Branch) => void;
  showBankColumn: boolean;
  /** 事業部ごとの呼び名（銀行/支店 か 1次代理店/2次代理店） */
  terms: UnitTerms;
}) {
  // フック規則のため、早期 return より前で読む
  const { isCompact } = useDensity();
  const cellPad = rowPadding(isCompact);

  if (stats.length === 0) {
    return (
      <EmptyState
        icon={<Building2 className="h-10 w-10" />}
        title={`該当する${terms.child}がありません`}
        description={`絞り込み条件を変えるか、${terms.child}を登録してください`}
      />
    );
  }

  const allIds = stats.map((s) => s.branch.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));

  const th = (key: BranchSortKey, label: string, align: "left" | "right" = "left") => (
    <th className={cn(cellPad, align === "right" && "text-right")}>
      <button
        onClick={() => onSort(key)}
        className="inline-flex cursor-pointer items-center gap-1 text-xs font-bold whitespace-nowrap text-slate-500 transition-colors hover:text-cyan-600 dark:text-slate-400 dark:hover:text-cyan-400"
      >
        {label}
        {sortKey === key ? (
          asc ? (
            <ChevronUp className="h-3.5 w-3.5 text-cyan-500" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-cyan-500" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </th>
  );

  return (
    <>
      {/* ---------- デスクトップ: テーブル ---------- */}
      <div className="card hidden overflow-hidden lg:block">
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/40">
              <tr>
                {selectable && (
                  <th className={cn("w-10", cellPad)}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => onToggleAll(allIds)}
                      aria-label={`表示中の${terms.child}をすべて選択`}
                      className="h-4 w-4 cursor-pointer accent-cyan-500"
                    />
                  </th>
                )}
                {showBankColumn && th("name", `${terms.parent} / ${terms.child}`)}
                {!showBankColumn && th("name", `${terms.child}名`)}
                {th("assigned", "担当者")}
                <th className={cn(cellPad, "text-xs font-bold whitespace-nowrap text-slate-500 dark:text-slate-400")}>
                  担当代理店
                </th>
                {th("lastContact", "最終接点")}
                {th("recentAppointments", "直近アポ", "right")}
                {th("wonCount", "累計成約", "right")}
                {th("winRate", "成約率", "right")}
                <th className={cellPad} />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {stats.map((s) => {
                const style = DORMANCY_STYLE[s.dormancyLevel];
                const b = s.branch;
                return (
                  <tr
                    key={b.id}
                    className={cn(
                      "transition-colors hover:bg-cyan-50/40 dark:hover:bg-slate-800/50",
                      selected.has(b.id) && "bg-cyan-50/60 dark:bg-cyan-500/10"
                    )}
                  >
                    {selectable && (
                      <td className={cellPad}>
                        <input
                          type="checkbox"
                          checked={selected.has(b.id)}
                          onChange={() => onToggle(b.id)}
                          aria-label={`${b.name}を選択`}
                          className="h-4 w-4 cursor-pointer accent-cyan-500"
                        />
                      </td>
                    )}
                    <td className={cellPad}>
                      <div className="flex items-center gap-2">
                        <span className={cn("h-2 w-2 shrink-0 rounded-full", style.dot)} />
                        <div className="min-w-0">
                          {showBankColumn && (
                            <p className="truncate text-[11px] text-slate-400">
                              {bankNameOf(b.bank_id)}
                            </p>
                          )}
                          <p className="truncate font-semibold">
                            {b.name}
                            {b.code && (
                              <span className="ml-1.5 text-[11px] font-normal text-slate-400">
                                {b.code}
                              </span>
                            )}
                          </p>
                        </div>
                        {b.status !== "active" && (
                          <Badge className={BRANCH_STATUSES[b.status].color}>
                            {BRANCH_STATUSES[b.status].label}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className={cellPad}>
                      {b.assigned_name ? (
                        <span className="flex items-center gap-2">
                          <Avatar
                            name={b.assigned_name}
                            color={colorOf(b.assigned_name)}
                            size="xs"
                          />
                          <span className="text-xs whitespace-nowrap text-slate-600 dark:text-slate-300">
                            {b.assigned_name}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-rose-500">未割当</span>
                      )}
                    </td>
                    <td className={cn(cellPad, "text-xs whitespace-nowrap text-slate-500 dark:text-slate-400")}>
                      {orgNameOf(b.assigned_org_id) || "—"}
                    </td>
                    <td className={cellPad}>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <Badge className={style.badge}>
                          {formatDormancyBadge(s.daysSinceContact, s.dormancyLevel)}
                        </Badge>
                        <span className="text-xs text-slate-400">
                          {s.lastContactAt ? formatDate(s.lastContactAt) : "接点記録なし"}
                        </span>
                      </div>
                    </td>
                    <td className={cn(cellPad, "text-right font-semibold tabular-nums")}>
                      {s.recentAppointments > 0 ? s.recentAppointments : "—"}
                    </td>
                    <td className={cn(cellPad, "text-right font-semibold tabular-nums")}>
                      {s.wonCount > 0 ? s.wonCount : "—"}
                    </td>
                    <td className={cn(cellPad, "text-right font-semibold tabular-nums")}>
                      {formatRate(s.winRate)}
                    </td>
                    <td className={cn(cellPad, "text-right whitespace-nowrap")}>
                      <button
                        onClick={() => onLogActivity(b)}
                        aria-label={`${b.name}に活動を記録`}
                        title="活動を記録"
                        className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-cyan-600 dark:hover:bg-slate-800"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                      {onEdit && (
                        <button
                          onClick={() => onEdit(b)}
                          aria-label={`${b.name}を編集`}
                          title="編集"
                          className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------- モバイル: カード ---------- */}
      <div className="space-y-2 lg:hidden">
        {selectable && (
          <label className="flex cursor-pointer items-center gap-2 px-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => onToggleAll(allIds)}
              className="h-4 w-4 cursor-pointer accent-cyan-500"
            />
            表示中の {stats.length} 件をすべて選択
          </label>
        )}
        {stats.map((s) => {
          const style = DORMANCY_STYLE[s.dormancyLevel];
          const b = s.branch;
          return (
            <div
              key={b.id}
              className={cn(
                "card p-4",
                selected.has(b.id) && "ring-2 ring-cyan-400/60 dark:ring-cyan-500/50"
              )}
            >
              <div className="flex items-start gap-3">
                {selectable && (
                  <input
                    type="checkbox"
                    checked={selected.has(b.id)}
                    onChange={() => onToggle(b.id)}
                    aria-label={`${b.name}を選択`}
                    className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-cyan-500"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] text-slate-400">{bankNameOf(b.bank_id)}</p>
                  <p className="truncate font-semibold">{b.name}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge className={style.badge}>
                      {formatDormancyDetail(s.daysSinceContact, s.dormancyLevel)}
                    </Badge>
                    {b.status !== "active" && (
                      <Badge className={BRANCH_STATUSES[b.status].color}>
                        {BRANCH_STATUSES[b.status].label}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                    担当: {b.assigned_name || "未割当"}
                    {orgNameOf(b.assigned_org_id) && ` ・ ${orgNameOf(b.assigned_org_id)}`}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    直近アポ {s.recentAppointments}件 ・ 累計成約 {s.wonCount}件 ・ 成約率{" "}
                    {formatRate(s.winRate)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <Button size="sm" variant="secondary" onClick={() => onLogActivity(b)}>
                    活動
                  </Button>
                  {onEdit && (
                    <Button size="sm" variant="ghost" onClick={() => onEdit(b)}>
                      編集
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
