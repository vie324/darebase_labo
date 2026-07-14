"use client";

// =============================================================
// 日程調整（Google カレンダー連携）
//  調整一覧 → 新規作成 → 回答マトリクスで集計 → 日程確定 →
//  Google カレンダー / ICS / 社内スケジュールへ登録、まで一気通貫。
// =============================================================

import { useState } from "react";
import {
  CalendarCheck,
  CalendarClock,
  Clock,
  Plus,
  Sparkles,
  Users,
} from "lucide-react";
import { useCollection } from "@/lib/use-collection";
import { useUser } from "@/lib/use-user";
import { cn, formatDateTime } from "@/lib/utils";
import type { PollResponse, SchedulePoll } from "@/lib/types";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  PageSkeleton,
  StatCard,
  Tabs,
} from "@/components/ui";
import {
  POLL_STATUS,
  bestCandidateIndex,
  candidateScore,
  draftsToCandidates,
  durationLabel,
  type PollFormValues,
} from "./shared";
import { PollDetailModal, PollFormModal } from "./poll-modals";

type FilterKey = "all" | "open" | "confirmed";

export default function BookingPage() {
  const { user } = useUser();
  const polls = useCollection("schedule_polls");
  const events = useCollection("events");
  const profiles = useCollection("profiles");

  const [filter, setFilter] = useState<FilterKey>("all");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  if (!user || polls.loading || events.loading || profiles.loading) {
    return <PageSkeleton />;
  }

  // ---------- 派生データ ----------
  const colorOf = (name: string) =>
    profiles.items.find((p) => p.name === name)?.color ?? "cyan";

  const sorted = [...polls.items].sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  );

  const openCount = polls.items.filter((p) => p.status === "open").length;
  const confirmedCount = polls.items.filter(
    (p) => p.status === "confirmed"
  ).length;

  const now = new Date();
  const monthCount = polls.items.filter((p) => {
    const d = new Date(p.created_at);
    return (
      d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    );
  }).length;

  const filtered = sorted.filter((p) => {
    if (filter === "open") return p.status === "open";
    if (filter === "confirmed") return p.status === "confirmed";
    return true;
  });

  const detailPoll = detailId
    ? (polls.items.find((p) => p.id === detailId) ?? null)
    : null;

  // ---------- 操作 ----------
  const createPoll = async (values: PollFormValues) => {
    await polls.add({
      title: values.title,
      description: values.description.trim(),
      organizer: user.name,
      location: values.location.trim(),
      duration_min: values.duration_min,
      candidates: draftsToCandidates(values.candidates, values.duration_min),
      responses: [],
      status: "open",
      confirmed_index: null,
    });
    setFormOpen(false);
  };

  const addResponse = async (responses: PollResponse[]) => {
    if (!detailPoll) return;
    await polls.update(detailPoll.id, { responses });
  };

  const confirmPoll = async (index: number) => {
    if (!detailPoll) return;
    await polls.update(detailPoll.id, {
      status: "confirmed",
      confirmed_index: index,
    });
  };

  const reopenPoll = async () => {
    if (!detailPoll) return;
    await polls.update(detailPoll.id, {
      status: "open",
      confirmed_index: null,
    });
  };

  const registerEvent = async () => {
    if (!detailPoll || detailPoll.confirmed_index === null) return;
    const c = detailPoll.candidates[detailPoll.confirmed_index];
    await events.add({
      title: detailPoll.title,
      description: detailPoll.description,
      start_at: c.start,
      end_at: c.end,
      all_day: false,
      category: "meeting",
      location: detailPoll.location,
      owner_name: detailPoll.organizer,
    });
  };

  const deletePoll = async () => {
    if (!detailPoll) return;
    if (!confirm(`日程調整「${detailPoll.title}」を削除しますか？`)) return;
    await polls.remove(detailPoll.id);
    setDetailId(null);
  };

  return (
    <div>
      <PageHeader
        title="日程調整"
        description="候補日から出欠を集めて、確定した予定をワンクリックでカレンダーへ"
        icon={<CalendarClock className="h-5 w-5" />}
        actions={
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            新規作成
          </Button>
        }
      />

      {/* ---------- サマリー ---------- */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="調整中"
          value={openCount}
          sub="回答を集計中"
          icon={<CalendarClock className="h-5 w-5" />}
          accent="amber"
        />
        <StatCard
          label="確定済み"
          value={confirmedCount}
          sub="日程が確定した調整"
          icon={<CalendarCheck className="h-5 w-5" />}
          accent="emerald"
        />
        <StatCard
          label="今月の調整数"
          value={monthCount}
          sub={`${now.getMonth() + 1}月に作成`}
          icon={<Sparkles className="h-5 w-5" />}
          accent="cyan"
        />
      </div>

      {/* ---------- フィルタ ---------- */}
      <div className="mt-6">
        <Tabs<FilterKey>
          tabs={[
            { key: "all", label: "すべて", count: polls.items.length },
            { key: "open", label: "調整中", count: openCount },
            { key: "confirmed", label: "確定済み", count: confirmedCount },
          ]}
          active={filter}
          onChange={setFilter}
        />
      </div>

      {/* ---------- 一覧 ---------- */}
      <div className="mt-4">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<CalendarClock className="h-12 w-12" />}
            title="日程調整はまだありません"
            description="「新規作成」から候補日を並べて、チームや取引先に出欠を聞きましょう。"
            action={
              <Button size="sm" onClick={() => setFormOpen(true)}>
                <Plus className="h-4 w-4" />
                新規作成
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((poll) => (
              <PollCard
                key={poll.id}
                poll={poll}
                colorOf={colorOf}
                onClick={() => setDetailId(poll.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ---------- モーダル ---------- */}
      {detailPoll && (
        <PollDetailModal
          key={detailPoll.id}
          poll={detailPoll}
          user={user}
          colorOf={colorOf}
          onClose={() => setDetailId(null)}
          onAddResponse={addResponse}
          onConfirm={confirmPoll}
          onReopen={reopenPoll}
          onRegisterEvent={registerEvent}
          onDelete={deletePoll}
        />
      )}

      {formOpen && (
        <PollFormModal
          organizer={user.name}
          onClose={() => setFormOpen(false)}
          onSubmit={createPoll}
        />
      )}
    </div>
  );
}

// ---------- 一覧カード ----------
function PollCard({
  poll,
  colorOf,
  onClick,
}: {
  poll: SchedulePoll;
  colorOf: (name: string) => string;
  onClick: () => void;
}) {
  const status = POLL_STATUS[poll.status];
  const confirmed =
    poll.confirmed_index !== null ? poll.candidates[poll.confirmed_index] : null;
  const best = bestCandidateIndex(poll);
  const leading =
    poll.status === "open" && best >= 0 ? poll.candidates[best] : null;

  return (
    <Card hover onClick={onClick} className="flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-2">
        <Badge className={status.badge}>
          <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
          {status.label}
        </Badge>
        <Badge className="bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          <Clock className="h-3 w-3" />
          {durationLabel(poll.duration_min)}
        </Badge>
      </div>

      <h3 className="line-clamp-2 leading-snug font-bold text-slate-800 dark:text-slate-100">
        {poll.title}
      </h3>

      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <Avatar name={poll.organizer} color={colorOf(poll.organizer)} size="xs" />
        主催 {poll.organizer}
      </div>

      {confirmed ? (
        <div className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          <span className="flex items-center gap-1">
            <CalendarCheck className="h-3.5 w-3.5" />
            {formatDateTime(confirmed.start)} に確定
          </span>
        </div>
      ) : leading ? (
        <div className="rounded-xl bg-cyan-50/70 px-3 py-2 text-xs font-medium text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-300">
          <span className="flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5" />
            最有力 {formatDateTime(leading.start)}（{candidateScore(poll, best)}
            点）
          </span>
        </div>
      ) : (
        <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-400 dark:bg-slate-800/60 dark:text-slate-500">
          回答を待っています
        </div>
      )}

      <div className="mt-auto flex items-center gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <span className="inline-flex items-center gap-1">
          <CalendarClock className="h-3.5 w-3.5" />
          候補 {poll.candidates.length}件
        </span>
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          回答 {poll.responses.length}名
        </span>
      </div>
    </Card>
  );
}
