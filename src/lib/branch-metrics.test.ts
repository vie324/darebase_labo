// 支店稼働集計のユニットテスト（node --test / 型ストリップで実行）
//   npm test

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  addMonths,
  buildBranchStats,
  buildHeatmap,
  daysBetween,
  dormancyLevel,
  monthlyAppointmentCounts,
  recentMonths,
  resolveLastContact,
  rollupByBank,
  rollupByOwner,
  summarizeBranches,
  toDateOnly,
  toMonth,
  type BranchActivityThresholds,
} from "./branch-metrics.ts";
import type { Appointment, Branch, BranchActivity, BranchStatus } from "./types.ts";

const TODAY = "2026-08-06";

const T: BranchActivityThresholds = {
  activeWindowDays: 90,
  dormantWarnDays: 30,
  dormantAlertDays: 60,
  dormantCriticalDays: 90,
  recentMonths: 3,
};

// ---------- テスト用ファクトリ ----------

function branch(over: Partial<Branch> & { id: string }): Branch {
  return {
    id: over.id,
    bank_id: "bank-1",
    name: "支店",
    code: "",
    address: "",
    prefecture: "",
    assigned_to: null,
    assigned_name: "",
    assigned_org_id: null,
    status: "active" as BranchStatus,
    last_contact_at: "",
    note: "",
    business_unit_id: null,
    updated_at: "",
    created_at: "",
    ...over,
  };
}

function appointment(over: Partial<Appointment> & { id: string }): Appointment {
  return {
    id: over.id,
    bank_id: "bank-1",
    branch_id: "br-1",
    assigned_to: null,
    assigned_name: "",
    organization_id: null,
    received_at: TODAY,
    scheduled_at: "",
    company_name: "",
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
  };
}

function activity(over: Partial<BranchActivity> & { id: string }): BranchActivity {
  return {
    id: over.id,
    branch_id: "br-1",
    bank_id: "bank-1",
    user_id: null,
    user_name: "",
    type: "visit",
    occurred_at: TODAY,
    memo: "",
    business_unit_id: null,
    created_at: "",
    ...over,
  };
}

// =============================================================
// 日付ユーティリティ
// =============================================================

test("toDateOnly はISO日時から日付部分だけを取り出す", () => {
  assert.equal(toDateOnly("2026-08-06T23:30:00.000Z"), "2026-08-06");
  assert.equal(toDateOnly("2026-08-06"), "2026-08-06");
  assert.equal(toDateOnly(""), "");
  assert.equal(toDateOnly("不正な値"), "");
});

test("daysBetween は月またぎ・年またぎでも正しい日数を返す", () => {
  assert.equal(daysBetween("2026-08-01", "2026-08-06"), 5);
  assert.equal(daysBetween("2026-07-31", "2026-08-01"), 1);
  assert.equal(daysBetween("2025-12-31", "2026-01-01"), 1);
  // うるう年（2028-02-29）をまたぐ
  assert.equal(daysBetween("2028-02-28", "2028-03-01"), 2);
  // 未来日は負の値
  assert.equal(daysBetween("2026-08-10", "2026-08-06"), -4);
  assert.equal(daysBetween("", "2026-08-06"), null);
});

test("daysBetween は夏時間の切り替わり（3月/11月）でもずれない", () => {
  // ローカルタイムで計算するとDSTのある地域で1日ずれることがある区間
  assert.equal(daysBetween("2026-03-07", "2026-03-09"), 2);
  assert.equal(daysBetween("2026-10-31", "2026-11-02"), 2);
});

test("addMonths は年をまたいで正しく戻る/進む", () => {
  assert.equal(addMonths("2026-08", -1), "2026-07");
  assert.equal(addMonths("2026-01", -1), "2025-12");
  assert.equal(addMonths("2026-01", -13), "2024-12");
  assert.equal(addMonths("2026-12", 1), "2027-01");
});

test("recentMonths は古い順に指定件数を返す", () => {
  assert.deepEqual(recentMonths("2026-01-15", 3), ["2025-11", "2025-12", "2026-01"]);
  assert.equal(recentMonths("2026-08-06", 12).length, 12);
});

// =============================================================
// 最終接点日
// =============================================================

