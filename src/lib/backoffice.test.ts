// 勤怠・経費・人事評価のユニットテスト
//   npm test

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  daysInMonth,
  formatMinutes,
  lateNightMinutes,
  longDays,
  monthlySummary,
  overtimeMinutes,
  parseTime,
  workedMinutes,
  type AttendanceLike,
} from "./attendance.ts";
import {
  canTransition,
  isEditableByOwner,
  needsCounterparty,
  nextStatuses,
  summarize,
  validateForSubmit,
} from "./expenses.ts";
import {
  blankItems,
  filledCount,
  gapItems,
  readItems,
  scoreBand,
  totalScore,
  type EvaluationItem,
} from "./evaluation.ts";

const SCHEDULED = 480; // 8時間

function day(over: Partial<AttendanceLike> = {}): AttendanceLike {
  return {
    work_date: "2026-09-01",
    kind: "office",
    start_at: "09:00",
    end_at: "18:00",
    break_minutes: 60,
    ...over,
  };
}

// ---------- 勤怠 ----------

test("実働は退勤−出勤−休憩", () => {
  assert.equal(workedMinutes(day()), 480);
  assert.equal(workedMinutes(day({ end_at: "20:30" })), 630);
  assert.equal(workedMinutes(day({ break_minutes: 0 })), 540);
});

test("日をまたいだ勤務も実働として数える", () => {
  assert.equal(workedMinutes(day({ start_at: "21:00", end_at: "02:00" })), 240);
});

test("有給・欠勤・休日は実働0", () => {
  for (const kind of ["paid_leave", "absence", "holiday"]) {
    assert.equal(workedMinutes(day({ kind })), 0, kind);
  }
});

test("打刻が欠けている日は実働0（推測で埋めない）", () => {
  assert.equal(workedMinutes(day({ end_at: "" })), 0);
  assert.equal(workedMinutes(day({ start_at: "" })), 0);
  assert.equal(workedMinutes(day({ start_at: "9時" })), 0);
});

test("残業は所定労働時間を超えた分だけ", () => {
  assert.equal(overtimeMinutes(day(), SCHEDULED), 0);
  assert.equal(overtimeMinutes(day({ end_at: "21:00" }), SCHEDULED), 180);
  // 早退しても残業はマイナスにしない
  assert.equal(overtimeMinutes(day({ end_at: "15:00" }), SCHEDULED), 0);
});

test("深夜(22:00〜翌5:00)にかかった分を別に出す", () => {
  assert.equal(lateNightMinutes(day()), 0);
  assert.equal(lateNightMinutes(day({ end_at: "23:30" })), 90);
  // 早朝出勤も深夜帯
  assert.equal(lateNightMinutes(day({ start_at: "04:00", end_at: "13:00" })), 60);
  // 日跨ぎ: 21:00〜02:00 なら 22:00〜02:00 の4時間
  assert.equal(lateNightMinutes(day({ start_at: "21:00", end_at: "02:00" })), 240);
});

test("月次集計は区分ごとに数える", () => {
  const rows = [
    day({ work_date: "2026-09-01" }),
    day({ work_date: "2026-09-02", end_at: "21:00" }),
    day({ work_date: "2026-09-03", kind: "paid_leave" }),
    day({ work_date: "2026-09-04", kind: "absence" }),
    day({ work_date: "2026-09-05", kind: "holiday" }),
    day({ work_date: "2026-09-07", end_at: "" }), // 打刻漏れ
  ];
  const s = monthlySummary(rows, SCHEDULED);
  assert.equal(s.workedDays, 2);
  assert.equal(s.workedMinutes, 480 + 660);
  assert.equal(s.overtimeMinutes, 180);
  assert.equal(s.paidLeaveDays, 1);
  assert.equal(s.absenceDays, 1);
  assert.equal(s.missingDays, 1);
});

test("残業が閾値を超えた日を拾える", () => {
  const rows = [day({ end_at: "19:00" }), day({ work_date: "2026-09-02", end_at: "22:00" })];
  assert.deepEqual(
    longDays(rows, SCHEDULED, 180).map((r) => r.work_date),
    ["2026-09-02"]
  );
});

test("月の日数を正しく出す（うるう年を含む）", () => {
  assert.equal(daysInMonth("2026-09").length, 30);
  assert.equal(daysInMonth("2026-02").length, 28);
  assert.equal(daysInMonth("2028-02").length, 29);
  assert.deepEqual(daysInMonth("こわれた"), []);
});

test("時刻と時間の表示", () => {
  assert.equal(parseTime("09:30"), 570);
  assert.equal(parseTime("9:5"), null);
  assert.equal(formatMinutes(0), "0h");
  assert.equal(formatMinutes(45), "45m"); // 1時間未満は「0h45m」にしない
  assert.equal(formatMinutes(480), "8h");
  assert.equal(formatMinutes(545), "9h05m");
});

// ---------- 経費 ----------

test("申請者は提出まで、承認・支払は承認者だけ", () => {
  assert.equal(canTransition("draft", "submitted", "owner"), true);
  assert.equal(canTransition("submitted", "approved", "owner"), false);
  assert.equal(canTransition("submitted", "approved", "approver"), true);
  assert.equal(canTransition("approved", "paid", "approver"), true);
  assert.equal(canTransition("approved", "paid", "owner"), false);
});

