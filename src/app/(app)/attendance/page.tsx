"use client";

// =============================================================
// 勤怠 — 自分の打刻と、管理部から見た全員の月次
//
// 一般社員: 自分の当月カレンダーを埋める（1日1行）
// 管理部・経営: 全員の月次サマリーを見て、打刻漏れ・時間外の超過を拾う
//
// 給与計算（社会保険料・源泉徴収）はここでは行わない。
// 雇用形態の内訳と人数が決まってから、この実績値を入力にして組む。
// =============================================================

import { useMemo, useState } from "react";
import {
  AlarmClock,
  CalendarCheck,
  ClipboardList,
  Clock,
  Moon,
  TriangleAlert,
  Users,
} from "lucide-react";
import { useCollection } from "@/lib/use-collection";
import { useUser } from "@/lib/use-user";
import { useAccess } from "@/lib/use-access";
import { useWorkSettings } from "@/lib/settings";
import {
  ATTENDANCE_KINDS,
  ATTENDANCE_KIND_KEYS,
  daysInMonth,
  formatMinutes,
  isWorkingKind,
  monthlySummary,
  overtimeMinutes,
  workedMinutes,
} from "@/lib/attendance";
import { cn, todayStr } from "@/lib/utils";
import type { AttendanceRecord } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  PageSkeleton,
  Select,
  StatCard,
  Tabs,
} from "@/components/ui";
import { useToast } from "@/components/ui/toast";

/** YYYY-MM。当月を既定にする */
function thisMonth(): string {
  return todayStr().slice(0, 7);
}

