// =============================================================
// 銀行・支店リストのCSV取込（UI非依存の純粋ロジック）
//
// 先方から提供される銀行・支店リストを取り込む。
// フローは「列マッピング → ドライラン（差分プレビュー）→ 確定」の2段階。
// 重複判定は §5-1 の指定どおり **銀行コード + 支店コード**。
// コードが無い行は 銀行名 + 支店名 で突き合わせる（実データにコードが
// 入っていないケースへのフォールバック）。
//
// 【ランタイム依存なし】node の型ストリップでテストできるよう、
// 値の import は同ディレクトリの csv.ts のみに限定している。
// =============================================================

import { parseDelimited } from "./csv.ts";
import type { Bank, Branch } from "./types";

// ---------- 列マッピング ----------

/** 取込対象の列。-1 = 未割当 */
export interface BranchColumnMapping {
  bankName: number;
  bankCode: number;
  branchName: number;
  branchCode: number;
  prefecture: number;
  address: number;
  assignee: number;
  note: number;
}

export const EMPTY_MAPPING: BranchColumnMapping = {
  bankName: -1,
  bankCode: -1,
  branchName: -1,
  branchCode: -1,
  prefecture: -1,
  address: -1,
  assignee: -1,
  note: -1,
};

/** 取込対象列のラベル（マッピングUIの表示にも使う） */
export const BRANCH_COLUMN_LABELS: { key: keyof BranchColumnMapping; label: string; required: boolean }[] = [
  { key: "bankName", label: "銀行名", required: true },
  { key: "branchName", label: "支店名", required: true },
  { key: "bankCode", label: "銀行コード", required: false },
  { key: "branchCode", label: "支店コード", required: false },
  { key: "prefecture", label: "都道府県", required: false },
  { key: "address", label: "住所", required: false },
  { key: "assignee", label: "担当者", required: false },
  { key: "note", label: "備考", required: false },
];

/** ヘッダ行から列マッピングを推測する */
export function guessBranchMapping(header: string[]): BranchColumnMapping {
  const find = (patterns: RegExp[]) =>
    header.findIndex((h) => patterns.some((p) => p.test(h)));
  return {
    // 「銀行コード」を「銀行名」として拾わないよう、コード系を先に除外する
    bankName: find([/^(?!.*(コード|CD|cd|番号)).*(銀行|金融機関|信用金庫|信金).*$/]),
    bankCode: find([/(銀行|金融機関).*(コード|CD|cd|番号)/, /^金融機関コード$/]),
    branchName: find([/^(?!.*(コード|CD|cd|番号)).*(支店|店舗|営業店).*$/]),
    branchCode: find([/(支店|店舗|営業店).*(コード|CD|cd|番号)/, /^店番/]),
    prefecture: find([/都道府県/, /^県$/, /エリア/]),
    address: find([/住所/, /所在地/]),
    assignee: find([/担当/, /営業担当/]),
    note: find([/備考/, /メモ/, /note/i]),
  };
}

/**
 * 見出しらしいセルの判定。
 * データ値（"みらい銀行" "渋谷支店"）を見出しと誤認しないよう、
 * 「〜名 / 〜コード / 〜番号」で終わるか、既知の見出し語そのものの場合だけ真とする。
 */
const HEADER_CELL =
  /^(.*(名|コード|ｺｰﾄﾞ|CD|cd|番号|区分|状態|ｽﾃｰﾀｽ|ステータス)|住所|所在地|都道府県|県|エリア|地区|担当|担当者|営業担当|備考|メモ|note|店番)$/;

/**
 * 1行目がヘッダ行かどうかの推定。
 * 誤判定は取込UIのチェックボックスで手動修正できる（あくまで初期値）。
 */
export function looksLikeHeader(row: string[]): boolean {
  return row.some((cell) => HEADER_CELL.test(cell.trim()));
}

// ---------- ドライランの結果 ----------

export type ImportAction = "create" | "update" | "skip" | "error";

export interface ImportRow {
  /** CSV上の行番号（1始まり・ヘッダを含む） */
  lineNo: number;
  bankName: string;
  bankCode: string;
  branchName: string;
  branchCode: string;
  prefecture: string;
  address: string;
  assignee: string;
  note: string;
  action: ImportAction;
  /** 更新対象の既存支店 id（action = "update" のときのみ） */
  existingBranchId?: string;
  /** 既存銀行 id（見つかった場合。無ければ取込時に新規作成する） */
  existingBankId?: string;
  /** 新規銀行として作成されるか（同一取込内の重複は1件にまとめる） */
  createsBank: boolean;
  /** skip / error の理由 */
  reason: string;
}

export interface ImportPlan {
  rows: ImportRow[];
  newBanks: { name: string; code: string }[];
  createCount: number;
  updateCount: number;
  skipCount: number;
  errorCount: number;
}

function cell(row: string[], index: number): string {
  return index >= 0 && index < row.length ? row[index].trim() : "";
}

/** 全角数字・記号を含むコードを比較用に正規化する */
function normalizeCode(code: string): string {
  return code
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\s-－ー]/g, "")
    .toUpperCase();
}

function normalizeName(name: string): string {
  return name.replace(/[\s　]/g, "");
}

