// スケジュールモジュール共通のヘルパー

import type { CalendarEvent } from "@/lib/types";
import { DEMO_TEAM } from "@/lib/demo/team";
import { formatDate, formatDateTime, formatTime, toDateStr } from "@/lib/utils";

/** イベントが指定範囲（ミリ秒）と重なるか */
export function overlapsRange(
  ev: CalendarEvent,
  rangeStart: number,
  rangeEnd: number
): boolean {
  const start = new Date(ev.start_at).getTime();
  const end = Math.max(new Date(ev.end_at).getTime(), start);
  return start <= rangeEnd && end >= rangeStart;
}

/** イベントが指定日に発生するか（複数日にまたがるイベントにも対応） */
export function occursOn(ev: CalendarEvent, day: Date): boolean {
  const dayStart = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate()
  ).getTime();
  return overlapsRange(ev, dayStart, dayStart + 86_399_999);
}

/** 同一日内の表示順: 終日 → 開始時刻順 */
export function byStart(a: CalendarEvent, b: CalendarEvent): number {
  if (a.all_day !== b.all_day) return a.all_day ? -1 : 1;
  return new Date(a.start_at).getTime() - new Date(b.start_at).getTime();
}

/** 指定日に発生するイベントを表示順で返す */
export function eventsOn(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events.filter((e) => occursOn(e, day)).sort(byStart);
}

const OWNER_COLORS = new Map(DEMO_TEAM.map((m) => [m.name, m.color]));

/** 担当者名 → アバター色（チーム外の名前は indigo） */
export function ownerColor(name: string): string {
  return OWNER_COLORS.get(name) ?? "indigo";
}

/** ISO → datetime-local 入力値（ローカル時刻の yyyy-MM-ddTHH:mm） */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
}

/** イベント期間の表示文字列（終日・日またぎ対応） */
export function formatRange(ev: CalendarEvent): string {
  const sameDay =
    toDateStr(new Date(ev.start_at)) === toDateStr(new Date(ev.end_at));
  if (ev.all_day) {
    return sameDay
      ? `${formatDate(ev.start_at)} 終日`
      : `${formatDate(ev.start_at)} 〜 ${formatDate(ev.end_at)} 終日`;
  }
  return sameDay
    ? `${formatDateTime(ev.start_at)} 〜 ${formatTime(ev.end_at)}`
    : `${formatDateTime(ev.start_at)} 〜 ${formatDateTime(ev.end_at)}`;
}

export const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

/** 曜日の文字色（日曜=赤 / 土曜=青） */
export function weekdayColor(dayIndex: number): string {
  if (dayIndex === 0) return "text-rose-500 dark:text-rose-400";
  if (dayIndex === 6) return "text-sky-600 dark:text-sky-400";
  return "text-slate-500 dark:text-slate-400";
}
