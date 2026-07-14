"use client";

// 勉強会 — 詳細モーダル / 作成・編集モーダル

import { useState, type ReactNode } from "react";
import {
  CalendarDays,
  ExternalLink,
  FileText,
  Package,
  Pencil,
  Trash2,
  Video,
} from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  Field,
  Input,
  Modal,
  Tabs,
  Textarea,
} from "@/components/ui";
import { formatDate, renderMarkdown } from "@/lib/utils";
import type { TrainingLog } from "@/lib/types";
import { categoryChip } from "./helpers";

// ---------- 詳細 ----------

/** 録画・資料への大きめリンクボタン */
function ResourceButton({
  href,
  icon,
  title,
  desc,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 transition-all hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md hover:shadow-cyan-500/10 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-cyan-500/40"
    >
      <span className="bg-brand-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-900 shadow-sm">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold group-hover:text-cyan-600 dark:group-hover:text-cyan-400">
          {title}
        </span>
        <span className="block truncate text-[11px] text-slate-400 dark:text-slate-500">
          {desc}
        </span>
      </span>
      <ExternalLink className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-cyan-500 dark:text-slate-500" />
    </a>
  );
}

export function DetailModal({
  training,
  presenterColor,
  onClose,
  onEdit,
  onDelete,
}: {
  training: TrainingLog | null;
  presenterColor: string;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  if (!training) return null;

  return (
    <Modal open onClose={onClose} title={training.title} wide>
      {/* メタ: ツール名 / カテゴリ / タグ */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-sm font-bold text-cyan-700 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-300">
          <Package className="h-4 w-4" />
          {training.tool_name}
        </span>
        <Badge className={categoryChip(training.category)}>{training.category}</Badge>
        {training.tags.map((t) => (
          <span
            key={t}
            className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400"
          >
            #{t}
          </span>
        ))}
      </div>

      {/* 発表者・開催日・サマリ */}
      <div className="mb-5 rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/50">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Avatar name={training.presenter} color={presenterColor} size="sm" />
            <div>
              <p className="text-sm leading-tight font-semibold">{training.presenter}</p>
              <p className="text-[11px] leading-tight text-slate-400 dark:text-slate-500">
                発表者
              </p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300">
            <CalendarDays className="h-4 w-4 text-cyan-500" />
            {formatDate(training.held_at)} 開催
          </span>
        </div>
        {training.summary.trim() && (
          <p className="mt-3 border-t border-slate-200/70 pt-3 text-sm leading-relaxed text-slate-600 dark:border-slate-700/70 dark:text-slate-300">
            {training.summary}
          </p>
        )}
      </div>

      {/* 録画・資料リンク */}
      {(training.video_url || training.material_url) && (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row">
          {training.video_url && (
            <ResourceButton
              href={training.video_url}
              icon={<Video className="h-5 w-5" />}
              title="録画を視聴"
              desc="勉強会のアーカイブ動画"
            />
          )}
          {training.material_url && (
            <ResourceButton
              href={training.material_url}
              icon={<FileText className="h-5 w-5" />}
              title="資料を開く"
              desc="当日の投影資料・配布物"
            />
          )}
        </div>
      )}

      {/* 議事録本文 */}
      {training.content.trim() ? (
        <div
          className="prose-simple text-sm"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(training.content) }}
        />
      ) : (
        <p className="text-sm text-slate-400 dark:text-slate-500">議事録は未記入です。</p>
      )}

      {/* アクション */}
      <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
        <Button variant="secondary" size="sm" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
          編集
        </Button>
        <Button variant="danger" size="sm" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
          削除
        </Button>
      </div>
    </Modal>
  );
}

// ---------- 作成 / 編集フォーム ----------

export interface TrainingFormValues {
  title: string;
  tool_name: string;
  category: string;
  held_at: string;
  presenter: string;
  summary: string;
  content: string;
  video_url: string;
  material_url: string;
  tags: string; // カンマ区切り
}

type EditorTab = "write" | "preview";

interface FormModalProps {
  open: boolean;
  editing: TrainingLog | null;
  /** 既存カテゴリ候補（datalist 用） */
  categoryOptions: string[];
  /** 既存ツール名候補（datalist 用） */
  toolOptions: string[];
  /** 発表者候補（datalist 用） */
  presenterOptions: string[];
  /** 新規作成時の初期値 */
  defaults: { held_at: string; presenter: string };
  onClose: () => void;
  onSubmit: (values: TrainingFormValues) => Promise<void>;
}

/** 開くたび・編集対象が変わるたびに key で内部状態をリセットする */
export function FormModal({ open, editing, ...rest }: FormModalProps) {
  if (!open) return null;
  return <FormModalInner key={editing?.id ?? "new"} editing={editing} {...rest} />;
}

