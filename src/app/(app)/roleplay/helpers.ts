// =============================================================
// ロープレ練習 — 共通ヘルパー / 型定義 / 定数
// （純粋関数・型のみ。JSX は含めない）
// =============================================================

import type { RoleplayFeedback, RoleplaySession } from "@/lib/types";

// ---------- モード（録音のみ / 画面録画） ----------
export type RoleplayMode = RoleplaySession["mode"];

export const MODE_META: Record<
  RoleplayMode,
  { label: string; short: string; emoji: string; color: string }
> = {
  audio: {
    label: "録音のみ",
    short: "録音",
    emoji: "🎙",
    color: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
  screen: {
    label: "画面録画",
    short: "録画",
    emoji: "🖥",
    color: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  },
};

// ---------- スクリプトのカテゴリ（自由文字列。プリセット + 色） ----------
export const SCRIPT_CATEGORIES = [
  "テレアポ",
  "受付突破",
  "ヒアリング",
  "商談",
  "提案",
  "クロージング",
  "切り返し",
  "その他",
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  テレアポ: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  受付突破: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  ヒアリング: "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
  商談: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  提案: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  クロージング: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  切り返し: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  その他: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
};

export function scriptCategoryColor(category: string): string {
  return (
    CATEGORY_COLORS[category] ??
    "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300"
  );
}

// ---------- 分析（話速・フィラーワード・文字数） ----------
export const FILLER_WORDS = ["えー", "あのー", "えっと", "まあ"] as const;

export interface SpeechAnalysis {
  charCount: number; // 空白を除いた文字数
  fillerCount: number; // フィラーワード出現回数の合計
  fillerBreakdown: { word: string; count: number }[];
  rate: number; // 話速（文字数 / 分）
}

/** 文字列中の word の出現回数（非重複） */
function countOccurrences(text: string, word: string): number {
  if (!word) return 0;
  let count = 0;
  let from = 0;
  for (;;) {
    const idx = text.indexOf(word, from);
    if (idx === -1) break;
    count += 1;
    from = idx + word.length;
  }
  return count;
}

/** 文字起こしと録音時間から簡易分析を算出 */
export function analyzeTranscript(transcript: string, durationSec: number): SpeechAnalysis {
  const compact = transcript.replace(/\s+/g, "");
  const charCount = compact.length;
  const fillerBreakdown = FILLER_WORDS.map((word) => ({
    word,
    count: countOccurrences(transcript, word),
  }));
  const fillerCount = fillerBreakdown.reduce((sum, f) => sum + f.count, 0);
  const minutes = durationSec / 60;
  const rate = minutes > 0 ? Math.round(charCount / minutes) : 0;
  return { charCount, fillerCount, fillerBreakdown, rate };
}

/** 話速の目安評価（営業トークとして 250〜350 字/分が目安） */
export function rateAssessment(rate: number): { label: string; color: string } {
  if (rate === 0) return { label: "—", color: "text-slate-400 dark:text-slate-500" };
  if (rate < 220) return { label: "ゆっくりめ", color: "text-sky-600 dark:text-sky-400" };
  if (rate > 380) return { label: "やや速い", color: "text-amber-600 dark:text-amber-400" };
  return { label: "適正ペース", color: "text-emerald-600 dark:text-emerald-400" };
}

// ---------- 評価（星） ----------
export function averageRating(feedbacks: RoleplayFeedback[]): number | null {
  if (!feedbacks.length) return null;
  const sum = feedbacks.reduce((s, f) => s + f.rating, 0);
  return sum / feedbacks.length;
}

/** 全セッションのフィードバック評価の平均 */
export function overallAverageRating(sessions: RoleplaySession[]): number | null {
  let sum = 0;
  let n = 0;
  for (const s of sessions) {
    for (const f of s.feedbacks) {
      sum += f.rating;
      n += 1;
    }
  }
  return n > 0 ? sum / n : null;
}

// ---------- 日付 ----------
/** 今週（月曜 0:00）以降か */
export function isThisWeek(iso: string): boolean {
  const d = new Date(iso).getTime();
  const now = new Date();
  const dayFromMonday = (now.getDay() + 6) % 7;
  now.setHours(0, 0, 0, 0);
  now.setDate(now.getDate() - dayFromMonday);
  return d >= now.getTime();
}

export function bySessionNewest(a: RoleplaySession, b: RoleplaySession): number {
  return b.created_at.localeCompare(a.created_at);
}

// =============================================================
// Web Speech API（webkitSpeechRecognition / SpeechRecognition）
// 標準の型定義が無いため、利用する範囲だけ最小限で独自定義する。
// =============================================================

export interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

export interface SpeechRecognitionResultLike {
  readonly length: number;
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternativeLike;
}

export interface SpeechRecognitionResultListLike {
  readonly length: number;
  [index: number]: SpeechRecognitionResultLike;
}

export interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}

export interface SpeechRecognitionErrorEventLike {
  error: string;
  message: string;
}

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

export interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionLike;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

/** ブラウザの SpeechRecognition コンストラクタを取得（非対応なら null） */
export function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}
