// ナレッジ共有モジュールのヘルパー（純関数 + localStorage アクセス）

import type { Knowledge } from "@/lib/types";

/** 自分がいいね済みの記事IDを localStorage に記録するキー */
const LIKED_KEY = "dbl:knowledge:liked";

export function loadLikedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LIKED_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    // 壊れたデータは無視して空扱い
  }
  return new Set();
}

export function saveLikedIds(ids: Set<string>): void {
  try {
    localStorage.setItem(LIKED_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // 容量超過などは無視
  }
}

/** カンマ（半角/全角/読点）区切りのタグ文字列 → 配列 */
export function parseTags(input: string): string[] {
  return input
    .split(/[,、，]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** ISO文字列が今月かどうか */
export function isThisMonth(iso: string): boolean {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

/** updated_at 降順の比較関数 */
export function byUpdatedDesc(a: Knowledge, b: Knowledge): number {
  return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
}

/** Markdown記法をざっくり除去した本文抜粋（カード表示用） */
export function excerpt(md: string, length = 90): string {
  const plain = md
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/[#>*`-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > length ? plain.slice(0, length) + "…" : plain;
}
