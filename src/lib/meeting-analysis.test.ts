// 商談ログ解析のユニットテスト（プロンプト組み立てと期限の解釈）
//   npm test

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  TRANSCRIPT_MAX_CHARS,
  buildAnalysisPrompt,
  ownActions,
  resolveDueDate,
  type MeetingAnalysis,
  type MeetingContext,
} from "./meeting-analysis.ts";

const TODAY = "2026-09-13"; // 日曜

const CTX: MeetingContext = {
  kind: "meeting",
  companyName: "株式会社サンプル",
  industry: "製造",
  revenueScale: "1〜5億円",
  criteria: { A: "決裁者同席かつ予算明示", B: "前向きだが未確定", C: "情報収集段階" },
};

// ---------- プロンプト ----------

test("プロンプトに文脈と判定基準が入る", () => {
  const p = buildAnalysisPrompt("よろしくお願いします。", CTX);
  assert.match(p, /商談の文字起こしです/);
  assert.match(p, /相手先: 株式会社サンプル/);
  assert.match(p, /業種: 製造/);
  assert.match(p, /A: 決裁者同席かつ予算明示/);
  assert.match(p, /よろしくお願いします。/);
});

test("社内会議・勉強会は見出しが変わる", () => {
  assert.match(buildAnalysisPrompt("x", { ...CTX, kind: "internal" }), /社内会議の文字起こし/);
  assert.match(buildAnalysisPrompt("x", { ...CTX, kind: "study" }), /勉強会の文字起こし/);
});

test("分かっていない文脈は行ごと出さない", () => {
  const p = buildAnalysisPrompt("x", { ...CTX, companyName: "", industry: "", revenueScale: "" });
  assert.ok(!p.includes("相手先:"));
  assert.ok(!p.includes("業種:"));
});

test("長すぎる文字起こしは上限で切る", () => {
  const long = "あ".repeat(TRANSCRIPT_MAX_CHARS + 5000);
  const p = buildAnalysisPrompt(long, CTX);
  assert.ok(p.length < TRANSCRIPT_MAX_CHARS + 2000, "上限を超えて送らない");
});

// ---------- 期限の解釈 ----------

test("相対的な期限を日付にする", () => {
  assert.equal(resolveDueDate("本日中", TODAY), "2026-09-13");
  assert.equal(resolveDueDate("明日", TODAY), "2026-09-14");
  assert.equal(resolveDueDate("明後日", TODAY), "2026-09-15");
  assert.equal(resolveDueDate("5日以内", TODAY), "2026-09-18");
  assert.equal(resolveDueDate("2週間後", TODAY), "2026-09-27");
  assert.equal(resolveDueDate("今週中", TODAY), "2026-09-18");
  assert.equal(resolveDueDate("来週", TODAY), "2026-09-23");
});

test("営業日は土日ぶんを足す", () => {
  // 3営業日 → 3日 + 週末0日ぶん
  assert.equal(resolveDueDate("3営業日以内", TODAY), "2026-09-16");
  // 5営業日 → 5日 + 2日（1週末）
  assert.equal(resolveDueDate("5営業日以内", TODAY), "2026-09-20");
});

test("解釈できない期限は空（期限なし）にする", () => {
  assert.equal(resolveDueDate("", TODAY), "");
  assert.equal(resolveDueDate("追って連絡", TODAY), "");
  assert.equal(resolveDueDate("なるはや", TODAY), "");
});

test("日付が壊れていても落ちない", () => {
  assert.equal(resolveDueDate("明日", "not-a-date"), "");
});

// ---------- タスク化の対象 ----------

const ANALYSIS = {
  segments: [],
  summary: "",
  decisions: [],
  concerns: [],
  next_actions: [
    { title: "見積を送る", owner: "自社", due_hint: "今週中", priority: "high" },
    { title: "稟議を上げる", owner: "顧客", due_hint: "", priority: "mid" },
    { title: "支店長に共有する", owner: "銀行", due_hint: "", priority: "low" },
    { title: "議事録を共有する", owner: "自社", due_hint: "明日", priority: "mid" },
  ],
  confidence: { rank: "B", reason: "", evidence: [] },
  lost_risk: { level: "low", reasons: [] },
} as MeetingAnalysis;

test("タスク化するのは自社がやることだけ", () => {
  const own = ownActions(ANALYSIS);
  assert.deepEqual(own.map((a) => a.title), ["見積を送る", "議事録を共有する"]);
});

test("解析結果がなければタスク化対象も空", () => {
  assert.deepEqual(ownActions(null), []);
});
