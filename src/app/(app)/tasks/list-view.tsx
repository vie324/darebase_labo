"use client";

// リストビュー（チェックボックスで完了トグル・期限順ソート済みの配列を受け取る）

import { Briefcase, CheckCircle2, Circle } from "lucide-react";
import { Avatar, Badge } from "@/components/ui";
import { TASK_STATUSES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { TaskItem } from "@/lib/types";
import { DueBadge, PriorityBadge } from "./badges";

export function ListView({
  tasks,
  memberColors,
  onToggle,
  onOpen,
}: {
  tasks: TaskItem[];
  memberColors: Record<string, string>;
  onToggle: (task: TaskItem) => void;
  onOpen: (task: TaskItem) => void;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {tasks.map((task) => {
          const done = task.status === "done";
          const statusMeta = TASK_STATUSES[task.status];
          return (
            <div
              key={task.id}
              onClick={() => onOpen(task)}
              className="group flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50 sm:px-5 dark:hover:bg-slate-800/40"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(task);
                }}
                aria-label={done ? "未完了に戻す" : "完了にする"}
                className="shrink-0 cursor-pointer rounded-full text-slate-300 transition-transform hover:scale-110 dark:text-slate-600"
              >
                {done ? (
                  <CheckCircle2 className="h-[22px] w-[22px] text-emerald-500" />
                ) : (
                  <Circle className="h-[22px] w-[22px] transition-colors hover:text-emerald-400" />
                )}
              </button>

              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "truncate text-sm font-semibold",
                    done && "text-slate-400 line-through dark:text-slate-500"
                  )}
                >
                  {task.title}
                </p>
                {(task.related_deal || task.description) && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                    {task.related_deal && (
                      <span className="flex min-w-0 items-center gap-1">
                        <Briefcase className="h-3 w-3 shrink-0" />
                        <span className="truncate">{task.related_deal}</span>
                      </span>
                    )}
                    {task.related_deal && task.description && <span className="shrink-0">·</span>}
                    {task.description && <span className="truncate">{task.description}</span>}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <span className="hidden sm:inline-flex">
                  <PriorityBadge priority={task.priority} />
                </span>
                <DueBadge task={task} />
                <span className="hidden md:inline-flex">
                  <Badge className={statusMeta.color}>{statusMeta.label}</Badge>
                </span>
                {task.assignee_name && (
                  <Avatar
                    name={task.assignee_name}
                    color={memberColors[task.assignee_name]}
                    size="xs"
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
