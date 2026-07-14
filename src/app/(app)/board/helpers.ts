// 掲示板モジュールのヘルパー（純関数 + localStorage アクセス）

import type { BoardPost, PostComment } from "@/lib/types";

/** 自分がいいね済みの投稿IDを localStorage に記録するキー（連打防止） */
const LIKED_KEY = "dbl:board:liked";

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

/** created_at 降順（新着順）の比較関数 */
export function byCreatedDesc(a: BoardPost, b: BoardPost): number {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

/** コメントを投稿時刻の昇順（古い順）に並べる比較関数 */
export function byCommentAsc(a: PostComment, b: PostComment): number {
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

/** 週の始まり（月曜 0:00）を返す */
function startOfWeek(base: Date): Date {
  const d = new Date(base);
  const day = d.getDay(); // 0=日 .. 6=土
  const sinceMonday = (day + 6) % 7;
  d.setDate(d.getDate() - sinceMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** ISO文字列が今週（月曜始まり）の範囲内かどうか */
export function isThisWeek(iso: string): boolean {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return false;
  const start = startOfWeek(new Date());
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return d >= start && d < end;
}

/** Markdown記法をざっくり除去した本文抜粋（カード表示用・冒頭100字） */
export function excerpt(md: string, length = 100): string {
  const plain = md
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/[#>*`~-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > length ? plain.slice(0, length) + "…" : plain;
}
