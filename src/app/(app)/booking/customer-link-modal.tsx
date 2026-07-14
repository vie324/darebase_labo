"use client";

// =============================================================
// 顧客用 Web会議予約リンク 作成モーダル
//  主催者(自分)の空きスロットを自動生成して候補にし、
//  kind:"customer" の poll を作成する。公開ページは /invite/[id]。
// =============================================================

import { useMemo, useState } from "react";
import {
  CalendarClock,
  Info,
  Link2,
  Plus,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import {
  Button,
  Field,
  Input,
  Modal,
  Select,
  Textarea,
} from "@/components/ui";
import { formatDate, formatTime } from "@/lib/utils";
import type { CalendarEvent, PollCandidate } from "@/lib/types";
import {
  FINDER_DURATIONS,
  FINDER_RANGES,
  findAvailableSlots,
} from "./availability";
import { durationLabel, localInputFromNow } from "./shared";

export interface CustomerLinkPayload {
  title: string;
  description: string;
  location: string;
  duration_min: number;
  candidates: PollCandidate[];
}

export function CustomerLinkModal({
  organizer,
  events,
  onClose,
  onSubmit,
}: {
  organizer: string;
  events: CalendarEvent[];
  onClose: () => void;
  onSubmit: (payload: CustomerLinkPayload) => Promise<void>;
}) {
  const [title, setTitle] = useState("オンライン相談（30分）");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [durationMin, setDurationMin] = useState<number>(30);
  const [days, setDays] = useState<number>(7);
  const [workStart, setWorkStart] = useState("09:00");
  const [workEnd, setWorkEnd] = useState("18:00");
  const [excludeWeekends, setExcludeWeekends] = useState(true);

  const [candidates, setCandidates] = useState<PollCandidate[]>([]);
  const [manualStart, setManualStart] = useState(() => localInputFromNow(1, 10));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const now = useMemo(() => new Date(), []);

  const generate = () => {
    const slots = findAvailableSlots({
      events,
      members: [organizer],
      durationMin,
      days,
      workStart,
      workEnd,
      excludeWeekends,
      from: now,
    });
    setCandidates(slots);
    if (slots.length === 0) {
      setError(
        "空きスロットが見つかりませんでした。期間・所要時間・勤務時間帯を調整するか、手動で候補を追加してください。"
      );
    } else {
      setError("");
    }
  };

  const addManual = () => {
    if (!manualStart) return;
    const start = new Date(manualStart);
    if (isNaN(start.getTime())) return;
    const end = new Date(start.getTime() + durationMin * 60_000);
    const iso = start.toISOString();
    setCandidates((prev) => {
      if (prev.some((c) => c.start === iso)) return prev;
      const next = [...prev, { start: iso, end: end.toISOString() }];
      next.sort((a, b) => a.start.localeCompare(b.start));
      return next;
    });
  };

  const removeCandidate = (iso: string) =>
    setCandidates((prev) => prev.filter((c) => c.start !== iso));

  const submit = async () => {
    if (!title.trim()) {
      setError("タイトルを入力してください");
      return;
    }
    if (candidates.length === 0) {
      setError("候補を1つ以上追加してください（自動生成 または 手動追加）");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        duration_min: durationMin,
        candidates,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="顧客用 予約リンクを作成" wide>
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
          <Users className="h-3.5 w-3.5 shrink-0" />
          あなた（{organizer}）の空き時間から候補を作り、顧客が1つ選んで予約できるリンクを発行します。
        </div>

        <Field label="タイトル" required>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: オンライン相談（30分）"
            autoFocus
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="場所 / オンラインURL">
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="例: Google Meet / Zoom URL"
            />
          </Field>
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
        </div>

        <Field label="説明">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="顧客に表示する案内文（任意）"
            rows={2}
          />
        </Field>

        {/* 空き自動生成の条件 */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <Sparkles className="h-3.5 w-3.5" />
            自分の空きから候補を生成
          </p>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="期間">
              <Select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              >
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
            <div className="flex items-end">
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={generate}
              >
                <Sparkles className="h-4 w-4" />
                候補を生成
              </Button>
            </div>
          </div>
          <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600 select-none dark:text-slate-300">
            <input
              type="checkbox"
              checked={excludeWeekends}
              onChange={(e) => setExcludeWeekends(e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-slate-300 text-cyan-500 focus:ring-cyan-400 dark:border-slate-600"
            />
            週末（土日）を除外する
          </label>
        </div>

        {/* 候補一覧 */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <CalendarClock className="h-3.5 w-3.5" />
              予約候補
              <span className="text-rose-500">*</span>
              {candidates.length > 0 && (
                <span className="font-normal text-slate-400 dark:text-slate-500">
                  {candidates.length}件
                </span>
              )}
            </span>
          </div>

          {candidates.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-sm text-slate-400 dark:bg-slate-800/60 dark:text-slate-500">
              「候補を生成」または下の手動追加で予約候補を作成してください。
            </p>
          ) : (
            <div className="space-y-2">
              {candidates.map((c) => (
                <div
                  key={c.start}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900"
                >
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {formatDate(c.start)}{" "}
                    <span className="text-slate-400 dark:text-slate-500">
                      {formatTime(c.start)}〜{formatTime(c.end)}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeCandidate(c.start)}
                    aria-label="候補を削除"
                    className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 手動追加 */}
          <div className="mt-2 flex items-center gap-2">
            <Input
              type="datetime-local"
              value={manualStart}
              onChange={(e) => setManualStart(e.target.value)}
              className="flex-1"
            />
            <Button type="button" variant="secondary" onClick={addManual}>
              <Plus className="h-4 w-4" />
              追加
            </Button>
          </div>
        </div>

        {error && (
          <p className="text-sm font-medium text-rose-500 dark:text-rose-400">
            {error}
          </p>
        )}

        <p className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
          <Info className="h-3.5 w-3.5 shrink-0" />
          作成後、詳細画面の「共有リンクをコピー」から顧客にURLを送れます。
        </p>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={submit} disabled={saving}>
            <Link2 className="h-4 w-4" />
            {saving ? "作成中…" : "予約リンクを作成"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
