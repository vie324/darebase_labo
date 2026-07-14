"use client";

// =============================================================
// 全員空き時間ファインダー モーダル
//  選択メンバー全員が空いている連続スロットを提案し、
//  そのまま「予定を作成」または「調整候補にする」ことができる。
// =============================================================

import { useMemo, useState } from "react";
import {
  CalendarPlus,
  Check,
  Clock,
  Info,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  Field,
  Input,
  Modal,
  Select,
} from "@/components/ui";
import { cn, formatDate, formatTime } from "@/lib/utils";
import type { CalendarEvent, PollCandidate } from "@/lib/types";
import {
  FINDER_DURATIONS,
  FINDER_RANGES,
  findAvailableSlots,
} from "./availability";
import { durationLabel } from "./shared";

export interface FinderPollPayload {
  title: string;
  description: string;
  duration_min: number;
  candidates: PollCandidate[];
}

export function AvailabilityModal({
  events,
  members,
  colorOf,
  defaultSelected,
  onClose,
  onCreateEvent,
  onCreatePoll,
}: {
  /** 走査対象の全予定 */
  events: CalendarEvent[];
  /** 選択候補となる全メンバー名 */
  members: string[];
  colorOf: (name: string) => string;
  /** 初期選択メンバー */
  defaultSelected: string[];
  onClose: () => void;
  /** 1スロットを予定として作成 */
  onCreateEvent: (
    slot: PollCandidate,
    memberNames: string[],
    durationMin: number
  ) => Promise<void>;
  /** 選択スロットを候補にした通常pollを作成し、その id を返す */
  onCreatePoll: (payload: FinderPollPayload) => Promise<string>;
}) {
  const [selected, setSelected] = useState<string[]>(() =>
    defaultSelected.filter((n) => members.includes(n))
  );
  const [durationMin, setDurationMin] = useState<number>(60);
  const [days, setDays] = useState<number>(7);
  const [workStart, setWorkStart] = useState("09:00");
  const [workEnd, setWorkEnd] = useState("18:00");
  const [excludeWeekends, setExcludeWeekends] = useState(true);

  // 「調整候補にする」で選んだスロット（start ISO で管理）
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  // 予定を作成済みのスロット
  const [createdEvents, setCreatedEvents] = useState<Set<string>>(
    () => new Set()
  );
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [creatingPoll, setCreatingPoll] = useState(false);

  const now = useMemo(() => new Date(), []);
  const slots = useMemo(
    () =>
      findAvailableSlots({
        events,
        members: selected,
        durationMin,
        days,
        workStart,
        workEnd,
        excludeWeekends,
        from: now,
      }),
    [events, selected, durationMin, days, workStart, workEnd, excludeWeekends, now]
  );

  const toggleMember = (name: string) =>
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );

  const togglePick = (iso: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      return next;
    });

  const createEvent = async (slot: PollCandidate) => {
    if (busySlot || createdEvents.has(slot.start)) return;
    setBusySlot(slot.start);
    try {
      await onCreateEvent(slot, selected, durationMin);
      setCreatedEvents((prev) => new Set(prev).add(slot.start));
    } finally {
      setBusySlot(null);
    }
  };

  const pickedSlots = slots.filter((s) => picked.has(s.start));

  const createPoll = async () => {
    if (pickedSlots.length === 0 || creatingPoll) return;
    setCreatingPoll(true);
    try {
      const label = selected.length > 0 ? selected.join("、") : "チーム";
      await onCreatePoll({
        title: `${label} 打ち合わせ日程調整`,
        description: `空き時間ファインダーで作成（対象: ${label}）`,
        duration_min: durationMin,
        candidates: pickedSlots,
      });
    } finally {
      setCreatingPoll(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="全員の空き時間を探す" wide>
      <div className="space-y-5">
        {/* メンバー選択 */}
        <div>
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <Users className="h-3.5 w-3.5" />
            対象メンバー
            <span className="text-rose-500">*</span>
          </span>
          <div className="flex flex-wrap gap-2">
            {members.map((name) => {
              const active = selected.includes(name);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => toggleMember(name)}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all active:scale-95",
                    active
                      ? "border-cyan-300 bg-cyan-50 text-cyan-700 dark:border-cyan-500/40 dark:bg-cyan-500/15 dark:text-cyan-300"
                      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                  )}
                >
                  <Avatar name={name} color={colorOf(name)} size="xs" />
                  {name}
                  {active && <Check className="h-3.5 w-3.5" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* 条件 */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="所要時間">
            <Select
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value))}
            >
              {FINDER_DURATIONS.map((m) => (
                <option key={m} value={m}>
                  {durationLabel(m)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="期間">
            <Select value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {FINDER_RANGES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="勤務開始">
            <Input
              type="time"
              value={workStart}
              onChange={(e) => setWorkStart(e.target.value)}
            />
          </Field>
          <Field label="勤務終了">
            <Input
              type="time"
              value={workEnd}
              onChange={(e) => setWorkEnd(e.target.value)}
            />
          </Field>
        </div>

        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600 select-none dark:text-slate-300">
          <input
            type="checkbox"
            checked={excludeWeekends}
            onChange={(e) => setExcludeWeekends(e.target.checked)}
            className="h-4 w-4 cursor-pointer rounded border-slate-300 text-cyan-500 focus:ring-cyan-400 dark:border-slate-600"
          />
          週末（土日）を除外する
        </label>

        {/* 結果 */}
        <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
              <Search className="h-4 w-4 text-cyan-500" />
              空き時間の提案
              {slots.length > 0 && (
                <span className="text-[11px] font-normal text-slate-400 dark:text-slate-500">
                  直近{slots.length}件
                </span>
              )}
            </h3>
          </div>

          {selected.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-400 dark:bg-slate-800/60 dark:text-slate-500">
              対象メンバーを1名以上選択してください。
            </p>
          ) : slots.length === 0 ? (
            <p className="rounded-xl bg-amber-50 px-3 py-6 text-center text-sm text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
              条件に合う空き時間が見つかりませんでした。期間を延ばすか、所要時間・勤務時間帯を調整してみてください。
            </p>
          ) : (
            <div className="space-y-2">
              {slots.map((slot) => {
                const isPicked = picked.has(slot.start);
                const isCreated = createdEvents.has(slot.start);
                return (
                  <div
                    key={slot.start}
                    className={cn(
                      "flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 transition-colors",
                      isPicked
                        ? "border-cyan-300 bg-cyan-50/60 dark:border-cyan-500/30 dark:bg-cyan-500/10"
                        : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                      <Clock className="h-4 w-4 text-slate-400" />
                      {formatDate(slot.start)}
                      <span className="text-slate-400 dark:text-slate-500">
                        {formatTime(slot.start)}〜{formatTime(slot.end)}
                      </span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant={isCreated ? "success" : "secondary"}
                        size="sm"
                        onClick={() => createEvent(slot)}
                        disabled={isCreated || busySlot === slot.start}
                      >
                        {isCreated ? (
                          <>
                            <Check className="h-4 w-4" />
                            作成済み
                          </>
                        ) : (
                          <>
                            <CalendarPlus className="h-4 w-4" />
                            予定を作成
                          </>
                        )}
                      </Button>
                      <Button
                        variant={isPicked ? "primary" : "secondary"}
                        size="sm"
                        onClick={() => togglePick(slot.start)}
                      >
                        {isPicked ? (
                          <>
                            <Check className="h-4 w-4" />
                            候補に選択中
                          </>
                        ) : (
                          "調整候補にする"
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
          <Info className="h-3.5 w-3.5 shrink-0" />
          終日予定（締切など）は空き判定から除外しています。
        </p>

        {/* フッター */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          {pickedSlots.length > 0 ? (
            <Badge className="bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300">
              <Sparkles className="h-3.5 w-3.5" />
              {pickedSlots.length}件を候補に選択中
            </Badge>
          ) : (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              「調整候補にする」で選んだ日時から日程調整を作成できます
            </span>
          )}
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose}>
              閉じる
            </Button>
            <Button
              onClick={createPoll}
              disabled={pickedSlots.length === 0 || creatingPoll}
            >
              <Sparkles className="h-4 w-4" />
              {creatingPoll
                ? "作成中…"
                : `この候補で日程調整を作成${
                    pickedSlots.length > 0 ? `（${pickedSlots.length}）` : ""
                  }`}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
