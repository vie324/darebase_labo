"use client";

// =============================================================
// ダッシュボード — 全モジュール横断のホーム画面
// events / deals / tasks / knowledge / posts / deal_activities を
// useCollection で読み、チームの「今」をひと目で把握できるようにする。
// =============================================================

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Briefcase,
  CalendarDays,
  Check,
  CheckSquare,
  Clock,
  Eye,
  LayoutDashboard,
  MessageCircle,
  Newspaper,
  Plus,
  ThumbsUp,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { useCollection } from "@/lib/use-collection";
import { useUser } from "@/lib/use-user";
import {
  ACTIVITY_TYPES,
  DEAL_STAGES,
  EVENT_CATEGORIES,
  KNOWLEDGE_CATEGORIES,
  POST_CATEGORIES,
  TASK_PRIORITIES,
} from "@/lib/constants";
import {
  cn,
  formatDate,
  formatTime,
  formatYenShort,
  timeAgo,
  toDateStr,
  todayStr,
} from "@/lib/utils";
import type { DealStage, TaskPriority } from "@/lib/types";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  PageSkeleton,
  ProgressBar,
  Select,
  StatCard,
  Textarea,
} from "@/components/ui";

// ---------- セクション共通のカード枠 ----------
function SectionCard({
  icon,
  iconClass,
  title,
  count,
  href,
  children,
}: {
  icon: ReactNode;
  iconClass: string;
  title: string;
  count?: number;
  href: string;
  children: ReactNode;
}) {
  return (
    <Card className="flex flex-col p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2.5 font-bold">
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              iconClass
            )}
          >
            {icon}
          </span>
          <span className="truncate">{title}</span>
          {typeof count === "number" && (
            <span className="rounded-full bg-slate-100 px-2 text-xs leading-5 font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {count}
            </span>
          )}
        </h2>
        <Link
          href={href}
          className="group inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-cyan-600 transition-colors hover:text-cyan-500 dark:text-cyan-400 dark:hover:text-cyan-300"
        >
          すべて見る
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
      <div className="flex-1">{children}</div>
    </Card>
  );
}

