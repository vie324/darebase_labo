// =============================================================
// 支店の「かんたん入力」（UI非依存の純粋ロジック）
//
// 銀行を1つ選んで、支店名を1行1件で貼り付ける形の取込。
// 列マッピングを省けるので、銀行から受け取った支店一覧や
// メールの本文をそのまま貼るだけで登録できる。
//
// 解析した行は branch-import.ts の buildImportPlan に渡せる形
// （string[][]）にして返す。重複判定・差分プレビュー・確定処理は
// CSV取込とまったく同じ経路を通る（挙動を2つに分けないため）。
//
// 【ランタイム依存なし】node の型ストリップでテストできるよう、
// 値の import は branch-import.ts のみに限定している。
// =============================================================

import type { BranchColumnMapping } from "./branch-import.ts";

/** かんたん入力が組み立てる行の列順（buildImportPlan にそのまま渡す） */
export const QUICK_ADD_MAPPING: BranchColumnMapping = {
  bankName: 0,
  bankCode: 1,
  branchName: 2,
  branchCode: 3,
  prefecture: 4,
  address: 5,
  assignee: -1,
  note: -1,
};

export const PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
  "岐阜県", "静岡県", "愛知県", "三重県",
  "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
  "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県",
  "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
] as const;

/** 1行を解析した結果 */
export interface QuickBranch {
  /** 貼り付けたテキスト内での行番号（1始まり。空行も数える） */
  lineNo: number;
  name: string;
  code: string;
  prefecture: string;
  address: string;
}

/** 全角英数字を半角に寄せる（貼り付け元がWord/PDFのことがあるため） */
function toHalfWidth(value: string): string {
  return value.replace(/[０-９Ａ-Ｚａ-ｚ]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );
}

/** 支店コードとして扱える値か（金融機関の支店コードは3桁が基本） */
function isBranchCode(value: string): boolean {
  return /^\d{1,4}$/.test(toHalfWidth(value));
}

/** 先頭の都道府県を切り出す。無ければ null */
function splitPrefecture(value: string): { prefecture: string; rest: string } | null {
  for (const pref of PREFECTURES) {
    if (value.startsWith(pref)) {
      return { prefecture: pref, rest: value.slice(pref.length).trim() };
    }
  }
  return null;
}

/**
 * 「1.」「2)」のような行頭の連番を取り除く。
 * ※「001 中央支店」「001,中央支店」の 001 は連番ではなく支店コードなので、
 *   カンマ・読点（＝列の区切り）は連番の記号に含めない。
 */
function stripLineNumber(line: string): string {
  const stripped = line.replace(/^\s*\d{1,3}\s*[.．)）:：]\s*/, "");
  return stripped.trim() === "" ? line.trim() : stripped.trim();
}

/**
 * 区切り文字が無い行から支店コードを剥がす。
 * 例: 中央支店(001) / 中央支店 001 / 001 中央支店
 */
function peelCode(name: string): { name: string; code: string } {
  const bracket = /^(.+?)[\s　]*[（(]\s*(\d{1,4})\s*[）)]$/.exec(name);
  if (bracket) return { name: bracket[1].trim(), code: toHalfWidth(bracket[2]) };

  const trailing = /^(.+?)[\s　]+(\d{1,4})$/.exec(name);
  if (trailing) return { name: trailing[1].trim(), code: toHalfWidth(trailing[2]) };

  const leading = /^(\d{1,4})[\s　]+(.+)$/.exec(name);
  if (leading) return { name: leading[2].trim(), code: toHalfWidth(leading[1]) };

  return { name: name.trim(), code: "" };
}

/**
 * 1行を支店1件として解析する。
 * 空行・「#」で始まる行は null（取り込まない）。
 *
 * 区切りはタブ / カンマ / 2つ以上の空白。列の順番は問わず、
 * 数字だけの値は支店コード、都道府県名は都道府県として拾う。
 */
export function parseBranchLine(line: string, lineNo = 1): QuickBranch | null {
  const trimmed = line.trim();
  if (trimmed === "" || trimmed.startsWith("#") || trimmed.startsWith("//")) return null;

  const fields = stripLineNumber(trimmed)
    .split(/\t|[,，、]|[ 　]{2,}/)
    .map((f) => f.trim())
    .filter((f) => f !== "");
  if (fields.length === 0) return null;

  let code = "";
  let prefecture = "";
  const rest: string[] = [];

  for (const field of fields) {
    if (code === "" && isBranchCode(field)) {
      code = toHalfWidth(field);
      continue;
    }
    if (prefecture === "") {
      const split = splitPrefecture(field);
      if (split) {
        prefecture = split.prefecture;
        // 「東京都千代田区…」のように住所が続く場合は残りを住所に回す
        if (split.rest !== "") rest.push(split.rest);
        continue;
      }
    }
    rest.push(field);
  }

  if (rest.length === 0) return null; // 支店名が無い（コードだけの行など）

  // 区切りが1つも無い行は、末尾の数字を支店コードとして剥がす
  const head = fields.length === 1 ? peelCode(rest[0]) : { name: rest[0], code: "" };
  if (head.name === "") return null;

  return {
    lineNo,
    name: head.name,
    code: code || head.code,
    prefecture,
    address: rest.slice(1).join(" "),
  };
}

/** 貼り付けたテキスト全体を解析する */
export function parseBranchLines(text: string): QuickBranch[] {
  return text
    .split(/\r?\n/)
    .map((line, i) => parseBranchLine(line, i + 1))
    .filter((b): b is QuickBranch => b !== null);
}

/**
 * 解析した支店を buildImportPlan に渡せる行データへ変換する。
 * 銀行はここで全行に同じ値を配る（かんたん入力は1銀行ぶんのため）。
 */
export function buildQuickRows(
  text: string,
  bank: { name: string; code: string }
): string[][] {
  return parseBranchLines(text).map((b) => [
    bank.name,
    bank.code,
    b.name,
    b.code,
    b.prefecture,
    b.address,
  ]);
}
