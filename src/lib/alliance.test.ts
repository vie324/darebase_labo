// アライアンス営業（案件管理表の項目・お金の計算）のユニットテスト
//   npm test

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  applySalesPhase,
  dealEconomics,
  dealMoneyPatch,
  isAgencyContracted,
  jstDate,
  kindOf,
  lineMoney,
  lostOnOf,
  monthLabel,
  phaseForColumn,
  phaseForFulfillmentGroup,
  referredOnOf,
  salesPhaseOf,
  wonOnOf,
  PARTNERSHIP_PHASES,
  SALES_PHASES,
} from "./alliance.ts";
import { FULFILLMENT_GROUPS, FULFILLMENT_STAGES, PIPELINE_COLUMNS } from "./constants.ts";
import type { Deal, DealProduct, Product } from "./types.ts";

// 事業計画※確定版『前提条件』のプラン単価マスター
function product(id: string, name: string, price: number, profit: number, fee: number, unit = "contract"): Product {
  return {
    id,
    name,
    slug: id,
    color: "cyan",
    unit_price: price,
    unit_profit: profit,
    agency_fee: fee,
    count_unit: unit,
    sort_order: 0,
    is_active: true,
    memo: "",
    business_unit_id: null,
    updated_at: "",
    created_at: "",
  };
}

const PLAN10 = product("plan10", "プラン10", 811_200, 311_200, 500_000);
const PLAN50 = product("plan50", "プラン50", 1_852_800, 652_800, 1_200_000);
const DEVICE = product("device", "機器", 282_400, 162_400, 0, "device");
const PRODUCTS = new Map([PLAN10, PLAN50, DEVICE].map((p) => [p.id, p]));

function line(dealId: string, p: Product, quantity: number): DealProduct {
  const m = lineMoney(p, quantity);
  return {
    id: `${dealId}-${p.id}`,
    created_at: "2026-10-01T00:00:00Z",
    deal_id: dealId,
    product_id: p.id,
    product_name: p.name,
    quantity,
    memo: "",
    ...m,
  };
}

function deal(over: Partial<Deal> & { id: string }): Deal {
  return {
    created_at: "2026-10-09T01:00:00Z",
    name: "",
    company: "",
    contact_name: "",
    stage: "won",
    amount: 0,
    probability: 100,
    expected_close: "2026-10-30",
    owner_name: "",
    next_action: "",
    memo: "",
    updated_at: "2026-10-30T00:00:00Z",
    ...over,
  };
}

test("値の一覧はシートのプルダウンと同じ数・同じ並び", () => {
  assert.deepEqual(
    SALES_PHASES.map((p) => p.label),
    [
      "日程調整中",
      "商談待ち",
      "商談済み",
      "対応事項あり",
      "見積り書等送付済み",
      "見込みC",
      "見込みB",
      "見込みA",
      "成約",
      "サインバック回収",
      "リースURL連携済み",
      "リース契約済み",
      "設置調整中",
      "設置済み",
      "入金待ち",
      "入金済み",
      "支払い済み",
      "ロスト",
    ]
  );
  assert.deepEqual(
    PARTNERSHIP_PHASES.map((p) => p.label),
    ["日程調整中", "商談待ち", "商談済み", "対応事項あり", "グループ作成済み", "契約対応中", "契約締結", "初回紹介済み", "成約獲得"]
  );
  // 受注後フェーズの対応先は、実在する FULFILLMENT_STAGES のキーだけ
  const keys = new Set(FULFILLMENT_STAGES.map((s) => s.key));
  for (const p of SALES_PHASES) if (p.fulfillment) assert.ok(keys.has(p.fulfillment), p.label);
});

test("コスモ技研（ラフール・プラン50＋機器1台）＝確定版『月次実績』の成約明細と一致", () => {
  const lines = [line("cosmo", PLAN50, 1), line("cosmo", DEVICE, 1)];
  const e = dealEconomics(deal({ id: "cosmo", bank_id: "rafuru" }), lines, PRODUCTS);
  assert.equal(e.sales, 2_135_200);
  assert.equal(e.profit, 815_200);
  assert.equal(e.fee, 1_200_000);
  assert.equal(e.devices, 1);
  assert.equal(e.contracts, 1);
  assert.deepEqual(e.plans, ["プラン50"]);
  assert.equal(e.direct, false);
});

