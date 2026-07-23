// 請求・支払モジュール内で共有するヘルパー・型

import { getSignedFileUrl } from "@/lib/supabase";
import { INVOICE_STATUSES } from "@/lib/constants";
import { toDateStr } from "@/lib/utils";
import type {
  CommissionRate,
  Invoice,
  InvoiceDirection,
  InvoiceStatus,
  Partner,
} from "@/lib/types";

// ---------- 金額計算（端数は円未満切り捨てで統一） ----------

export const TAX_RATE = 0.1;

export function calcTax(subtotal: number): number {
  return Math.floor(subtotal * TAX_RATE);
}

/** 代理店取り分。percent は円未満切り捨て、fixed は明細金額を上限とする */
export function calcAgencyShare(amount: number, rate: CommissionRate): number {
  if (rate.rate_type === "fixed") return Math.min(rate.fixed_fee, Math.max(0, amount));
  return Math.floor((amount * rate.rate_percent) / 100);
}

/**
 * 率マスタから適用ルールを探す。
 * - 商材名の完全一致 > メーカー全体デフォルト（product_name=""）の優先順
 * - 対象月（YYYY-MM）が適用期間 effective_from/to に入っているもののみ
 */
export function findRate(
  rates: CommissionRate[],
  agencyId: string,
  makerId: string | null,
  productName: string,
  statementMonth: string
): CommissionRate | null {
  if (!makerId) return null;
  const refDate = statementMonth ? `${statementMonth}-01` : "";
  const candidates = rates.filter((r) => {
    if (r.agency_id !== agencyId || r.maker_id !== makerId) return false;
    if (refDate) {
      if (r.effective_from && refDate < r.effective_from) return false;
      if (r.effective_to && refDate > r.effective_to) return false;
    }
    return true;
  });
  return (
    candidates.find((r) => r.product_name !== "" && r.product_name === productName) ??
    candidates.find((r) => r.product_name === "") ??
    null
  );
}

// ---------- 請求書ステータス・残額 ----------

/** 消込対象として「開いている」か（下書き・取消・全額消込済みを除く） */
export function isOpenInvoice(inv: Invoice): boolean {
  return inv.status !== "cancelled" && inv.status !== "paid" && inv.status !== "draft";
}

/** 未消込残額（円） */
export function openBalance(inv: Invoice): number {
  if (!isOpenInvoice(inv)) return 0;
  return Math.max(0, inv.total - inv.paid_amount);
}

/** 支払期日を過ぎているか */
export function isOverdue(inv: Invoice, today: string): boolean {
  return isOpenInvoice(inv) && inv.due_date !== "" && inv.due_date < today;
}

/** 期日超過日数（正の値 = 超過） */
export function overdueDays(inv: Invoice, today: string): number {
  if (!inv.due_date) return 0;
  const due = new Date(inv.due_date + "T00:00:00");
  const now = new Date(today + "T00:00:00");
  if (isNaN(due.getTime()) || isNaN(now.getTime())) return 0;
  return Math.round((now.getTime() - due.getTime()) / 86_400_000);
}

/** 方向を踏まえたステータス表示（paid は入金済/支払済を出し分け） */
export function statusLabel(inv: Invoice): string {
  if (inv.status === "paid") return inv.direction === "receivable" ? "入金済" : "支払済";
  return INVOICE_STATUSES[inv.status].label;
}

/** 発行日 + 取引先の支払サイト（default_due_days）から期日を計算 */
export function nextDueDate(issueDate: string, partner: Partner | undefined): string {
  if (!issueDate) return "";
  const d = new Date(issueDate + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + (partner?.default_due_days ?? 30));
  return toDateStr(d);
}

// ---------- 取引先ルックアップ ----------

export function partnerName(partners: Partner[], id: string | null): string {
  if (!id) return "";
  return partners.find((p) => p.id === id)?.name ?? "";
}

/** 請求書の表示名（紐付け済みなら最新のマスタ名、なければスナップショット） */
export function invoicePartnerLabel(inv: Invoice, partners: Partner[]): string {
  return partnerName(partners, inv.partner_id) || inv.partner_name || "（取引先未設定）";
}

// ---------- 添付ファイル参照の解決 ----------

/**
 * Invoice.file_url の参照をブラウザで表示できるURLに解決する。
 * - http(s) / data: / blob: はそのまま（デモモード・外部URL）
 * - それ以外は非公開バケット "invoices" のパスとみなし署名URLを取得
 */
export async function resolveInvoiceFileUrl(ref: string): Promise<string | null> {
  if (!ref) return null;
  if (/^(https?:|data:|blob:)/.test(ref)) return ref;
  return getSignedFileUrl(ref);
}

/** 画像として表示できるファイルタイプか（OCR対象の判定にも使用） */
export function isImageType(fileType: string): boolean {
  return ["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(fileType.toLowerCase());
}

// ---------- 請求書フォーム ----------

export interface InvoiceFormValues {
  direction: InvoiceDirection;
  partner_id: string; // "" = 未選択（保存時に null へ変換）
  partner_name: string;
  invoice_number: string;
  title: string;
  subtotal: number;
  tax: number;
  withholding: number;
  issue_date: string;
  due_date: string;
  status: InvoiceStatus;
  file_url: string;
  file_type: string;
  ocr_text: string;
  memo: string;
}

export function toFormValues(inv: Invoice): InvoiceFormValues {
  return {
    direction: inv.direction,
    partner_id: inv.partner_id ?? "",
    partner_name: inv.partner_name,
    invoice_number: inv.invoice_number,
    title: inv.title,
    subtotal: inv.subtotal,
    tax: inv.tax,
    withholding: inv.withholding,
    issue_date: inv.issue_date,
    due_date: inv.due_date,
    status: inv.status,
    file_url: inv.file_url,
    file_type: inv.file_type,
    ocr_text: inv.ocr_text,
    memo: inv.memo,
  };
}

export function emptyFormValues(direction: InvoiceDirection, today: string): InvoiceFormValues {
  return {
    direction,
    partner_id: "",
    partner_name: "",
    invoice_number: "",
    title: "",
    subtotal: 0,
    tax: 0,
    withholding: 0,
    issue_date: today,
    due_date: "",
    status: direction === "receivable" ? "draft" : "confirmed",
    file_url: "",
    file_type: "",
    ocr_text: "",
    memo: "",
  };
}

/** フォーム値から合計を計算 */
export function formTotal(v: Pick<InvoiceFormValues, "subtotal" | "tax" | "withholding">): number {
  return v.subtotal + v.tax - v.withholding;
}
