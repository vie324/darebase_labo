"use client";

// タスクカード・リスト行で使う優先度/期限バッジ

import { AlertCircle, CalendarDays, Clock, Flag } from "lucide-react";
import { Badge } from "@/components/ui";
import { TASK_PRIORITIES } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import type { TaskItem, TaskPriority } from "@/lib/types";
import { getDueState } from "./helpers";

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const meta = TASK_PRIORITIES[priority];
  return (
    <Badge className={meta.color}>
      <Flag className="h-3 w-3" />
      {meta.label}
    </Badge>
  );
}

/** 期限バッジ。期限切れ=赤 / 今日=アンバー / それ以外=ニュートラル */
export function DueBadge({ task }: { task: TaskItem }) {
  const state = getDueState(task);
  if (state === "none") return null;
  if (state === "overdue") {
    return (
      <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
        <AlertCircle className="h-3 w-3" />
        期限切れ {formatDate(task.due_date)}
      </Badge>
    );
  }
  if (state === "today") {
    return (
      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
        <Clock className="h-3 w-3" />
        今日期限
      </Badge>
    );
  }
  return (
    <Badge>
      <CalendarDays className="h-3 w-3" />
      {formatDate(task.due_date)}
    </Badge>
  );
}
