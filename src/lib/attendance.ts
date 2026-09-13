// =============================================================
// 勤怠 — 実働時間・残業・月次集計
//
// 金額には触れない。給与計算（社会保険料・源泉徴収）はこの段階では作らず、
// その計算に必要な「実績値」までをここで確定させる。
// 雇用形態の内訳と人数が決まった時点で、この出力を入力にして組む。
//
// 所定労働時間のような「先方が決める値」は設定（app_settings）に置き、
// この関数群は引数で受け取る（既定値はここに書かない）。
// =============================================================

/** 勤務区分 */
export const ATTENDANCE_KINDS = {
  office: { label: "出社", color: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300", works: true },
  remote: { label: "在宅", color: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300", works: true },
  field: { label: "直行直帰", color: "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300", works: true },
  paid_leave: { label: "有給", color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", works: false },
  absence: { label: "欠勤", color: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300", works: false },
  holiday: { label: "休日", color: "bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-400", works: false },
} as const;

export type AttendanceKind = keyof typeof ATTENDANCE_KINDS;

export const ATTENDANCE_KIND_KEYS = Object.keys(ATTENDANCE_KINDS) as AttendanceKind[];

export function kindMeta(kind: string): (typeof ATTENDANCE_KINDS)[AttendanceKind] {
  return ATTENDANCE_KINDS[kind as AttendanceKind] ?? ATTENDANCE_KINDS.office;
}

/** 出勤としてカウントする区分か */
export function isWorkingKind(kind: string): boolean {
  return kindMeta(kind).works;
}

/** 集計に必要な最小限の形（DBの行でもフォームの下書きでも渡せる） */
export interface AttendanceLike {
  work_date: string;
  kind: string;
  start_at: string;
  end_at: string;
  break_minutes: number;
}

/** "HH:MM" を 0時からの分に。読めない場合は null */
export function parseTime(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 47 || min > 59) return null; // 翌日跨ぎは 24:00〜47:59 で表す
  return h * 60 + min;
}

/** 分を "8h30m" 形式に（1時間未満は "45m"、ちょうどなら "8h"） */
export function formatMinutes(total: number): string {
  if (total <= 0) return "0h";
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}m`;
}

/**
 * 実働時間（分）。
 * 退勤が出勤より前の場合は日をまたいだ勤務とみなして24時間足す。
 */
export function workedMinutes(row: AttendanceLike): number {
  if (!isWorkingKind(row.kind)) return 0;
  const start = parseTime(row.start_at);
  const end = parseTime(row.end_at);
  if (start === null || end === null) return 0;
  const span = end >= start ? end - start : end + 24 * 60 - start;
  return Math.max(0, span - Math.max(0, row.break_minutes));
}

/** 所定労働時間を超えた分（＝時間外）。scheduledMinutes は設定から渡す */
export function overtimeMinutes(row: AttendanceLike, scheduledMinutes: number): number {
  return Math.max(0, workedMinutes(row) - scheduledMinutes);
}

/**
 * 深夜（22:00〜翌5:00）にかかった分。割増の対象になるため実働とは別に出す。
 * 金額はここでは計算しない（料率は雇用形態が決まってから）。
 */
export function lateNightMinutes(row: AttendanceLike): number {
  if (!isWorkingKind(row.kind)) return 0;
  const start = parseTime(row.start_at);
  const end = parseTime(row.end_at);
  if (start === null || end === null) return 0;
  const finish = end >= start ? end : end + 24 * 60;

  // 22:00〜29:00（＝翌5:00）の帯と、前日から続く 0:00〜5:00 の帯
  const overlap = (from: number, to: number) =>
    Math.max(0, Math.min(finish, to) - Math.max(start, from));
  return overlap(22 * 60, 29 * 60) + overlap(0, 5 * 60);
}

export interface MonthlySummary {
  /** 出勤した日数（有給・欠勤・休日を除く） */
  workedDays: number;
  workedMinutes: number;
  overtimeMinutes: number;
  lateNightMinutes: number;
  paidLeaveDays: number;
  absenceDays: number;
  /** 出勤日のうち、打刻が欠けている日 */
  missingDays: number;
}

/** 1人分の月次集計。rows はその月の行だけを渡す */
export function monthlySummary(
  rows: AttendanceLike[],
  scheduledMinutes: number
): MonthlySummary {
  const summary: MonthlySummary = {
    workedDays: 0,
    workedMinutes: 0,
    overtimeMinutes: 0,
    lateNightMinutes: 0,
    paidLeaveDays: 0,
    absenceDays: 0,
    missingDays: 0,
  };

  for (const row of rows) {
    if (row.kind === "paid_leave") {
      summary.paidLeaveDays += 1;
      continue;
    }
    if (row.kind === "absence") {
      summary.absenceDays += 1;
      continue;
    }
    if (!isWorkingKind(row.kind)) continue;

    const worked = workedMinutes(row);
    if (worked === 0) {
      // 出勤区分なのに時刻が入っていない＝打刻漏れ。日数には数えない
      summary.missingDays += 1;
      continue;
    }
    summary.workedDays += 1;
    summary.workedMinutes += worked;
    summary.overtimeMinutes += overtimeMinutes(row, scheduledMinutes);
    summary.lateNightMinutes += lateNightMinutes(row);
  }
  return summary;
}

/** YYYY-MM の日付一覧（カレンダー表示用） */
export function daysInMonth(month: string): string[] {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return [];
  const year = Number(m[1]);
  const mon = Number(m[2]);
  const last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return Array.from(
    { length: last },
    (_, i) => `${m[1]}-${m[2]}-${String(i + 1).padStart(2, "0")}`
  );
}

/** 月内で残業が突出している日（36協定の目安を超えた日を拾う） */
export function longDays(
  rows: AttendanceLike[],
  scheduledMinutes: number,
  thresholdMinutes: number
): AttendanceLike[] {
  return rows.filter((r) => overtimeMinutes(r, scheduledMinutes) >= thresholdMinutes);
}
