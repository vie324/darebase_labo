// スケジュールからの案件登録のユニットテスト
//   npm test

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  defaultExpectedClose,
  guessCompany,
  linkedDealIdOf,
  openDealsOfCompany,
  scheduleDealName,
  sourceAppointmentOf,
} from "./schedule-deal.ts";
import type { Appointment } from "./types.ts";

function appointment(over: Partial<Appointment> & { id: string }): Appointment {
  return {
    bank_id: "bank-1",
    branch_id: "br-1",
    assigned_to: null,
    assigned_name: "",
    organization_id: null,
    received_at: "2026-09-01",
    scheduled_at: "",
    company_name: "株式会社サンプル",
    industry: "",
    revenue_scale: "",
    contact_role: "",
    source_note: "",
    status: "scheduled",
    deal_id: null,
    event_id: null,
    business_unit_id: null,
    updated_at: "2026-09-01T00:00:00Z",
    created_at: "2026-09-01T00:00:00Z",
    ...over,
  };
}

// ---------- 会社名の推定 ----------

test("予定のタイトルから会社名を推定する", () => {
  assert.equal(guessCompany("株式会社ミライテック 訪問商談"), "株式会社ミライテック");
  assert.equal(guessCompany("ミライテック様 訪問"), "ミライテック");
  assert.equal(guessCompany("株式会社ABC商談"), "株式会社ABC");
  assert.equal(guessCompany("株式会社X　初回訪問 資料持参"), "株式会社X");
  assert.equal(guessCompany("【商談】ミライテック様"), "ミライテック");
  assert.equal(guessCompany("[訪問] 株式会社ハルカ製作所"), "株式会社ハルカ製作所");
});

test("キーワードを含む会社名は削らない", () => {
  assert.equal(guessCompany("株式会社アポロ 訪問"), "株式会社アポロ");
  assert.equal(guessCompany("デモ工業株式会社 商談"), "デモ工業株式会社");
});

test("推定できないときは先頭の語、会社名が無ければ空欄", () => {
  assert.equal(guessCompany("グローバル商事 見積提出期限"), "グローバル商事");
  assert.equal(guessCompany("訪問商談"), "");
  assert.equal(guessCompany("  "), "");
});

// ---------- 初期値 ----------

test("完了予定日は予定の日付の30日後（ローカル日付）", () => {
  const start = new Date(2026, 8, 29, 12, 0).toISOString(); // 2026-09-29 正午（ローカル）
  assert.equal(defaultExpectedClose(start), "2026-10-29");
  assert.equal(defaultExpectedClose(start, 7), "2026-10-06");
});

test("日付が読めないときも完了予定日は空にしない", () => {
  assert.match(defaultExpectedClose("not-a-date"), /^\d{4}-\d{2}-\d{2}$/);
});

test("案件名を空欄にしたときは「会社名 商材」にする", () => {
  assert.equal(scheduleDealName(" 株式会社X ", ["DDS", "AI"]), "株式会社X DDS・AI");
  assert.equal(scheduleDealName("株式会社X", []), "株式会社X");
});

// ---------- 予定と案件・アポの紐づけ ----------

test("予定に直接付いた案件を優先する", () => {
  const appts = [appointment({ id: "ap-1", event_id: "ev-1", deal_id: "deal-from-appt" })];
  assert.equal(linkedDealIdOf({ id: "ev-1", deal_id: "deal-direct" }, appts), "deal-direct");
});

test("アポから来た予定は、アポが案件化済みならその案件に紐づいているとみなす", () => {
  const appts = [appointment({ id: "ap-1", event_id: "ev-1", deal_id: "deal-1" })];
  assert.equal(linkedDealIdOf({ id: "ev-1", deal_id: null }, appts), "deal-1");
  assert.equal(linkedDealIdOf({ id: "ev-1" }, appts), "deal-1");
});

test("案件化していないアポの予定・アポと無関係の予定は未紐づけ", () => {
  const appts = [appointment({ id: "ap-1", event_id: "ev-1" })];
  assert.equal(linkedDealIdOf({ id: "ev-1", deal_id: null }, appts), null);
  assert.equal(linkedDealIdOf({ id: "ev-2", deal_id: null }, appts), null);
  assert.equal(sourceAppointmentOf({ id: "ev-1" }, appts)?.id, "ap-1");
  assert.equal(sourceAppointmentOf({ id: "ev-2" }, appts), null);
});

// ---------- 二重登録の注意 ----------

test("同じ会社の進行中の案件だけを拾う（空白の違いは無視）", () => {
  const isOpen = (stage: string) => !["won", "lost", "partnership"].includes(stage);
  const deals = [
    { id: "d-1", company: "株式会社 X", stage: "follow_up" },
    { id: "d-2", company: "株式会社X", stage: "won" },
    { id: "d-3", company: "株式会社Y", stage: "appointment" },
  ];
  assert.deepEqual(
    openDealsOfCompany(deals, "株式会社X", isOpen).map((d) => d.id),
    ["d-1"]
  );
  assert.deepEqual(openDealsOfCompany(deals, " ", isOpen), []);
});
