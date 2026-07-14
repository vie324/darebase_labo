"use client";

// カンバンボードビュー（HTML5 ドラッグ&ドロップでステータス変更）

import { useMemo, useState, type DragEvent } from "react";
import { AlertCircle, Briefcase, GripVertical, Plus } from "lucide-react";
import { Avatar } from "@/components/ui";
import { TASK_STATUSES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { TaskItem, TaskPriority, TaskStatus } from "@/lib/types";
import { BOARD_COLUMNS, compareByDue, getDueState } from "./helpers";
import { DueBadge, PriorityBadge } from "./badges";

const COLUMN_DOT: Record<TaskStatus, string> = {
  todo: "bg-slate-400",
  doing: "bg-cyan-500",
  done: "bg-emerald-500",
};

/** 優先度ごとのカード左端アクセント */
const PRIORITY_EDGE: Record<TaskPriority, string> = {
  high: "border-l-rose-400 dark:border-l-rose-500",
  mid: "border-l-amber-400 dark:border-l-amber-500",
  low: "border-l-slate-300 dark:border-l-slate-600",
};

export function BoardView({
  tasks,
  memberColors,
  onDropTask,
  onQuickAdd,
  onOpen,
}: {
  tasks: TaskItem[];
  memberColors: Record<string, string>;
  onDropTask: (id: string, to: TaskStatus) => void;
  onQuickAdd: (title: string, status: TaskStatus) => void;
  onOpen: (task: TaskItem) => void;
}) {
  const grouped = useMemo(() => {
    const g: Record<TaskStatus, TaskItem[]> = { todo: [], doing: [], done: [] };
    for (const t of tasks) g[t.status].push(t);
    g.todo.sort(compareByDue);
    g.doing.sort(compareByDue);
    g.done.sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));
    return g;
  }, [tasks]);

  return (
    <div className="grid items-start gap-4 md:grid-cols-3">
      {BOARD_COLUMNS.map((status) => (
        <Column
          key={status}
          status={status}
          tasks={grouped[status]}
          memberColors={memberColors}
          onDropTask={onDropTask}
          onQuickAdd={onQuickAdd}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}

function Column({
  status,
  tasks,
  memberColors,
  onDropTask,
  onQuickAdd,
  onOpen,
}: {
  status: TaskStatus;
  tasks: TaskItem[];
  memberColors: Record<string, string>;
  onDropTask: (id: string, to: TaskStatus) => void;
  onQuickAdd: (title: string, status: TaskStatus) => void;
  onOpen: (task: TaskItem) => void;
}) {
  const [over, setOver] = useState(false);
  const meta = TASK_STATUSES[status];
  const overdueCount = tasks.filter((t) => getDueState(t) === "overdue").length;

  const handleDragOver = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOver(true);
  };
  const handleDragLeave = (e: DragEvent<HTMLElement>) => {
    // 子要素への移動では解除しない
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
  };
  const handleDrop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setOver(false);
    const id = e.dataTransfer.getData("text/plain");
    if (id) onDropTask(id, status);
  };

  return (
    <section
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "flex min-h-[420px] flex-col rounded-2xl border border-slate-200/70 bg-slate-100/60 p-3 transition-all duration-150 dark:border-slate-800 dark:bg-slate-900/50",
        over &&
          "border-cyan-300 bg-cyan-50/70 ring-2 ring-cyan-400/40 dark:border-cyan-700 dark:bg-cyan-500/10"
      )}
    >
      <header className="mb-3 flex items-center gap-2 px-1">
        <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", COLUMN_DOT[status])} />
        <h2 className="text-sm font-bold">{meta.label}</h2>
        {overdueCount > 0 && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-100 px-1.5 py-0.5 text-[11px] font-bold text-rose-600 dark:bg-rose-500/20 dark:text-rose-300">
            <AlertCircle className="h-3 w-3" />
            {overdueCount}
          </span>
        )}
        <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-300">
          {tasks.length}
        </span>
      </header>

      <QuickAdd onAdd={(title) => onQuickAdd(title, status)} />

      <div className="scrollbar-thin mt-3 max-h-[70vh] flex-1 space-y-2.5 overflow-y-auto pb-1">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            color={memberColors[task.assignee_name]}
            onOpen={onOpen}
          />
        ))}
        {tasks.length === 0 && (
          <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-slate-300 text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500">
            ここにドラッグで移動
          </div>
        )}
      </div>
    </section>
  );
}

/** 列上部のクイック追加入力（Enterで即追加） */
function QuickAdd({ onAdd }: { onAdd: (title: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="relative">
      <Plus className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
          const title = value.trim();
          if (!title) return;
          onAdd(title);
          setValue("");
        }}
        placeholder="タスクを追加して Enter"
        className="w-full rounded-xl border border-dashed border-slate-300 bg-transparent py-2 pr-3 pl-9 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:border-solid focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-500/10 focus:outline-none dark:border-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-900"
      />
    </div>
  );
}

function TaskCard({
  task,
  color,
  onOpen,
}: {
  task: TaskItem;
  color?: string;
  onOpen: (task: TaskItem) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const done = task.status === "done";

  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", task.id);
        e.dataTransfer.effectAllowed = "move";
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      onClick={() => onOpen(task)}
      className={cn(
        "card card-hover group cursor-grab border-l-4 p-3.5 select-none active:cursor-grabbing",
        PRIORITY_EDGE[task.priority],
        dragging && "rotate-2 opacity-40"
      )}
    >
      <div className="flex items-start gap-2">
        <p
          className={cn(
            "flex-1 text-sm leading-snug font-semibold",
            done && "text-slate-400 line-through dark:text-slate-500"
          )}
        >
          {task.title}
        </p>
        <GripVertical className="h-4 w-4 shrink-0 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-slate-600" />
      </div>

      {task.description && (
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {task.description}
        </p>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <PriorityBadge priority={task.priority} />
        <DueBadge task={task} />
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 dark:border-slate-800">
        {task.related_deal ? (
          <span className="flex min-w-0 items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <Briefcase className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
            <span className="truncate">{task.related_deal}</span>
          </span>
        ) : (
          <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
        )}
        {task.assignee_name && (
          <Avatar name={task.assignee_name} color={color} size="xs" className="shrink-0" />
        )}
      </div>
    </article>
  );
}
