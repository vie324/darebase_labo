"use client";

// =============================================================
// 公開予約ページ /invite/[id]
//  顧客がログイン不要で候補から1つ選び、Web会議を予約できる独立ページ。
//  - Supabase接続時: schedule_polls を直接 select / update
//  - デモモード: localStorage 'dbl:data:schedule_polls' を直接読み書き
// =============================================================

import { use, useEffect, useState } from "react";
import {
  AlertCircle,
  CalendarCheck,
  CalendarClock,
  Check,
  Clock,
  Download,
  ExternalLink,
  Loader2,
  MapPin,
  User,
} from "lucide-react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { DEMO_POLLS } from "@/lib/demo/polls";
import type { SchedulePoll } from "@/lib/types";
import { formatDate, formatDateTime, formatTime } from "@/lib/utils";
import { Button, Field, Input } from "@/components/ui";
import { Logo } from "@/components/brand/logo";
import {
  downloadIcs,
  openGoogleCalendar,
  type CalendarEventDraft,
} from "@/app/(app)/booking/calendar-links";
import {
  buildCustomerResponse,
  durationLabel,
} from "@/app/(app)/booking/shared";

const LS_KEY = "dbl:data:schedule_polls";

/** デモモード: localStorage から poll 一覧を読む（未シードなら DEMO_POLLS で初期化） */
function readLocalPolls(): SchedulePoll[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as SchedulePoll[];
  } catch {
    // 壊れたデータはシードで上書き
  }
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(DEMO_POLLS));
  } catch {
    // 容量超過などは無視
  }
  return DEMO_POLLS;
}

function writeLocalPolls(polls: SchedulePoll[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(polls));
  } catch {
    // 容量超過は無視
  }
}

export default function InvitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [poll, setPoll] = useState<SchedulePoll | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      if (isSupabaseConfigured()) {
        const sb = getSupabase();
        if (sb) {
          const { data } = await sb
            .from("schedule_polls")
            .select("*")
            .eq("id", id)
            .maybeSingle();
          if (active) {
            setPoll((data as SchedulePoll | null) ?? null);
            setLoading(false);
          }
          return;
        }
      }
      // デモモード
      const found = readLocalPolls().find((p) => p.id === id) ?? null;
      if (active) {
        setPoll(found);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  const book = async () => {
    if (!poll || selectedIndex === null || !name.trim() || saving) return;
    setSaving(true);
    setError("");
    const response = buildCustomerResponse(
      name,
      email,
      poll.candidates.length,
      selectedIndex
    );
    const patch = {
      status: "confirmed" as const,
      confirmed_index: selectedIndex,
      responses: [...poll.responses, response],
    };
    try {
      if (isSupabaseConfigured()) {
        const sb = getSupabase();
        if (sb) {
          const { error: upErr } = await sb
            .from("schedule_polls")
            .update(patch)
            .eq("id", poll.id);
          if (upErr) throw upErr;
        }
      } else {
        const next = readLocalPolls().map((p) =>
          p.id === poll.id ? { ...p, ...patch } : p
        );
        writeLocalPolls(next);
      }
      setPoll({ ...poll, ...patch });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "予約の確定に失敗しました。時間をおいて再度お試しください。"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-cyan-50 via-white to-sky-50 dark:from-slate-950 dark:via-slate-950 dark:to-cyan-950/40">
      <header className="flex items-center justify-between px-5 py-4 sm:px-8">
        <Logo variant="inline" />
        <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
          Web会議 予約ページ
        </span>
      </header>

      <main className="flex flex-1 items-start justify-center p-4 sm:p-6">
        <div className="w-full max-w-xl">
          {loading ? (
            <LoadingCard />
          ) : !poll ? (
            <InvalidCard />
          ) : poll.status === "confirmed" && poll.confirmed_index !== null ? (
            <ConfirmedCard poll={poll} />
          ) : poll.candidates.length === 0 ? (
            <EmptyCandidatesCard poll={poll} />
          ) : (
            <SelectCard
              poll={poll}
              selectedIndex={selectedIndex}
              onSelect={setSelectedIndex}
              name={name}
              onNameChange={setName}
              email={email}
              onEmailChange={setEmail}
              saving={saving}
              error={error}
              onBook={book}
            />
          )}

          {!isSupabaseConfigured() && !loading && poll && (
            <p className="mt-4 rounded-xl bg-white/70 px-4 py-3 text-center text-[11px] leading-relaxed text-slate-500 backdrop-blur dark:bg-slate-900/70 dark:text-slate-400">
              ※ デモではこのブラウザ内のみで完結します（本番 / Supabase接続時は別端末の顧客でも予約可能です）。
            </p>
          )}
        </div>
      </main>

      <footer className="px-5 py-6 text-center text-xs text-slate-400 dark:text-slate-600">
        Powered by DARE BASE LABO
      </footer>
    </div>
  );
}

// ---------- カード: 会議情報ヘッダー ----------
function MeetingInfo({ poll }: { poll: SchedulePoll }) {
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-bold text-slate-800 sm:text-2xl dark:text-slate-100">
        {poll.title}
      </h1>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <User className="h-4 w-4" />
          主催 {poll.organizer}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-4 w-4" />
          {durationLabel(poll.duration_min)}
        </span>
        {poll.location && (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-4 w-4" />
            {poll.location}
          </span>
        )}
      </div>
      {poll.description && (
        <p className="rounded-xl bg-slate-50 p-3 text-sm leading-relaxed whitespace-pre-wrap text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
          {poll.description}
        </p>
      )}
    </div>
  );
}

