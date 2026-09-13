// 採用まわりのユニットテスト
//   npm test

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CANDIDATE_STATUS_KEYS,
  INTERVIEW_MAX_CHARS,
  RESUME_MAX_CHARS,
  buildCrosscheckPrompt,
  buildQuestionsPrompt,
  buildResumePrompt,
  isOpenStatus,
  readCrosscheck,
  readQuestions,
  readResumeAnalysis,
  seriousGaps,
  statusMeta,
  type Crosscheck,
  type RecruitContext,
  type ResumeAnalysis,
} from "./recruiting.ts";

const CTX: RecruitContext = {
  position: "法人営業（銀行提携）",
  requirements: "銀行紹介を起点とした法人営業。",
};

// ---------- 選考ステータス ----------

test("選考中のステータスだけ open になる", () => {
  const open = CANDIDATE_STATUS_KEYS.filter((k) => isOpenStatus(k));
  assert.deepEqual(open, ["applied", "screening", "interview", "offer"]);
});

test("入社・不採用・辞退は選考中に含めない", () => {
  assert.equal(isOpenStatus("hired"), false);
  assert.equal(isOpenStatus("rejected"), false);
  assert.equal(isOpenStatus("declined"), false);
});

test("未知のステータスは応募として扱う（DBの値が増えても落ちない）", () => {
  assert.equal(statusMeta("unknown_value").label, "応募");
  assert.equal(isOpenStatus("unknown_value"), true);
});

// ---------- プロンプト ----------

test("履歴書のプロンプトに募集職種と求める人物像が入る", () => {
  const prompt = buildResumePrompt("職務経歴書の本文", CTX);
  assert.ok(prompt.includes("法人営業（銀行提携）"));
  assert.ok(prompt.includes("銀行紹介を起点とした法人営業。"));
  assert.ok(prompt.includes("職務経歴書の本文"));
});

test("求める人物像が未設定なら既定の文言で補う", () => {
  const prompt = buildResumePrompt("本文", { position: "営業", requirements: "" });
  assert.ok(prompt.includes("銀行の紹介を起点に"));
});

test("長すぎる履歴書は上限で切る", () => {
  // 上限ちょうどまでを埋めて、末尾に目印を足す（目印が落ちれば切れている）
  const long = "X".repeat(RESUME_MAX_CHARS) + "末尾の目印";
  const prompt = buildResumePrompt(long, CTX);
  assert.equal((prompt.match(/X/g) ?? []).length, RESUME_MAX_CHARS);
  assert.ok(!prompt.includes("末尾の目印"));
});

test("長すぎる面接ログは上限で切る", () => {
  const transcript = "X".repeat(INTERVIEW_MAX_CHARS) + "末尾の目印";
  const prompt = buildCrosscheckPrompt("履歴書の本文", transcript, CTX);
  assert.equal((prompt.match(/X/g) ?? []).length, INTERVIEW_MAX_CHARS);
  assert.ok(!prompt.includes("末尾の目印"));
});

test("質問生成は解析済みの「確認すべき点」をプロンプトに渡す", () => {
  const analysis = {
    verify_points: [{ point: "在籍の空白", reason: "4か月の空白がある" }],
  } as unknown as ResumeAnalysis;
  const prompt = buildQuestionsPrompt("本文", CTX, analysis);
  assert.ok(prompt.includes("在籍の空白"));
  assert.ok(prompt.includes("4か月の空白がある"));
});

test("未解析でも質問生成のプロンプトは組み立てられる", () => {
  const prompt = buildQuestionsPrompt("本文", CTX, null);
  assert.ok(!prompt.includes("面接で確認すべき点"));
  assert.ok(prompt.includes("面接質問を6〜10問"));
});

test("突き合わせのプロンプトに書類と面接の両方が入る", () => {
  const prompt = buildCrosscheckPrompt("書類の中身", "面接の中身", CTX);
  assert.ok(prompt.includes("書類の中身"));
  assert.ok(prompt.includes("面接の中身"));
});

// ---------- jsonb の読み取り ----------

test("未解析・壊れた jsonb は null として読む", () => {
  for (const value of [null, undefined, "", 0, {}, { career: "配列ではない" }]) {
    assert.equal(readResumeAnalysis(value), null);
  }
  assert.equal(readQuestions({ focus: "確かめること" }), null);
  assert.equal(readCrosscheck({ findings: [] }), null);
});

test("形の揃った jsonb はそのまま返す", () => {
  const analysis = { career: [], verify_points: [] };
  assert.equal(readResumeAnalysis(analysis), analysis);

  const questions = { questions: [] };
  assert.equal(readQuestions(questions), questions);

  const check = { findings: [], consistent_points: [] };
  assert.equal(readCrosscheck(check), check);
});

// ---------- 突き合わせ結果の絞り込み ----------

test("面接官が追うべき食い違いは high と mid だけ", () => {
  const check = {
    summary: "",
    findings: [
      { topic: "受注額", resume_says: "", interview_says: "", level: "mid", how_to_confirm: "" },
      { topic: "在籍期間", resume_says: "", interview_says: "", level: "high", how_to_confirm: "" },
      { topic: "言い回し", resume_says: "", interview_says: "", level: "low", how_to_confirm: "" },
    ],
    consistent_points: [],
    unanswered: [],
  } as Crosscheck;
  assert.deepEqual(
    seriousGaps(check).map((f) => f.topic),
    ["受注額", "在籍期間"]
  );
});

test("未実施なら追うべき食い違いは0件", () => {
  assert.deepEqual(seriousGaps(null), []);
});