test("resolveLastContact はマスタ・アポ・活動ログの最大値を返す", () => {
  const b = branch({ id: "br-1", last_contact_at: "2026-05-01" });
  const appts = [appointment({ id: "a1", branch_id: "br-1", received_at: "2026-06-10" })];
  const acts = [activity({ id: "ac1", branch_id: "br-1", occurred_at: "2026-07-20" })];
  assert.equal(resolveLastContact(b, appts, acts, TODAY), "2026-07-20");
});

test("resolveLastContact は他支店のデータを混ぜない", () => {
  const b = branch({ id: "br-1" });
  const appts = [appointment({ id: "a1", branch_id: "br-2", received_at: "2026-08-01" })];
  assert.equal(resolveLastContact(b, appts, [], TODAY), "");
});

test("resolveLastContact は未来日を接点として扱わない（誤入力対策）", () => {
  const b = branch({ id: "br-1", last_contact_at: "2026-06-01" });
  const appts = [appointment({ id: "a1", received_at: "2027-01-01" })];
  assert.equal(resolveLastContact(b, appts, [], TODAY), "2026-06-01");
});

test("resolveLastContact はキャンセルされたアポも接点として数える", () => {
  const b = branch({ id: "br-1" });
  const appts = [
    appointment({ id: "a1", received_at: "2026-08-01", status: "cancelled" }),
  ];
  assert.equal(resolveLastContact(b, appts, [], TODAY), "2026-08-01");
});

// =============================================================
// 休眠判定
// =============================================================

test("dormancyLevel は閾値の境界で切り替わる", () => {
  assert.equal(dormancyLevel(null, T), "never");
  assert.equal(dormancyLevel(0, T), "fresh");
  assert.equal(dormancyLevel(29, T), "fresh");
  assert.equal(dormancyLevel(30, T), "warn"); // 閾値ちょうどは休眠側
  assert.equal(dormancyLevel(59, T), "warn");
  assert.equal(dormancyLevel(60, T), "alert");
  assert.equal(dormancyLevel(89, T), "alert");
  assert.equal(dormancyLevel(90, T), "critical");
  assert.equal(dormancyLevel(400, T), "critical");
});

test("dormancyLevel は設定された閾値に追従する（ハードコードしていない）", () => {
  const loose: BranchActivityThresholds = { ...T, dormantWarnDays: 60, dormantAlertDays: 120, dormantCriticalDays: 180 };
  assert.equal(dormancyLevel(45, loose), "fresh");
  assert.equal(dormancyLevel(130, loose), "alert");
});

// =============================================================
// 支店ごとの指標
// =============================================================

test("buildBranchStats: 稼働判定は activeWindowDays 以内の接点で決まる", () => {
  const branches = [
    branch({ id: "br-1", last_contact_at: "2026-08-01" }), // 5日前 → 稼働
    branch({ id: "br-2", last_contact_at: "2026-01-01" }), // 217日前 → 休眠
    branch({ id: "br-3" }), // 接点なし
  ];
  const stats = buildBranchStats(branches, [], [], TODAY, T);
  assert.equal(stats[0].isActive, true);
  assert.equal(stats[0].daysSinceContact, 5);
  assert.equal(stats[1].isActive, false);
  assert.equal(stats[1].dormancyLevel, "critical");
  assert.equal(stats[2].isActive, false);
  assert.equal(stats[2].daysSinceContact, null);
  assert.equal(stats[2].dormancyLevel, "never");
});

test("buildBranchStats: 境界（ちょうど activeWindowDays 日前）は稼働に含める", () => {
  const stats = buildBranchStats(
    [
      branch({ id: "br-1", last_contact_at: "2026-05-08" }), // 90日前
      branch({ id: "br-2", last_contact_at: "2026-05-07" }), // 91日前
    ],
    [],
    [],
    TODAY,
    T
  );
  assert.equal(stats[0].daysSinceContact, 90);
  assert.equal(stats[0].isActive, true);
  assert.equal(stats[1].daysSinceContact, 91);
  assert.equal(stats[1].isActive, false);
});

