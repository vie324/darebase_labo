// アライアンス事業計画（確定版の再現）のユニットテスト
//   npm test
//
// 期待値はすべて『アライアンス事業計画※確定版』の各シートに出ている数字。
// ここが通る＝システムの計画がシートと1円・1件もずれない、という意味。

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_ALLIANCE_PLAN,
  budgetText,
  buildPlan,
  ceilDiv,
  closingsOf,
  coercePlan,
  manYen,
  monthRange,
  planHalves,
  planMonths,
  planTotals,
} from "./alliance-plan.ts";

test("計画期間は 2026年9月〜2027年4月の8ヶ月", () => {
  assert.deepEqual(planMonths(DEFAULT_ALLIANCE_PLAN), [
    "2026-09",
    "2026-10",
    "2026-11",
    "2026-12",
    "2027-01",
    "2027-02",
    "2027-03",
    "2027-04",
  ]);
  assert.deepEqual(monthRange("2026-11", 3), ["2026-11", "2026-12", "2027-01"]);
});

test("成約数は 紹介総数 × 月別成約率 の切り上げ（浮動小数でずれない）", () => {
  assert.equal(closingsOf(35, 23), 9); // 8.05 → 9
  assert.equal(closingsOf(25, 20), 5); // ちょうど 5（5.000…01 で 6 にならない）
  assert.equal(closingsOf(50, 27), 14); // 13.5 → 14
  assert.equal(closingsOf(90, 30), 27);
  assert.equal(closingsOf(0, 35), 0);
  assert.equal(ceilDiv(25, 4), 7);
  assert.equal(ceilDiv(10, 0), 0);
});

test("『月次計画』（標準）の各月が確定版と一致する", () => {
  const rows = buildPlan(DEFAULT_ALLIANCE_PLAN);
  const pick = rows.map((r) => [
    r.newAgencies,
    r.cumAgencies,
    r.perAgencyReferrals,
    r.referrals,
    r.closings,
    r.sales,
    r.profit,
    r.fee,
    r.cumFee,
    r.perAgencyFee,
  ]);
  assert.deepEqual(pick, [
    [2, 2, 5, 10, 1, 1_012_800, 312_800, 700_000, 700_000, 350_000],
    [2, 4, 7, 25, 5, 5_064_000, 1_564_000, 3_500_000, 4_200_000, 875_000],
    [2, 6, 6, 35, 9, 9_115_200, 2_815_200, 6_300_000, 10_500_000, 1_050_000],
    [1, 7, 8, 50, 14, 14_179_200, 4_379_200, 9_800_000, 20_300_000, 1_400_000],
    [1, 8, 12, 90, 27, 27_345_600, 8_445_600, 18_900_000, 39_200_000, 2_362_500],
    [1, 9, 13, 115, 38, 38_486_400, 11_886_400, 26_600_000, 65_800_000, 2_955_556],
    [1, 10, 13, 130, 46, 46_588_800, 14_388_800, 32_200_000, 98_000_000, 3_220_000],
    [0, 10, 15, 150, 53, 53_678_400, 16_578_400, 37_100_000, 135_100_000, 3_710_000],
  ]);
});

test("『月次計画』の期間合計・『期間サマリー』の数字", () => {
  const t = planTotals(buildPlan(DEFAULT_ALLIANCE_PLAN));
  assert.equal(t.newAgencies, 10);
  assert.equal(t.endAgencies, 10);
  assert.equal(t.agencyMonths, 56); // 延べ稼働社月数
  assert.equal(t.referrals, 605);
  assert.equal(t.perAgencyReferrals, 11);
  assert.equal(t.closings, 193);
  assert.equal(t.closeRate, 31.9);
  assert.equal(t.sales, 195_470_400);
  assert.equal(t.profit, 60_370_400);
  assert.equal(t.fee, 135_100_000);
  assert.equal(t.perAgencyFee, 2_412_500); // 稼働1社あたり月間報酬

  const [first, second] = planHalves(buildPlan(DEFAULT_ALLIANCE_PLAN)).map((h) =>
    planTotals(h.rows)
  );
  assert.equal(first.fee, 20_300_000);
  assert.equal(second.fee, 114_800_000);
  assert.equal(first.closings, 29);
  assert.equal(second.closings, 164);
  assert.equal(first.referrals, 120);
  assert.equal(second.referrals, 485);
  assert.equal(first.agencyMonths, 19);
  assert.equal(second.agencyMonths, 37);
});

test("シナリオ比較（保守・積極）も確定版と一致する", () => {
  const cons = planTotals(buildPlan(DEFAULT_ALLIANCE_PLAN, "conservative"));
  assert.deepEqual([cons.referrals, cons.closings, cons.sales, cons.fee, cons.profit], [
    518, 162, 164_073_600, 113_400_000, 50_673_600,
  ]);
  const aggr = planTotals(buildPlan(DEFAULT_ALLIANCE_PLAN, "aggressive"));
  assert.deepEqual([aggr.referrals, aggr.closings, aggr.sales, aggr.fee, aggr.profit], [
    649, 203, 205_598_400, 142_100_000, 63_498_400,
  ]);
});

test("『月次目標生成』の文面（2026年11月度）", () => {
  assert.equal(
    budgetText(DEFAULT_ALLIANCE_PLAN, "2026-11"),
    [
      "【アライアンス事業　2026年11月度予算】 概算※修整可能性あり",
      "",
      "【KGI】",
      "パートナー還元：630万円",
      "",
      "【KPI】",
      "-DDHBOX販売-",
      "紹介獲得総数：35社",
      "DDHBOX契約社数：9社",
      "売上：9,115,200円",
      "自社利益：2,815,200円",
      "",
      "-代理店開拓-",
      "新規代理店契約：2社",
    ].join("\n")
  );
  assert.equal(budgetText(DEFAULT_ALLIANCE_PLAN, "2027-05"), null);
  assert.equal(manYen(18_900_000), "1,890万円");
  assert.equal(manYen(1_012_800), "101.3万円");
});

test("保存値の読み込み：壊れた値・足りない月は既定値で埋める", () => {
  const plan = coercePlan({
    scenario: "aggressive",
    startMonth: "2026-13", // 不正 → 既定
    referrals: { standard: [1, 2] }, // 足りない月は確定版の値
    closeRates: [50, -1, "x"],
    newAgencies: [3],
    unitSales: -5,
  });
  assert.equal(plan.scenario, "aggressive");
  assert.equal(plan.startMonth, "2026-09");
  assert.deepEqual(plan.referrals.standard, [1, 2, 35, 50, 90, 115, 130, 150]);
  assert.deepEqual(plan.referrals.aggressive, DEFAULT_ALLIANCE_PLAN.referrals.aggressive);
  assert.deepEqual(plan.closeRates.slice(0, 3), [50, 20, 23]);
  assert.deepEqual(plan.newAgencies, [3, 2, 2, 1, 1, 1, 1, 0]);
  assert.equal(plan.unitSales, DEFAULT_ALLIANCE_PLAN.unitSales);

  // 期間を延ばすと、増えた月は 0 で埋まる
  const longer = coercePlan({ months: 10 });
  assert.equal(longer.referrals.standard.length, 10);
  assert.deepEqual(longer.referrals.standard.slice(8), [0, 0]);

  // 未保存は確定版そのもの（呼び出し側が書き換えても既定値は汚れない）
  const fresh = coercePlan(undefined);
  fresh.referrals.standard[0] = 999;
  assert.equal(DEFAULT_ALLIANCE_PLAN.referrals.standard[0], 10);
});
