"use client";

// ナレッジ共有 — 記事詳細モーダル / 作成・編集モーダル

import { useState } from "react";
import { Eye, Heart, Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  Field,
  Input,
  Modal,
  Select,
  Tabs,
  Textarea,
} from "@/components/ui";
import { KNOWLEDGE_CATEGORIES } from "@/lib/constants";
import { cn, formatDate, renderMarkdown, timeAgo } from "@/lib/utils";
import type { Knowledge, KnowledgeCategory } from "@/lib/types";

// ---------- 記事詳細 ----------

export function DetailModal({
  article,
  liked,
  authorColor,
  onClose,
  onToggleLike,
  onTogglePin,
  onEdit,
  onDelete,
}: {
  article: Knowledge | null;
  liked: boolean;
  authorColor: string;
  onClose: () => void;
  onToggleLike: () => void;
  onTogglePin: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  if (!article) return null;
  const cat = KNOWLEDGE_CATEGORIES[article.category];

  return (
    <Modal open onClose={onClose} title={article.title} wide>
      {/* メタ情報 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge className={cat.color}>{cat.label}</Badge>
        {article.pinned && (
          <Badge className="bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            <Pin className="h-3 w-3" />
            ピン留め
          </Badge>
        )}
        {article.tags.map((t) => (
          <span
            key={t}
            className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400"
          >
            #{t}
          </span>
        ))}
      </div>

      {/* 著者・統計 */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/50">
        <div className="flex items-center gap-2.5">
          <Avatar name={article.author_name} color={authorColor} size="sm" />
          <div>
            <p className="text-sm leading-tight font-semibold">{article.author_name}</p>
            <p className="text-[11px] leading-tight text-slate-400 dark:text-slate-500">
              投稿 {formatDate(article.created_at)} ・ 更新 {timeAgo(article.updated_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
          <span className="flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" />
            {article.views} 回閲覧
          </span>
          <span className="flex items-center gap-1">
            <Heart className="h-3.5 w-3.5" />
            {article.likes}
          </span>
        </div>
      </div>

      {/* 本文 */}
      <div
        className="prose-simple text-sm"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(article.content) }}
      />

      {/* アクション */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
        <button
          onClick={onToggleLike}
          className={cn(
            "flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all active:scale-95",
            liked
              ? "border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400"
              : "border-slate-200 text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500 dark:border-slate-700 dark:text-slate-400 dark:hover:border-rose-500/30 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
          )}
        >
          <Heart className={cn("h-4 w-4 transition-transform", liked && "scale-110 fill-current")} />
          {liked ? "いいね済み" : "いいね"}
          <span className="tabular-nums">{article.likes}</span>
        </button>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={onTogglePin}>
            {article.pinned ? (
              <>
                <PinOff className="h-4 w-4" />
                ピン解除
              </>
            ) : (
              <>
                <Pin className="h-4 w-4" />
                ピン留め
              </>
            )}
          </Button>
          <Button variant="secondary" size="sm" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
            編集
          </Button>
          <Button variant="danger" size="sm" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
            削除
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------- 作成 / 編集フォーム ----------

export interface KnowledgeFormValues {
  title: string;
  category: KnowledgeCategory;
  tags: string; // カンマ区切り
  content: string;
  pinned: boolean;
}

const EMPTY_FORM: KnowledgeFormValues = {
  title: "",
  category: "sales_tips",
  tags: "",
  content: "",
  pinned: false,
};

type EditorTab = "write" | "preview";

interface FormModalProps {
  open: boolean;
  editing: Knowledge | null;
  onClose: () => void;
  onSubmit: (values: KnowledgeFormValues) => Promise<void>;
}

/** 開くたび・編集対象が変わるたびに key で内部状態をリセットする */
export function FormModal({ open, editing, onClose, onSubmit }: FormModalProps) {
  if (!open) return null;
  return (
    <FormModalInner
      key={editing?.id ?? "new"}
      editing={editing}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

function FormModalInner({
  editing,
  onClose,
  onSubmit,
}: Omit<FormModalProps, "open">) {
  const [values, setValues] = useState<KnowledgeFormValues>(() =>
    editing
      ? {
          title: editing.title,
          category: editing.category,
          tags: editing.tags.join(", "),
          content: editing.content,
          pinned: editing.pinned,
        }
      : EMPTY_FORM
  );
  const [tab, setTab] = useState<EditorTab>("write");
  const [saving, setSaving] = useState(false);

  const canSave = values.title.trim() !== "" && values.content.trim() !== "";

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
    <Modal
      open
      onClose={onClose}
      title={editing ? "記事を編集" : "新しいナレッジを投稿"}
      wide
    >
      <div className="space-y-4">
        <Field label="タイトル" required>
          <Input
            value={values.title}
            onChange={(e) => setValues({ ...values, title: e.target.value })}
            placeholder="例: 「予算がない」と言われた時の切り返し"
            autoFocus
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="カテゴリ" required>
            <Select
              value={values.category}
              onChange={(e) =>
                setValues({ ...values, category: e.target.value as KnowledgeCategory })
              }
            >
              {(Object.keys(KNOWLEDGE_CATEGORIES) as KnowledgeCategory[]).map((k) => (
                <option key={k} value={k}>
                  {KNOWLEDGE_CATEGORIES[k].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="タグ（カンマ区切り）">
            <Input
              value={values.tags}
              onChange={(e) => setValues({ ...values, tags: e.target.value })}
              placeholder="例: テレアポ, 切り返し, 心理学"
            />
          </Field>
        </div>

        {/* 本文エディタ + プレビュー切替 */}
        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              本文（Markdown対応）
              <span className="ml-1 text-rose-500">*</span>
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
              onChange={(e) => setValues({ ...values, content: e.target.value })}
              rows={14}
              placeholder={"## 見出し\n\n本文を入力…\n\n- 箇条書き\n- **太字** も使えます"}
              className="min-h-80 font-mono text-[13px]"
            />
          ) : (
            <div className="scrollbar-thin min-h-80 max-h-96 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/40">
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

        {/* フッター */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 select-none dark:text-slate-300">
            <input
              type="checkbox"
              checked={values.pinned}
              onChange={(e) => setValues({ ...values, pinned: e.target.checked })}
              className="h-4 w-4 cursor-pointer accent-cyan-600"
            />
            <Pin className="h-4 w-4 text-amber-500" />
            一覧の最上部にピン留めする
          </label>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              キャンセル
            </Button>
            <Button onClick={submit} disabled={!canSave || saving}>
              {saving ? "保存中…" : editing ? "更新する" : "投稿する"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