test("buildBranchStats: 取引停止(suspended)は母数から外れ、稼働にもならない", () => {
  const stats = buildBranchStats(
    [branch({ id: "br-1", status: "suspended", last_contact_at: TODAY })],
    [],
    [],
    TODAY,
    T
  );
  assert.equal(stats[0].counted, false);
  assert.equal(stats[0].isActive, false);
});

test("buildBranchStats: 直近Nヶ月アポ数は期間外を含めない", () => {
  const appts = [
    appointment({ id: "a1", received_at: "2026-08-02" }), // 当月
    appointment({ id: "a2", received_at: "2026-06-15" }), // 3ヶ月枠の下限
    appointment({ id: "a3", received_at: "2026-05-31" }), // 枠外
    appointment({ id: "a4", received_at: "2026-08-03", status: "cancelled" }), // 除外
  ];
  const stats = buildBranchStats([branch({ id: "br-1" })], appts, [], TODAY, T);
  assert.equal(stats[0].recentAppointments, 2);
  assert.equal(stats[0].totalAppointments, 3); // キャンセルを除く累計
});

test("buildBranchStats: 成約率は結果が出たアポのみを母数にする", () => {
  const appts = [
    appointment({ id: "a1", status: "won" }),
    appointment({ id: "a2", status: "lost" }),
    appointment({ id: "a3", status: "lost" }),
    appointment({ id: "a4", status: "scheduled" }), // 母数に入れない
    appointment({ id: "a5", status: "done" }), // 母数に入れない
  ];
  const stats = buildBranchStats([branch({ id: "br-1" })], appts, [], TODAY, T);
  assert.equal(stats[0].wonCount, 1);
  assert.equal(stats[0].winRate, 33); // 1/3
});

test("buildBranchStats: 結果が出たアポが無ければ成約率は null（0で埋めない）", () => {
  const stats = buildBranchStats(
    [branch({ id: "br-1" })],
    [appointment({ id: "a1", status: "scheduled" })],
    [],
    TODAY,
    T
  );
  assert.equal(stats[0].winRate, null);
});

// =============================================================
// サマリー
// =============================================================

test("summarizeBranches: 稼働率は取引停止を除いた母数で計算する", () => {
  const stats = buildBranchStats(
    [
      branch({ id: "br-1", last_contact_at: "2026-08-01" }),
      branch({ id: "br-2", last_contact_at: "2026-08-01" }),
      branch({ id: "br-3", last_contact_at: "2026-01-01" }),
      branch({ id: "br-4" }),
      branch({ id: "br-5", status: "suspended" }),
    ],
    [],
    [],
    TODAY,
    T
  );
  const s = summarizeBranches(stats);
  assert.equal(s.totalBranches, 4);
  assert.equal(s.activeBranches, 2);
  assert.equal(s.dormantBranches, 2);
  assert.equal(s.neverContacted, 1);
  assert.equal(s.suspendedBranches, 1);
  assert.equal(s.activeRate, 50);
});

test("summarizeBranches: 支店ゼロなら稼働率は null（NaN や 0 にしない）", () => {
  const s = summarizeBranches([]);
  assert.equal(s.totalBranches, 0);
  assert.equal(s.activeRate, null);
});

test("monthlyAppointmentCounts: 対象月のアポ数と成約数（キャンセル除外）", () => {
  const appts = [
    appointment({ id: "a1", received_at: "2026-08-01", status: "won" }),
    appointment({ id: "a2", received_at: "2026-08-20", status: "scheduled" }),
    appointment({ id: "a3", received_at: "2026-08-21", status: "cancelled" }),
    appointment({ id: "a4", received_at: "2026-07-31", status: "won" }),
  ];
  const r = monthlyAppointmentCounts(appts, "2026-08");
  assert.equal(r.appointments, 2);
  assert.equal(r.won, 1);
});

// =============================================================
// ロールアップ
// =============================================================

