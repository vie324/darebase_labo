"use client";

// 名刺の詳細モーダルと新規/編集フォームモーダル

import { useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import {
  Building2,
  CalendarDays,
  ExternalLink,
  Globe,
  ImagePlus,
  Mail,
  MapPin,
  NotebookTabs,
  Pencil,
  Phone,
  Smartphone,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { storeFile } from "@/lib/supabase";
import { formatDate, uid } from "@/lib/utils";
import type { Contact } from "@/lib/types";
import { Avatar, Badge, Button, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import {
  companyColor,
  emptyFormValues,
  parseTags,
  toFormValues,
  type ContactFormValues,
} from "./shared";

function InfoRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">{label}</p>
        <div className="mt-0.5 text-sm font-medium break-all">{children}</div>
      </div>
    </div>
  );
}

const linkClass =
  "text-indigo-600 hover:underline underline-offset-2 dark:text-indigo-400";

// =============================================================
// 詳細モーダル
// =============================================================
export function ContactDetailModal({
  contact,
  colorOf,
  onClose,
  onEdit,
  onDelete,
}: {
  contact: Contact;
  colorOf: (name: string) => string;
  onClose: () => void;
  onEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
}) {
  return (
    <Modal open onClose={onClose} title="名刺の詳細" wide>
      <div className="space-y-5">
        {/* 名刺ヘッダー */}
        <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-gradient-to-r from-indigo-50 to-violet-50 p-5 dark:from-indigo-500/10 dark:to-violet-500/10">
          <Avatar name={contact.name} color={companyColor(contact.company)} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {contact.name_kana || " "}
            </p>
            <h3 className="truncate text-xl font-bold">{contact.name}</h3>
            <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">
              {contact.company}
              {(contact.department || contact.title) && (
                <span className="text-slate-400 dark:text-slate-500">
                  {" "}
                  ・ {[contact.department, contact.title].filter(Boolean).join(" ")}
                </span>
              )}
            </p>
          </div>
          {contact.tags.length > 0 && (
            <div className="flex w-full flex-wrap gap-1.5 sm:w-auto">
              {contact.tags.map((t) => (
                <Badge
                  key={t}
                  className="bg-white/80 text-indigo-600 dark:bg-slate-900/60 dark:text-indigo-300"
                >
                  #{t}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* 名刺画像 */}
        {contact.card_image_url && (
          <div>
            <p className="mb-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              名刺画像
            </p>
            {/* dataURL / objectURL を扱うため next/image ではなく img を使う */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={contact.card_image_url}
              alt={`${contact.name}の名刺`}
              className="max-h-64 w-full rounded-xl border border-slate-200 bg-slate-50 object-contain dark:border-slate-800 dark:bg-slate-800/50"
            />
          </div>
        )}

        {/* 連絡先・基本情報 */}
        <div className="grid gap-4 rounded-2xl bg-slate-50/80 p-4 sm:grid-cols-2 dark:bg-slate-800/40">
          <InfoRow icon={<Mail className="h-3.5 w-3.5" />} label="メールアドレス">
            {contact.email ? (
              <a href={`mailto:${contact.email}`} className={linkClass}>
                {contact.email}
              </a>
            ) : (
              "—"
            )}
          </InfoRow>
          <InfoRow icon={<Phone className="h-3.5 w-3.5" />} label="電話番号">
            {contact.phone ? (
              <a href={`tel:${contact.phone}`} className={linkClass}>
                {contact.phone}
              </a>
            ) : (
              "—"
            )}
          </InfoRow>
          <InfoRow icon={<Smartphone className="h-3.5 w-3.5" />} label="携帯番号">
            {contact.mobile ? (
              <a href={`tel:${contact.mobile}`} className={linkClass}>
                {contact.mobile}
              </a>
            ) : (
              "—"
            )}
          </InfoRow>
          <InfoRow icon={<Globe className="h-3.5 w-3.5" />} label="Webサイト">
            {contact.website ? (
              <a
                href={contact.website}
                target="_blank"
                rel="noopener noreferrer"
                className={`${linkClass} inline-flex items-center gap-1`}
              >
                {contact.website}
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            ) : (
              "—"
            )}
          </InfoRow>
          <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="住所">
            {contact.address || "—"}
          </InfoRow>
          <InfoRow icon={<Building2 className="h-3.5 w-3.5" />} label="会社名">
            {contact.company}
          </InfoRow>
        </div>

        {/* メモ */}
        {contact.memo && (
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <NotebookTabs className="h-3.5 w-3.5" />
              メモ
            </p>
            <p className="rounded-xl bg-amber-50/60 p-3.5 text-sm leading-relaxed whitespace-pre-wrap text-slate-600 dark:bg-amber-500/10 dark:text-slate-300">
              {contact.memo}
            </p>
          </div>
        )}

        {/* 登録情報 */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400 dark:text-slate-500">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            名刺交換日: {contact.exchanged_at ? formatDate(contact.exchanged_at) : "—"}
          </span>
          <span className="flex items-center gap-1.5">
            <Avatar name={contact.owner_name} color={colorOf(contact.owner_name)} size="xs" />
            登録者: {contact.owner_name}
          </span>
          <span>登録日: {formatDate(contact.created_at)}</span>
        </div>

        {/* フッター */}
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button variant="danger" size="sm" onClick={() => onDelete(contact)}>
            <Trash2 className="h-4 w-4" />
            削除
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              閉じる
            </Button>
            <Button size="sm" onClick={() => onEdit(contact)}>
              <Pencil className="h-4 w-4" />
              編集
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// =============================================================
// 新規 / 編集フォームモーダル
// =============================================================
export function ContactFormModal({
  initial,
  members,
  defaultOwner,
  onClose,
  onSubmit,
}: {
  initial: Contact | null;
  members: string[];
  defaultOwner: string;
  onClose: () => void;
  onSubmit: (values: ContactFormValues) => Promise<void>;
}) {
  // 親側で key を付けてマウントするため、初期値は useState の初期化子で確定する
  const [values, setValues] = useState<ContactFormValues>(() =>
    initial ? toFormValues(initial) : emptyFormValues(defaultOwner)
  );
  const [tagsText, setTagsText] = useState(() => (initial ? initial.tags.join(", ") : ""));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [transientImage, setTransientImage] = useState(false);

  const set = <K extends keyof ContactFormValues>(key: K, v: ContactFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const ownerOptions = Array.from(
    new Set([...members, defaultOwner, values.owner_name].filter(Boolean))
  );

  const previewTags = parseTags(tagsText);
  const valid = values.name.trim() !== "" && values.company.trim() !== "";

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const { url, persistent } = await storeFile(file, `cards/${uid()}.${ext}`);
      set("card_image_url", url);
      setTransientImage(!persistent);
    } catch {
      alert("画像のアップロードに失敗しました。時間をおいて再度お試しください。");
    } finally {
      setUploading(false);
      input.value = "";
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || saving || uploading) return;
    setSaving(true);
    try {
      await onSubmit({
        ...values,
        name: values.name.trim(),
        name_kana: values.name_kana.trim(),
        company: values.company.trim(),
        department: values.department.trim(),
        title: values.title.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
        mobile: values.mobile.trim(),
        address: values.address.trim(),
        website: values.website.trim(),
        memo: values.memo.trim(),
        tags: previewTags,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={initial ? "名刺を編集" : "名刺を登録"} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="氏名" required>
            <Input
              value={values.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="例: 山田 太郎"
              autoFocus
              required
            />
          </Field>
          <Field label="フリガナ">
            <Input
              value={values.name_kana}
              onChange={(e) => set("name_kana", e.target.value)}
              placeholder="例: ヤマダ タロウ"
            />
          </Field>
          <Field label="会社名" required className="sm:col-span-2">
            <Input
              value={values.company}
              onChange={(e) => set("company", e.target.value)}
              placeholder="例: 株式会社サンプル"
              required
            />
          </Field>
          <Field label="部署">
            <Input
              value={values.department}
              onChange={(e) => set("department", e.target.value)}
              placeholder="例: 営業企画部"
            />
          </Field>
          <Field label="役職">
            <Input
              value={values.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="例: 部長"
            />
          </Field>
          <Field label="メールアドレス">
            <Input
              type="email"
              value={values.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="例: yamada@example.com"
            />
          </Field>
          <Field label="Webサイト">
            <Input
              type="url"
              value={values.website}
              onChange={(e) => set("website", e.target.value)}
              placeholder="例: https://example.com"
            />
          </Field>
          <Field label="電話番号">
            <Input
              type="tel"
              value={values.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="例: 03-1234-5678"
            />
          </Field>
          <Field label="携帯番号">
            <Input
              type="tel"
              value={values.mobile}
              onChange={(e) => set("mobile", e.target.value)}
              placeholder="例: 090-1234-5678"
            />
          </Field>
          <Field label="住所" className="sm:col-span-2">
            <Input
              value={values.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder="例: 東京都港区芝公園1-2-3"
            />
          </Field>
          <Field label="名刺交換日">
            <Input
              type="date"
              value={values.exchanged_at}
              onChange={(e) => set("exchanged_at", e.target.value)}
            />
          </Field>
          <Field label="登録者">
            <Select
              value={values.owner_name}
              onChange={(e) => set("owner_name", e.target.value)}
            >
              {ownerOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="タグ（カンマ区切り）" className="sm:col-span-2">
            <Input
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="例: 決裁者, IT, 展示会"
            />
            {previewTags.length > 0 && (
              <span className="mt-2 flex flex-wrap gap-1.5">
                {previewTags.map((t) => (
                  <Badge
                    key={t}
                    className="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"
                  >
                    #{t}
                  </Badge>
                ))}
              </span>
            )}
          </Field>
          <Field label="メモ" className="sm:col-span-2">
            <Textarea
              value={values.memo}
              onChange={(e) => set("memo", e.target.value)}
              rows={3}
              placeholder="先方の関心事・人柄・次のアプローチなど（任意）"
            />
          </Field>

          {/* 名刺画像 */}
          <div className="sm:col-span-2">
            <p className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-slate-400">
              名刺画像
            </p>
            {values.card_image_url ? (
              <div className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={values.card_image_url}
                  alt="名刺画像プレビュー"
                  className="max-h-44 rounded-xl border border-slate-200 bg-slate-50 object-contain dark:border-slate-700 dark:bg-slate-800/50"
                />
                <button
                  type="button"
                  onClick={() => {
                    set("card_image_url", "");
                    setTransientImage(false);
                  }}
                  aria-label="名刺画像を削除"
                  className="absolute -top-2 -right-2 cursor-pointer rounded-full bg-slate-700 p-1 text-white shadow transition-colors hover:bg-rose-500"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <label
                className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-200 py-6 text-slate-400 transition-colors hover:border-indigo-300 hover:text-indigo-500 dark:border-slate-700 dark:text-slate-500 dark:hover:border-indigo-500/50 dark:hover:text-indigo-400 ${uploading ? "pointer-events-none opacity-60" : ""}`}
              >
                <ImagePlus className="h-6 w-6" />
                <span className="text-xs font-medium">
                  {uploading ? "アップロード中…" : "クリックして名刺画像を選択（JPG / PNG）"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFile}
                  disabled={uploading}
                />
              </label>
            )}
            {transientImage && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                デモモードでは 1.5MB を超える画像はこのブラウザのセッション中のみ表示されます。
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button type="submit" disabled={!valid || saving || uploading}>
            {initial ? <Pencil className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {initial ? "保存する" : "登録する"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
