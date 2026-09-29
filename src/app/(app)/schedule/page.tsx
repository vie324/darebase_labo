"use client";

// スケジュール — 営業チームの予定管理（月 / 週 / リスト表示）
//
// 予定の入力画面から、そのまま案件を登録できる（「案件も登録する」）。
// 予定は events.deal_id で案件に紐づき、詳細から案件管理へ飛べる。
// 案件の修正は案件管理に一本化し、この画面では登録とリンクだけを持つ。

import { useMemo, useRef, useState } from "react";
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
import type { Appointment, CalendarEvent, Deal, EventCategory } from "@/lib/types";
import { EVENT_CATEGORIES } from "@/lib/constants";
import { insertRow, useCollection } from "@/lib/use-collection";
import { useUser } from "@/lib/use-user";
import { useAccess } from "@/lib/use-access";
import { useBusinessUnit } from "@/lib/use-business-unit";
import { columnByKey } from "@/lib/pipeline";
import { linkedDealIdOf, sourceAppointmentOf } from "@/lib/schedule-deal";
import { appointmentDealMemo } from "@/lib/appointments";
import { cn, formatDate, formatTime, toDateStr } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
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
import type { ScheduleDealContext, ScheduleDealInput } from "./deal-section";

type ViewTab = "month" | "week" | "list";