test("支払済みからは動かせない", () => {
  assert.deepEqual(nextStatuses("paid", "approver"), []);
  assert.equal(canTransition("paid", "draft", "approver"), false);
});

test("差し戻しは申請者が直して出し直せる", () => {
  assert.equal(isEditableByOwner("rejected"), true);
  assert.equal(isEditableByOwner("submitted"), false);
  assert.deepEqual(nextStatuses("rejected", "owner"), ["submitted"]);
});

test("接待交際費・会議費は相手先が要る", () => {
  assert.equal(needsCounterparty("entertainment"), true);
  assert.equal(needsCounterparty("meeting"), true);
  assert.equal(needsCounterparty("transport"), false);
});

test("提出前のチェックで足りない項目を挙げる", () => {
  const errors = validateForSubmit({
    spent_on: "",
    amount: 0,
    purpose: "",
    category: "entertainment",
    counterparty: "",
    receipt_file: "",
  });
  assert.equal(errors.length, 5);

  assert.deepEqual(
    validateForSubmit({
      spent_on: "2026-09-01",
      amount: 3200,
      purpose: "支店訪問の交通費",
      category: "transport",
      counterparty: "",
      receipt_file: "attachments/r1.pdf",
    }),
    []
  );
});

test("集計は下書き・差し戻しを金額に入れない", () => {
  const rows = [
    { spent_on: "2026-09-01", category: "transport", amount: 1000, status: "submitted", owner_name: "田中" },
    { spent_on: "2026-09-02", category: "transport", amount: 2000, status: "approved", owner_name: "田中" },
    { spent_on: "2026-09-03", category: "entertainment", amount: 8000, status: "paid", owner_name: "伊藤" },
    { spent_on: "2026-09-04", category: "supplies", amount: 500, status: "draft", owner_name: "田中" },
    { spent_on: "2026-09-05", category: "supplies", amount: 700, status: "rejected", owner_name: "伊藤" },
  ];
  const t = summarize(rows);
  assert.equal(t.pendingCount, 1);
  assert.equal(t.pendingAmount, 1000);
  assert.equal(t.payableAmount, 2000);
  assert.equal(t.paidAmount, 8000);
  assert.deepEqual(
    t.byCategory.map((c) => [c.label, c.amount]),
    [
      ["接待交際費", 8000],
      ["旅費交通費", 3000],
    ]
  );
  assert.deepEqual(
    t.byOwner.map((o) => [o.name, o.amount]),
    [
      ["伊藤", 8000],
      ["田中", 3000],
    ]
  );
});

// ---------- 人事評価 ----------

function scored(scores: Partial<Record<string, [number | null, number | null]>>): EvaluationItem[] {
  return blankItems().map((item) => {
    const pair = scores[item.key];
    return pair
      ? { ...item, self_score: pair[0], reviewer_score: pair[1] }
      : item;
  });
}

test("既定の評価項目は重み合計100", () => {
  assert.equal(
    blankItems().reduce((sum, i) => sum + i.weight, 0),
    100
  );
});

test("全項目が満点なら100点", () => {
  const items = blankItems().map((i) => ({ ...i, reviewer_score: 5 }));
  assert.equal(totalScore(items, "reviewer"), 100);
});

test("全項目が最低点なら20点（5段階の1は0点ではない）", () => {
  const items = blankItems().map((i) => ({ ...i, reviewer_score: 1 }));
  assert.equal(totalScore(items, "reviewer"), 20);
});

test("未入力の項目は重みごと除外する（入れ忘れで点が下がらない）", () => {
  // 成果(40%)だけ満点、他は未入力 → 100点
  assert.equal(totalScore(scored({ result: [null, 5] }), "reviewer"), 100);
});

test("重みの大きい項目ほど総合点に効く", () => {
  const heavy = totalScore(scored({ result: [null, 5], compliance: [null, 1] }), "reviewer");
  const light = totalScore(scored({ result: [null, 1], compliance: [null, 5] }), "reviewer");
  assert.ok(heavy > light, `${heavy} > ${light}`);
});

test("本人と評価者の点は別に集計する", () => {
  const items = scored({ result: [5, 3] });
  assert.equal(totalScore(items, "self"), 100);
  assert.equal(totalScore(items, "reviewer"), 60);
  assert.equal(filledCount(items, "self"), 1);
});

test("開きの大きい項目を面談の論点として拾う", () => {
  const items = scored({ result: [5, 3], team: [3, 3] });
  assert.deepEqual(
    gapItems(items).map((i) => i.key),
    ["result"]
  );
});

test("総合点の帯", () => {
  assert.equal(scoreBand(100).label, "S");
  assert.equal(scoreBand(90).label, "S");
  assert.equal(scoreBand(80).label, "A");
  assert.equal(scoreBand(60).label, "B");
  assert.equal(scoreBand(50).label, "C");
  assert.equal(scoreBand(0).label, "D");
});

test("壊れた jsonb からは項目を読まない", () => {
  assert.deepEqual(readItems(null), []);
  assert.deepEqual(readItems({ key: "result" }), []);
  assert.deepEqual(readItems([{ label: "キーがない" }]), []);
  assert.equal(readItems(blankItems()).length, 5);
});
