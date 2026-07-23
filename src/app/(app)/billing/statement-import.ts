// メーカー明細の取込 — CSV/TSVテキストの解析（UI非依存の純粋ロジック）

import { parseAmount } from "./invoice-ocr";

/** 区切りテキストを行×列に分解する（カンマ/タブ対応・簡易クオート処理） */
export function parseDelimited(text: string): string[][] {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  // タブが含まれていればTSV、なければCSVとして扱う
  const delimiter = lines.some((l) => l.includes("\t")) ? "\t" : ",";
  return lines.map((line) => splitLine(line, delimiter));
}

function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

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