export default function DashboardPage() {
  const { user } = useUser();
  const events = useCollection("events");
  const deals = useCollection("deals");
  const tasks = useCollection("tasks");
  const activities = useCollection("deal_activities");
  const knowledge = useCollection("knowledge");
  const posts = useCollection("posts");
  const profiles = useCollection("profiles");

  // クイックタスク追加モーダル
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskPriority, setTaskPriority] = useState<TaskPriority>("mid");
  const [taskDue, setTaskDue] = useState("");
  const [taskDesc, setTaskDesc] = useState("");

  const loading =
    !user ||
    events.loading ||
    deals.loading ||
    tasks.loading ||
    activities.loading ||
    knowledge.loading ||
    posts.loading;

  if (loading) return <PageSkeleton />;

  // ---------- 派生データ（loading 後のみ計算するのでハイドレーション安全） ----------
  const now = new Date();
  const today = todayStr();
  const hour = now.getHours();
  const greeting =
    hour >= 5 && hour < 11
      ? "おはようございます"
      : hour >= 11 && hour < 18
        ? "こんにちは"
        : "こんばんは";
  const weekday = ["日", "月", "火", "水", "木", "金", "土"][now.getDay()];
  const dateLabel = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日（${weekday}）`;

  const colorOf = (name: string) =>
    profiles.items.find((p) => p.name === name)?.color ?? "cyan";

  // 今日の予定（終日→時刻順）
  const todayEvents = events.items
    .filter((e) => toDateStr(new Date(e.start_at)) === today)
    .sort((a, b) => {
      if (a.all_day !== b.all_day) return a.all_day ? -1 : 1;
      return a.start_at.localeCompare(b.start_at);
    });
  const nextEvent = todayEvents.find(
    (e) => !e.all_day && new Date(e.end_at).getTime() > now.getTime()
  );

  // 案件
  const activeDeals = deals.items.filter(
    (d) => d.stage !== "won" && d.stage !== "lost"
  );
  const activeAmount = activeDeals.reduce((sum, d) => sum + d.amount, 0);
  const wonDeals = deals.items.filter((d) => d.stage === "won");
  const wonAmount = wonDeals.reduce((sum, d) => sum + d.amount, 0);
  const lostCount = deals.items.filter((d) => d.stage === "lost").length;
  const winRate =
    wonDeals.length + lostCount > 0
      ? Math.round((wonDeals.length / (wonDeals.length + lostCount)) * 100)
      : null;

  // 自分の未完了タスク（期限昇順 → 優先度順）
  const priorityOrder: Record<TaskPriority, number> = { high: 0, mid: 1, low: 2 };
  const myOpenTasks = tasks.items
    .filter((t) => t.assignee_name === user.name && t.status !== "done")
    .sort((a, b) => {
      const da = a.due_date || "9999-12-31";
      const db = b.due_date || "9999-12-31";
      if (da !== db) return da.localeCompare(db);
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  const overdueCount = myOpenTasks.filter(
    (t) => t.due_date && t.due_date < today
  ).length;

  // パイプライン（ステージ順）
  const stageRows = (Object.keys(DEAL_STAGES) as DealStage[])
    .sort((a, b) => DEAL_STAGES[a].order - DEAL_STAGES[b].order)
    .map((stage) => {
      const rows = deals.items.filter((d) => d.stage === stage);
      return {
        stage,
        meta: DEAL_STAGES[stage],
        count: rows.length,
        amount: rows.reduce((sum, d) => sum + d.amount, 0),
      };
    });
  const maxStageAmount = Math.max(...stageRows.map((r) => r.amount), 1);

  // 最近の活動
  const recentActivities = [...activities.items]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5);
  const dealNameOf = (dealId: string) =>
    deals.items.find((d) => d.id === dealId)?.name ?? "";

  // 新着ナレッジ / 掲示板
  const latestKnowledge = [...knowledge.items]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 3);
  const latestPosts = [...posts.items]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 3);

  // ---------- 操作 ----------
  const completeTask = (id: string) => {
    void tasks.update(id, {
      status: "done",
      completed_at: new Date().toISOString(),
    });
  };

  const resetTaskForm = () => {
    setTaskTitle("");
    setTaskPriority("mid");
    setTaskDue("");
    setTaskDesc("");
  };

  const handleAddTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    await tasks.add({
      title: taskTitle.trim(),
      description: taskDesc.trim(),
      status: "todo",
      priority: taskPriority,
      due_date: taskDue,
      assignee_name: user.name,
      related_deal: "",
      completed_at: null,
    });
    resetTaskForm();
    setTaskModalOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="ダッシュボード"
        description="チーム全体の動きをひと目で確認"
        icon={<LayoutDashboard className="h-5 w-5" />}
        actions={
          <Button size="sm" onClick={() => setTaskModalOpen(true)}>
            <Plus className="h-4 w-4" />
            タスクを追加
          </Button>
        }
      />

      {/* ---------- 挨拶ヒーロー ---------- */}
      <div className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-600 via-sky-600 to-sky-600 p-6 text-white shadow-lg shadow-cyan-500/25 sm:p-8">
        <div className="pointer-events-none absolute -top-20 -right-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-sky-400/20 blur-2xl" />
        <div className="relative">
          <p className="text-sm font-medium text-cyan-100">{dateLabel}</p>
          <h2 className="mt-1.5 text-2xl leading-snug font-bold sm:text-3xl">
            {greeting}、{user.name}さん
          </h2>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-medium sm:text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 backdrop-blur-sm">
              <CalendarDays className="h-3.5 w-3.5" />
              今日の予定 {todayEvents.length}件
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 backdrop-blur-sm">
              <CheckSquare className="h-3.5 w-3.5" />
              未完了タスク {myOpenTasks.length}件
            </span>
            {overdueCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/80 px-3 py-1 backdrop-blur-sm">
                <AlertTriangle className="h-3.5 w-3.5" />
                期限切れ {overdueCount}件
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ---------- サマリー ---------- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="進行中案件"
          value={`${activeDeals.length}件`}
          sub={`総額 ${formatYenShort(activeAmount)}`}
          icon={<Briefcase className="h-5 w-5" />}
          accent="cyan"
        />
        <StatCard
          label="今日の予定"
          value={`${todayEvents.length}件`}
          sub={
            nextEvent
              ? `次は ${formatTime(nextEvent.start_at)}〜`
              : todayEvents.length > 0
                ? "本日の予定は終了しました"
                : "予定はありません"
          }
          icon={<CalendarDays className="h-5 w-5" />}
          accent="sky"
        />
        <StatCard
          label="自分の未完了タスク"
          value={`${myOpenTasks.length}件`}
          sub={
            overdueCount > 0 ? (
              <span className="font-semibold text-rose-500">
                期限切れ {overdueCount}件
              </span>
            ) : (
              "期限切れなし"
            )
          }
          icon={<CheckSquare className="h-5 w-5" />}
          accent="amber"
        />
        <StatCard
          label="受注済み金額"
          value={formatYenShort(wonAmount)}
          sub={`${wonDeals.length}件を受注`}
          icon={<Trophy className="h-5 w-5" />}
          accent="emerald"
        />
      </div>

      {/* ---------- メイングリッド ---------- */}
      <div className="mt-6 grid items-start gap-4 lg:grid-cols-2">
        {/* 今日のスケジュール */}
        <SectionCard
          icon={<CalendarDays className="h-4 w-4" />}
          iconClass="bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400"
          title="今日のスケジュール"
          count={todayEvents.length}
          href="/schedule"
        >
          {todayEvents.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="h-8 w-8" />}
              title="今日の予定はありません"
              description="スケジュールから予定を登録できます"
            />
          ) : (
            <ul className="scrollbar-thin max-h-80 space-y-1 overflow-y-auto">
              {todayEvents.map((ev) => (
                <li
                  key={ev.id}
                  className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <span
                    className={cn(
                      "h-2.5 w-2.5 shrink-0 rounded-full",
                      EVENT_CATEGORIES[ev.category].dot
                    )}
                  />
                  <div className="w-12 shrink-0 text-center">
                    {ev.all_day ? (
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        終日
                      </span>
                    ) : (
                      <>
                        <p className="text-sm font-bold tabular-nums">
                          {formatTime(ev.start_at)}
                        </p>
                        <p className="text-[11px] text-slate-400 tabular-nums dark:text-slate-500">
                          {formatTime(ev.end_at)}
                        </p>
                      </>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{ev.title}</p>
                    {ev.location && (
                      <p className="truncate text-xs text-slate-400 dark:text-slate-500">
                        {ev.location}
                      </p>
                    )}
                  </div>
                  <Badge
                    className={cn(
                      "hidden sm:inline-flex",
                      EVENT_CATEGORIES[ev.category].chip
                    )}
                  >
                    {EVENT_CATEGORIES[ev.category].label}
                  </Badge>
                  <Avatar
                    name={ev.owner_name}
                    color={colorOf(ev.owner_name)}
                    size="xs"
                  />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* 自分のタスク */}
        <SectionCard
          icon={<CheckSquare className="h-4 w-4" />}
          iconClass="bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"
          title="自分のタスク"
          count={myOpenTasks.length}
          href="/tasks"
        >
          {myOpenTasks.length === 0 ? (
            <EmptyState
              icon={<CheckSquare className="h-8 w-8" />}
              title="未完了のタスクはありません"
              description="お疲れさまです。すべてのタスクが完了しています"
              action={
                <Button size="sm" variant="secondary" onClick={() => setTaskModalOpen(true)}>
                  <Plus className="h-4 w-4" />
                  タスクを追加
                </Button>
              }
            />
          ) : (
            <ul className="space-y-1">
              {myOpenTasks.slice(0, 5).map((t) => {
                const overdue = !!t.due_date && t.due_date < today;
                return (
                  <li
                    key={t.id}
                    className="group flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <button
                      onClick={() => completeTask(t.id)}
                      aria-label={`「${t.title}」を完了にする`}
                      title="完了にする"
                      className="mt-0.5 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-slate-300 text-transparent transition-all hover:border-emerald-500 hover:bg-emerald-500 hover:text-white dark:border-slate-600 dark:hover:border-emerald-500"
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Badge className={TASK_PRIORITIES[t.priority].color}>
                          {TASK_PRIORITIES[t.priority].label}
                        </Badge>
                        {overdue ? (
                          <Badge className="bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                            <AlertTriangle className="h-3 w-3" />
                            期限切れ {formatDate(t.due_date)}
                          </Badge>
                        ) : (
                          t.due_date && (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                              <Clock className="h-3 w-3" />
                              {formatDate(t.due_date)}
                            </span>
                          )
                        )}
                        {t.related_deal && (
                          <span className="truncate text-xs text-slate-400 dark:text-slate-500">
                            {t.related_deal}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        {/* パイプライン */}
        <SectionCard
          icon={<TrendingUp className="h-4 w-4" />}
          iconClass="bg-cyan-50 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400"
          title="パイプライン"
          href="/deals"
        >
          {deals.items.length === 0 ? (
            <EmptyState
              icon={<Briefcase className="h-8 w-8" />}
              title="案件がありません"
              description="案件管理から新規案件を登録できます"
            />
          ) : (
            <>
              <div className="space-y-4">
                {stageRows.map((row) => (
                  <div key={row.stage}>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2 text-sm">
                        <span
                          className={cn("h-2.5 w-2.5 shrink-0 rounded-full", row.meta.bar)}
                        />
                        <span className="truncate font-medium">{row.meta.label}</span>
                        <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
                          {row.count}件
                        </span>
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-slate-500 tabular-nums dark:text-slate-400">
                        {row.amount > 0 ? formatYenShort(row.amount) : "—"}
                      </span>
                    </div>
                    <ProgressBar
                      value={row.amount}
                      max={maxStageAmount}
                      barClassName={row.meta.bar}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <span>
                  進行中 {activeDeals.length}件・{formatYenShort(activeAmount)}
                </span>
                {winRate !== null && (
                  <span className="font-semibold">受注率 {winRate}%</span>
                )}
              </div>
            </>
          )}
        </SectionCard>

        {/* 最近の活動 */}
        <SectionCard
          icon={<Activity className="h-4 w-4" />}
          iconClass="bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400"
          title="最近の活動"
          href="/deals"
        >
          {recentActivities.length === 0 ? (
            <EmptyState
              icon={<Activity className="h-8 w-8" />}
              title="活動履歴はまだありません"
              description="案件に活動を記録するとここに表示されます"
            />
          ) : (
            <ol>
              {recentActivities.map((a, i) => {
                const dealName = dealNameOf(a.deal_id);
                return (
                  <li key={a.id} className="relative flex gap-3 pb-5 last:pb-0">
                    {i < recentActivities.length - 1 && (
                      <span
                        aria-hidden
                        className="absolute top-9 bottom-0 left-4 w-px bg-slate-200 dark:bg-slate-800"
                      />
                    )}
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm dark:bg-slate-800">
                      {ACTIVITY_TYPES[a.type].icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-sm font-semibold">{a.author_name}</span>
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          {ACTIVITY_TYPES[a.type].label}
                        </span>
                        <span className="ml-auto shrink-0 text-xs text-slate-400 dark:text-slate-500">
                          {timeAgo(a.created_at)}
                        </span>
                      </div>
                      {dealName && (
                        <p className="mt-0.5 truncate text-xs font-medium text-cyan-600 dark:text-cyan-400">
                          {dealName}
                        </p>
                      )}
                      <p className="mt-0.5 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">
                        {a.note}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </SectionCard>

        {/* 新着ナレッジ */}
        <SectionCard
          icon={<BookOpen className="h-4 w-4" />}
          iconClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
          title="新着ナレッジ"
          href="/knowledge"
        >
          {latestKnowledge.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="h-8 w-8" />}
              title="ナレッジはまだありません"
              description="営業ノウハウを共有しましょう"
            />
          ) : (
            <ul className="space-y-1">
              {latestKnowledge.map((k) => (
                <li key={k.id}>
                  <Link
                    href="/knowledge"
                    className="block rounded-xl px-2 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <div className="flex items-center gap-2">
                      <Badge className={KNOWLEDGE_CATEGORIES[k.category].color}>
                        {KNOWLEDGE_CATEGORIES[k.category].label}
                      </Badge>
                      <p className="truncate text-sm font-medium">{k.title}</p>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
                      <span className="truncate">
                        {k.author_name}・{timeAgo(k.created_at)}
                      </span>
                      <span className="ml-auto inline-flex shrink-0 items-center gap-1">
                        <ThumbsUp className="h-3 w-3" />
                        {k.likes}
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {k.views}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* 掲示板 */}
        <SectionCard
          icon={<Newspaper className="h-4 w-4" />}
          iconClass="bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400"
          title="掲示板"
          href="/board"
        >
          {latestPosts.length === 0 ? (
            <EmptyState
              icon={<Newspaper className="h-8 w-8" />}
              title="投稿はまだありません"
              description="チームへのお知らせや質問を投稿しましょう"
            />
          ) : (
            <ul className="space-y-1">
              {latestPosts.map((p) => (
                <li key={p.id}>
                  <Link
                    href="/board"
                    className="block rounded-xl px-2 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <div className="flex items-center gap-2">
                      <Badge className={POST_CATEGORIES[p.category].color}>
                        {POST_CATEGORIES[p.category].label}
                      </Badge>
                      <p className="truncate text-sm font-medium">{p.title}</p>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
                      <span className="truncate">
                        {p.author_name}・{timeAgo(p.created_at)}
                      </span>
                      <span className="ml-auto inline-flex shrink-0 items-center gap-1">
                        <ThumbsUp className="h-3 w-3" />
                        {p.likes}
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1">
                        <MessageCircle className="h-3 w-3" />
                        {p.comments.length}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* ---------- クイックタスク追加 ---------- */}
      <Modal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        title="タスクを追加"
      >
        <form onSubmit={handleAddTask} className="space-y-4">
          <Field label="タイトル" required>
            <Input
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="例: 〇〇社へ見積書を送付"
              autoFocus
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="優先度">
              <Select
                value={taskPriority}
                onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
              >
                <option value="high">高</option>
                <option value="mid">中</option>
                <option value="low">低</option>
              </Select>
            </Field>
            <Field label="期限">
              <Input
                type="date"
                value={taskDue}
                onChange={(e) => setTaskDue(e.target.value)}
              />
            </Field>
          </div>
          <Field label="メモ">
            <Textarea
              value={taskDesc}
              onChange={(e) => setTaskDesc(e.target.value)}
              placeholder="補足があれば入力（任意）"
              rows={3}
            />
          </Field>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            担当者は自分（{user.name}）として登録されます。
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setTaskModalOpen(false)}
            >
              キャンセル
            </Button>
            <Button type="submit" disabled={!taskTitle.trim()}>
              <Plus className="h-4 w-4" />
              追加する
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