test("ネクストゲート（宮田先生・プラン10＋機器3台）：機器代金は台数×単価、報酬はプランだけ", () => {
  const lines = [line("ng", PLAN10, 1), line("ng", DEVICE, 3)];
  const e = dealEconomics(deal({ id: "ng", bank_id: "miyata" }), lines, PRODUCTS);
  assert.equal(e.sales, 811_200 + 847_200); // 機器代金 ¥847,200（案件管理表と同じ）
  assert.equal(e.fee, 500_000);
  assert.equal(e.devices, 3);
});

test("直販は代理店報酬ゼロ、そのぶんは自社利益になる（ソルー：プラン50＋機器2台）", () => {
  const lines = [line("solu", PLAN50, 1), line("solu", DEVICE, 2)];
  const e = dealEconomics(deal({ id: "solu", bank_id: null }), lines, PRODUCTS);
  assert.equal(e.direct, true);
  assert.equal(e.fee, 0);
  assert.equal(e.sales, 1_852_800 + 564_800);
  // プランの売上はまるごと自社利益（＋機器の自社利益）
  assert.equal(e.profit, 1_852_800 + 2 * 162_400);
});

test("明細が無い案件は、案件に入っている金額をそのまま使う", () => {
  const e = dealEconomics(
    deal({ id: "x", bank_id: "b", amount: 500_000, contract_amount: 480_000, gross_profit: 100_000, agency_fee: 200_000 }),
    [],
    PRODUCTS
  );
  assert.deepEqual([e.sales, e.profit, e.fee, e.devices], [480_000, 100_000, 200_000, 0]);
  assert.equal(dealMoneyPatch(deal({ id: "x" }), [], PRODUCTS), null);
  assert.deepEqual(
    dealMoneyPatch(deal({ id: "cosmo", bank_id: "r" }), [line("cosmo", PLAN50, 1)], PRODUCTS),
    { amount: 1_852_800, gross_profit: 652_800, agency_fee: 1_200_000, contract_amount: 1_852_800 }
  );
});

test("プラン数 2 は売上・利益・報酬とも2倍（未入力の0は数えない）", () => {
  assert.deepEqual(lineMoney(PLAN10, 2), { amount: 1_622_400, profit: 622_400, agency_fee: 1_000_000 });
  assert.deepEqual(lineMoney(PLAN10, -1), { amount: 0, profit: 0, agency_fee: 0 });
});

test("セールスフェーズ → ステージ・確度・受注後フェーズ", () => {
  const today = "2026-11-09";
  assert.deepEqual(applySalesPhase({ stage: "appointment" }, "prospect_b", today), {
    sales_phase: "prospect_b",
    stage: "follow_up",
    confidence_rank: "B",
    probability: 40,
  });
  // 成約にすると受注後フェーズが始まり、成約日が入る
  assert.deepEqual(applySalesPhase({ stage: "follow_up" }, "won", today), {
    sales_phase: "won",
    stage: "won",
    confidence_rank: "",
    probability: 100,
    fulfillment_status: "contract",
    fulfillment_updated_at: today,
    contracted_at: today,
  });
  // すでに入っている成約日は上書きしない
  const later = applySalesPhase(
    { stage: "won", fulfillment_status: "contract", contracted_at: "2026-10-30" },
    "lease_url",
    today
  );
  assert.equal(later.contracted_at, undefined);
  assert.equal(later.fulfillment_status, "lease_apply");
  // ロストはロスト日
  assert.equal(applySalesPhase({ stage: "follow_up" }, "lost", today).lost_at, today);
  // 知らない値は sales_phase を空にするだけ（ステージは動かさない）
  assert.deepEqual(applySalesPhase({ stage: "won" }, "???", today), { sales_phase: "" });
});

test("フェーズ未設定の案件はステージから推定する", () => {
  assert.equal(salesPhaseOf({ stage: "appointment" })?.label, "商談待ち");
  assert.equal(salesPhaseOf({ stage: "follow_up", confidence_rank: "" })?.label, "商談済み");
  assert.equal(salesPhaseOf({ stage: "follow_up", confidence_rank: "A" })?.label, "見込みA");
  assert.equal(salesPhaseOf({ stage: "won" })?.label, "成約");
  assert.equal(salesPhaseOf({ stage: "partnership" }), null);
  assert.equal(salesPhaseOf({ stage: "po_wait" }), null);
  assert.equal(salesPhaseOf({ stage: "won", sales_phase: "installed" })?.label, "設置済み");
});

