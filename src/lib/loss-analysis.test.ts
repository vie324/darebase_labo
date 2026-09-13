// 失注の横断分析のユニットテスト
//   npm test

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildLossPrompt,
  buildLossStats,
  categorizeReason,
  hasAnalyzableLosses,
} from "./loss-analysis.ts";
import type { Deal, MeetingLog } from "./types.ts";

function deal(over: Partial<Deal> & { id: string }): Deal {
  return {
    name: "案件",
    company: "会社",
    contact_name: "",
    stage: "lost",
    amount: 1_000_000,
    probability: 0,
    expected_close: "",
    owner_name: "田中 美咲",
    next_action: "",
    memo: "",
    updated_at: "2026-08-20T00:00:00Z",
    created_at: "2026-06-01T00:00:00Z",
    ...over,
  };
}

function log(dealId: string, reasons: string[], concerns: string[] = []): MeetingLog {
  return {
    id: `log-${dealId}`,
    title: "",
    held_at: "2026-08-01",
    kind: "meeting",
    deal_id: dealId,
    appointment_id: null,
    bank_id: null,
    branch_id: null,
    company_name: "",
    transcript: "",
    media_url: "",
    analysis: {
      segments: [],
      summary: "",
      decisions: [],
      concerns,
      next_actions: [],
      confidence: { rank: "B", reason: "", evidence: [] },
      lost_risk: { level: "high", reasons },
    },
    analyzed_at: "2026-08-01T00:00:00Z",
    analysis_model: "claude-opus-5",
    owner_name: "",
    business_unit_id: null,
    updated_at: "",
    created_at: "",
  };
}

// ---------- 分類 ----------

test("失注要因をキーワードでカテゴリに割り当てる", () => {
  assert.equal(categorizeReason("価格面で競合B社に決定した"), "competitor", "競合を優先する");
  assert.equal(categorizeReason("提示価格が予算より高かった"), "price");
  assert.equal(categorizeReason("今期は予算が確保できなかった"), "budget");
  assert.equal(categorizeReason("役員会で反対された"), "authority");
  assert.equal(categorizeReason("導入時期が来期に先送りになった"), "timing");
  assert.equal(categorizeReason("設置工事で業務が止まることを懸念された"), "install");
  assert.equal(categorizeReason("必要な機能が不足していた"), "spec");
  assert.equal(categorizeReason("その後まったく連絡がつかなくなった"), "contact");
});

test("どれにも当てはまらない要因はその他", () => {
  assert.equal(categorizeReason("担当者が異動した"), "other");
  assert.equal(categorizeReason(""), "other");
});

// ---------- 集計 ----------

const DEALS: Deal[] = [
  deal({ id: "l1", amount: 3_000_000, confidence_rank: "A", updated_at: "2026-08-10T00:00:00Z" }),
  deal({ id: "l2", amount: 1_000_000, confidence_rank: "C", owner_name: "鈴木 大輔", updated_at: "2026-08-20T00:00:00Z" }),
  deal({ id: "l3", amount: 2_000_000, confidence_rank: "A", updated_at: "2026-09-01T00:00:00Z" }),
  deal({ id: "w1", stage: "won", amount: 5_000_000 }),
  deal({ id: "w2", stage: "won", amount: 4_000_000, owner_name: "鈴木 大輔" }),
  deal({ id: "o1", stage: "follow_up", amount: 900_000 }),
];

const LOGS: MeetingLog[] = [
  log("l1", ["提示価格が高いと言われた", "競合A社が先に提案していた"], ["決裁者が同席しなかった"]),
  log("l2", ["導入時期が来期に先送りになった"]),
  // l3 は商談ログなし
];

test("失注の件数・金額・失注率を集計する", () => {
  const s = buildLossStats(DEALS, LOGS);
  assert.equal(s.lostCount, 3);
  assert.equal(s.wonCount, 2);
  assert.equal(s.lostAmount, 6_000_000);
  assert.equal(s.lossRate, 60, "3/(3+2) = 60%");
});

test("要因をカテゴリ別に集計する", () => {
  const s = buildLossStats(DEALS, LOGS);
  const found = Object.fromEntries(s.categories.map((c) => [c.key, c.count]));
  assert.deepEqual(found, { competitor: 1, price: 1, timing: 1 });
  assert.equal(s.categories.reduce((n, c) => n + c.count, 0), 3);
});

test("カテゴリは件数の多い順に並ぶ", () => {
  const many = [
    deal({ id: "a" }),
    deal({ id: "b" }),
    deal({ id: "c" }),
  ];
  const logs = [
    log("a", ["価格が高い"]),
    log("b", ["価格が合わない"]),
    log("c", ["時期が来期になった"]),
  ];
  const s = buildLossStats(many, logs);
  assert.deepEqual(s.categories.map((c) => c.key), ["price", "timing"]);
  assert.equal(s.categories[0].count, 2);
  assert.equal(s.categories[0].samples.length, 2, "実文をサンプルとして持つ");
});

test("確度ランク別に集計する（Aから落ちていれば見極めが甘い）", () => {
  const s = buildLossStats(DEALS, LOGS);
  assert.deepEqual(s.byRank, [
    { rank: "A", count: 2 },
    { rank: "C", count: 1 },
  ]);
});

test("担当者別は失注のある人だけを失注数の多い順で返す", () => {
  const s = buildLossStats(DEALS, LOGS);
  assert.deepEqual(s.byOwner, [
    { name: "田中 美咲", lost: 2, won: 1, rate: 67 },
    { name: "鈴木 大輔", lost: 1, won: 1, rate: 50 },
  ]);
});

test("月次は昇順で、更新月を失注月として扱う", () => {
  const s = buildLossStats(DEALS, LOGS);
  assert.deepEqual(s.monthly.map((m) => m.month), ["2026-08", "2026-09"]);
  assert.equal(s.monthly[0].count, 2);
  assert.equal(s.monthly[0].amount, 4_000_000);
});

test("商談ログが無い失注は「要因なし」として数える", () => {
  const s = buildLossStats(DEALS, LOGS);
  assert.equal(s.withoutReasons, 1, "l3 は解析なし");
});

test("同じ要因が複数ログにあっても案件単位では重複を除く", () => {
  const dup = [log("l1", ["価格が高い"]), { ...log("l1", ["価格が高い"]), id: "log-dup" }];
  const s = buildLossStats([DEALS[0]], dup);
  assert.deepEqual(s.cases[0].reasons, ["価格が高い"]);
});

test("失注が無ければ空の統計を返す（落ちない）", () => {
  const s = buildLossStats([deal({ id: "w", stage: "won" })], []);
  assert.equal(s.lostCount, 0);
  assert.equal(s.lossRate, 0);
  assert.deepEqual(s.categories, []);
  assert.deepEqual(s.byRank, []);
});

// ---------- AIに渡す判断とプロンプト ----------

test("要因が1件も無ければAIには渡さない", () => {
  const empty = buildLossStats([deal({ id: "l" })], []);
  assert.equal(hasAnalyzableLosses(empty), false);
  assert.equal(hasAnalyzableLosses(buildLossStats(DEALS, LOGS)), true);
});

test("プロンプトに金額・確度・要因が入る", () => {
  const s = buildLossStats(DEALS, LOGS);
  const p = buildLossPrompt(s.cases);
  assert.match(p, /失注案件の一覧/);
  assert.match(p, /確度 A/);
  assert.match(p, /提示価格が高いと言われた/);
  assert.match(p, /（商談ログの解析なし）/, "解析が無い案件もその旨を伝える");
});
