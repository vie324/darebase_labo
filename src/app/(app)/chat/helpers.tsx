// チャットモジュールのヘルパー（日付区切り・URL自動リンク・色引き）

import type { ReactNode } from "react";
import { cn, formatDate } from "@/lib/utils";
import { DEMO_TEAM } from "@/lib/demo/team";

// 同名メンバーのアバター色を引く（いなければ indigo）
const TEAM_COLORS = new Map(DEMO_TEAM.map((m) => [m.name, m.color]));
export function authorColor(name: string): string {
  return TEAM_COLORS.get(name) ?? "indigo";
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** 日付区切りのグルーピング用キー（YYYY-M-D） */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** 「今日」「昨日」「M/D(曜)」を判定して返す */
export function dayDividerLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(d, now)) return "今日";
  if (isSameDay(d, yesterday)) return "昨日";
  return formatDate(iso);
}

// split 用（グローバル）と判定用（非グローバル）で分ける。
// グローバル正規表現は lastIndex を持つため test には使わない。
const URL_SPLIT = /(https?:\/\/[^\s]+)/g;
const URL_TEST = /^https?:\/\/[^\s]+$/;

/** URL を含むテキストを React ノード配列に。URL 部分だけ <a> にする（dangerouslySetInnerHTML 不使用） */
export function linkify(text: string, onDark = false): ReactNode {
  return text.split(URL_SPLIT).map((part, i) => {
    if (URL_TEST.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "break-all underline underline-offset-2 transition-colors",
            onDark
              ? "text-white/90 hover:text-white"
              : "text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
          )}
        >
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