test("rollupByBank: 稼働率の低い銀行が先頭に来る", () => {
  const branches = [
    // A銀行: 2支店中2稼働 = 100%
    branch({ id: "b1", bank_id: "bank-a", last_contact_at: "2026-08-01" }),
    branch({ id: "b2", bank_id: "bank-a", last_contact_at: "2026-08-01" }),
    // B銀行: 4支店中1稼働 = 25%
    branch({ id: "b3", bank_id: "bank-b", last_contact_at: "2026-08-01" }),
    branch({ id: "b4", bank_id: "bank-b" }),
    branch({ id: "b5", bank_id: "bank-b" }),
    branch({ id: "b6", bank_id: "bank-b" }),
  ];
  const names: Record<string, string> = { "bank-a": "A銀行", "bank-b": "B銀行" };
  const rows = rollupByBank(buildBranchStats(branches, [], [], TODAY, T), (id) => names[id] ?? "");
  assert.equal(rows[0].label, "B銀行");
  assert.equal(rows[0].activeRate, 25);
  assert.equal(rows[0].neverContacted, 3);
  assert.equal(rows[1].label, "A銀行");
  assert.equal(rows[1].activeRate, 100);
});

test("rollupByOwner: 担当者別カバレッジと平均経過日数（未割当も1行にまとめる）", () => {
  const branches = [
    branch({ id: "b1", assigned_to: "u1", assigned_name: "田中", last_contact_at: "2026-08-01" }), // 5日
    branch({ id: "b2", assigned_to: "u1", assigned_name: "田中", last_contact_at: "2026-07-27" }), // 10日
    branch({ id: "b3", assigned_to: "u1", assigned_name: "田中" }), // 接点なし
    branch({ id: "b4" }), // 未割当
  ];
  const rows = rollupByOwner(buildBranchStats(branches, [], [], TODAY, T));
  const tanaka = rows.find((r) => r.label === "田中");
  assert.ok(tanaka);
  assert.equal(tanaka.total, 3);
  assert.equal(tanaka.active, 2);
  assert.equal(tanaka.activeRate, 67);
  // 平均は「接点がある支店」だけで計算する（接点なしを0日として薄めない）
  assert.equal(tanaka.avgDaysSinceContact, 8);
  assert.equal(tanaka.neverContacted, 1);

  const none = rows.find((r) => r.label === "未割当");
  assert.ok(none);
  assert.equal(none.total, 1);
  assert.equal(none.avgDaysSinceContact, null);
});

test("rollupByOwner: 取引停止の支店は担当者のカバレッジに含めない", () => {
  const rows = rollupByOwner(
    buildBranchStats(
      [
        branch({ id: "b1", assigned_to: "u1", assigned_name: "田中", last_contact_at: TODAY }),
        branch({ id: "b2", assigned_to: "u1", assigned_name: "田中", status: "suspended" }),
      ],
      [],
      [],
      TODAY,
      T
    )
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].total, 1);
  assert.equal(rows[0].activeRate, 100);
});

// =============================================================
// ヒートマップ
// =============================================================

test("buildHeatmap: 銀行×月の接点件数を数える", () => {
  const months = ["2026-06", "2026-07", "2026-08"];
  const branches = [
    branch({ id: "b1", bank_id: "bank-a" }),
    branch({ id: "b2", bank_id: "bank-b" }),
  ];
  const appts = [
    appointment({ id: "a1", branch_id: "b1", received_at: "2026-08-02" }),
    appointment({ id: "a2", branch_id: "b1", received_at: "2026-08-20" }),
    appointment({ id: "a3", branch_id: "b1", received_at: "2026-08-21", status: "cancelled" }),
    appointment({ id: "a4", branch_id: "b2", received_at: "2026-06-01" }),
    appointment({ id: "a5", branch_id: "b1", received_at: "2026-03-01" }), // 期間外
  ];
  const acts = [activity({ id: "ac1", branch_id: "b1", occurred_at: "2026-07-10" })];
  const rows = buildHeatmap(branches, appts, acts, months, (id) =>
    id === "bank-a" ? "A銀行" : "B銀行"
  );

  const a = rows.find((r) => r.bankId === "bank-a");
  assert.ok(a);
  assert.deepEqual(a.counts, [0, 1, 2]);

  const b = rows.find((r) => r.bankId === "bank-b");
  assert.ok(b);
  assert.deepEqual(b.counts, [1, 0, 0]);
});

test("toMonth は不正値で空文字を返す", () => {
  assert.equal(toMonth("2026-08-06"), "2026-08");
  assert.equal(toMonth(""), "");
});
