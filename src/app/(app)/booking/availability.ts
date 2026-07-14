// =============================================================
// 日程調整 — 全員空き時間ファインダー（純関数）
//
// useCollection('events') の予定を読み、選択メンバー全員が空いている
// 連続スロットを勤務時間・週末除外の条件で抽出する。
// 副作用を持たず、単体テストしやすいよう UI から分離している。
// =============================================================

import type { CalendarEvent, PollCandidate } from "@/lib/types";

/** busy 区間（epoch ミリ秒） */
export interface BusyInterval {
  start: number;
  end: number;
}

export interface AvailabilityInput {
  /** 走査対象の全予定 */
  events: CalendarEvent[];
  /** 空きを見たいメンバー名（owner_name と一致させる） */
  members: string[];
  /** 所要時間（分） */
  durationMin: number;
  /** 検索する日数（今日から数えて何日先まで） */
  days: number;
  /** 勤務開始時刻 "HH:MM" */
  workStart: string;
  /** 勤務終了時刻 "HH:MM" */
  workEnd: string;
  /** 週末（土日）を除外する */
  excludeWeekends: boolean;
  /** 基準時刻（既定: 現在） */
  from?: Date;
  /** スロットの刻み幅（分・既定: 30） */
  stepMin?: number;
  /** 最大提案数（既定: 10） */
  limit?: number;
}

/** "HH:MM" → 0-1439 の分。不正な値は null。 */
export function parseHm(hm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * 選択メンバーの busy 区間を抽出する。
 * 終日予定（all_day）は締切・リマインダー用途が多く実際の拘束ではないため除外する。
 */
export function busyIntervals(
  events: CalendarEvent[],
  members: string[]
): BusyInterval[] {
  const set = new Set(members);
  const out: BusyInterval[] = [];
  for (const ev of events) {
    if (ev.all_day) continue;
    if (!set.has(ev.owner_name)) continue;
    const start = new Date(ev.start_at).getTime();
    const end = new Date(ev.end_at).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) continue;
    out.push({ start, end });
  }
  return out;
}

/** [startMs, endMs) が busy 区間のいずれかと重なるか */
export function overlapsBusy(
  startMs: number,
  endMs: number,
  busy: BusyInterval[]
): boolean {
  return busy.some((b) => startMs < b.end && endMs > b.start);
}

/**
 * 全員が空いている連続スロットを直近順に抽出する。
 * - 過去（from より前）のスロットは提案しない
 * - 週末除外・勤務時間帯でフィルタ
 * - 最大 limit 件
 */
export function findAvailableSlots(input: AvailabilityInput): PollCandidate[] {
  const {
    events,
    members,
    durationMin,
    days,
    workStart,
    workEnd,
    excludeWeekends,
    from = new Date(),
    stepMin = 30,
    limit = 10,
  } = input;

  const slots: PollCandidate[] = [];
  if (members.length === 0 || durationMin <= 0 || days <= 0) return slots;

  const startMin = parseHm(workStart);
  const endMin = parseHm(workEnd);
  if (startMin === null || endMin === null || endMin - startMin < durationMin) {
    return slots;
  }

  const busy = busyIntervals(events, members);
  const nowMs = from.getTime();

  // 基準日の0時から days 日ぶんを走査
  const day0 = new Date(from);
  day0.setHours(0, 0, 0, 0);

  for (let d = 0; d < days && slots.length < limit; d++) {
    const day = new Date(day0);
    day.setDate(day.getDate() + d);
    const dow = day.getDay();
    if (excludeWeekends && (dow === 0 || dow === 6)) continue;

    for (let m = startMin; m + durationMin <= endMin; m += stepMin) {
      const slotStart = new Date(day);
      slotStart.setHours(0, m, 0, 0);
      const startMs = slotStart.getTime();
      const endMs = startMs + durationMin * 60_000;
      if (startMs < nowMs) continue; // 過去は除外
      if (overlapsBusy(startMs, endMs, busy)) continue;
      slots.push({
        start: new Date(startMs).toISOString(),
        end: new Date(endMs).toISOString(),
      });
      if (slots.length >= limit) break;
    }
  }
  return slots;
}

/** ファインダー・顧客リンクで共通の所要時間オプション（分） */
export const FINDER_DURATIONS = [30, 45, 60, 90] as const;

/** 検索期間オプション */
export const FINDER_RANGES: { value: number; label: string }[] = [
  { value: 3, label: "今後3日" },
  { value: 7, label: "今後7日" },
  { value: 14, label: "今後14日" },
];
