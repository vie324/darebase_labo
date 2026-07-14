"use client";

// =============================================================
// ロープレ練習 — 「練習履歴」タブ
// セッション一覧 → 詳細（再生 / 文字起こし / 分析 / フィードバック）
// =============================================================

import { useMemo, useState } from "react";
import {
  Clock,
  FileText,
  MessageSquare,
  Mic,
  Monitor,
  Send,
  Trash2,
  Volume2,
} from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  Textarea,
} from "@/components/ui";
import { formatDateTime, formatDuration, timeAgo } from "@/lib/utils";
import type { RoleplayFeedback, RoleplaySession } from "@/lib/types";
import { averageRating, bySessionNewest, MODE_META } from "./helpers";
import { StarRating, StarRatingInput } from "./star-rating";
import { AnalysisGrid } from "./practice-panel";

export function HistoryPanel({
  sessions,
  userName,
  colorOf,
  onAddFeedback,
  onRemove,
}: {
  sessions: RoleplaySession[];
  userName: string;
  colorOf: (name: string) => string;
  onAddFeedback: (session: RoleplaySession, feedback: RoleplayFeedback) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [detailId, setDetailId] = useState<string | null>(null);

  const ordered = useMemo(() => [...sessions].sort(bySessionNewest), [sessions]);
  const detail = detailId ? sessions.find((s) => s.id === detailId) ?? null : null;

  const handleDelete = async (s: RoleplaySession) => {
    if (!confirm("この練習記録を削除しますか？この操作は取り消せません。")) return;
    await onRemove(s.id);
    setDetailId(null);
  };

  if (ordered.length === 0) {
    return (
      <EmptyState
        icon={<Mic className="h-10 w-10" />}
        title="まだ練習記録がありません"
        description="「練習する」タブからロープレを録音すると、ここに履歴が残ります"
      />
    );
  }

  return (
    <div className="animate-fade-in space-y-3">
      {ordered.map((s) => {
        const meta = MODE_META[s.mode];
        const avg = averageRating(s.feedbacks);
        return (
          <Card
            key={s.id}
            hover
            className="flex flex-wrap items-center gap-4 p-4"
            onClick={() => setDetailId(s.id)}
          >
            <Avatar name={s.user_name} color={colorOf(s.user_name)} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-semibold">{s.script_title || "自由練習"}</span>
                <Badge className={meta.color}>
                  {meta.emoji} {meta.short}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                {s.user_name} ・ {timeAgo(s.created_at)}
              </p>
            </div>

            <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
              <Clock className="h-4 w-4" />
              <span className="tabular-nums">{formatDuration(s.duration_sec)}</span>
            </div>

            <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
              <MessageSquare className="h-4 w-4" />
              <span className="tabular-nums">{s.feedbacks.length}</span>
            </div>

            <div className="flex min-w-[92px] items-center justify-end gap-1.5">
              {avg !== null ? (
                <>
                  <StarRating value={avg} />
                  <span className="text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                    {avg.toFixed(1)}
                  </span>
                </>
              ) : (
                <span className="text-xs text-slate-400 dark:text-slate-500">未評価</span>
              )}
            </div>
          </Card>
        );
      })}

      {detail && (
        <SessionDetailModal
          key={detail.id}
          session={detail}
          userName={userName}
          colorOf={colorOf}
          canDelete={detail.user_name === userName}
          onClose={() => setDetailId(null)}
          onAddFeedback={onAddFeedback}
          onDelete={() => handleDelete(detail)}
        />
      )}
    </div>
  );
}

// ---------- 詳細モーダル ----------

function SessionDetailModal({
  session,
  userName,
  colorOf,
  canDelete,
  onClose,
  onAddFeedback,
  onDelete,
}: {
  session: RoleplaySession;
  userName: string;
  colorOf: (name: string) => string;
  canDelete: boolean;
  onClose: () => void;
  onAddFeedback: (session: RoleplaySession, feedback: RoleplayFeedback) => Promise<void>;
  onDelete: () => void;
}) {
  const meta = MODE_META[session.mode];
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);

  const orderedFeedbacks = [...session.feedbacks].sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  );

  const submitFeedback = async () => {
    if (rating === 0 || posting) return;
    setPosting(true);
    try {
      await onAddFeedback(session, {
        author_name: userName,
        rating,
        comment: comment.trim(),
        created_at: new Date().toISOString(),
      });
      setRating(0);
      setComment("");
    } finally {
      setPosting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={session.script_title || "自由練習"} wide>
      {/* メタ情報 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge className={meta.color}>
          {meta.emoji} {meta.label}
        </Badge>
        <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <Clock className="h-3 w-3" />
          {formatDuration(session.duration_sec)}
        </Badge>
        <span className="ml-auto flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
          <Avatar name={session.user_name} color={colorOf(session.user_name)} size="xs" />
          {session.user_name} ・ {formatDateTime(session.created_at)}
        </span>
      </div>

      {/* 再生 */}
      {session.media_url ? (
        <div className="mb-4">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
            {session.mode === "screen" ? (
              <Monitor className="h-3.5 w-3.5" />
            ) : (
              <Volume2 className="h-3.5 w-3.5" />
            )}
            録音再生
          </p>
          {session.mode === "screen" ? (
            <video
              src={session.media_url}
              controls
              className="w-full rounded-xl border border-slate-200 bg-black dark:border-slate-700"
            />
          ) : (
            <audio src={session.media_url} controls className="w-full" />
          )}
        </div>
      ) : (
        <div className="mb-4 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-400 dark:bg-slate-800/50 dark:text-slate-500">
          録音データはありません（このセッションでは保存されなかった可能性があります）。
        </div>
      )}

      {/* 分析 */}
      <div className="mb-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">簡易分析</p>
        <AnalysisGrid durationSec={session.duration_sec} transcript={session.transcript} />
      </div>

      {/* 文字起こし */}
      <section className="mb-4">
        <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-bold">
          <FileText className="h-4 w-4 text-cyan-500" />
          文字起こし
        </h3>
        <div className="scrollbar-thin max-h-52 overflow-y-auto rounded-xl bg-slate-50 p-4 text-sm leading-relaxed whitespace-pre-wrap dark:bg-slate-800/50">
          {session.transcript ? (
            session.transcript
          ) : (
            <span className="text-slate-400 dark:text-slate-500">文字起こしがありません。</span>
          )}
        </div>
      </section>

      {/* セルフメモ */}
      {session.self_note && (
        <section className="mb-4">
          <h3 className="mb-1.5 text-sm font-bold">セルフ振り返りメモ</h3>
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm leading-relaxed whitespace-pre-wrap dark:border-slate-800 dark:bg-slate-900">
            {session.self_note}
          </p>
        </section>
      )}

      {/* フィードバック */}
      <section className="border-t border-slate-200 pt-4 dark:border-slate-800">
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold">
          <MessageSquare className="h-4 w-4 text-cyan-500" />
          フィードバック
          <span className="text-xs font-normal text-slate-400 dark:text-slate-500">
            {session.feedbacks.length}件
          </span>
        </h3>

        {orderedFeedbacks.length > 0 && (
          <div className="mb-4 space-y-3">
            {orderedFeedbacks.map((f, i) => (
              <div
                key={`${f.author_name}-${f.created_at}-${i}`}
                className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/50"
              >
                <div className="flex items-center gap-2">
                  <Avatar name={f.author_name} color={colorOf(f.author_name)} size="xs" />
                  <span className="text-sm font-semibold">{f.author_name}</span>
                  <StarRating value={f.rating} className="ml-1" />
                  <span className="ml-auto text-[11px] text-slate-400 dark:text-slate-500">
                    {timeAgo(f.created_at)}
                  </span>
                </div>
                {f.comment && (
                  <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-slate-600 dark:text-slate-300">
                    {f.comment}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 追加フォーム */}
        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">評価</span>
            <StarRatingInput value={rating} onChange={setRating} size="md" />
            {rating > 0 && (
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                {rating}.0
              </span>
            )}
          </div>
          <Field label="コメント">
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="良かった点や改善アドバイスを記入…"
            />
          </Field>
          <div className="mt-3 flex justify-end">
            <Button onClick={submitFeedback} disabled={rating === 0 || posting}>
              <Send className="h-4 w-4" />
              {posting ? "投稿中…" : "フィードバックを送る"}
            </Button>
          </div>
        </div>
      </section>

      {/* 削除（自分のセッションのみ） */}
      {canDelete && (
        <div className="mt-4 flex justify-end border-t border-slate-200 pt-4 dark:border-slate-800">
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-slate-400 hover:text-rose-500"
          >
            <Trash2 className="h-4 w-4" />
            この練習記録を削除
          </Button>
        </div>
      )}
    </Modal>
  );
}
