// アポイントの「これから」「要フォロー」の判定のユニットテスト
//   npm test

import { test } from "node:test";
import assert from "node:assert/strict";

import { isOpenAppointment, isUpcoming, needsFollowUp } from "./appointments.ts";
import type { Appointment } from "./types.ts";

const TODAY = "2026-09-16";

function appointment(over: Partial<Appointment> = {}): Appointment {
  return {
    id: "ap-1",
    bank_id: "bank-1",
    branch_id: "branch-1",
    assigned_to: null,
    assigned_name: "担当",
    organization_id: null,
    received_at: "2026-09-10",
    scheduled_at: `${TODAY}T10:00:00.000Z`,
    company_name: "テスト株式会社",
    industry: "",
    revenue_scale: "",
    contact_role: "",
    source_note: "",
    status: "scheduled",
    deal_id: null,
    event_id: null,
    business_unit_id: null,
    updated_at: "",
    created_at: "",
    ...over,
  } as Appointment;
}

test("案件化していない予定のアポは「これから」に出る", () => {
  assert.equal(isUpcoming(appointment(), TODAY), true);
});

test("案件化したアポは「これから」から外れる", () => {
  assert.equal(isUpcoming(appointment({ deal_id: "deal-1" }), TODAY), false);
});

test("案件化したアポは「要フォロー」からも外れる", () => {
  // 商談日から5日経過（しきい値3日）→ 本来なら要フォロー
  const old = appointment({ scheduled_at: "2026-09-11T10:00:00.000Z" });
  assert.equal(needsFollowUp(old, TODAY, 3), true);
  assert.equal(needsFollowUp({ ...old, deal_id: "deal-1" }, TODAY, 3), false);
});

test("予定以外のステータスは、どちらのタブにも出ない", () => {
  for (const status of ["won", "lost", "cancelled", "done"]) {
    const a = appointment({ status } as Partial<Appointment>);
    assert.equal(isUpcoming(a, TODAY), false, `${status} が「これから」に残っている`);
    assert.equal(needsFollowUp(a, TODAY, 0), false, `${status} が「要フォロー」に残っている`);
  }
});

test("日程未定のアポは、どちらのタブにも出ない", () => {
  const a = appointment({ scheduled_at: "" });
  assert.equal(isUpcoming(a, TODAY), false);
  assert.equal(needsFollowUp(a, TODAY, 0), false);
});

test("isOpenAppointment: 予定かつ未案件化のときだけ true", () => {
  assert.equal(isOpenAppointment(appointment()), true);
  assert.equal(isOpenAppointment(appointment({ deal_id: "deal-1" })), false);
  assert.equal(isOpenAppointment(appointment({ status: "won" } as Partial<Appointment>)), false);
});
