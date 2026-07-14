"use client";

// =============================================================
// タスク管理 — カンバンボード / リストの2ビュー
// ドラッグ&ドロップ・クイック追加・フィルタ・統計つき
// =============================================================

import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CheckSquare,
  Clock,
  Inbox,
  ListTodo,
  Plus,
  User,
} from "lucide-react";
import {
  Button,
  EmptyState,
  PageHeader,
  PageSkeleton,
  SearchInput,
  Select,
  StatCard,
  Tabs,
} from "@/components/ui";
import { useCollection } from "@/lib/use-collection";
import { useUser } from "@/lib/use-user";
import { TASK_PRIORITIES } from "@/lib/constants";
import type { TaskItem, TaskPriority, TaskStatus } from "@/lib/types";
import { compareByDue, getDueState, startOfThisWeek, statusPatch } from "./helpers";
import { BoardView } from "./board-view";
import { ListView } from "./list-view";
import { TaskModal, type TaskFormValues } from "./task-modal";

type ViewKey = "board" | "list";
type PriorityFilter = TaskPriority | "all";

export default function TasksPage() {
  const { items, loading, add, update, remove } = useCollection("tasks");
  const { items: profiles, loading: profilesLoading } = useCollection("profiles");
  const { items: deals } = useCollection("deals");
  const { user } = useUser();

  const [view, setView] = useState<ViewKey>("board");
  const [q, setQ] = useState("");
  const [assignee, setAssignee] = useState("all");
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [mineOnly, setMineOnly] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TaskItem | null>(null);

  // ---------- 派生データ ----------
  const memberNames = useMemo(() => {
    const set = new Set<string>(profiles.map((p) => p.name));
    items.forEach((t) => t.assignee_name && set.add(t.assignee_name));
    return Array.from(set);
  }, [profiles, items]);

  const memberColors = useMemo(() => {
    const map: Record<string, string> = {};
    profiles.forEach((p) => {
      map[p.name] = p.color;
    });
    return map;
  }, [profiles]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return items.filter((t) => {
      if (mineOnly && t.assignee_name !== user?.name) return false;
      if (assignee !== "all" && t.assignee_name !== assignee) return false;
      if (priority !== "all" && t.priority !== priority) return false;
      if (query) {
        const hay =
          `${t.title} ${t.description} ${t.related_deal} ${t.assignee_name}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [items, q, assignee, priority, mineOnly, user?.name]);

  /** リストビュー用: 未完了を期限順 → 完了を完了日時の新しい順 */
  const listTasks = useMemo(() => {
    const openTasks = filtered.filter((t) => t.status !== "done").sort(compareByDue);
    const doneTasks = filtered
      .filter((t) => t.status === "done")
      .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));
    return [...openTasks, ...doneTasks];
  }, [filtered]);

  const stats = useMemo(() => {
    const total = items.length;
    const open = items.filter((t) => t.status !== "done").length;
    const dueToday = items.filter((t) => getDueState(t) === "today").length;
    const overdue = items.filter((t) => getDueState(t) === "overdue").length;
    const weekStart = startOfThisWeek();
    const doneThisWeek = items.filter(
      (t) => t.status === "done" && t.completed_at && new Date(t.completed_at) >= weekStart
    ).length;
    const rate = total > 0 ? Math.round(((total - open) / total) * 100) : 0;
    return { total, open, dueToday, overdue, doneThisWeek, rate };
  }, [items]);

  // ---------- 操作 ----------
  const openNew = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openTask = (task: TaskItem) => {
    setEditing(task);
    setModalOpen(true);
  };

  /** クイック追加: 自分が担当・優先度中で即作成 */
  const quickAdd = async (title: string, status: TaskStatus) => {
    await add({
      title,
      description: "",
      status,
      priority: "mid",
      due_date: "",
      assignee_name: user?.name ?? "",
      related_deal: "",
      completed_at: status === "done" ? new Date().toISOString() : null,
    });
  };

  /** ドラッグ&ドロップでのステータス変更 */
  const dropTask = async (id: string, to: TaskStatus) => {
    const task = items.find((t) => t.id === id);
    if (!task || task.status === to) return;
    await update(id, statusPatch(task.status, to));
  };

  /** リストビューのチェックボックスで完了トグル */
  const toggleDone = async (task: TaskItem) => {
    const to: TaskStatus = task.status === "done" ? "todo" : "done";
    await update(task.id, statusPatch(task.status, to));
  };

  const saveTask = async (values: TaskFormValues) => {
    if (editing) {
      const patch: Partial<TaskItem> = { ...values };
      if (values.status === "done" && editing.status !== "done") {
        patch.completed_at = new Date().toISOString();
      }
      if (values.status !== "done" && editing.status === "done") {
        patch.completed_at = null;
      }
      await update(editing.id, patch);
    } else {
      await add({
        ...values,
        completed_at: values.status === "done" ? new Date().toISOString() : null,
      });
    }
    setModalOpen(false);
  };

  const deleteTask = async (task: TaskItem) => {
    if (!confirm(`タスク「${task.title}」を削除しますか？`)) return;
    await remove(task.id);
    setModalOpen(false);
  };

  if (loading || profilesLoading) return <PageSkeleton />;

  const openFilteredCount = filtered.filter((t) => t.status !== "done").length;

  return (
    <div>
      <PageHeader
        title="タスク管理"
        description="チームのタスクをカンバンとリストで一元管理"
        icon={<CheckSquare className="h-5 w-5" />}
        actions={
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" />
            新規タスク
          </Button>
        }
      />

      {/* 統計 */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="未完了"
          value={stats.open}
          sub={`全${stats.total}件・完了率 ${stats.rate}%`}
          icon={<ListTodo className="h-5 w-5" />}
          accent="indigo"
        />
        <StatCard
          label="今日期限"
          value={stats.dueToday}
          sub="今日中に対応が必要"
          icon={<Clock className="h-5 w-5" />}
          accent="amber"
        />
        <StatCard
          label="期限切れ"
          value={stats.overdue}
          sub={stats.overdue > 0 ? "早めの対応を" : "対応漏れなし"}
          icon={<AlertCircle className="h-5 w-5" />}
          accent="rose"
        />
        <StatCard
          label="今週完了"
          value={stats.doneThisWeek}
          sub="月曜からの完了数"
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent="emerald"
        />
      </div>

      {/* ビュー切替 + フィルタ */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Tabs<ViewKey>
          tabs={[
            { key: "board", label: "ボード", count: openFilteredCount },
            { key: "list", label: "リスト", count: filtered.length },
          ]}
          active={view}
          onChange={setView}
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="タスクを検索…"
            className="w-full sm:w-56"
          />
          <div className="w-34">
            <Select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              aria-label="担当者で絞り込み"
            >
              <option value="all">全担当者</option>
              {memberNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-32">
            <Select
              value={priority}
              onChange={(e) => setPriority(e.target.value as PriorityFilter)}
              aria-label="優先度で絞り込み"
            >
              <option value="all">全優先度</option>
              {(Object.keys(TASK_PRIORITIES) as TaskPriority[]).map((p) => (
                <option key={p} value={p}>
                  優先度: {TASK_PRIORITIES[p].label}
                </option>
              ))}
            </Select>
          </div>
          <Button
            variant={mineOnly ? "primary" : "secondary"}
            onClick={() => setMineOnly((v) => !v)}
            aria-pressed={mineOnly}
          >
            <User className="h-4 w-4" />
            自分のタスク
          </Button>
        </div>
      </div>

      {/* メイン */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-10 w-10" />}
          title="タスクが見つかりません"
          description={
            items.length === 0
              ? "最初のタスクを追加してみましょう"
              : "検索条件やフィルタを変更してください"
          }
          action={
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4" />
              新規タスク
            </Button>
          }
        />
      ) : view === "board" ? (
        <BoardView
          tasks={filtered}
          memberColors={memberColors}
          onDropTask={dropTask}
          onQuickAdd={quickAdd}
          onOpen={openTask}
        />
      ) : (
        <ListView
          tasks={listTasks}
          memberColors={memberColors}
          onToggle={toggleDone}
          onOpen={openTask}
        />
      )}

      <TaskModal
        open={modalOpen}
        task={editing}
        members={memberNames}
        dealNames={deals.map((d) => d.name)}
        defaultAssignee={user?.name ?? ""}
        onClose={() => setModalOpen(false)}
        onSave={saveTask}
        onDelete={deleteTask}
      />
    </div>
  );
}