export default function SchedulePage() {
  const { items: events, loading, add, update, remove } = useCollection("events");
  const { user } = useUser();
  const { organizationId, isPartner } = useAccess();
  const { toast } = useToast();
  // 予定の入力画面から案件を登録するためのデータ
  // （明細・活動履歴は書き込むだけなので一覧は読まない。insertRow で追記する）
  const deals = useCollection("deals");
  const products = useCollection("products");
  const banks = useCollection("banks");
  const branches = useCollection("branches");
  const appointments = useCollection("appointments");
  const profiles = useCollection("profiles");
  const { slug, units, defaultUnitId, loading: unitsLoading } = useBusinessUnit();

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
  // 案件は作れたが予定の保存に失敗したとき、入力画面で保存し直しても案件を作り直さない
  const pendingDeal = useRef<Deal | null>(null);

  const owners = useMemo(
    () =>
      Array.from(new Set(events.map((e) => e.owner_name).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b, "ja")
      ),
    [events]
  );

  // 担当者の選択肢はチームのメンバー（案件の担当者にもなるため実在のメンバーから選ぶ）
  const memberNames = useMemo(() => {
    const set = new Set<string>(
      profiles.items.filter((m) => m.is_active !== false).map((m) => m.name)
    );
    owners.forEach((o) => set.add(o));
    if (user?.name) set.add(user.name);
    return Array.from(set);
  }, [profiles.items, owners, user]);

  const filtered = useMemo(
    () =>
      events.filter(
        (e) =>
          (catFilters.length === 0 || catFilters.includes(e.category)) &&
          (!ownerFilter || e.owner_name === ownerFilter)
      ),
    [events, catFilters, ownerFilter]
  );

  if (
    loading ||
    deals.loading ||
    products.loading ||
    banks.loading ||
    branches.loading ||
    appointments.loading ||
    profiles.loading ||
    unitsLoading
  ) {
    return <PageSkeleton />;
  }

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

  // ---- 予定と案件の紐づけ ----

  /** 予定に紐づく案件（直接の紐づけ、または予定を作った紹介アポの案件） */
  const linkedDealOf = (ev: CalendarEvent | null): Deal | null => {
    if (!ev) return null;
    const id = linkedDealIdOf(ev, appointments.items);
    return id ? (deals.items.find((d) => d.id === id) ?? null) : null;
  };

  /** 予定を作った紹介アポのうち、まだ案件化していないもの */
  const openSourceAppointmentOf = (ev: CalendarEvent | null): Appointment | null => {
    if (!ev || linkedDealOf(ev)) return null;
    return sourceAppointmentOf(ev, appointments.items);
  };

  const dealContext: ScheduleDealContext = {
    units,
    defaultUnitId,
    banks: banks.items,
    branches: branches.items,
    products: products.items
      .filter((p) => p.is_active)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "ja")),
    deals: deals.items,
  };

  /**
   * 予定の入力内容から案件を1件登録する（商談予定・明細・活動履歴まで）。
   * 紹介アポから来た予定なら、紹介元はアポに揃え、アポの側も案件化済みにする。
   */
  const createDealFromSchedule = async (
    input: ScheduleDealInput,
    ev: EventInput,
    source: Appointment | null
  ): Promise<Deal> => {
    const now = new Date().toISOString();
    const bankId = source ? source.bank_id : input.bank_id;
    const branchId = source ? source.branch_id : input.branch_id;
    const branch = branches.items.find((b) => b.id === branchId);
    // 担当者は予定の担当者に揃える。代理店ユーザーは自分の案件しか作れない（RLS）ので自分
    const ownerId = isPartner
      ? (user?.id ?? null)
      : (profiles.items.find((m) => m.name === ev.owner_name)?.id ?? user?.id ?? null);
    const created = await deals.add({
      name: input.name,
      company: input.company,
      contact_name: "",
      stage: "appointment",
      confidence_rank: "",
      amount: input.amount,
      // 列の既定値にしておくと、カンバンで動かしたときに確度が自動で追従する
      probability: columnByKey("appointment")?.defaultProbability ?? 10,
      expected_close: input.expected_close,
      owner_name: ev.owner_name,
      owner_id: ownerId,
      next_action: "商談実施",
      memo: source ? appointmentDealMemo(source) : "",
      updated_at: now,
      bank_id: bankId || null,
      branch_id: branchId || null,
      appointment_id: source?.id ?? null,
      // 代理店ユーザーが登録した案件は自社に紐づける（RLS のスコープ条件）
      organization_id: branch?.assigned_org_id ?? source?.organization_id ?? organizationId ?? null,
      business_unit_id: source?.business_unit_id ?? input.business_unit_id,
    });
    await Promise.all(
      input.products.map((p) =>
        insertRow("deal_products", {
          deal_id: created.id,
          product_id: p.id,
          // マスタを改名しても当時の名前が残るようスナップショットする
          product_name: p.name,
          amount: p.unit_price,
          quantity: 1,
          memo: "",
        })
      )
    );
    const productNote =
      input.products.length > 0 ? `（${input.products.map((p) => p.name).join(" / ")}）` : "";
    await insertRow("deal_activities", {
      deal_id: created.id,
      type: "note",
      note: `スケジュールの予定「${ev.title}」（${formatDate(ev.start_at)}）から案件を登録しました${productNote}`,
      author_name: user?.name ?? ev.owner_name,
    });
    if (source) {
      await appointments.update(source.id, { deal_id: created.id, updated_at: now });
    }
    return created;
  };

  const handleSubmit = async (values: EventInput, dealInput: ScheduleDealInput | null) => {
    const target = form?.event ?? null;
    // すでに案件に紐づいている予定では、案件欄は出していない（二重登録しない）
    let created: Deal | null = null;
    if (dealInput && !linkedDealOf(target)) {
      pendingDeal.current ??= await createDealFromSchedule(
        dealInput,
        values,
        openSourceAppointmentOf(target)
      );
      created = pendingDeal.current;
    }
    const body = created ? { ...values, deal_id: created.id } : values;
    if (target) {
      await update(target.id, body);
    } else {
      await add(body);
    }
    if (created) {
      toast(`案件「${created.name}」を登録しました。修正は案件管理から行えます`, "success");
    }
  };

  const closeForm = () => {
    pendingDeal.current = null;
    setForm(null);
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
          linkedDeal={linkedDealOf(detail)}
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
          dealContext={dealContext}
          defaultUnit={slug}
          linkedDeal={linkedDealOf(form.event)}
          sourceAppointment={openSourceAppointmentOf(form.event)}
          onClose={closeForm}
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