/** 直近12か月の選択肢 */
function monthOptions(): string[] {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function weekdayOf(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "" : WEEKDAYS[d.getDay()];
}

function isWeekend(date: string): boolean {
  const d = new Date(`${date}T00:00:00`);
  return d.getDay() === 0 || d.getDay() === 6;
}

export default function AttendancePage() {
  const { user } = useUser();
  const { can, loading: accessLoading } = useAccess();
  const records = useCollection("attendance_records");
  const profiles = useCollection("profiles");
  const { settings } = useWorkSettings();
  const { toast } = useToast();

  const [month, setMonth] = useState(thisMonth());
  const [tab, setTab] = useState<"mine" | "team">("mine");

  const isAdmin = can("hr_admin");

  const monthRows = useMemo(
    () => records.items.filter((r) => r.work_date.startsWith(month)),
    [records.items, month]
  );

  const myRows = useMemo(
    () => monthRows.filter((r) => r.owner_id === user?.id),
    [monthRows, user?.id]
  );

  if (accessLoading || records.loading || profiles.loading || !user) return <PageSkeleton />;

  if (!can("hr_self")) {
    return (
      <div>
        <PageHeader
          icon={<CalendarCheck className="h-5 w-5" />}
          title="勤怠"
          description="出退勤の記録と月次の集計"
        />
        <Card className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">
          勤怠管理の対象は本部の社員のみです。
        </Card>
      </div>
    );
  }

  const mySummary = monthlySummary(myRows, settings.scheduledMinutes);
  const overLimit = mySummary.overtimeMinutes > settings.monthlyOvertimeLimitMinutes;

  // ---------- 操作 ----------

  const upsert = async (date: string, patch: Partial<AttendanceRecord>) => {
    const existing = myRows.find((r) => r.work_date === date);
    const now = new Date().toISOString();
    if (existing) {
      await records.update(existing.id, { ...patch, updated_at: now });
      return;
    }
    await records.add({
      owner_id: user.id,
      owner_name: user.name,
      work_date: date,
      kind: "office",
      start_at: "",
      end_at: "",
      break_minutes: 60,
      note: "",
      updated_at: now,
      ...patch,
    });
  };

  /** 出社・退勤を今の時刻で入れる */
  const stamp = async (field: "start_at" | "end_at") => {
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    await upsert(todayStr(), { [field]: hhmm } as Partial<AttendanceRecord>);
    toast(field === "start_at" ? `出勤 ${hhmm} を記録しました` : `退勤 ${hhmm} を記録しました`, "success");
  };

  const today = todayStr();
  const todayRow = myRows.find((r) => r.work_date === today);
  const isThisMonth = month === thisMonth();

  return (
    <div>
      <PageHeader
        title="勤怠"
        description="出退勤の記録と月次の集計。給与計算は含みません"
        icon={<CalendarCheck className="h-5 w-5" />}
        actions={
          <div className="w-36">
            <Select value={month} onChange={(e) => setMonth(e.target.value)}>
              {monthOptions().map((m) => (
                <option key={m} value={m}>
                  {m.replace("-", "年")}月
                </option>
              ))}
            </Select>
          </div>
        }
      />

      {/* 今日の打刻 */}
      {isThisMonth && (
        <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
            今日（{today.slice(5).replace("-", "/")}）
          </span>
          <span className="text-sm tabular-nums">
            {todayRow?.start_at || "--:--"} 〜 {todayRow?.end_at || "--:--"}
          </span>
          {todayRow && workedMinutes(todayRow) > 0 && (
            <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              実働 {formatMinutes(workedMinutes(todayRow))}
            </Badge>
          )}
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => stamp("start_at")}>
              <Clock className="h-4 w-4" />
              出勤
            </Button>
            <Button size="sm" onClick={() => stamp("end_at")}>
              <Clock className="h-4 w-4" />
              退勤
            </Button>
          </div>
        </Card>
      )}

      {/* 自分の月次 */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="出勤日数"
          value={`${mySummary.workedDays}日`}
          sub={`有給 ${mySummary.paidLeaveDays}日 ・ 欠勤 ${mySummary.absenceDays}日`}
          icon={<CalendarCheck className="h-5 w-5" />}
          accent="cyan"
        />
        <StatCard
          label="実働"
          value={formatMinutes(mySummary.workedMinutes)}
          sub={`所定 ${formatMinutes(settings.scheduledMinutes)}/日`}
          icon={<Clock className="h-5 w-5" />}
          accent="sky"
        />
        <StatCard
          label="時間外"
          value={formatMinutes(mySummary.overtimeMinutes)}
          sub={
            overLimit
              ? `上限 ${formatMinutes(settings.monthlyOvertimeLimitMinutes)} を超過`
              : `上限 ${formatMinutes(settings.monthlyOvertimeLimitMinutes)} まで`
          }
          icon={<AlarmClock className="h-5 w-5" />}
          accent={overLimit ? "rose" : "amber"}
        />
        <StatCard
          label="深夜"
          value={formatMinutes(mySummary.lateNightMinutes)}
          sub={mySummary.missingDays > 0 ? `打刻漏れ ${mySummary.missingDays}日` : "打刻漏れなし"}
          icon={<Moon className="h-5 w-5" />}
          accent="indigo"
        />
      </div>

      {isAdmin && (
        <div className="mt-6">
          <Tabs
            tabs={[
              { key: "mine" as const, label: "自分の勤怠" },
              { key: "team" as const, label: "全員の月次" },
            ]}
            active={tab}
            onChange={setTab}
          />
        </div>
      )}

      {(!isAdmin || tab === "mine") && (
        <MyMonth
          month={month}
          rows={myRows}
          scheduledMinutes={settings.scheduledMinutes}
          longDayMinutes={settings.longDayMinutes}
          onChange={upsert}
        />
      )}

      {isAdmin && tab === "team" && (
        <TeamMonth
          rows={monthRows}
          scheduledMinutes={settings.scheduledMinutes}
          overtimeLimit={settings.monthlyOvertimeLimitMinutes}
        />
      )}
    </div>
  );
}

// ---------- 自分の月次（カレンダー） ----------

function MyMonth({
  month,
  rows,
  scheduledMinutes,
  longDayMinutes,
  onChange,
}: {
  month: string;
  rows: AttendanceRecord[];
  scheduledMinutes: number;
  longDayMinutes: number;
  onChange: (date: string, patch: Partial<AttendanceRecord>) => Promise<void>;
}) {
  const days = daysInMonth(month);
  const byDate = new Map(rows.map((r) => [r.work_date, r]));
  const today = todayStr();

  return (
    <Card className="mt-4 overflow-hidden">
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 sm:px-5">日付</th>
              <th className="px-3 py-3">区分</th>
              <th className="px-3 py-3">出勤</th>
              <th className="px-3 py-3">退勤</th>
              <th className="px-3 py-3">休憩</th>
              <th className="px-3 py-3 text-right">実働</th>
              <th className="px-4 py-3 text-right sm:px-5">時間外</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {days.map((date) => {
              const row = byDate.get(date);
              const kind = row?.kind ?? (isWeekend(date) ? "holiday" : "office");
              const worked = row ? workedMinutes(row) : 0;
              const over = row ? overtimeMinutes(row, scheduledMinutes) : 0;
              const missing =
                row !== undefined && isWorkingKind(kind) && worked === 0 && date <= today;
              return (
                <tr
                  key={date}
                  className={cn(
                    "transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40",
                    date === today && "bg-cyan-50/40 dark:bg-cyan-500/5"
                  )}
                >
                  <td className="px-4 py-2 whitespace-nowrap sm:px-5">
                    <span
                      className={cn(
                        "font-semibold tabular-nums",
                        isWeekend(date) && "text-slate-400 dark:text-slate-500"
                      )}
                    >
                      {date.slice(8)}
                    </span>
                    <span className="ml-1.5 text-xs text-slate-400">{weekdayOf(date)}</span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="w-28">
                      <Select
                        value={kind}
                        onChange={(e) => onChange(date, { kind: e.target.value })}
                        className="!py-1.5 text-xs"
                      >
                        {ATTENDANCE_KIND_KEYS.map((k) => (
                          <option key={k} value={k}>
                            {ATTENDANCE_KINDS[k].label}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="w-28">
                      <Input
                        type="time"
                        value={row?.start_at ?? ""}
                        onChange={(e) => onChange(date, { start_at: e.target.value })}
                        className="!py-1.5 text-xs"
                        disabled={!isWorkingKind(kind)}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="w-28">
                      <Input
                        type="time"
                        value={row?.end_at ?? ""}
                        onChange={(e) => onChange(date, { end_at: e.target.value })}
                        className="!py-1.5 text-xs"
                        disabled={!isWorkingKind(kind)}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="w-20">
                      <Input
                        type="number"
                        value={String(row?.break_minutes ?? 60)}
                        onChange={(e) =>
                          onChange(date, { break_minutes: Number(e.target.value) || 0 })
                        }
                        className="!py-1.5 text-xs"
                        disabled={!isWorkingKind(kind)}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">
                    {missing ? (
                      <span className="text-amber-600 dark:text-amber-400">打刻漏れ</span>
                    ) : (
                      formatMinutes(worked)
                    )}
                  </td>
                  <td className="px-4 py-2 text-right text-xs tabular-nums sm:px-5">
                    <span
                      className={cn(
                        over >= longDayMinutes && "font-bold text-rose-600 dark:text-rose-400"
                      )}
                    >
                      {over > 0 ? formatMinutes(over) : "—"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ---------- 全員の月次（管理部向け） ----------

function TeamMonth({
  rows,
  scheduledMinutes,
  overtimeLimit,
}: {
  rows: AttendanceRecord[];
  scheduledMinutes: number;
  overtimeLimit: number;
}) {
  const people = Array.from(new Set(rows.map((r) => r.owner_name))).filter(Boolean).sort();

  if (people.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-10 w-10" />}
        title="この月の勤怠がありません"
        description="各自が打刻するとここに集計されます"
      />
    );
  }

  return (
    <Card className="mt-4 overflow-hidden">
      <h2 className="flex items-center gap-2.5 p-5 pb-0 font-bold sm:p-6 sm:pb-0">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400">
          <ClipboardList className="h-4 w-4" />
        </span>
        全員の月次
      </h2>
      <div className="scrollbar-thin mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-y border-slate-100 bg-slate-50/70 text-xs font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3 sm:px-6">氏名</th>
              <th className="px-4 py-3 text-right">出勤</th>
              <th className="px-4 py-3 text-right">実働</th>
              <th className="px-4 py-3 text-right">時間外</th>
              <th className="px-4 py-3 text-right">深夜</th>
              <th className="px-4 py-3 text-right">有給</th>
              <th className="px-5 py-3 text-right sm:px-6">要確認</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {people.map((name) => {
              const s = monthlySummary(
                rows.filter((r) => r.owner_name === name),
                scheduledMinutes
              );
              const over = s.overtimeMinutes > overtimeLimit;
              return (
                <tr
                  key={name}
                  className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                >
                  <td className="px-5 py-3 font-semibold whitespace-nowrap sm:px-6">{name}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{s.workedDays}日</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatMinutes(s.workedMinutes)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={cn(over && "font-bold text-rose-600 dark:text-rose-400")}>
                      {formatMinutes(s.overtimeMinutes)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-500 dark:text-slate-400">
                    {formatMinutes(s.lateNightMinutes)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{s.paidLeaveDays}日</td>
                  <td className="px-5 py-3 text-right sm:px-6">
                    <span className="flex flex-wrap justify-end gap-1.5">
                      {over && (
                        <Badge className="bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                          <TriangleAlert className="mr-1 h-3 w-3" />
                          時間外超過
                        </Badge>
                      )}
                      {s.missingDays > 0 && (
                        <Badge className="bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                          打刻漏れ {s.missingDays}日
                        </Badge>
                      )}
                      {!over && s.missingDays === 0 && (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
