// =============================================================
// 請求書 OCR — 名刺OCR（contacts/ocr.ts の runOcr）を再利用し、
// 認識テキストから請求書のフィールドを推定する。
// tesseract.js は画像のみ対応（PDFは不可）な点に注意。
// =============================================================

export { runOcr } from "../contacts/ocr";

export interface ParsedInvoiceFields {
  /** 税込の請求合計（見つかった場合） */
  total?: number;
  /** 税抜金額 */
  subtotal?: number;
  /** 消費税額 */
  tax?: number;
  invoice_number?: string;
  /** 支払期日 YYYY-MM-DD */
  due_date?: string;
  /** 発行日 YYYY-MM-DD */
  issue_date?: string;
  /** 発行元（会社名らしき行） */
  partner_name?: string;
  title?: string;
}

/** "1,234,567" や全角数字・¥付きの文字列を number へ（失敗時 null） */
export function parseAmount(raw: string): number | null {
  const normalized = raw
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[¥￥\s,，、円]/g, "");
  if (!/^\d+$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isSafeInteger(n) ? n : null;
}

/** "2026年7月31日" / "2026/7/31" / "2026-07-31" → "2026-07-31" */
function parseJpDate(raw: string): string | null {
  const normalized = raw.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );
  const m =
    normalized.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/) ??
    normalized.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const month = Number(mo);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const AMOUNT_PART = "[¥￥]?\\s*([0-9０-９][0-9０-９,，\\s]*)";

/** OCRテキストから請求書フィールドを推定する（見つかったものだけ返す） */
export function parseInvoiceText(text: string): ParsedInvoiceFields {
  const result: ParsedInvoiceFields = {};
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const joined = lines.join("\n");

  // 合計金額（税込を優先）
  const totalMatch =
    joined.match(new RegExp(`(?:ご請求金額|請求金額|ご請求額|合計金額|税込合計|合計)\\s*[:：]?\\s*${AMOUNT_PART}`)) ??
    null;
  if (totalMatch) {
    const n = parseAmount(totalMatch[1]);
    if (n !== null && n > 0) result.total = n;
  }

  // 税抜金額
  const subtotalMatch = joined.match(
    new RegExp(`(?:小計|税抜金額|税抜合計)\\s*[:：]?\\s*${AMOUNT_PART}`)
  );
  if (subtotalMatch) {
    const n = parseAmount(subtotalMatch[1]);
    if (n !== null && n > 0) result.subtotal = n;
  }

  // 消費税
  const taxMatch = joined.match(
    new RegExp(`(?:消費税(?:等)?(?:\\s*[(（]?10%[)）]?)?)\\s*[:：]?\\s*${AMOUNT_PART}`)
  );
  if (taxMatch) {
    const n = parseAmount(taxMatch[1]);
    if (n !== null && n > 0) result.tax = n;
  }

  // 請求書番号
  const numberMatch = joined.match(
    /(?:請求書番号|請求番号|伝票番号|No[.:：]?)\s*[:：]?\s*([A-Za-z0-9][A-Za-z0-9_-]{2,20})/
  );
  if (numberMatch) result.invoice_number = numberMatch[1];

  // 支払期日
  const dueMatch = joined.match(
    /(?:お?支払期限|お?支払期日|振込期限|お振込期日|支払日)\s*[:：]?\s*([^\n]+)/
  );
  if (dueMatch) {
    const d = parseJpDate(dueMatch[1]);
    if (d) result.due_date = d;
  }

  // 発行日
  const issueMatch = joined.match(/(?:発行日|請求日)\s*[:：]?\s*([^\n]+)/);
  if (issueMatch) {
    const d = parseJpDate(issueMatch[1]);
    if (d) result.issue_date = d;
  }

  // 発行元: 会社名らしき行（「御中」「様」の宛先行は除外）
  const companyLine = lines.find(
    (l) =>
      /(株式会社|合同会社|有限会社|\(株\)|（株）)/.test(l) &&
      !/(御中|様)\s*$/.test(l) &&
      l.length <= 40
  );
  if (companyLine) {
    const m = companyLine.match(
      /((?:株式会社|合同会社|有限会社|\(株\)|（株）)\s*[^\s]{1,20}|[^\s]{1,20}\s*(?:株式会社|合同会社|有限会社))/
    );
    if (m) result.partner_name = m[1].replace(/\s+/g, " ").trim();
  }

  // タイトル: 「◯◯請求書」を含む行があれば
  const titleLine = lines.find((l) => /請求書/.test(l) && l.length <= 30);
  if (titleLine) result.title = titleLine;

  return result;
}
