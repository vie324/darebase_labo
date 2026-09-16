// =============================================================
// 名刺の読み取り — 出力の形とプロンプト
//
// tesseract.js による OCR（ocr.ts）は、日本語の名刺だと精度が出ない。
// 小さい文字・縦書き・ロゴ・地紋・スマホ写真の歪みで文字が崩れ、
// その崩れたテキストを正規表現で分けるので、誤りが二重に乗る。
//
// そこで画像をそのまま Claude に読ませる。レイアウトを見たうえで
// 「どれが社名で、どれが氏名か」を判断できるので、OCR＋正規表現より
// 精度が一段上がる。フリガナの推定や、全角／半角の整形もまとめて任せる。
//
// サーバー（api/ai/read-card）とクライアント（表示）の両方から参照するため、
// ここには Anthropic SDK を持ち込まない（型と純粋関数だけ）。
// =============================================================

import { z } from "zod";

/**
 * 名刺1枚から読み取る項目。
 * 読み取れなかった項目は空文字で返させる（推測で埋めさせない）。
 */
export const cardReadSchema = z.object({
  name: z.string().describe("氏名。姓と名の間は半角スペース1つ。例: 山田 太郎"),
  name_kana: z
    .string()
    .describe(
      "氏名のフリガナ（全角カタカナ）。名刺にふりがな・ローマ字表記があればそれを使う。無ければ一般的な読みを推定してよい。読みが定まらない場合は空文字"
    ),
  company: z.string().describe("会社名。株式会社などの法人格を含めて、名刺の表記のまま"),
  department: z.string().describe("部署名。例: 営業本部 第一営業部"),
  title: z.string().describe("役職。例: 代表取締役社長 / 営業部長"),
  email: z.string().describe("メールアドレス。半角"),
  phone: z.string().describe("固定電話。市外局番から。ハイフン区切りの半角"),
  mobile: z.string().describe("携帯電話。070/080/090 で始まるもの。ハイフン区切りの半角"),
  address: z.string().describe("住所。郵便番号があれば「〒123-4567 」を先頭に付ける"),
  website: z.string().describe("WebサイトのURL。http(s):// から始まる形にする"),
  /** 読み取りに自信が持てなかった項目を、利用者に確認してもらうために返す */
  uncertain_fields: z
    .array(z.string())
    .describe(
      "値は入れたが読み取りに自信がない項目のキー名（name/company/phone など）。自信があるものは含めない"
    ),
  /** 名刺以外の画像が来たときに気づけるようにする */
  is_business_card: z
    .boolean()
    .describe("画像が名刺として読み取れたか。名刺でなければ false"),
  note: z
    .string()
    .describe("読み取れなかった理由や、注意すべき点があれば1文。無ければ空文字"),
});

export type CardRead = z.infer<typeof cardReadSchema>;

/** 画面のフォームに流し込む項目（uncertain_fields などの補助情報を除いたもの） */
export const CARD_FIELD_KEYS = [
  "name",
  "name_kana",
  "company",
  "department",
  "title",
  "email",
  "phone",
  "mobile",
  "address",
  "website",
] as const;

export type CardFieldKey = (typeof CARD_FIELD_KEYS)[number];

export const SYSTEM_PROMPT = `あなたは日本の名刺を読み取るアシスタントです。
渡された画像から、連絡先として登録する項目を抜き出します。

守ること:
- 画像に書かれていない項目は空文字にする。推測で埋めない
  （フリガナだけは例外。氏名の一般的な読みを推定してよい）
- 会社名と氏名を取り違えない。名刺で最も大きい文字が氏名とは限らない
- 部署と役職を混ぜない。「営業本部 部長」なら department=営業本部 / title=部長
- 電話番号は「代表」「TEL」「FAX」の別に注意する。FAX番号は phone に入れない
- 携帯（070/080/090）は mobile に、それ以外の固定電話は phone に入れる
- 数字・英字・記号は半角に直す。電話番号はハイフン区切りにする
- 縦書き・ロゴ・地紋があっても、文字として読める部分だけを拾う
- 裏面（英語表記）が写っている場合も、日本語面の情報を優先する
- 読み取りに自信がない項目は uncertain_fields に入れる。入力者が確認できるようにするため`;

/** 解析リクエストのユーザーメッセージ */
export const USER_PROMPT = `この名刺から連絡先の項目を読み取ってください。
読み取れない項目は空文字のままにしてください。`;

// ---------- 画像の前処理（クライアント側で使う定数） ----------

/**
 * 送信前に縮小する長辺のピクセル数。
 * スマホ写真は4000px超のことがあり、そのままだとAPIの上限に当たるうえ遅い。
 * 名刺の文字は1600pxもあれば十分に読める。
 */
export const MAX_IMAGE_EDGE = 1600;

/** JPEG の品質。文字が潰れない範囲で軽くする */
export const IMAGE_QUALITY = 0.85;

/** 送信できる画像の上限（base64 換算）。これを超える場合はさらに縮小する */
export const MAX_IMAGE_BYTES = 4_500_000;

// ---------- 表示のヘルパー ----------

/** 項目キー → 画面のラベル */
export const CARD_FIELD_LABELS: Record<CardFieldKey, string> = {
  name: "氏名",
  name_kana: "フリガナ",
  company: "会社名",
  department: "部署",
  title: "役職",
  email: "メール",
  phone: "電話",
  mobile: "携帯",
  address: "住所",
  website: "Webサイト",
};

/** 読み取り結果から、値の入っている項目だけを取り出す */
export function filledFieldsOf(read: CardRead): Partial<Record<CardFieldKey, string>> {
  const out: Partial<Record<CardFieldKey, string>> = {};
  for (const key of CARD_FIELD_KEYS) {
    const value = read[key];
    if (typeof value === "string" && value.trim() !== "") out[key] = value.trim();
  }
  return out;
}

/** 自信がないと申告された項目のうち、実際に値が入っているものだけを返す */
export function uncertainLabelsOf(read: CardRead): string[] {
  const filled = filledFieldsOf(read);
  return read.uncertain_fields
    .filter((key): key is CardFieldKey =>
      (CARD_FIELD_KEYS as readonly string[]).includes(key)
    )
    .filter((key) => filled[key] !== undefined)
    .map((key) => CARD_FIELD_LABELS[key]);
}
