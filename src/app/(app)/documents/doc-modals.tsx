"use client";

// 資料のアップロード/編集フォームモーダルと詳細モーダル

import { useState, type ChangeEvent, type FormEvent } from "react";
import {
  CalendarDays,
  Download,
  FileUp,
  Pencil,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import { storeFile } from "@/lib/supabase";
import { cn, formatDateTime, timeAgo, uid } from "@/lib/utils";
import type { DocCategory, SalesDocument } from "@/lib/types";
import { DOC_CATEGORIES } from "@/lib/constants";
import { Avatar, Badge, Button, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { DownloadAction } from "./doc-card";
import {
  baseName,
  extOf,
  fileTypeStyle,
  formatSize,
  parseTags,
  type DocFormValues,
} from "./shared";

const CATEGORY_KEYS = Object.keys(DOC_CATEGORIES) as DocCategory[];

// =============================================================
// アップロード / 編集フォームモーダル
// initial あり = メタデータのみの編集（ファイル差し替えなし）
// =============================================================
export function DocFormModal({
  initial,
  onClose,
  onSubmit,
}: {
  initial: SalesDocument | null;
  onClose: () => void;
  onSubmit: (values: DocFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState<DocFormValues>(() =>
    initial
      ? {
          name: initial.name,
          category: initial.category,
          description: initial.description,
          tags: initial.tags,
          file_url: initial.file_url,
          file_type: initial.file_type,
          size_kb: initial.size_kb,
        }
      : {
          name: "",
          category: "proposal",
          description: "",
          tags: [],
          file_url: "",
          file_type: "",
          size_kb: 0,
        }
  );
  const [tagsText, setTagsText] = useState(() => (initial ? initial.tags.join(", ") : ""));
  const [fileName, setFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [transient, setTransient] = useState(false);

  const set = <K extends keyof DocFormValues>(key: K, v: DocFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const previewTags = parseTags(tagsText);
  const isEdit = initial !== null;
  // 新規はファイル選択必須
  const valid = values.name.trim() !== "" && (isEdit || values.file_url !== "");

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = extOf(file.name);
      const path = `docs/${uid()}${ext ? "." + ext : ""}`;
      const { url, persistent } = await storeFile(file, path);
      setValues((prev) => ({
        ...prev,
        file_url: url,
        file_type: ext,
        size_kb: Math.max(1, Math.round(file.size / 1024)),
        // 名前が未入力ならファイル名を初期値に
        name: prev.name.trim() === "" ? baseName(file.name) : prev.name,
      }));
      setFileName(file.name);
      setTransient(!persistent);
    } catch {
      alert("ファイルの保存に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setUploading(false);
      input.value = "";
    }
  };

  const clearFile = () => {
    setValues((prev) => ({ ...prev, file_url: "", file_type: "", size_kb: 0 }));
    setFileName("");
    setTransient(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || saving || uploading) return;
    setSaving(true);
    try {
      await onSubmit({
        ...values,
        name: values.name.trim(),
        description: values.description.trim(),
        tags: previewTags,
      });
    } finally {
      setSaving(false);
    }
  };

  const style = fileTypeStyle(values.file_type);
  const FileIcon = style.icon;

  return (
    <Modal open onClose={onClose} title={isEdit ? "資料情報を編集" : "資料をアップロード"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ---------- ファイル選択（新規のみ） ---------- */}
        {!isEdit && (
          <div>
            <p className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-slate-400">
              ファイル<span className="ml-1 text-rose-500">*</span>
            </p>
            {values.file_url ? (
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", style.tile)}>
                  <FileIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{fileName || values.name}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {style.label} ・ {formatSize(values.size_kb)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearFile}
                  aria-label="ファイルを取り消す"
                  className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-rose-500 dark:hover:bg-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-200 py-8 text-slate-400 transition-colors hover:border-cyan-300 hover:text-cyan-500 dark:border-slate-700 dark:text-slate-500 dark:hover:border-cyan-500/50 dark:hover:text-cyan-400",
                  uploading && "pointer-events-none opacity-60"
                )}
              >
                <FileUp className="h-7 w-7" />
                <span className="text-xs font-medium">
                  {uploading ? "アップロード中…" : "クリックしてファイルを選択（形式は任意）"}
                </span>
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFile}
                  disabled={uploading}
                />
              </label>
            )}
            {transient && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                デモモードのためサイズの大きいファイルは永続化されず、
                <strong>このセッション中のみ有効</strong>です。ブラウザを閉じるとダウンロードできなくなります。
              </p>
            )}
          </div>
        )}

        <Field label="資料名" required>
          <Input
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="例: 標準提案書テンプレート_v3"
            required
          />
        </Field>

        <Field label="カテゴリ" required>
          <Select
            value={values.category}
            onChange={(e) => set("category", e.target.value as DocCategory)}
          >
            {CATEGORY_KEYS.map((k) => (
              <option key={k} value={k}>
                {DOC_CATEGORIES[k].label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="説明">
          <Textarea
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
            rows={3}
            placeholder="どんな場面で使う資料か、使い方の注意点など（任意）"
          />
        </Field>

        <Field label="タグ（カンマ区切り）">
          <Input
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="例: テンプレート, 全商材"
          />
          {previewTags.length > 0 && (
            <span className="mt-2 flex flex-wrap gap-1.5">
              {previewTags.map((t) => (
                <Badge
                  key={t}
                  className="bg-cyan-50 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-300"
                >
                  #{t}
                </Badge>
              ))}
            </span>
          )}
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button type="submit" disabled={!valid || saving || uploading}>
            {isEdit ? <Pencil className="h-4 w-4" /> : <FileUp className="h-4 w-4" />}
            {saving ? "保存中…" : isEdit ? "保存する" : "アップロード"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// =============================================================
// 詳細モーダル
// =============================================================
export function DocDetailModal({
  doc,
  colorOf,
  onClose,
  onEdit,
  onDelete,
  onDownloaded,
}: {
  doc: SalesDocument;
  colorOf: (name: string) => string;
  onClose: () => void;
  onEdit: (doc: SalesDocument) => void;
  onDelete: (doc: SalesDocument) => void;
  onDownloaded: (doc: SalesDocument) => void;
}) {
  const style = fileTypeStyle(doc.file_type);
  const Icon = style.icon;
  const cat = DOC_CATEGORIES[doc.category];

  return (
    <Modal open onClose={onClose} title="資料の詳細">
      <div className="space-y-5">
        {/* ヘッダー */}
        <div className="flex items-start gap-4 rounded-2xl bg-gradient-to-r from-cyan-50 to-sky-50 p-5 dark:from-cyan-500/10 dark:to-sky-500/10">
          <div className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl", style.tile)}>
            <Icon className="h-7 w-7" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={cat.color}>{cat.label}</Badge>
              <span className={cn("text-[11px] font-bold tracking-wider", style.text)}>
                {style.label} ・ {formatSize(doc.size_kb)}
              </span>
            </div>
            <h3 className="mt-1.5 leading-snug font-bold break-words">{doc.name}</h3>
          </div>
        </div>

        {/* 説明 */}
        {doc.description && (
          <p className="rounded-xl bg-slate-50 p-4 text-sm leading-relaxed whitespace-pre-wrap text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
            {doc.description}
          </p>
        )}

        {/* タグ */}
        {doc.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Tags className="h-4 w-4 text-slate-400" aria-hidden />
            {doc.tags.map((t) => (
              <Badge
                key={t}
                className="bg-cyan-50 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-300"
              >
                #{t}
              </Badge>
            ))}
          </div>
        )}

        {/* メタ情報 */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400 dark:text-slate-500">
          <span className="flex items-center gap-1.5">
            <Avatar name={doc.uploaded_by} color={colorOf(doc.uploaded_by)} size="xs" />
            アップロード: {doc.uploaded_by}
          </span>
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatDateTime(doc.created_at)}（{timeAgo(doc.created_at)}）
          </span>
          <span className="flex items-center gap-1.5">
            <Download className="h-3.5 w-3.5" />
            累計 {doc.downloads} DL
          </span>
        </div>

        {/* フッター */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button variant="danger" size="sm" onClick={() => onDelete(doc)}>
            <Trash2 className="h-4 w-4" />
            削除
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <DownloadAction doc={doc} onDownloaded={onDownloaded} size="md" />
            <Button variant="secondary" size="sm" onClick={() => onEdit(doc)}>
              <Pencil className="h-4 w-4" />
              編集
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
