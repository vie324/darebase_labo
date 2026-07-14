"use client";

// 掲示板 — 投稿詳細モーダル（いいね・コメントスレッド） / 作成・編集モーダル

import { useState } from "react";
import { Heart, MessageCircle, Pencil, Pin, Send, Trash2 } from "lucide-react";
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
import { POST_CATEGORIES } from "@/lib/constants";
import { cn, formatDate, renderMarkdown, timeAgo } from "@/lib/utils";
import type { BoardPost, PostCategory } from "@/lib/types";
import { byCommentAsc } from "./helpers";

// ---------- 投稿詳細 ----------

export function DetailModal({
  post,
  liked,
  canManage,
  authorColor,
  currentUser,
  onClose,
  onToggleLike,
  onEdit,
  onDelete,
  onAddComment,
}: {
  post: BoardPost;
  liked: boolean;
  canManage: boolean;
  /** 名前 → アバター色 の解決関数 */
  authorColor: (name: string) => string;
  currentUser: { name: string; color: string };
  onClose: () => void;
  onToggleLike: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddComment: (content: string) => Promise<void>;
}) {
  const cat = POST_CATEGORIES[post.category];
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const comments = [...post.comments].sort(byCommentAsc);

  const submitComment = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await onAddComment(body);
      setDraft("");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={post.title} wide>
      {/* メタ情報 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge className={cat.color}>{cat.label}</Badge>
        {post.pinned && (
          <Badge className="bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            <Pin className="h-3 w-3 fill-amber-400/40" />
            ピン留め
          </Badge>
        )}
      </div>

      {/* 著者 */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800/50">
        <div className="flex items-center gap-2.5">
          <Avatar name={post.author_name} color={authorColor(post.author_name)} size="sm" />
          <div>
            <p className="text-sm leading-tight font-semibold">{post.author_name}</p>
            <p className="text-[11px] leading-tight text-slate-400 dark:text-slate-500">
              {formatDate(post.created_at)} 投稿 ・ {timeAgo(post.created_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
          <span className="flex items-center gap-1">
            <Heart className="h-3.5 w-3.5" />
            {post.likes}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="h-3.5 w-3.5" />
            {post.comments.length}
          </span>
        </div>
      </div>

      {/* 本文 */}
      <div
        className="prose-simple text-sm"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }}
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
          <span className="tabular-nums">{post.likes}</span>
        </button>

        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
              編集
            </Button>
            <Button variant="danger" size="sm" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
              削除
            </Button>
          </div>
        )}
      </div>

      {/* コメントスレッド */}
      <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-800">
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold">
          <MessageCircle className="h-4 w-4 text-indigo-500" />
          コメント
          <span className="text-slate-400 dark:text-slate-500">{post.comments.length}件</span>
        </h3>

        {comments.length > 0 ? (
          <ul className="space-y-3">
            {comments.map((c, i) => (
              <li key={`${c.created_at}-${i}`} className="flex gap-2.5">
                <Avatar name={c.author_name} color={authorColor(c.author_name)} size="sm" />
                <div className="min-w-0 flex-1 rounded-xl rounded-tl-sm bg-slate-50 px-3.5 py-2.5 dark:bg-slate-800/50">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-semibold">{c.author_name}</span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                      {timeAgo(c.created_at)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm leading-relaxed break-words whitespace-pre-wrap text-slate-600 dark:text-slate-300">
                    {c.content}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400 dark:border-slate-800 dark:text-slate-500">
            まだコメントはありません。最初のコメントを投稿しましょう。
          </p>
        )}

        {/* コメント投稿フォーム */}
        <div className="mt-4 flex gap-2.5">
          <Avatar name={currentUser.name} color={currentUser.color} size="sm" />
          <div className="min-w-0 flex-1">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="コメントを入力…"
              rows={2}
              className="min-h-0"
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  void submitComment();
                }
              }}
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                ⌘ / Ctrl + Enter で送信
              </span>
              <Button size="sm" onClick={submitComment} disabled={!draft.trim() || sending}>
                <Send className="h-3.5 w-3.5" />
                {sending ? "送信中…" : "コメント"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ---------- 作成 / 編集フォーム ----------

export interface PostFormValues {
  title: string;
  category: PostCategory;
  content: string;
  pinned: boolean;
}

const EMPTY_FORM: PostFormValues = {
  title: "",
  category: "share",
  content: "",
  pinned: false,
};

type EditorTab = "write" | "preview";

interface FormModalProps {
  open: boolean;
  editing: BoardPost | null;
  onClose: () => void;
  onSubmit: (values: PostFormValues) => Promise<void>;
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

function FormModalInner({ editing, onClose, onSubmit }: Omit<FormModalProps, "open">) {
  const [values, setValues] = useState<PostFormValues>(() =>
    editing
      ? {
          title: editing.title,
          category: editing.category,
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
    <Modal open onClose={onClose} title={editing ? "投稿を編集" : "新しい投稿"} wide>
      <div className="space-y-4">
        <Field label="タイトル" required>
          <Input
            value={values.title}
            onChange={(e) => setValues({ ...values, title: e.target.value })}
            placeholder="例: 【重要】来月の全体会議について"
            autoFocus
          />
        </Field>

        <Field label="カテゴリ" required>
          <Select
            value={values.category}
            onChange={(e) => setValues({ ...values, category: e.target.value as PostCategory })}
          >
            {(Object.keys(POST_CATEGORIES) as PostCategory[]).map((k) => (
              <option key={k} value={k}>
                {POST_CATEGORIES[k].label}
              </option>
            ))}
          </Select>
        </Field>

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
              rows={12}
              placeholder={"本文を入力…\n\n- 箇条書き\n- **太字** や > 引用 も使えます"}
              className="min-h-64 font-mono text-[13px]"
            />
          ) : (
            <div className="scrollbar-thin max-h-96 min-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/40">
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
              className="h-4 w-4 cursor-pointer accent-indigo-600"
            />
            <Pin className="h-4 w-4 text-amber-500" />
            お知らせとして最上部にピン留めする
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
