// タスク管理モジュール共通のロジックヘルパー

import type { TaskItem, TaskPriority, TaskStatus } from "@/lib/types";
import { todayStr } from "@/lib/utils";

/** ボード列の表示順 */
export const BOARD_COLUMNS: TaskStatus[] = ["todo", "doing", "done"];

/** 優先度の並び順（高が先） */
export const PRIORITY_ORDER: Record<TaskPriority, number> = { high: 0, mid: 1, low: 2 };

/** 期限の状態。完了済みタスクは期限切れとして強調しない */
export type DueState = "overdue" | "today" | "future" | "none";

export function getDueState(task: TaskItem): DueState {
  if (!task.due_date) return "none";
  if (task.status === "done") return "future";
  const today = todayStr();
  if (task.due_date < today) return "overdue";
  if (task.due_date === today) return "today";
  return "future";
}

/** ステータス変更時に completed_at の付け外しを含むパッチを作る */
export function statusPatch(from: TaskStatus, to: TaskStatus): Partial<TaskItem> {
  const patch: Partial<TaskItem> = { status: to };
  if (to === "done" && from !== "done") patch.completed_at = new Date().toISOString();
  if (to !== "done" && from === "done") patch.completed_at = null;
  return patch;
}

/** 期限昇順（期限なしは最後）→ 同日なら優先度の高い順 */
export function compareByDue(a: TaskItem, b: TaskItem): number {
  if (a.due_date !== b.due_date) {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date < b.due_date ? -1 : 1;
  }
  return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
}

/** 今週（月曜始まり）の開始日時 */
export function startOfThisWeek(): Date {
  const d = new Date();
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
