// =============================================================
// 日程調整モジュール内で共有するヘルパー・メタ定義・型
// =============================================================

import type { PollCandidate, PollResponse, SchedulePoll } from "@/lib/types";
import { uid } from "@/lib/utils";

export type Answer = "ok" | "maybe" | "ng";
export const ANSWERS: Answer[] = ["ok", "maybe", "ng"];

/** 回答（◯/△/×）の表示メタ。score は集計用（ok=2 / maybe=1 / ng=0）。 */
export const ANSWER_META: Record<
  Answer,
  {
    symbol: string;
    label: string;
    score: number;
    /** マトリクス表のセル配色 */
    cell: string;
    /** トグルボタンが選択中のときの配色 */
    activeBtn: string;
  }
> = {
  ok: {
    symbol: "◯",
    label: "参加できる",
    score: 2,
    cell: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    activeBtn: "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30",
  },
  maybe: {
    symbol: "△",
    label: "調整すれば可",
    score: 1,
    cell: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
    activeBtn: "bg-amber-500 text-white shadow-sm shadow-amber-500/30",
  },
  ng: {
    symbol: "×",
    label: "参加できない",
    score: 0,
    cell: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
    activeBtn: "bg-rose-500 text-white shadow-sm shadow-rose-500/30",
  },
};

/** 未回答セルの配色 */
export const EMPTY_CELL =
  "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500";

/** 種別バッジ（customer=顧客予約リンク）の表示メタ。group/未設定は通常調整。 */
export const POLL_KIND_META: {
  label: string;
  badge: string;
} = {
  label: "顧客予約リンク",
  badge:
    "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
};

/** 公開予約ページ（/invite/[id]）の共有URLを組み立てる */
export function buildInviteUrl(pollId: string): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/invite/${pollId}`;
}

/** ステータス（open=調整中 / confirmed=確定 / closed=終了）の表示メタ */
export const POLL_STATUS: Record<
  SchedulePoll["status"],
  { label: string; badge: string; dot: string }
> = {
  open: {
    label: "調整中",
    badge: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  confirmed: {
    label: "確定",
    badge:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  closed: {
    label: "終了",
    badge: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
    dot: "bg-slate-400",
  },
};

/** 所要時間の選択肢（分） */
export const DURATION_OPTIONS = [15, 30, 45, 60, 90] as const;

/** 所要時間 → 表示ラベル（例: 90 → "1時間30分"） */
export function durationLabel(min: number): string {
  if (min < 60) return `${min}分`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}時間` : `${h}時間${m}分`;
}

/** ある候補列の合計スコア（回答者全員の ok=2/maybe=1/ng=0 の合計） */
export function candidateScore(poll: SchedulePoll, index: number): number {
  return poll.responses.reduce((sum, r) => {
    const a = r.answers[index];
    return sum + (a ? ANSWER_META[a].score : 0);
  }, 0);
}

/** ある候補列の ◯/△/× 集計 */
export function answerCounts(
  poll: SchedulePoll,
  index: number
): Record<Answer, number> {
  const counts: Record<Answer, number> = { ok: 0, maybe: 0, ng: 0 };
  for (const r of poll.responses) {
    const a = r.answers[index];
    if (a) counts[a] += 1;
  }
  return counts;
}

/** 最有力（最高スコア）候補の index。回答が無い場合は -1。 */
export function bestCandidateIndex(poll: SchedulePoll): number {
  if (poll.candidates.length === 0 || poll.responses.length === 0) return -1;
  let best = 0;
  let bestScore = -1;
  poll.candidates.forEach((_, i) => {
    const s = candidateScore(poll, i);
    if (s > bestScore) {
      bestScore = s;
      best = i;
    }
  });
  return best;
}

// ---------- 作成フォームの値 ----------

/** 候補日時エディタの1行（start はローカルの datetime-local 文字列） */
export interface CandidateDraft {
  id: string;
  start: string;
}

export interface PollFormValues {
  title: string;
  description: string;
  location: string;
  duration_min: number;
  candidates: CandidateDraft[];
}

/** ISO → datetime-local 入力値（ローカル時刻 yyyy-MM-ddTHH:mm） */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
}

/** n日後・指定時刻の datetime-local 文字列を返す（候補の初期値用） */
export function localInputFromNow(days: number, hour = 10, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return toLocalInput(d.toISOString());
}

/** 候補ドラフト1件を生成 */
export function newCandidateDraft(start?: string): CandidateDraft {
  return { id: uid(), start: start ?? localInputFromNow(1) };
}

/** フォームの初期値 */
export function emptyPollForm(): PollFormValues {
  return {
    title: "",
    description: "",
    location: "",
    duration_min: 60,
    candidates: [
      newCandidateDraft(localInputFromNow(1, 10)),
      newCandidateDraft(localInputFromNow(1, 14)),
    ],
  };
}

/**
 * 候補ドラフト配列 → PollCandidate[] へ変換。
 * end は start + 所要時間で自動計算。start が空の行は除外。
 */
export function draftsToCandidates(
  drafts: CandidateDraft[],
  durationMin: number
): PollCandidate[] {
  return drafts
    .filter((d) => d.start)
    .map((d) => {
      const start = new Date(d.start);
      const end = new Date(start.getTime() + durationMin * 60_000);
      return { start: start.toISOString(), end: end.toISOString() };
    })
    .filter((c) => !isNaN(new Date(c.start).getTime()));
}

/** 新しい回答オブジェクトを生成 */
export function buildResponse(
  name: string,
  answers: Answer[],
  comment: string
): PollResponse {
  return {
    name: name.trim(),
    answers,
    comment: comment.trim(),
    created_at: new Date().toISOString(),
  };
}

/**
 * 顧客が公開ページで1つの候補を選んだ回答を生成する。
 * 選択した候補のみ "ok"、それ以外は "ng"。メールはコメント欄に残す。
 */
export function buildCustomerResponse(
  name: string,
  email: string,
  candidateCount: number,
  selectedIndex: number
): PollResponse {
  const answers: Answer[] = Array.from({ length: candidateCount }, (_, i) =>
    i === selectedIndex ? "ok" : "ng"
  );
  const trimmedEmail = email.trim();
  return {
    name: name.trim(),
    answers,
    comment: trimmedEmail ? `連絡先: ${trimmedEmail}` : "",
    created_at: new Date().toISOString(),
  };
}
