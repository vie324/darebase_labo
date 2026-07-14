"use client";

// タスクの新規作成・詳細編集モーダル

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import type { TaskItem, TaskPriority, TaskStatus } from "@/lib/types";

export interface TaskFormValues {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string;
  assignee_name: string;
  related_deal: string;
}

interface TaskModalProps {
  open: boolean;
  /** null = 新規作成 */
  task: TaskItem | null;
  members: string[];
  dealNames: string[];
  defaultAssignee: string;
  onClose: () => void;
  onSave: (values: TaskFormValues) => void;
  onDelete: (task: TaskItem) => void;
}

export function TaskModal({ open, task, onClose, ...rest }: TaskModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={task ? "タスクを編集" : "新規タスク"}>
      {/* Modal は閉じると子をアンマウントするため、開くたびにフォームが初期化される */}
      <TaskForm key={task?.id ?? "new"} task={task} onClose={onClose} {...rest} />
    </Modal>
  );
}

function TaskForm({
  task,
  members,
  dealNames,
  defaultAssignee,
  onClose,
  onSave,
  onDelete,
}: Omit<TaskModalProps, "open">) {
  const [form, setForm] = useState<TaskFormValues>(() =>
    task
      ? {
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          due_date: task.due_date,
          assignee_name: task.assignee_name,
          related_deal: task.related_deal,
        }
      : {
          title: "",
          description: "",
          status: "todo",
          priority: "mid",
          due_date: "",
          assignee_name: defaultAssignee,
          related_deal: "",
        }
  );

  const set = <K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const assigneeOptions = Array.from(new Set([...members, form.assignee_name].filter(Boolean)));

  const submit = () => {
    if (!form.title.trim()) return;
    onSave({ ...form, title: form.title.trim(), related_deal: form.related_deal.trim() });
  };

  return (
    <div>
      <div className="space-y-4">
        <Field label="タイトル" required>
          <Input
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="例: 提案書の初稿を作成"
            autoFocus
          />
        </Field>

        <Field label="説明">
          <Textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="補足メモや完了条件など"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="ステータス">
            <Select
              value={form.status}
              onChange={(e) => set("status", e.target.value as TaskStatus)}
            >
              {(Object.keys(TASK_STATUSES) as TaskStatus[]).map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUSES[s].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="優先度">
            <Select
              value={form.priority}
              onChange={(e) => set("priority", e.target.value as TaskPriority)}
            >
              {(Object.keys(TASK_PRIORITIES) as TaskPriority[]).map((p) => (
                <option key={p} value={p}>
                  {TASK_PRIORITIES[p].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="期限">
            <Input
              type="date"
              value={form.due_date}
              onChange={(e) => set("due_date", e.target.value)}
            />
          </Field>
          <Field label="担当者">
            <Select
              value={form.assignee_name}
              onChange={(e) => set("assignee_name", e.target.value)}
            >
              <option value="">未割当</option>
              {assigneeOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="関連案件">
          <Input
            list="task-deal-suggestions"
            value={form.related_deal}
            onChange={(e) => set("related_deal", e.target.value)}
            placeholder="案件名を入力（任意）"
          />
          <datalist id="task-deal-suggestions">
            {dealNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </Field>
      </div>

      <div className="mt-6 flex items-center gap-2">
        {task && (
          <Button
            variant="ghost"
            className="text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
            onClick={() => onDelete(task)}
          >
            <Trash2 className="h-4 w-4" />
            削除
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={submit} disabled={!form.title.trim()}>
            {task ? "保存" : "作成"}
          </Button>
        </div>
      </div>
    </div>
  );
}
