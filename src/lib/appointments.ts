// =============================================================
// アポイントの状態判定（UI非依存の純粋ロジック）
//
// 「これから」「要フォロー」のタブと件数、一覧のバッジは、すべてここを見る。
// 画面ごとに条件を書くと、タブの件数と中身がずれる。
//
// 【ランタイム依存なし】node の型ストリップでテストできるよう、
// 値の import は同ディレクトリの branch-metrics.ts のみに限定している。
// =============================================================

import { daysBetween, toDateOnly } from "./branch-metrics.ts";
import type { Appointment } from "./types";

/**
 * まだアポイントの画面で手を動かす必要があるか。
 *
 * 案件化したものは案件管理に引き継がれているので、ここでは「済み」として扱う。
 * これを見ないと、案件化しても「これから」「要フォロー」に残り続ける。
 * （「すべて」タブには案件化済みのバッジ付きで出るので、見えなくなるわけではない）
 */
export function isOpenAppointment(a: Appointment): boolean {
  return a.status === "scheduled" && !a.deal_id;
}

/**
 * 商談予定日から followUpDays 日経っても「予定」のままのアポ。
 * 結果入力の抜けを拾うためのリマインド（§5-2）。
 */
export function needsFollowUp(a: Appointment, today: string, followUpDays: number): boolean {
  if (!isOpenAppointment(a)) return false;
  const scheduled = toDateOnly(a.scheduled_at);
  if (!scheduled) return false;
  const elapsed = daysBetween(scheduled, today);
  return elapsed !== null && elapsed >= followUpDays;
}

/** 商談予定が今日以降か（これからの商談） */
export function isUpcoming(a: Appointment, today: string): boolean {
  if (!isOpenAppointment(a)) return false;
  const scheduled = toDateOnly(a.scheduled_at);
  return scheduled !== "" && scheduled >= today;
}