/**
 * 取込プランを組み立てる（ドライラン）。DBは一切変更しない。
 *
 * @param rows      ヘッダを除いたデータ行
 * @param mapping   列マッピング
 * @param banks     既存の銀行
 * @param branches  既存の支店
 * @param headerOffset ヘッダ行を除いた場合は 1（行番号の表示用）
 */
export function buildImportPlan(
  rows: string[][],
  mapping: BranchColumnMapping,
  banks: Bank[],
  branches: Branch[],
  headerOffset = 1
): ImportPlan {
  // 既存銀行のインデックス（コード優先 → 名称）
  const bankByCode = new Map<string, Bank>();
  const bankByName = new Map<string, Bank>();
  for (const b of banks) {
    if (b.code) bankByCode.set(normalizeCode(b.code), b);
    bankByName.set(normalizeName(b.name), b);
  }

  // 既存支店のインデックス（銀行id + 支店コード / 銀行id + 支店名）
  const branchByCode = new Map<string, Branch>();
  const branchByName = new Map<string, Branch>();
  for (const b of branches) {
    if (b.code) branchByCode.set(`${b.bank_id}::${normalizeCode(b.code)}`, b);
    branchByName.set(`${b.bank_id}::${normalizeName(b.name)}`, b);
  }

  // 同一の取込内での重複検出用（CSV・貼り付け・かんたん入力に共通）
  const seen = new Set<string>();
  const newBanks: { name: string; code: string }[] = [];
  const newBankKeys = new Set<string>();

  const result: ImportRow[] = rows.map((raw, i) => {
    const bankName = cell(raw, mapping.bankName);
    const bankCode = cell(raw, mapping.bankCode);
    const branchName = cell(raw, mapping.branchName);
    const branchCode = cell(raw, mapping.branchCode);

    const base = {
      lineNo: i + 1 + headerOffset,
      bankName,
      bankCode,
      branchName,
      branchCode,
      prefecture: cell(raw, mapping.prefecture),
      address: cell(raw, mapping.address),
      assignee: cell(raw, mapping.assignee),
      note: cell(raw, mapping.note),
      createsBank: false,
    };

    if (!bankName || !branchName) {
      return {
        ...base,
        action: "error" as const,
        reason: !bankName ? "銀行名がありません" : "支店名がありません",
      };
    }

    // 銀行の解決: コード一致 → 名称一致 → 新規
    const existingBank =
      (bankCode ? bankByCode.get(normalizeCode(bankCode)) : undefined) ??
      bankByName.get(normalizeName(bankName));

    // 同じ銀行×支店が2回出てくる行は、後勝ちにせずスキップする
    const dedupeKey = `${normalizeName(bankName)}::${
      branchCode ? normalizeCode(branchCode) : normalizeName(branchName)
    }`;
    if (seen.has(dedupeKey)) {
      return {
        ...base,
        action: "skip" as const,
        existingBankId: existingBank?.id,
        reason: "同じ支店が複数行にあります",
      };
    }
    seen.add(dedupeKey);

    let createsBank = false;
    if (!existingBank && !newBankKeys.has(normalizeName(bankName))) {
      newBankKeys.add(normalizeName(bankName));
      newBanks.push({ name: bankName, code: bankCode });
      createsBank = true;
    }

    // 既存支店の解決（銀行が未作成なら当然新規）
    const existingBranch = existingBank
      ? (branchCode
          ? branchByCode.get(`${existingBank.id}::${normalizeCode(branchCode)}`)
          : undefined) ?? branchByName.get(`${existingBank.id}::${normalizeName(branchName)}`)
      : undefined;

    if (existingBranch) {
      return {
        ...base,
        createsBank,
        action: "update" as const,
        existingBranchId: existingBranch.id,
        existingBankId: existingBank?.id,
        reason: "",
      };
    }

    return {
      ...base,
      createsBank,
      action: "create" as const,
      existingBankId: existingBank?.id,
      reason: "",
    };
  });

  return {
    rows: result,
    newBanks,
    createCount: result.filter((r) => r.action === "create").length,
    updateCount: result.filter((r) => r.action === "update").length,
    skipCount: result.filter((r) => r.action === "skip").length,
    errorCount: result.filter((r) => r.action === "error").length,
  };
}

/** CSVテキスト → （ヘッダ推定込みの）行データ */
export function parseBranchCsv(text: string): {
  header: string[];
  rows: string[][];
  mapping: BranchColumnMapping;
  hasHeader: boolean;
} {
  const all = parseDelimited(text);
  if (all.length === 0) {
    return { header: [], rows: [], mapping: EMPTY_MAPPING, hasHeader: false };
  }
  const hasHeader = looksLikeHeader(all[0]);
  return {
    header: all[0],
    rows: hasHeader ? all.slice(1) : all,
    // 見出しが無い場合は列の意味を推測できないため、UIで手動割り当てしてもらう
    mapping: hasHeader ? guessBranchMapping(all[0]) : EMPTY_MAPPING,
    hasHeader,
  };
}

/** 必須列（銀行名・支店名）が割り当てられているか */
export function isMappingReady(mapping: BranchColumnMapping): boolean {
  return mapping.bankName >= 0 && mapping.branchName >= 0;
}