// ---------- 候補選択 + 予約フォーム ----------
function SelectCard({
  poll,
  selectedIndex,
  onSelect,
  name,
  onNameChange,
  email,
  onEmailChange,
  saving,
  error,
  onBook,
}: {
  poll: SchedulePoll;
  selectedIndex: number | null;
  onSelect: (i: number) => void;
  name: string;
  onNameChange: (v: string) => void;
  email: string;
  onEmailChange: (v: string) => void;
  saving: boolean;
  error: string;
  onBook: () => void;
}) {
  return (
    <div className="card animate-fade-up space-y-6 p-6 sm:p-8">
      <MeetingInfo poll={poll} />

      {/* 候補選択 */}
      <div>
        <p className="mb-2.5 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
          <CalendarClock className="h-4 w-4 text-cyan-500" />
          ご希望の日時を1つお選びください
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {poll.candidates.map((c, i) => {
            const active = selectedIndex === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onSelect(i)}
                className={
                  "flex cursor-pointer items-center justify-between gap-2 rounded-xl border px-3.5 py-3 text-left transition-all active:scale-[0.98] " +
                  (active
                    ? "border-cyan-400 bg-cyan-50 ring-2 ring-cyan-400/30 dark:border-cyan-500/50 dark:bg-cyan-500/15"
                    : "border-slate-200 bg-white hover:border-cyan-300 hover:bg-cyan-50/40 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-cyan-500/40")
                }
              >
                <span>
                  <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {formatDate(c.start)}
                  </span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    {formatTime(c.start)}〜{formatTime(c.end)}
                  </span>
                </span>
                <span
                  className={
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border " +
                    (active
                      ? "border-cyan-500 bg-cyan-500 text-white"
                      : "border-slate-300 dark:border-slate-600")
                  }
                >
                  {active && <Check className="h-3.5 w-3.5" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 顧客情報 */}
      <div className="space-y-3">
        <Field label="お名前" required>
          <Input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="山田 太郎"
          />
        </Field>
        <Field label="メールアドレス（任意）">
          <Input
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="you@example.com"
          />
        </Field>
      </div>

      {error && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
          {error}
        </p>
      )}

      <Button
        size="lg"
        className="w-full"
        onClick={onBook}
        disabled={selectedIndex === null || !name.trim() || saving}
      >
        <CalendarCheck className="h-5 w-5" />
        {saving ? "予約を確定中…" : "この日時で予約する"}
      </Button>
    </div>
  );
}

// ---------- 予約完了 / 確定済み ----------
function ConfirmedCard({ poll }: { poll: SchedulePoll }) {
  const slot =
    poll.confirmed_index !== null ? poll.candidates[poll.confirmed_index] : null;
  if (!slot) return <InvalidCard />;

  const draft: CalendarEventDraft = {
    title: poll.title,
    start: slot.start,
    end: slot.end,
    description: poll.description,
    location: poll.location,
  };

  return (
    <div className="card animate-fade-up space-y-6 p-6 sm:p-8">
      <div className="flex flex-col items-center text-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/25">
          <CalendarCheck className="h-7 w-7" />
        </div>
        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          ご予約が確定しました
        </p>
        <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-100">
          {formatDateTime(slot.start)}
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          〜 {formatTime(slot.end)}
        </p>
      </div>

      <div className="space-y-1.5 border-t border-slate-100 pt-5 text-sm dark:border-slate-800">
        <p className="font-bold text-slate-800 dark:text-slate-100">{poll.title}</p>
        <p className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
          <User className="h-4 w-4" />
          主催 {poll.organizer}
        </p>
        {poll.location && (
          <p className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <MapPin className="h-4 w-4" />
            {poll.location}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => openGoogleCalendar(draft)}>
          <ExternalLink className="h-4 w-4" />
          Googleカレンダーに登録
        </Button>
        <Button variant="secondary" size="sm" onClick={() => downloadIcs(draft)}>
          <Download className="h-4 w-4" />
          ICSダウンロード
        </Button>
      </div>
    </div>
  );
}

// ---------- 状態カード ----------
function LoadingCard() {
  return (
    <div className="card flex flex-col items-center gap-3 p-12 text-slate-400 dark:text-slate-500">
      <Loader2 className="h-8 w-8 animate-spin" />
      <p className="text-sm">読み込んでいます…</p>
    </div>
  );
}

function InvalidCard() {
  return (
    <div className="card flex flex-col items-center gap-3 p-12 text-center">
      <AlertCircle className="h-10 w-10 text-rose-400" />
      <div>
        <p className="font-semibold text-slate-700 dark:text-slate-200">
          リンクが無効です
        </p>
        <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
          この予約リンクは存在しないか、無効になっています。主催者にお問い合わせください。
        </p>
      </div>
    </div>
  );
}

function EmptyCandidatesCard({ poll }: { poll: SchedulePoll }) {
  return (
    <div className="card animate-fade-up space-y-6 p-6 sm:p-8">
      <MeetingInfo poll={poll} />
      <p className="rounded-xl bg-amber-50 px-4 py-6 text-center text-sm text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
        現在、予約可能な日時がありません。主催者にお問い合わせください。
      </p>
    </div>
  );
}
