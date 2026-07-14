"use client";

// =============================================================
// 日程調整 — 新規作成モーダル と 詳細モーダル（本体）
// =============================================================

import { useState } from "react";
import {
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  Check,
  Clock,
  Download,
  ExternalLink,
  Info,
  MapPin,
  Plus,
  RotateCcw,
  Send,
  Trash2,
  Trophy,
  Users,
  X,
} from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  Field,
  Input,
  Modal,
  Select,
  Textarea,
} from "@/components/ui";
import { cn, formatDate, formatDateTime, formatTime } from "@/lib/utils";
import type { PollResponse, SchedulePoll } from "@/lib/types";
import type { CurrentUser } from "@/lib/use-user";
import {
  downloadIcs,
  openGoogleCalendar,
  type CalendarEventDraft,
} from "./calendar-links";
import {
  ANSWERS,
  ANSWER_META,
  DURATION_OPTIONS,
  POLL_STATUS,
  bestCandidateIndex,
  buildResponse,
  durationLabel,
  emptyPollForm,
  newCandidateDraft,
  type Answer,
  type PollFormValues,
} from "./shared";
import { ResponseMatrix } from "./response-matrix";

// =============================================================
// 新規作成モーダル
// =============================================================
export function PollFormModal({
  organizer,
  onClose,
  onSubmit,
}: {
  organizer: string;
  onClose: () => void;
  onSubmit: (values: PollFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState<PollFormValues>(() => emptyPollForm());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof PollFormValues>(key: K, v: PollFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const setCandidateStart = (id: string, start: string) =>
    setValues((prev) => ({
      ...prev,
      candidates: prev.candidates.map((c) =>
        c.id === id ? { ...c, start } : c
      ),
    }));

  const addCandidate = () =>
    setValues((prev) => ({
      ...prev,
      candidates: [...prev.candidates, newCandidateDraft()],
    }));

  const removeCandidate = (id: string) =>
    setValues((prev) => ({
      ...prev,
      candidates: prev.candidates.filter((c) => c.id !== id),
    }));

  const previewEnd = (startLocal: string): string => {
    if (!startLocal) return "";
    const s = new Date(startLocal);
    if (isNaN(s.getTime())) return "";
    return formatTime(
      new Date(s.getTime() + values.duration_min * 60_000).toISOString()
    );
  };

  const validCandidates = values.candidates.filter((c) => c.start);

  const submit = async () => {
    if (!values.title.trim()) {
      setError("タイトルを入力してください");
      return;
    }
    if (validCandidates.length === 0) {
      setError("候補日時を1つ以上追加してください");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ ...values, title: values.title.trim() });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="日程調整を新規作成" wide>
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          <Users className="h-3.5 w-3.5" />
          主催者：
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            {organizer}
          </span>
        </div>

        <Field label="タイトル" required>
          <Input
            value={values.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="例: 株式会社〇〇 オンラインデモ"
            autoFocus
          />
        </Field>

        <Field label="説明">
          <Textarea
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="アジェンダ・参加者・目的などのメモ（任意）"
            rows={2}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="場所 / オンラインURL">
            <Input
              value={values.location}
              onChange={(e) => set("location", e.target.value)}
              placeholder="例: 会議室B / Zoom URL"
            />
          </Field>
          <Field label="所要時間">
            <Select
              value={values.duration_min}
              onChange={(e) => set("duration_min", Number(e.target.value))}
            >
              {DURATION_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {durationLabel(m)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {/* 候補日時エディタ */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              候補日時
              <span className="ml-1 text-rose-500">*</span>
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              終了時刻は所要時間から自動計算
            </span>
          </div>
          <div className="space-y-2">
            {values.candidates.map((c, i) => (
              <div
                key={c.id}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-2 dark:border-slate-800 dark:bg-slate-800/40"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-[11px] font-bold text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-300">
                  {i + 1}
                </span>
                <Input
                  type="datetime-local"
                  value={c.start}
                  onChange={(e) => setCandidateStart(c.id, e.target.value)}
                  className="flex-1"
                />
                <span className="hidden w-24 shrink-0 text-center text-xs font-medium text-slate-500 tabular-nums sm:block dark:text-slate-400">
                  {previewEnd(c.start) ? `〜 ${previewEnd(c.start)}` : "〜 --:--"}
                </span>
                <button
                  type="button"
                  onClick={() => removeCandidate(c.id)}
                  disabled={values.candidates.length <= 1}
                  aria-label="候補を削除"
                  className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500 disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-rose-500/10"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-2"
            onClick={addCandidate}
          >
            <Plus className="h-4 w-4" />
            候補を追加
          </Button>
        </div>

        {error && (
          <p className="text-sm font-medium text-rose-500 dark:text-rose-400">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={submit} disabled={saving}>
            <Plus className="h-4 w-4" />
            {saving ? "作成中…" : "作成する"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// =============================================================
// 詳細モーダル（本体）
// =============================================================
export function PollDetailModal({
  poll,
  user,
  colorOf,
  onClose,
  onAddResponse,
  onConfirm,
  onReopen,
  onRegisterEvent,
  onDelete,
}: {
  poll: SchedulePoll;
  user: CurrentUser;
  colorOf: (name: string) => string;
  onClose: () => void;
  onAddResponse: (responses: PollResponse[]) => Promise<void>;
  onConfirm: (index: number) => Promise<void>;
  onReopen: () => Promise<void>;
  onRegisterEvent: () => Promise<void>;
  onDelete: () => void;
}) {
  const isOrganizer = poll.organizer === user.name;
  const status = POLL_STATUS[poll.status];
  const bestIndex = bestCandidateIndex(poll);
  const confirmed =
    poll.confirmed_index !== null ? poll.candidates[poll.confirmed_index] : null;

  return (
    <Modal open onClose={onClose} title={poll.title} wide>
      <div className="space-y-5">
        {/* ヘッダー情報 */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge className={status.badge}>
            <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
            {status.label}
          </Badge>
          <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
            <Avatar
              name={poll.organizer}
              color={colorOf(poll.organizer)}
              size="xs"
            />
            主催 {poll.organizer}
          </span>
          <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
            <Clock className="h-3.5 w-3.5" />
            {durationLabel(poll.duration_min)}
          </span>
          <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
            <CalendarClock className="h-3.5 w-3.5" />
            候補 {poll.candidates.length}件
          </span>
          <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
            <Users className="h-3.5 w-3.5" />
            回答 {poll.responses.length}名
          </span>
          {poll.location && (
            <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
              <MapPin className="h-3.5 w-3.5" />
              {poll.location}
            </span>
          )}
        </div>

        {poll.description && (
          <p className="rounded-xl bg-slate-50 p-3.5 text-sm leading-relaxed whitespace-pre-wrap text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            {poll.description}
          </p>
        )}

        {/* 確定バナー + 外部連携アクション */}
        {confirmed && (
          <ConfirmedPanel
            poll={poll}
            confirmedStart={confirmed.start}
            confirmedEnd={confirmed.end}
            isOrganizer={isOrganizer}
            onRegisterEvent={onRegisterEvent}
            onReopen={onReopen}
          />
        )}

        {/* 回答マトリクス */}
        <div>
          <h3 className="mb-2.5 flex items-center gap-2 text-sm font-bold">
            <Trophy className="h-4 w-4 text-slate-400" />
            回答状況
            {isOrganizer && poll.status === "open" && (
              <span className="text-[11px] font-normal text-slate-400 dark:text-slate-500">
                （列の「この日時で確定」で日程を確定できます）
              </span>
            )}
          </h3>
          <ResponseMatrix
            poll={poll}
            bestIndex={bestIndex}
            canConfirm={isOrganizer && poll.status === "open"}
            colorOf={colorOf}
            onConfirm={(i) => {
              if (confirm(`${formatDateTime(poll.candidates[i].start)} で確定しますか？`)) {
                void onConfirm(i);
              }
            }}
          />
        </div>

        {/* 回答追加フォーム */}
        {poll.status !== "closed" && (
          <ResponseForm
            poll={poll}
            defaultName={user.name}
            onAddResponse={onAddResponse}
          />
        )}

        {/* フッター */}
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          {isOrganizer ? (
            <Button variant="danger" size="sm" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
              削除
            </Button>
          ) : (
            <span />
          )}
          <Button variant="secondary" size="sm" onClick={onClose}>
            閉じる
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------- 確定パネル（大きな確定日時 + 3アクション） ----------
function ConfirmedPanel({
  poll,
  confirmedStart,
  confirmedEnd,
  isOrganizer,
  onRegisterEvent,
  onReopen,
}: {
  poll: SchedulePoll;
  confirmedStart: string;
  confirmedEnd: string;
  isOrganizer: boolean;
  onRegisterEvent: () => Promise<void>;
  onReopen: () => Promise<void>;
}) {
  const [scheduleAdded, setScheduleAdded] = useState(false);
  const [busy, setBusy] = useState(false);

  const draft: CalendarEventDraft = {
    title: poll.title,
    start: confirmedStart,
    end: confirmedEnd,
    description: poll.description,
    location: poll.location,
  };

  const registerToSchedule = async () => {
    if (busy || scheduleAdded) return;
    setBusy(true);
    try {
      await onRegisterEvent();
      setScheduleAdded(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50/60 p-5 dark:border-emerald-500/25 dark:from-emerald-500/10 dark:to-teal-500/5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/25">
            <CalendarCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-emerald-600 dark:text-emerald-400">
              確定した日時
            </p>
            <p className="text-lg font-bold text-slate-800 dark:text-slate-100">
              {formatDateTime(confirmedStart)}
              <span className="mx-1 text-slate-400">〜</span>
              {formatTime(confirmedEnd)}
            </p>
          </div>
        </div>
        {isOrganizer && (
          <button
            onClick={() => {
              if (confirm("確定を取り消して調整中に戻しますか？")) void onReopen();
            }}
            className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-white/60 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            確定を取り消す
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => openGoogleCalendar(draft)}>
          <ExternalLink className="h-4 w-4" />
          Googleカレンダーに登録
        </Button>
        <Button variant="secondary" size="sm" onClick={() => downloadIcs(draft)}>
          <Download className="h-4 w-4" />
          ICSダウンロード
        </Button>
        <Button
          variant={scheduleAdded ? "success" : "secondary"}
          size="sm"
          onClick={registerToSchedule}
          disabled={busy || scheduleAdded}
        >
          {scheduleAdded ? (
            <>
              <Check className="h-4 w-4" />
              登録済み
            </>
          ) : (
            <>
              <CalendarPlus className="h-4 w-4" />
              社内スケジュールに登録
            </>
          )}
        </Button>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
        <Info className="h-3.5 w-3.5 shrink-0" />
        「Googleカレンダーに登録」を押すと、Googleカレンダーの予定作成画面が新しいタブで開きます。
      </p>
    </div>
  );
}

// ---------- 回答追加フォーム ----------
function ResponseForm({
  poll,
  defaultName,
  onAddResponse,
}: {
  poll: SchedulePoll;
  defaultName: string;
  onAddResponse: (responses: PollResponse[]) => Promise<void>;
}) {
  const [name, setName] = useState(defaultName);
  const [answers, setAnswers] = useState<Answer[]>(() =>
    poll.candidates.map(() => "ok")
  );
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const setAnswer = (index: number, value: Answer) =>
    setAnswers((prev) => prev.map((a, i) => (i === index ? value : a)));

  const submit = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const next = [...poll.responses, buildResponse(name, answers, comment)];
      await onAddResponse(next);
      setComment("");
      setAnswers(poll.candidates.map(() => "ok"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-cyan-100 bg-cyan-50/40 p-4 dark:border-cyan-500/20 dark:bg-cyan-500/5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
        <Send className="h-4 w-4 text-cyan-500" />
        出欠を回答する
      </h3>

      <Field label="お名前" required>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="お名前"
          className="sm:max-w-xs"
        />
      </Field>

      <div className="mt-3 space-y-2">
        {poll.candidates.map((c, i) => (
          <div
            key={i}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/70 px-3 py-2 dark:bg-slate-900/50"
          >
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {formatDate(c.start)}{" "}
              <span className="text-slate-400 dark:text-slate-500">
                {formatTime(c.start)}〜{formatTime(c.end)}
              </span>
            </span>
            <div className="flex gap-1">
              {ANSWERS.map((key) => {
                const active = answers[i] === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAnswer(i, key)}
                    aria-label={ANSWER_META[key].label}
                    className={cn(
                      "flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-base font-bold transition-all active:scale-95",
                      active
                        ? ANSWER_META[key].activeBtn
                        : "bg-slate-100 text-slate-400 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:hover:bg-slate-700"
                    )}
                  >
                    {ANSWER_META[key].symbol}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <Input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="コメント（任意）"
        />
      </div>

      <div className="mt-3 flex justify-end">
        <Button onClick={submit} disabled={!name.trim() || saving}>
          <Send className="h-4 w-4" />
          {saving ? "送信中…" : "回答を送信"}
        </Button>
      </div>
    </div>
  );
}
