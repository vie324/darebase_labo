// メーカー明細の取込 — CSV/TSVテキストの解析（UI非依存の純粋ロジック）

import { parseDelimited } from "@/lib/csv";
import { parseAmount } from "./invoice-ocr";

// 区切りテキストの解析は銀行・支店マスタの取込と共通のため @/lib/csv に移動した。
// 既存の呼び出し側（statements-tab）のために同名で再エクスポートする。
export { parseDelimited };

/** 列マッピング（-1 = 未割当） */
export interface ColumnMapping {
  product: number;
  customer: number;
  amount: number;
  agency: number;
}

/** ヘッダ行らしき行から列マッピングを推測する */
export function guessMapping(header: string[]): ColumnMapping {
  const findCol = (patterns: RegExp[]) =>
    header.findIndex((h) => patterns.some((p) => p.test(h)));
  return {
    product: findCol([/商材/, /商品/, /サービス/, /プラン/, /品目/]),
    customer: findCol([/顧客/, /契約者/, /エンド/, /導入先/, /会社名/, /客先/]),
    amount: findCol([/金額/, /手数料/, /報酬/, /売上/, /額/]),
    agency: findCol([/代理店/, /パートナー/, /販売店/, /取次/]),
  };
}

/** ヘッダ行かどうかの推定（金額列が数値でなければヘッダとみなす） */
export function looksLikeHeader(row: string[], amountCol: number): boolean {
  if (amountCol < 0 || amountCol >= row.length) return true;
  return parseAmount(row[amountCol]) === null;
}

export interface ImportedLine {
  product_name: string;
  customer_name: string;
  amount: number;
  /** 明細上の代理店名（そのままの文字列。partners との突き合わせは呼び出し側で） */
  agency_name: string;
}

/** マッピングに従って行データを明細行に変換する。金額が読めない行はスキップ */
export function toImportedLines(rows: string[][], mapping: ColumnMapping): ImportedLine[] {
  const cell = (row: string[], idx: number) => (idx >= 0 && idx < row.length ? row[idx] : "");
  const result: ImportedLine[] = [];
  for (const row of rows) {
    const amount = parseAmount(cell(row, mapping.amount));
    if (amount === null || amount <= 0) continue;
    result.push({
      product_name: cell(row, mapping.product),
      customer_name: cell(row, mapping.customer),
      amount,
      agency_name: cell(row, mapping.agency),
    });
  }
  return result;
}
