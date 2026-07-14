"use client";

// スケジュール — 営業チームの予定管理（月 / 週 / リスト表示）

import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameDay,
  startOfWeek,
} from "date-fns";
import {
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Handshake,
  MapPin,
  Plus,
} from "lucide-react";
import type { CalendarEvent, EventCategory } from "@/lib/types";
import { EVENT_CATEGORIES } from "@/lib/constants";
import { useCollection } from "@/lib/use-collection";
import { useUser } from "@/lib/use-user";
import { cn, formatDate, formatTime, toDateStr } from "@/lib/utils";
import { DEMO_TEAM } from "@/lib/demo/team";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  PageSkeleton,
  Select,
  StatCard,
  Tabs,
} from "@/components/ui";
import {
  byStart,
  eventsOn,
  overlapsRange,
  ownerColor,
  WEEKDAYS,
  weekdayColor,
} from "./helpers";
import { MonthView } from "./month-view";
import {
  DayModal,
  EventDetailModal,
  EventFormModal,
  type EventInput,
} from "./event-modals";

type ViewTab = "month" | "week" | "list";

export default function SchedulePage() {
  const { items: events, loading, add, update, remove } = useCollection("events");
  const { user } = useUser();

  const [tab, setTab] = useState<ViewTab>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [catFilters, setCatFilters] = useState<EventCategory[]>([]);
  const [ownerFilter, setOwnerFilter] = useState("");
  const [dayModal, setDayModal] = useState<Date | null>(null);
  const [detail, setDetail] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState<{
    event: CalendarEvent | null;
    date: Date | null;
  } | null>(null);

  const owners = useMemo(
    () =>
      Array.from(new Set(events.map((e) => e.owner_name).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b, "ja")
      ),
    [events]
  );

  const memberNames = useMemo(() => {
    const set = new Set<string>(DEMO_TEAM.map((m) => m.name));
    owners.forEach((o) => set.add(o));
    if (user?.name) set.add(user.name);
    return Array.from(set);
  }, [owners, user]);

  const filtered = useMemo(
    () =>
      events.filter(
        (e) =>
          (catFilters.length === 0 || catFilters.includes(e.category)) &&
          (!ownerFilter || e.owner_name === ownerFilter)
      ),
    [events, catFilters, ownerFilter]
  );

  if (loading) return <PageSkeleton />;

  // ---- 集計（loading 後にのみ描画されるためハイドレーション安全） ----
  const today = new Date();
  const weekStart = startOfWeek(today);
  const weekEnd = endOfWeek(today);
  const todayCount = eventsOn(filtered, today).length;
  const weekEvents = filtered.filter((e) =>
    overlapsRange(e, weekStart.getTime(), weekEnd.getTime())
  );
  const weekSalesCount = weekEvents.filter(
    (e) => e.category === "visit" || e.category === "meeting"
  ).length;

  const navLabel =
    tab === "month"
      ? format(cursor, "yyyy年M月")
      : `${format(startOfWeek(cursor), "M/d")} 〜 ${format(endOfWeek(cursor), "M/d")}`;

  const moveCursor = (dir: 1 | -1) =>
    setCursor((c) => (tab === "month" ? addMonths(c, dir) : addDays(c, dir * 7)));

  const handleDelete = async (ev: CalendarEvent) => {
    if (!confirm(`「${ev.title}」を削除しますか？`)) return;
    await remove(ev.id);
    setDetail(null);
  };

  const handleSubmit = async (values: EventInput) => {
    if (form?.event) {
      await update(form.event.id, values);
    } else {
      await add(values);
    }
  };

  const filterActive = catFilters.length > 0 || ownerFilter !== "";

  return (
    <div>
      <PageHeader
        title="スケジュール"
        description="営業チームの予定をひと目で把握"
        icon={<CalendarDays className="h-5 w-5" />}
        actions={
          <Button onClick={() => setForm({ event: null, date: null })}>
            <Plus className="h-4 w-4" />
            予定を作成
          </Button>
        }
      />

      {/* サマリー */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="今日の予定"
          value={`${todayCount}件`}
          sub={`${format(today, "M月d日")}（${WEEKDAYS[today.getDay()]}）`}
          icon={<CalendarCheck className="h-5 w-5" />}
          accent="cyan"
        />
        <StatCard
          label="今週の予定"
          value={`${weekEvents.length}件`}
          sub={`${format(weekStart, "M/d")} 〜 ${format(weekEnd, "M/d")}`}
          icon={<CalendarRange className="h-5 w-5" />}
          accent="sky"
        />
        <StatCard
          label="今週の訪問・商談"
          value={`${weekSalesCount}件`}
          sub="訪問・会議カテゴリの合計"
          icon={<Handshake className="h-5 w-5" />}
          accent="emerald"
        />
      </div>

      {/* ビュー切替 + 期間ナビ */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          tabs={[
            { key: "month" as ViewTab, label: "月" },
            { key: "week" as ViewTab, label: "週" },
            { key: "list" as ViewTab, label: "リスト" },
          ]}
          active={tab}
          onChange={setTab}
        />
        {tab !== "list" && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => moveCursor(-1)}
              aria-label={tab === "month" ? "前月" : "前週"}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-28 text-center text-sm font-bold tabular-nums">
              {navLabel}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => moveCursor(1)}
              aria-label={tab === "month" ? "翌月" : "翌週"}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="ml-1"
              onClick={() => setCursor(new Date())}
            >
              今日
            </Button>
          </div>
        )}
      </div>

      {/* フィルタ */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setCatFilters([])}
          className={cn(
            "cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-all",
            catFilters.length === 0
              ? "border-transparent bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900"
              : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
          )}
        >
          すべて
        </button>
        {(Object.keys(EVENT_CATEGORIES) as EventCategory[]).map((key) => {
          const cat = EVENT_CATEGORIES[key];
          const active = catFilters.includes(key);
          return (
            <button
              key={key}
              onClick={() =>
                setCatFilters((prev) =>
                  active ? prev.filter((c) => c !== key) : [...prev, key]
                )
              }
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all",
                active
                  ? cn(cat.chip, "border-transparent shadow-sm")
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
              )}
            >
              <span className={cn("h-2 w-2 rounded-full", cat.dot)} />
              {cat.label}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          {filterActive && (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {filtered.length}件を表示中
            </span>
          )}
          <Select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="w-44 py-1.5! text-xs"
            aria-label="担当者で絞り込み"
          >
            <option value="">担当者: 全員</option>
            {owners.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* メインビュー */}
      {tab === "month" && (
        <MonthView
          cursor={cursor}
          today={today}
          events={filtered}
          onDayClick={setDayModal}
          onEventClick={setDetail}
        />
      )}
      {tab === "week" && (
        <WeekView
          cursor={cursor}
          today={today}
          events={filtered}
          onEventClick={setDetail}
          onDayCreate={(day) => setForm({ event: null, date: day })}
        />
      )}
      {tab === "list" && (
        <ListView
          events={filtered}
          today={today}
          onEventClick={setDetail}
          onCreate={() => setForm({ event: null, date: null })}
        />
      )}

      {/* モーダル群 */}
      {dayModal && (
        <DayModal
          day={dayModal}
          events={filtered}
          onClose={() => setDayModal(null)}
          onEventClick={(ev) => {
            setDayModal(null);
            setDetail(ev);
          }}
          onCreate={() => {
            const d = dayModal;
            setDayModal(null);
            setForm({ event: null, date: d });
          }}
        />
      )}
      {detail && (
        <EventDetailModal
          event={detail}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setForm({ event: detail, date: null });
            setDetail(null);
          }}
          onDelete={() => handleDelete(detail)}
        />
      )}
      {form && (
        <EventFormModal
          key={form.event?.id ?? (form.date ? toDateStr(form.date) : "new")}
          event={form.event}
          defaultDate={form.date}
          defaultOwner={user?.name ?? memberNames[0] ?? ""}
          memberNames={memberNames}
          onClose={() => setForm(null)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}

// ---------- 週ビュー（7日分の縦リスト） ----------
function WeekView({
  cursor,
  today,
  events,
  onEventClick,
  onDayCreate,
}: {
  cursor: Date;
  today: Date;
  events: CalendarEvent[];
  onEventClick: (ev: CalendarEvent) => void;
  onDayCreate: (day: Date) => void;
}) {
  const days = eachDayOfInterval({
    start: startOfWeek(cursor),
    end: endOfWeek(cursor),
  });

  return (
    <div className="space-y-3">
      {days.map((day) => {
        const dayEvents = eventsOn(events, day);
        const isToday = isSameDay(day, today);
        return (
          <Card
            key={day.toISOString()}
            className={cn(
              "p-4",
              isToday &&
                "border-cyan-200 ring-1 ring-cyan-100 dark:border-cyan-500/40 dark:ring-cyan-500/10"
            )}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 shrink-0 pt-0.5 text-center">
                <p className={cn("text-[11px] font-bold", weekdayColor(day.getDay()))}>
                  {WEEKDAYS[day.getDay()]}
                </p>
                <p
                  className={cn(
                    "mx-auto mt-0.5 flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold",
                    isToday
                      ? "bg-cyan-500 text-slate-900 shadow-sm shadow-cyan-500/30"
                      : "text-slate-700 dark:text-slate-200"
                  )}
                >
                  {day.getDate()}
                </p>
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                {dayEvents.length === 0 ? (
                  <p className="py-3 text-sm text-slate-300 dark:text-slate-600">
                    予定はありません
                  </p>
                ) : (
                  dayEvents.map((ev) => (
                    <EventRow key={ev.id} ev={ev} onClick={() => onEventClick(ev)} />
                  ))
                )}
              </div>
              <button
                onClick={() => onDayCreate(day)}
                aria-label="この日に予定を作成"
                title="この日に予定を作成"
                className="cursor-pointer rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-cyan-50 hover:text-cyan-500 dark:text-slate-600 dark:hover:bg-cyan-500/10 dark:hover:text-cyan-400"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ---------- リストビュー（今後の予定を日付グループで） ----------
function ListView({
  events,
  today,
  onEventClick,
  onCreate,
}: {
  events: CalendarEvent[];
  today: Date;
  onEventClick: (ev: CalendarEvent) => void;
  onCreate: () => void;
}) {
  const todayKey = toDateStr(today);
  const tomorrowKey = toDateStr(addDays(today, 1));
  const dayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  ).getTime();

  const upcoming = events
    .filter((e) => new Date(e.end_at).getTime() >= dayStart)
    .sort(
      (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
    );

  if (upcoming.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays className="h-12 w-12" />}
        title="今後の予定はありません"
        description="「予定を作成」から最初の予定を登録しましょう"
        action={
          <Button size="sm" onClick={onCreate}>
            <Plus className="h-4 w-4" />
            予定を作成
          </Button>
        }
      />
    );
  }

  const groups = new Map<string, CalendarEvent[]>();
  for (const ev of upcoming) {
    const key = toDateStr(new Date(ev.start_at));
    const list = groups.get(key);
    if (list) list.push(ev);
    else groups.set(key, [ev]);
  }

  return (
    <div className="space-y-6">
      {Array.from(groups.entries()).map(([key, list]) => (
        <section key={key}>
          <div className="mb-2 flex items-center gap-2.5">
            <h2
              className={cn(
                "text-sm font-bold",
                weekdayColor(new Date(`${key}T00:00:00`).getDay())
              )}
            >
              {formatDate(key)}
            </h2>
            {key === todayKey && (
              <Badge className="bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300">
                今日
              </Badge>
            )}
            {key === tomorrowKey && (
              <Badge className="bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                明日
              </Badge>
            )}
            {key < todayKey && (
              <Badge className="bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                継続中
              </Badge>
            )}
            <span className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {list.length}件
            </span>
          </div>
          <div className="space-y-1.5">
            {list.sort(byStart).map((ev) => (
              <EventRow key={ev.id} ev={ev} onClick={() => onEventClick(ev)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ---------- 週・リスト共通のイベント行 ----------
function EventRow({ ev, onClick }: { ev: CalendarEvent; onClick: () => void }) {
  const cat = EVENT_CATEGORIES[ev.category];
  return (
    <button
      onClick={onClick}
      className="group flex w-full cursor-pointer items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 text-left transition-all hover:-translate-y-px hover:border-cyan-200 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-cyan-500/30"
    >
      <span className={cn("h-10 w-1 shrink-0 rounded-full", cat.dot)} />
      <span className="w-16 shrink-0 text-xs font-semibold text-slate-500 tabular-nums dark:text-slate-400">
        {ev.all_day ? (
          "終日"
        ) : (
          <>
            {formatTime(ev.start_at)}
            <span className="block font-normal text-slate-300 dark:text-slate-600">
              〜{formatTime(ev.end_at)}
            </span>
          </>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold transition-colors group-hover:text-cyan-600 dark:group-hover:text-cyan-400">
          {ev.title}
        </span>
        {ev.location && (
          <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{ev.location}</span>
          </span>
        )}
      </span>
      <Badge className={cn("hidden sm:inline-flex", cat.chip)}>{cat.label}</Badge>
      <Avatar name={ev.owner_name} color={ownerColor(ev.owner_name)} size="xs" />
    </button>
  );
}
