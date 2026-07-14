// 名刺管理モジュール共通のヘルパー・型定義

import type { Contact } from "@/lib/types";
import { todayStr } from "@/lib/utils";

/** フォームで編集する値（= Contact から id/created_at を除いたもの） */
export type ContactFormValues = Omit<Contact, "id" | "created_at">;

export function emptyFormValues(defaultOwner: string): ContactFormValues {
  return {
    name: "",
    name_kana: "",
    company: "",
    department: "",
    title: "",
    email: "",
    phone: "",
    mobile: "",
    address: "",
    website: "",
    tags: [],
    memo: "",
    card_image_url: "",
    exchanged_at: todayStr(),
    owner_name: defaultOwner,
  };
}

export function toFormValues(c: Contact): ContactFormValues {
  return {
    name: c.name,
    name_kana: c.name_kana,
    company: c.company,
    department: c.department,
    title: c.title,
    email: c.email,
    phone: c.phone,
    mobile: c.mobile,
    address: c.address,
    website: c.website,
    tags: [...c.tags],
    memo: c.memo,
    card_image_url: c.card_image_url,
    exchanged_at: c.exchanged_at,
    owner_name: c.owner_name,
  };
}

/** カンマ（半角・全角・読点）区切りの文字列 → タグ配列（重複除去） */
export function parseTags(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[,，、]/)
        .map((t) => t.trim())
        .filter(Boolean)
    )
  );
}

// 会社名から安定したアバター色を割り当てる（同じ会社は同じ色になる）
const COMPANY_COLOR_KEYS = ["indigo", "violet", "emerald", "sky", "amber", "rose", "teal"];

export function companyColor(company: string): string {
  let h = 0;
  for (let i = 0; i < company.length; i++) {
    h = (h * 31 + company.charCodeAt(i)) >>> 0;
  }
  return COMPANY_COLOR_KEYS[h % COMPANY_COLOR_KEYS.length];
}

/** 登録から14日以内なら NEW バッジを出す */
export function isNewContact(c: Contact): boolean {
  const t = new Date(c.created_at).getTime();
  if (isNaN(t)) return false;
  return Date.now() - t < 14 * 24 * 60 * 60 * 1000;
}

// ---------- CSV エクスポート ----------

const CSV_HEADERS = [
  "氏名",
  "フリガナ",
  "会社名",
  "部署",
  "役職",
  "メールアドレス",
  "電話番号",
  "携帯番号",
  "住所",
  "Webサイト",
  "タグ",
  "メモ",
  "名刺交換日",
  "登録者",
  "登録日",
];

function escapeCsv(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** 全件を BOM 付き UTF-8 の CSV 文字列に変換（Excel でそのまま開ける） */
export function contactsToCsv(contacts: Contact[]): string {
  const rows = contacts.map((c) =>
    [
      c.name,
      c.name_kana,
      c.company,
      c.department,
      c.title,
      c.email,
      c.phone,
      c.mobile,
      c.address,
      c.website,
      c.tags.join(" / "),
      c.memo,
      c.exchanged_at,
      c.owner_name,
      c.created_at.slice(0, 10),
    ]
      .map(escapeCsv)
      .join(",")
  );
  return "\uFEFF" + [CSV_HEADERS.join(","), ...rows].join("\r\n");
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