test("カンバンの列 → セールスフェーズ（いまの値が列に合えば残す）", () => {
  assert.equal(phaseForColumn("follow_up_c", "todo"), "todo"); // 未判定は C 列のまま
  assert.equal(phaseForColumn("follow_up_b", "todo"), "prospect_b");
  assert.equal(phaseForColumn("appointment", "scheduling"), "scheduling");
  assert.equal(phaseForColumn("won", "payment_wait"), "payment_wait");
  assert.equal(phaseForColumn("won", "prospect_a"), "won");
  assert.equal(phaseForColumn("partnership", "met"), "");
  assert.equal(phaseForColumn("po_wait", "met"), "");
  // どの列のキーも実在する
  const keys = new Set(PIPELINE_COLUMNS.map((c) => c.key));
  for (const k of ["appointment", "follow_up_c", "follow_up_b", "follow_up_a", "won", "lost"]) {
    assert.ok(keys.has(k), k);
  }
});

test("受注後カンバンの列 → 成約後フェーズ", () => {
  const stagesOf = (key: string) => FULFILLMENT_GROUPS.find((g) => g.key === key)!.stages;
  assert.equal(phaseForFulfillmentGroup(stagesOf("lease"), "won"), "lease_url");
  assert.equal(phaseForFulfillmentGroup(stagesOf("lease"), "lease_done"), "lease_done");
  assert.equal(phaseForFulfillmentGroup(stagesOf("activated"), "won"), "installed");
  assert.equal(phaseForFulfillmentGroup(stagesOf("activated"), "paid_in"), "paid_in");
  assert.equal(phaseForFulfillmentGroup(stagesOf("install_wait"), "won"), ""); // 対応なし
});

test("商談種別・販売協力の契約締結", () => {
  assert.equal(kindOf({ stage: "follow_up" }), "sales");
  assert.equal(kindOf({ stage: "partnership" }), "partnership");
  assert.equal(kindOf({ stage: "follow_up", deal_kind: "sales_partnership" }), "sales_partnership");
  assert.equal(isAgencyContracted({ partnership_phase: "contracting" }), false);
  assert.equal(isAgencyContracted({ partnership_phase: "contracted" }), true);
  assert.equal(isAgencyContracted({ partnership_phase: "first_won" }), true);
});

test("日付：紹介日・成約日・ロスト日の決め方と日本時間", () => {
  assert.equal(jstDate("2026-09-30T15:30:00Z"), "2026-10-01"); // 日本時間では翌日
  assert.equal(jstDate("2026-09-30"), "2026-09-30");
  assert.equal(jstDate(""), "");
  assert.equal(referredOnOf({ created_at: "2026-09-30T15:30:00Z", referred_at: "2026-09-02" }), "2026-09-02");
  assert.equal(referredOnOf({ created_at: "2026-09-30T15:30:00Z" }, "2026-09-20"), "2026-09-20");
  assert.equal(referredOnOf({ created_at: "2026-09-30T15:30:00Z" }), "2026-10-01");
  assert.equal(wonOnOf({ stage: "won", expected_close: "2026-10-31", contracted_at: "2026-10-30" }), "2026-10-30");
  assert.equal(wonOnOf({ stage: "won", expected_close: "2026-10-31" }), "2026-10-31");
  assert.equal(wonOnOf({ stage: "follow_up", expected_close: "2026-10-31", contracted_at: "2026-10-30" }), "");
  assert.equal(lostOnOf({ stage: "lost", expected_close: "2026-10-31", lost_at: "2026-10-26" }), "2026-10-26");
  assert.equal(monthLabel("2027-04"), "2027年4月");
});

test("クロスセル（件数に数えない商材）は金額だけ入り、契約数・プラン別には入らない", () => {
  const ai = product("ai", "AI", 600_000, 0, 0, "none");
  const products = new Map([...PRODUCTS, [ai.id, ai]]);
  const lines = [line("x", PLAN10, 1), line("x", ai, 1)];
  const e = dealEconomics(deal({ id: "x", bank_id: "b" }), lines, products);
  assert.equal(e.sales, 811_200 + 600_000);
  assert.equal(e.contracts, 1);
  assert.deepEqual(e.plans, ["プラン10"]);
  assert.deepEqual(e.planQty, { プラン10: 1 });
});