function FormModalInner({
  editing,
  categoryOptions,
  toolOptions,
  presenterOptions,
  defaults,
  onClose,
  onSubmit,
}: Omit<FormModalProps, "open">) {
  const [values, setValues] = useState<TrainingFormValues>(() =>
    editing
      ? {
          title: editing.title,
          tool_name: editing.tool_name,
          category: editing.category,
          held_at: editing.held_at,
          presenter: editing.presenter,
          summary: editing.summary,
          content: editing.content,
          video_url: editing.video_url,
          material_url: editing.material_url,
          tags: editing.tags.join(", "),
        }
      : {
          title: "",
          tool_name: "",
          category: "",
          held_at: defaults.held_at,
          presenter: defaults.presenter,
          summary: "",
          content: "",
          video_url: "",
          material_url: "",
          tags: "",
        }
  );
  const [tab, setTab] = useState<EditorTab>("write");
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof TrainingFormValues>(key: K, v: TrainingFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const canSave =
    values.title.trim() !== "" &&
    values.tool_name.trim() !== "" &&
    values.category.trim() !== "" &&
    values.held_at !== "";

  const submit = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await onSubmit(values);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={editing ? "勉強会ログを編集" : "勉強会ログを作成"} wide>
      <div className="space-y-4">
        <Field label="タイトル" required>
          <Input
            value={values.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="例: クラウド会計『カウントA』新機能勉強会"
            autoFocus
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="対象ツール / 商材名" required>
            <Input
              list="training-tool-options"
              value={values.tool_name}
              onChange={(e) => set("tool_name", e.target.value)}
              placeholder="例: カウントA"
            />
            <datalist id="training-tool-options">
              {toolOptions.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Field>
          <Field label="カテゴリ" required>
            <Input
              list="training-category-options"
              value={values.category}
              onChange={(e) => set("category", e.target.value)}
              placeholder="例: SaaS / 通信 / 人材 / 社内ツール"
            />
            <datalist id="training-category-options">
              {categoryOptions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="開催日" required>
            <Input
              type="date"
              value={values.held_at}
              onChange={(e) => set("held_at", e.target.value)}
            />
          </Field>
          <Field label="発表者" required>
            <Input
              list="training-presenter-options"
              value={values.presenter}
              onChange={(e) => set("presenter", e.target.value)}
              placeholder="例: 伊藤 翔"
            />
            <datalist id="training-presenter-options">
              {presenterOptions.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </Field>
        </div>

        <Field label="一行サマリ">
          <Input
            value={values.summary}
            onChange={(e) => set("summary", e.target.value)}
            placeholder="例: 4月アップデートの新機能と訴求ポイントの共有"
          />
        </Field>

        {/* 議事録本文エディタ + プレビュー切替 */}
        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              議事録本文（Markdown対応）
            </span>
            <Tabs<EditorTab>
              tabs={[
                { key: "write", label: "編集" },
                { key: "preview", label: "プレビュー" },
              ]}
              active={tab}
              onChange={setTab}
            />
          </div>
          {tab === "write" ? (
            <Textarea
              value={values.content}
              onChange={(e) => set("content", e.target.value)}
              rows={12}
              placeholder={"## アジェンダ\n\n- 新機能デモ\n- 想定FAQ\n\n## 決定事項\n\n**Q.** …\nA. …"}
              className="min-h-72 font-mono text-[13px]"
            />
          ) : (
            <div className="scrollbar-thin max-h-96 min-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/40">
              {values.content.trim() ? (
                <div
                  className="prose-simple text-sm"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(values.content) }}
                />
              ) : (
                <p className="text-sm text-slate-400 dark:text-slate-500">
                  本文を入力するとプレビューが表示されます
                </p>
              )}
            </div>
          )}
          <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
            {"# 見出し / **太字** / - リスト / > 引用 / `コード` / [リンク](URL) が使えます"}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="録画URL">
            <Input
              type="url"
              value={values.video_url}
              onChange={(e) => set("video_url", e.target.value)}
              placeholder="https://…"
            />
          </Field>
          <Field label="資料URL">
            <Input
              type="url"
              value={values.material_url}
              onChange={(e) => set("material_url", e.target.value)}
              placeholder="https://…"
            />
          </Field>
        </div>

        <Field label="タグ（カンマ区切り）">
          <Input
            value={values.tags}
            onChange={(e) => set("tags", e.target.value)}
            placeholder="例: 会計, 新機能, 代理店"
          />
        </Field>

        {/* フッター */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={submit} disabled={!canSave || saving}>
            {saving ? "保存中…" : editing ? "更新する" : "作成する"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
