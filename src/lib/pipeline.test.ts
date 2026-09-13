// 案件パイプライン（商談カンバン / 受注後カンバン）のユニットテスト
//   npm test

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  columnKeyOf,
  fulfillmentGroupOf,
  fulfillmentLabel,
  fulfillmentProgress,
  fulfillmentTransition,
  hasAutoProbability,
  needsConfidenceRank,
  pipelineTransition,
  type DealLike,
} from "./pipeline.ts";
import { FULFILLMENT_GROUPS, FULFILLMENT_STAGES, PIPELINE_COLUMNS } from "./constants.ts";

const TODAY = "2026-09-13";

// ---------- 列の割り当て ----------

test("後追い案件は確度ランクごとの列に入る", () => {
  assert.equal(columnKeyOf({ stage: "follow_up", confidence_rank: "A" }), "follow_up_a");
  assert.equal(columnKeyOf({ stage: "follow_up", confidence_rank: "B" }), "follow_up_b");
  assert.equal(columnKeyOf({ stage: "follow_up", confidence_rank: "C" }), "follow_up_c");
});

test("確度未判定の後追いは C 列に置く（列が増えないようにする）", () => {
  assert.equal(columnKeyOf({ stage: "follow_up" }), "follow_up_c");
  assert.equal(columnKeyOf({ stage: "follow_up", confidence_rank: "" }), "follow_up_c");
  assert.equal(columnKeyOf({ stage: "follow_up", confidence_rank: "S" }), "follow_up_c");
  assert.equal(needsConfidenceRank({ stage: "follow_up" }), true);
  assert.equal(needsConfidenceRank({ stage: "follow_up", confidence_rank: "B" }), false);
  assert.equal(needsConfidenceRank({ stage: "appointment" }), false);
});

test("後追い以外はステージ名がそのまま列キー", () => {
  for (const stage of ["appointment", "po_wait", "won", "lost"] as const) {
    assert.equal(columnKeyOf({ stage }), stage);
  }
});

test("すべての列キーに対応する案件の並べ先がある", () => {
  const keys = PIPELINE_COLUMNS.map((c) => c.key);
  assert.deepEqual(keys, [
    "appointment",
    "follow_up_c",
    "follow_up_b",
    "follow_up_a",
    "po_wait",
    "won",
    "lost",
  ]);
});

// ---------- 列移動 ----------

test("後追いC → 後追いA でランクと既定確度が上がる", () => {
  const deal: DealLike = { stage: "follow_up", confidence_rank: "C", probability: 15 };
  const patch = pipelineTransition(deal, "follow_up_a", TODAY);
  assert.equal(patch.stage, "follow_up");
  assert.equal(patch.confidence_rank, "A");
  assert.equal(patch.probability, 70);
});

test("手入力された確度(%)はドラッグ操作で上書きしない", () => {
  const deal: DealLike = { stage: "follow_up", confidence_rank: "C", probability: 55 };
  assert.equal(hasAutoProbability(deal), false);
  const patch = pipelineTransition(deal, "follow_up_b", TODAY);
  assert.equal(patch.confidence_rank, "B");
  assert.equal(patch.probability, undefined, "手入力値は据え置き");
});

test("受注・失注に移したときは確度を必ず 100 / 0 にする", () => {
  const manual: DealLike = { stage: "follow_up", confidence_rank: "B", probability: 55 };
  assert.equal(pipelineTransition(manual, "won", TODAY).probability, 100);
  assert.equal(pipelineTransition(manual, "lost", TODAY).probability, 0);
});

test("受注に移すと受注後フェーズ（2階）が先頭から始まる", () => {
  const patch = pipelineTransition({ stage: "po_wait", probability: 90 }, "won", TODAY);
  assert.equal(patch.fulfillment_status, FULFILLMENT_STAGES[0].key);
  assert.equal(patch.fulfillment_updated_at, TODAY);
  assert.equal(patch.contracted_at, TODAY);
});

test("すでに受注後フェーズが進んでいる案件のフェーズは巻き戻さない", () => {
  const patch = pipelineTransition(
    { stage: "won", probability: 100, fulfillment_status: "install_work" },
    "won",
    TODAY
  );
  assert.equal(patch.fulfillment_status, undefined);
});

test("後追いから商談予定に戻すと確度ランクが外れる", () => {
  const patch = pipelineTransition(
    { stage: "follow_up", confidence_rank: "A", probability: 70 },
    "appointment",
    TODAY
  );
  assert.equal(patch.stage, "appointment");
  assert.equal(patch.confidence_rank, "");
  assert.equal(patch.probability, 10);
});

test("存在しない列キーには何も書き込まない", () => {
  assert.deepEqual(pipelineTransition({ stage: "appointment" }, "nope", TODAY), {});
});

// ---------- 2階：受注後 ----------

test("詳細フェーズは大分類の列に畳まれる", () => {
  assert.equal(fulfillmentGroupOf("quote_sent"), "contract");
  assert.equal(fulfillmentGroupOf("lease_review"), "lease");
  assert.equal(fulfillmentGroupOf("install_schedule"), "install_adjust");
  assert.equal(fulfillmentGroupOf("install_work"), "install_wait");
  assert.equal(fulfillmentGroupOf("accepted"), "activated");
});

test("未設定・未知のフェーズは先頭の列に置く", () => {
  assert.equal(fulfillmentGroupOf(""), FULFILLMENT_GROUPS[0].key);
  assert.equal(fulfillmentGroupOf(undefined), FULFILLMENT_GROUPS[0].key);
  assert.equal(fulfillmentGroupOf("unknown_phase"), FULFILLMENT_GROUPS[0].key);
});

test("既存の詳細フェーズはすべてどれかの列に属する（取りこぼしがない）", () => {
  const covered = new Set(FULFILLMENT_GROUPS.flatMap((g) => g.stages));
  for (const stage of FULFILLMENT_STAGES) {
    assert.ok(covered.has(stage.key), `${stage.key} がどの列にも入っていない`);
  }
});

test("受注後カンバンで列を移すと、その列の先頭フェーズになる", () => {
  const patch = fulfillmentTransition("install_adjust", TODAY);
  assert.equal(patch.fulfillment_status, "install_request");
  assert.equal(patch.fulfillment_updated_at, TODAY);
});

test("フェーズのラベルと進捗率", () => {
  assert.equal(fulfillmentLabel("lease_review"), "リース審査中");
  assert.equal(fulfillmentLabel(""), "未設定");
  assert.equal(fulfillmentProgress(""), 0);
  assert.equal(fulfillmentProgress(FULFILLMENT_STAGES[FULFILLMENT_STAGES.length - 1].key), 100);
  assert.ok(fulfillmentProgress("lease_apply") > 0);
});
