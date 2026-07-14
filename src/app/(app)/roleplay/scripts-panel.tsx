"use client";

// =============================================================
// ロープレ練習 — 「トークスクリプト」タブ
// スクリプトの一覧 / 検索 / 作成・編集 / 削除、練習への受け渡し
// =============================================================

import { useMemo, useState } from "react";
import { FileText, Mic, Pencil, Plus, Trash2 } from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  SearchInput,
  Select,
  Tabs,
  Textarea,
} from "@/components/ui";
import { formatDate, renderMarkdown, timeAgo } from "@/lib/utils";
import type { TalkScript } from "@/lib/types";
import { SCRIPT_CATEGORIES, scriptCategoryColor } from "./helpers";

type NewScript = Omit<TalkScript, "id" | "created_at"> &
  Partial<Pick<TalkScript, "id" | "created_at">>;

export function ScriptsPanel({
  scripts,
  userName,
  colorOf,
  onAdd,
  onUpdate,
  onRemove,
  onPractice,
}: {
  scripts: TalkScript[];
  userName: string;
  colorOf: (name: string) => string;
  onAdd: (row: NewScript) => Promise<TalkScript>;
  onUpdate: (id: string, patch: Partial<TalkScript>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onPractice: (scriptId: string) => void;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TalkScript | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    scripts.forEach((s) => set.add(s.category));
    return Array.from(set);
  }, [scripts]);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return scripts
      .filter((s) => {
        if (cat !== "all" && s.category !== cat) return false;
        if (!kw) return true;
        return (
          s.title.toLowerCase().includes(kw) ||
          s.scenario.toLowerCase().includes(kw) ||
          s.content.toLowerCase().includes(kw)
        );
      })
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }, [scripts, q, cat]);

  const startCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const startEdit = (s: TalkScript) => {
    setEditing(s);
    setFormOpen(true);
  };

  const handleDelete = async (s: TalkScript) => {
    if (!confirm(`スクリプト「${s.title}」を削除しますか？この操作は取り消せません。`)) return;
    await onRemove(s.id);
  };

  const handleSubmit = async (v: ScriptFormValues) => {
    const now = new Date().toISOString();
    if (editing) {
      await onUpdate(editing.id, {
        title: v.title.trim(),
        scenario: v.scenario.trim(),
        category: v.category,
        content: v.content,
        updated_at: now,
      });
    } else {
      await onAdd({
        title: v.title.trim(),
        scenario: v.scenario.trim(),
        category: v.category,
        content: v.content,
        author_name: userName,
        updated_at: now,
      });
    }
  };

  const tabDefs = [
    { key: "all", label: "すべて", count: scripts.length },
    ...categories.map((c) => ({
      key: c,
      label: c,
      count: scripts.filter((s) => s.category === c).length,
    })),
  ];

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <Tabs tabs={tabDefs} active={cat} onChange={setCat} />
        </div>
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="タイトル・シーン・本文で検索…"
          className="w-full sm:w-64"
        />
        <Button onClick={startCreate}>
          <Plus className="h-4 w-4" />
          スクリプト作成
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-10 w-10" />}
          title={scripts.length === 0 ? "まだスクリプトがありません" : "該当するスクリプトがありません"}
          description={
            scripts.length === 0
              ? "トークスクリプトを登録して、チームでロープレ練習を始めましょう"
              : "検索条件やカテゴリを変えてみてください"
          }
          action={
            scripts.length === 0 ? (
              <Button onClick={startCreate}>
                <Plus className="h-4 w-4" />
                最初のスクリプトを作成
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s) => (
            <Card key={s.id} hover className="flex flex-col p-5">
              <div className="mb-2 flex items-start justify-between gap-2">
                <Badge className={scriptCategoryColor(s.category)}>{s.category}</Badge>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  更新 {timeAgo(s.updated_at)}
                </span>
              </div>
              <h3 className="text-base font-bold leading-snug">{s.title}</h3>
              {s.scenario && (
                <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                  {s.scenario}
                </p>
              )}
              <div className="mt-3 line-clamp-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                {plainText(s.content)}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <Avatar name={s.author_name} color={colorOf(s.author_name)} size="xs" />
                <span className="text-xs text-slate-500 dark:text-slate-400">{s.author_name}</span>
                <span className="ml-auto text-[11px] text-slate-400 dark:text-slate-500">
                  {formatDate(s.created_at)}
                </span>
              </div>

              <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <Button size="sm" className="flex-1" onClick={() => onPractice(s.id)}>
                  <Mic className="h-4 w-4" />
                  このスクリプトで練習
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => startEdit(s)}
                  aria-label="編集"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(s)}
                  aria-label="削除"
                  className="text-slate-400 hover:text-rose-500"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {formOpen && (
        <ScriptFormModal
          key={editing?.id ?? "new"}
          editing={editing}
          onClose={() => setFormOpen(false)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}

// ---------- 作成 / 編集モーダル ----------

interface ScriptFormValues {
  title: string;
  scenario: string;
  category: string;
  content: string;
}

type EditorTab = "write" | "preview";

function ScriptFormModal({
  editing,
  onClose,
  onSubmit,
}: {
  editing: TalkScript | null;
  onClose: () => void;
  onSubmit: (values: ScriptFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState<ScriptFormValues>(() =>
    editing
      ? {
          title: editing.title,
          scenario: editing.scenario,
          category: editing.category,
          content: editing.content,
        }
      : { title: "", scenario: "", category: SCRIPT_CATEGORIES[0], content: "" }
  );
  const [tab, setTab] = useState<EditorTab>("write");
  const [saving, setSaving] = useState(false);

  // 既存スクリプトのカテゴリがプリセット外でも選択肢に含める
  const categoryOptions = Array.from(new Set<string>([...SCRIPT_CATEGORIES, values.category]));
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
    <Modal open onClose={onClose} title={editing ? "スクリプトを編集" : "スクリプトを作成"} wide>
      <div className="space-y-4">
        <Field label="タイトル" required>
          <Input
            value={values.title}
            onChange={(e) => setValues({ ...values, title: e.target.value })}
            placeholder="例: 新規テレアポ標準スクリプト"
            autoFocus
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="想定シーン">
            <Input
              value={values.scenario}
              onChange={(e) => setValues({ ...values, scenario: e.target.value })}
              placeholder="例: 初回架電・受付突破"
            />
          </Field>
          <Field label="カテゴリ" required>
            <Select
              value={values.category}
              onChange={(e) => setValues({ ...values, category: e.target.value })}
            >
              {categoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              スクリプト本文（Markdown対応）
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
              placeholder={"## 導入\n「お世話になっております…」\n\n## 切り返し\n- 「忙しい」→ …"}
              className="min-h-80 font-mono text-[13px]"
            />
          ) : (
            <div className="scrollbar-thin max-h-96 min-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/40">
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
            {"# 見出し / **太字** / - リスト / > 引用 が使えます"}
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
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

// ---------- helpers ----------

/** Markdown 記法を落として素のテキストにする（カード用プレビュー） */
function plainText(md: string): string {
  return md
    .replace(/[#>*`_-]/g, "")
    .replace(/\[(.+?)\]\((.+?)\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
