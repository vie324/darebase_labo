// 勉強会モジュールのヘルパー（純関数）

import type { TrainingLog } from "@/lib/types";
import { todayStr } from "@/lib/utils";

/** カンマ（半角/全角/読点）区切りのタグ文字列 → 配列 */
export function parseTags(input: string): string[] {
  return input
    .split(/[,、，]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** YYYY-MM-DD（または ISO）が今月かどうかを月プレフィックスで判定（タイムゾーン非依存） */
export function isThisMonth(dateStr: string): boolean {
  if (!dateStr) return false;
  return dateStr.slice(0, 7) === todayStr().slice(0, 7);
}

/** held_at 降順（同日は created_at 降順）の比較関数 */
export function byHeldAtDesc(a: TrainingLog, b: TrainingLog): number {
  if (a.held_at !== b.held_at) return b.held_at.localeCompare(a.held_at);
  return b.created_at.localeCompare(a.created_at);
}

/** カテゴリ名に応じて安定した色チップ（constants と同トーン）を割り当てる */
const CHIP_PALETTE = [
  "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
];

export function categoryChip(category: string): string {
  let h = 0;
  for (let i = 0; i < category.length; i++) {
    h = (h * 31 + category.charCodeAt(i)) >>> 0;
  }
  return CHIP_PALETTE[category ? h % CHIP_PALETTE.length : 0];
}

/** Markdown記法をざっくり除去した本文抜粋（フォールバック用） */
export function excerpt(md: string, length = 100): string {
  const plain = md
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/[#>*`-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > length ? plain.slice(0, length) + "…" : plain;
}
