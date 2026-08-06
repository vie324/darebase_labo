// アポイントモジュール内で共有するヘルパー・型

import { daysBetween, toDateOnly } from "@/lib/branch-metrics";
import type { Appointment, ContactRole } from "@/lib/types";
import { todayStr } from "@/lib/utils";

export interface AppointmentFormValues {
  bank_id: string;
  branch_id: string;
  assigned_to: string;
  received_at: string; // YYYY-MM-DD
  /** datetime-local の値（"YYYY-MM-DDTHH:mm"）。"" = 日程未定 */
  scheduled_local: string;
  company_name: string;
  industry: string;
  revenue_scale: string;
  contact_role: ContactRole | "";
  source_note: string;
}

export function emptyAppointmentForm(assignedTo: string): AppointmentFormValues {
  return {
    bank_id: "",
    branch_id: "",
    assigned_to: assignedTo,
    received_at: todayStr(),
    scheduled_local: "",
    company_name: "",
    industry: "",
    revenue_scale: "",
    contact_role: "",
    source_note: "",
  };
}

export function toAppointmentForm(a: Appointment): AppointmentFormValues {
  return {
    bank_id: a.bank_id ?? "",
    branch_id: a.branch_id ?? "",
    assigned_to: a.assigned_to ?? "",
    received_at: a.received_at,
    scheduled_local: isoToLocalInput(a.scheduled_at),
    company_name: a.company_name,
    industry: a.industry,
    revenue_scale: a.revenue_scale,
    contact_role: a.contact_role,
    source_note: a.source_note,
  };
}

// ---------- datetime-local ⇔ ISO ----------

/** ISO文字列 → datetime-local の値（ローカル時刻）。空なら "" */
export function isoToLocalInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local の値 → ISO文字列。空なら "" */
export function localInputToIso(local: string): string {
  if (!local) return "";
  const d = new Date(local);
  if (isNaN(d.getTime())) return "";
  return d.toISOString();
}

/** 商談予定の終了時刻（既定60分） */
export function addMinutesIso(iso: string, minutes: number): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return new Date(d.getTime() + minutes * 60_000).toISOString();
}

// ---------- フォローアップ判定 ----------

/**
 * 商談予定日から followUpDays 日経っても「予定」のままのアポ。
 * 結果入力の抜けを拾うためのリマインド（§5-2）。
 */
export function needsFollowUp(a: Appointment, today: string, followUpDays: number): boolean {
  if (a.status !== "scheduled") return false;
  const scheduled = toDateOnly(a.scheduled_at);
  if (!scheduled) return false;
  const elapsed = daysBetween(scheduled, today);
  return elapsed !== null && elapsed >= followUpDays;
}

/** 商談予定が今日以降か（これからの商談） */
export function isUpcoming(a: Appointment, today: string): boolean {
  if (a.status !== "scheduled") return false;
  const scheduled = toDateOnly(a.scheduled_at);
  return scheduled !== "" && scheduled >= today;
}
