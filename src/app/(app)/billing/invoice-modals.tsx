"use client";

// 請求書のフォームモーダル / 詳細モーダル / 添付ファイルプレビュー

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import {
  CalendarDays,
  ExternalLink,
  FileUp,
  Pencil,
  ScanLine,
  Send,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { storeInvoiceFile } from "@/lib/supabase";
import { cn, formatDate, formatYen, uid } from "@/lib/utils";
import type {
  Invoice,
  InvoiceDirection,
  InvoicePayment,
  InvoiceStatus,
  Partner,
} from "@/lib/types";
import {
  INVOICE_DIRECTIONS,
  INVOICE_SOURCES,
  INVOICE_STATUSES,
  PARTNER_KINDS,
} from "@/lib/constants";
import { Badge, Button, Field, Input, Modal, ProgressBar, Select, Skeleton, Textarea } from "@/components/ui";
import { extOf, fileTypeStyle } from "../documents/shared";
import { parseInvoiceText, runOcr } from "./invoice-ocr";
import {
  calcTax,
  formTotal,
  invoicePartnerLabel,
  isImageType,
  isOverdue,
  nextDueDate,
  overdueDays,
  resolveInvoiceFileUrl,
  statusLabel,
  toFormValues,
  emptyFormValues,
  type InvoiceFormValues,
} from "./shared";

const STATUS_KEYS = Object.keys(INVOICE_STATUSES) as InvoiceStatus[];
const KIND_ORDER = ["maker", "agency", "client"] as const;

// =============================================================
// 添付ファイルプレビュー（署名URL解決込み）
// =============================================================
export function InvoiceFileView({
  fileRef,
  fileType,
  className,
}: {
  fileRef: string;
  fileType: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    // fileRef切替時に前のプレビューを即座に破棄する（外部システム=Storageとの同期）
    /* eslint-disable react-hooks/set-state-in-effect */
    setUrl(null);
    setFailed(false);
    /* eslint-enable react-hooks/set-state-in-effect */
    if (!fileRef) return;
    resolveInvoiceFileUrl(fileRef)
      .then((u) => {
        if (!alive) return;
        if (u) setUrl(u);
        else setFailed(true);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [fileRef]);

  if (!fileRef) return null;
  if (failed) {
    return (
      <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-400 dark:bg-slate-800/50">
        添付ファイルを取得できませんでした（有効期限切れの可能性があります）
      </p>
    );
  }
  if (!url) return <Skeleton className={cn("h-40 rounded-xl", className)} />;
  if (isImageType(fileType)) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        {/* dataURL / 署名URL を扱うため next/image ではなく img を使う */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="請求書の添付画像"
          className={cn(
            "max-h-72 w-full rounded-xl border border-slate-200 object-contain dark:border-slate-700",
            className
          )}
        />
      </a>
    );
  }
  const style = fileTypeStyle(fileType);
  const Icon = style.icon;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:bg-slate-800"
    >
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", style.tile)}>
        <Icon className="h-5 w-5" />
      </div>
      <span className="flex-1 text-sm font-medium">添付ファイルを開く（{style.label}）</span>
      <ExternalLink className="h-4 w-4 text-slate-400" />
    </a>
  );
}

// =============================================================
// フォームモーダル（新規 / 編集）
// =============================================================
export function InvoiceFormModal({
  initial,
  defaultDirection = "receivable",
  partners,
  today,
  onClose,
  onSubmit,
}: {
  initial: Invoice | null;
  defaultDirection?: InvoiceDirection;
  partners: Partner[];
  today: string;
  onClose: () => void;
  onSubmit: (values: InvoiceFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState<InvoiceFormValues>(() =>
    initial ? toFormValues(initial) : emptyFormValues(defaultDirection, today)
  );
  // 新規は税10%自動計算をON、編集時は既存値尊重（手動扱い）
  const [autoTax, setAutoTax] = useState(initial === null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [transient, setTransient] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ocrState, setOcrState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [ocrProgress, setOcrProgress] = useState(0);

  const isEdit = initial !== null;
  const valid = values.title.trim() !== "" && values.issue_date !== "";
  const total = formTotal(values);

  const set = <K extends keyof InvoiceFormValues>(key: K, v: InvoiceFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const setSubtotal = (n: number) => {
    setValues((prev) => ({
      ...prev,
      subtotal: n,
      tax: autoTax ? calcTax(n) : prev.tax,
    }));
  };

  const toggleAutoTax = (on: boolean) => {
    setAutoTax(on);
    if (on) setValues((prev) => ({ ...prev, tax: calcTax(prev.subtotal) }));
  };

  const handlePartnerChange = (partnerId: string) => {
    const partner = partners.find((p) => p.id === partnerId);
    setValues((prev) => ({
      ...prev,
      partner_id: partnerId,
      // 表示名スナップショットは取引先選択に追従（手入力済みの場合は保持）
      partner_name:
        partner && (prev.partner_name === "" || partners.some((p) => p.name === prev.partner_name))
          ? partner.name
          : prev.partner_name,
      due_date: prev.due_date === "" ? nextDueDate(prev.issue_date, partner) : prev.due_date,
    }));
  };

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = extOf(file.name);
      const path = `manual/${uid()}${ext ? "." + ext : ""}`;
      const { ref, persistent } = await storeInvoiceFile(file, path);
      setValues((prev) => ({ ...prev, file_url: ref, file_type: ext }));
      setSelectedFile(file);
      setFileName(file.name);
      setTransient(!persistent);
      setOcrState("idle");
    } catch {
      alert("ファイルの保存に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setUploading(false);
      input.value = "";
    }
  };

  const clearFile = () => {
    setValues((prev) => ({ ...prev, file_url: "", file_type: "", ocr_text: "" }));
    setSelectedFile(null);
    setFileName("");
    setTransient(false);
    setOcrState("idle");
  };

  /** OCRで読み取り、空欄のフィールドだけ自動入力する */
  const handleOcr = async () => {
    if (!selectedFile || ocrState === "running") return;
    setOcrState("running");
    setOcrProgress(0);
    try {
      const text = await runOcr(selectedFile, setOcrProgress);
      const parsed = parseInvoiceText(text);
      setValues((prev) => {
        const next = { ...prev, ocr_text: text };
        if (prev.subtotal === 0) {
          if (parsed.subtotal) {
            next.subtotal = parsed.subtotal;
            next.tax = parsed.tax ?? (autoTax ? calcTax(parsed.subtotal) : prev.tax);
          } else if (parsed.total) {
            // 合計しか読めなかった場合は税込10%と仮定して逆算（要確認前提のプリフィル）
            const subtotal = Math.round(parsed.total / 1.1);
            next.subtotal = subtotal;
            next.tax = parsed.total - subtotal;
          }
        }
        if (prev.invoice_number === "" && parsed.invoice_number)
          next.invoice_number = parsed.invoice_number;
        if (prev.due_date === "" && parsed.due_date) next.due_date = parsed.due_date;
        if (parsed.issue_date) next.issue_date = parsed.issue_date;
        if (prev.partner_name === "" && parsed.partner_name)
          next.partner_name = parsed.partner_name;
        if (prev.title === "" && parsed.title) next.title = parsed.title;
        return next;
      });
      if (parsed.subtotal || parsed.total) setAutoTax(false);
      setOcrState("done");
    } catch {
      setOcrState("error");
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || saving || uploading) return;
    setSaving(true);
    try {
      await onSubmit({
        ...values,
        title: values.title.trim(),
        partner_name: values.partner_name.trim(),
        invoice_number: values.invoice_number.trim(),
        memo: values.memo.trim(),
      });
    } finally {
      setSaving(false);
    }
  };

  const canOcr = selectedFile !== null && isImageType(values.file_type);
  const style = fileTypeStyle(values.file_type);
  const FileIcon = style.icon;

  return (
    <Modal open onClose={onClose} title={isEdit ? "請求書を編集" : "請求書を登録"} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 方向 */}
        <div className="flex gap-2">
          {(Object.keys(INVOICE_DIRECTIONS) as InvoiceDirection[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => set("direction", d)}
              className={cn(
                "flex-1 cursor-pointer rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors",
                values.direction === d
                  ? "border-cyan-400 bg-cyan-50 text-cyan-700 dark:border-cyan-500/50 dark:bg-cyan-500/10 dark:text-cyan-300"
                  : "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
              )}
            >
              {INVOICE_DIRECTIONS[d].label}
              <span className="mt-0.5 block text-[11px] font-normal text-slate-400">
                {d === "receivable" ? "こちらから請求し入金を受ける" : "受領した請求書への支払"}
              </span>
            </button>
          ))}
        </div>

        {/* 添付ファイル + OCR */}
        <div>
          <p className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-slate-400">
            添付ファイル（画像 / PDF）
          </p>
          {values.file_url ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", style.tile)}>
                  <FileIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{fileName || "添付ファイル"}</p>
                  <p className="text-xs text-slate-400">{style.label}</p>
                </div>
                {canOcr && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleOcr}
                    disabled={ocrState === "running"}
                  >
                    <ScanLine className="h-4 w-4" />
                    {ocrState === "running" ? "読取中…" : "OCRで読み取り"}
                  </Button>
                )}
                <button
                  type="button"
                  onClick={clearFile}
                  aria-label="ファイルを取り消す"
                  className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-rose-500 dark:hover:bg-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {ocrState === "running" && (
                <div className="space-y-1">
                  <ProgressBar value={Math.round(ocrProgress * 100)} />
                  <p className="text-xs text-slate-400">画像を解析しています…（初回は辞書データの取得に時間がかかります）</p>
                </div>
              )}
              {ocrState === "done" && (
                <p className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                  <Wand2 className="h-3.5 w-3.5" />
                  読み取った内容を空欄に反映しました。金額・期日を確認してください。
                </p>
              )}
              {ocrState === "error" && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
                  OCRに失敗しました。オンライン環境か確認のうえ再度お試しください。
                </p>
              )}
              {selectedFile && !canOcr && (
                <p className="text-xs text-slate-400">
                  ※ OCRは画像ファイルのみ対応です。PDFは保存のうえ金額を手入力してください。
                </p>
              )}
              {transient && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                  デモモードのためサイズの大きいファイルは永続化されず、このセッション中のみ有効です。
                </p>
              )}
            </div>
          ) : (
            <label
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-200 py-6 text-slate-400 transition-colors hover:border-cyan-300 hover:text-cyan-500 dark:border-slate-700 dark:text-slate-500 dark:hover:border-cyan-500/50 dark:hover:text-cyan-400",
                uploading && "pointer-events-none opacity-60"
              )}
            >
              <FileUp className="h-6 w-6" />
              <span className="text-xs font-medium">
                {uploading ? "アップロード中…" : "請求書の画像・PDFを選択（画像はOCRで自動読取できます）"}
              </span>
              <input
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={handleFile}
                disabled={uploading}
              />
            </label>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="取引先">
            <Select value={values.partner_id} onChange={(e) => handlePartnerChange(e.target.value)}>
              <option value="">選択しない（下の表示名のみ）</option>
              {KIND_ORDER.map((kind) => {
                const list = partners.filter((p) => p.kind === kind && p.is_active);
                if (list.length === 0) return null;
                return (
                  <optgroup key={kind} label={PARTNER_KINDS[kind].label}>
                    {list.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </Select>
          </Field>
          <Field label="取引先表示名">
            <Input
              value={values.partner_name}
              onChange={(e) => set("partner_name", e.target.value)}
              placeholder="マスタ未登録の場合はここに社名を入力"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="件名" required>
            <Input
              value={values.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="例: 7月分 販売手数料"
              required
            />
          </Field>
          <Field label="請求書番号">
            <Input
              value={values.invoice_number}
              onChange={(e) => set("invoice_number", e.target.value)}
              placeholder="例: INV-202607-1"
            />
          </Field>
        </div>

        {/* 金額 */}
        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="税抜金額（円）" required>
              <Input
                type="number"
                min={0}
                value={values.subtotal === 0 ? "" : values.subtotal}
                onChange={(e) => setSubtotal(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                placeholder="0"
              />
            </Field>
            <Field label="消費税（円）">
              <Input
                type="number"
                min={0}
                value={values.tax === 0 ? "" : values.tax}
                onChange={(e) => set("tax", Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                disabled={autoTax}
                placeholder="0"
              />
              <label className="mt-1.5 flex cursor-pointer items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={autoTax}
                  onChange={(e) => toggleAutoTax(e.target.checked)}
                  className="h-3.5 w-3.5 accent-cyan-500"
                />
                10%を自動計算（円未満切り捨て）
              </label>
            </Field>
            <Field label="源泉徴収（円）">
              <Input
                type="number"
                min={0}
                value={values.withholding === 0 ? "" : values.withholding}
                onChange={(e) =>
                  set("withholding", Math.max(0, Math.floor(Number(e.target.value) || 0)))
                }
                placeholder="0"
              />
            </Field>
          </div>
          <p className="mt-3 border-t border-slate-100 pt-3 text-right text-sm dark:border-slate-800">
            合計 <span className="ml-2 text-xl font-bold tracking-tight">{formatYen(total)}</span>
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="発行日 / 受領日" required>
            <Input
              type="date"
              value={values.issue_date}
              onChange={(e) => set("issue_date", e.target.value)}
              required
            />
          </Field>
          <Field label="支払期日">
            <Input
              type="date"
              value={values.due_date}
              onChange={(e) => set("due_date", e.target.value)}
            />
            <button
              type="button"
              onClick={() =>
                set(
                  "due_date",
                  nextDueDate(values.issue_date, partners.find((p) => p.id === values.partner_id))
                )
              }
              className="mt-1.5 cursor-pointer text-xs text-cyan-600 hover:underline dark:text-cyan-400"
            >
              取引先の支払サイトから自動設定
            </button>
          </Field>
          <Field label="ステータス">
            <Select
              value={values.status}
              onChange={(e) => set("status", e.target.value as InvoiceStatus)}
            >
              {STATUS_KEYS.filter((s) => s !== "paid").map((s) => (
                <option key={s} value={s}>
                  {INVOICE_STATUSES[s].label}
                </option>
              ))}
            </Select>
            <p className="mt-1.5 text-xs text-slate-400">※「入金・支払済」は入金消込タブから</p>
          </Field>
        </div>

        <Field label="メモ">
          <Textarea
            value={values.memo}
            onChange={(e) => set("memo", e.target.value)}
            rows={2}
            placeholder="社内向けの補足（任意）"
          />
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button type="submit" disabled={!valid || saving || uploading}>
            {saving ? "保存中…" : isEdit ? "保存する" : "登録する"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// =============================================================
// 詳細モーダル
// =============================================================
export function InvoiceDetailModal({
  invoice,
  partners,
  payments,
  today,
  lineReady,
  onClose,
  onEdit,
  onDelete,
  onChangeStatus,
  onPushLine,
}: {
  invoice: Invoice;
  partners: Partner[];
  payments: InvoicePayment[];
  today: string;
  /** LINE送付が可能な状態か（Supabase接続 + LINE設定済 + 対象グループあり） */
  lineReady: { ok: boolean; reason: string };
  onClose: () => void;
  onEdit: (inv: Invoice) => void;
  onDelete: (inv: Invoice) => void;
  onChangeStatus: (inv: Invoice, status: InvoiceStatus) => void;
  onPushLine: (inv: Invoice) => void;
}) {
  const dir = INVOICE_DIRECTIONS[invoice.direction];
  const src = INVOICE_SOURCES[invoice.source];
  const overdue = isOverdue(invoice, today);
  const rows: [string, string][] = [
    ["税抜金額", formatYen(invoice.subtotal)],
    ["消費税", formatYen(invoice.tax)],
    ...(invoice.withholding > 0
      ? ([["源泉徴収", `-${formatYen(invoice.withholding)}`]] as [string, string][])
      : []),
  ];

  return (
    <Modal open onClose={onClose} title="請求書の詳細" wide>
      <div className="space-y-5">
        {/* ヘッダー */}
        <div className="rounded-2xl bg-gradient-to-r from-cyan-50 to-sky-50 p-5 dark:from-cyan-500/10 dark:to-sky-500/10">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={dir.color}>{dir.label}</Badge>
            <Badge className={INVOICE_STATUSES[invoice.status].color}>{statusLabel(invoice)}</Badge>
            <Badge className={src.color}>{src.label}</Badge>
            {overdue && (
              <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
                期限超過 {overdueDays(invoice, today)}日
              </Badge>
            )}
          </div>
          <h3 className="mt-2 text-lg leading-snug font-bold break-words">{invoice.title}</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {invoicePartnerLabel(invoice, partners)}
            {invoice.invoice_number && (
              <span className="ml-2 text-xs text-slate-400">No. {invoice.invoice_number}</span>
            )}
          </p>
        </div>

        {/* 金額・日付 */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between py-0.5 text-sm">
                <span className="text-slate-500 dark:text-slate-400">{label}</span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
            <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 dark:border-slate-800">
              <span className="text-sm font-semibold">合計</span>
              <span className="text-lg font-bold tracking-tight">{formatYen(invoice.total)}</span>
            </div>
            {invoice.paid_amount > 0 && (
              <div className="mt-1 flex justify-between text-sm text-emerald-600 dark:text-emerald-400">
                <span>消込済み</span>
                <span className="font-medium">{formatYen(invoice.paid_amount)}</span>
              </div>
            )}
          </div>
          <div className="space-y-2 rounded-xl border border-slate-200 p-4 text-sm dark:border-slate-700">
            <p className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <CalendarDays className="h-4 w-4" />
              発行/受領日: <span className="font-medium text-slate-700 dark:text-slate-200">{invoice.issue_date ? formatDate(invoice.issue_date) : "—"}</span>
            </p>
            <p className={cn("flex items-center gap-2", overdue ? "text-rose-600 dark:text-rose-400" : "text-slate-500 dark:text-slate-400")}>
              <CalendarDays className="h-4 w-4" />
              支払期日: <span className="font-medium">{invoice.due_date ? formatDate(invoice.due_date) : "—"}</span>
            </p>
            {invoice.paid_date && (
              <p className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CalendarDays className="h-4 w-4" />
                消込完了日: <span className="font-medium">{formatDate(invoice.paid_date)}</span>
              </p>
            )}
            {invoice.memo && (
              <p className="rounded-lg bg-slate-50 p-2.5 text-xs leading-relaxed whitespace-pre-wrap text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                {invoice.memo}
              </p>
            )}
          </div>
        </div>

        {/* 添付 */}
        {invoice.file_url && (
          <InvoiceFileView fileRef={invoice.file_url} fileType={invoice.file_type} />
        )}

        {/* 消込履歴 */}
        {payments.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-bold tracking-wider text-slate-400">消込履歴</p>
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-slate-500 dark:text-slate-400">
                    {formatDate(p.paid_on)} ・ {p.method}
                    {p.recorded_by && ` ・ ${p.recorded_by}`}
                  </span>
                  <span className="font-semibold">{formatYen(p.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* アクション */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button variant="danger" size="sm" onClick={() => onDelete(invoice)}>
            <Trash2 className="h-4 w-4" />
            削除
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            {invoice.status === "draft" && (
              <Button variant="success" size="sm" onClick={() => onChangeStatus(invoice, "sent")}>
                <Send className="h-4 w-4" />
                送付済にする
              </Button>
            )}
            {invoice.status === "received" && (
              <Button
                variant="success"
                size="sm"
                onClick={() => onChangeStatus(invoice, "confirmed")}
              >
                確認済にする
              </Button>
            )}
            {invoice.status !== "cancelled" && invoice.status !== "paid" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onChangeStatus(invoice, "cancelled")}
              >
                取消にする
              </Button>
            )}
            <span title={lineReady.ok ? "" : lineReady.reason}>
              <Button
                variant="secondary"
                size="sm"
                disabled={!lineReady.ok}
                onClick={() => onPushLine(invoice)}
              >
                <Send className="h-4 w-4" />
                LINEへ送付
              </Button>
            </span>
            <Button variant="secondary" size="sm" onClick={() => onEdit(invoice)}>
              <Pencil className="h-4 w-4" />
              編集
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
