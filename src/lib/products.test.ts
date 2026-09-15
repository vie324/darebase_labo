// 商材マスタ・案件明細・事業部のユニットテスト
//   npm test

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildProductStats,
  crossSellRate,
  dealAmount,
  dealHasProduct,
  linesOfDeal,
  linesTotal,
  productColor,
  productNamesOf,
} from "./products.ts";
import {
  ALLIANCE,
  BANKING,
  belongsToUnit,
  filterByUnit,
  normalizeUnitSlug,
  resolveUnit,
  termsOf,
} from "./business-units.ts";
import type { BusinessUnit, DealProduct, Product } from "./types.ts";

function product(over: Partial<Product> & { id: string; name: string }): Product {
  return {
    slug: "",
    color: "slate",
    unit_price: 0,
    sort_order: 0,
    is_active: true,
    memo: "",
    business_unit_id: null,
    updated_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

function line(over: Partial<DealProduct> & { id: string; deal_id: string }): DealProduct {
  return {
    product_id: "p-dds",
    product_name: "DDS",
    amount: 1_000_000,
    quantity: 1,
    memo: "",
    created_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

const DDS = product({ id: "p-dds", name: "DDS", slug: "dds", color: "cyan" });
const AI = product({ id: "p-ai", name: "AI", slug: "ai", color: "violet" });

// ---------- 明細 ----------

test("案件の明細だけを取り出し、登録順に並べる", () => {
  const lines = [
    line({ id: "l-2", deal_id: "d-1", product_id: "p-ai", product_name: "AI", created_at: "2026-02-01T00:00:00Z" }),
    line({ id: "l-1", deal_id: "d-1", created_at: "2026-01-01T00:00:00Z" }),
    line({ id: "l-3", deal_id: "d-2" }),
  ];
  assert.deepEqual(
    linesOfDeal(lines, "d-1").map((l) => l.id),
    ["l-1", "l-2"]
  );
});

test("明細が無い案件は案件そのものの金額を使う（既存の銀行営業の案件）", () => {
  assert.equal(linesTotal([]), null);
  assert.equal(dealAmount({ id: "d-1", amount: 3_000_000 }, []), 3_000_000);
});

test("明細があれば合計が案件の金額になる", () => {
  const lines = [
    line({ id: "l-1", deal_id: "d-1", amount: 1_200_000 }),
    line({ id: "l-2", deal_id: "d-1", product_id: "p-ai", product_name: "AI", amount: 800_000 }),
  ];
  // 案件側の amount が古くても、明細の合計が正
  assert.equal(dealAmount({ id: "d-1", amount: 0 }, lines), 2_000_000);
});

test("案件に載っている商材名を並べる", () => {
  const lines = [
    line({ id: "l-1", deal_id: "d-1" }),
    line({ id: "l-2", deal_id: "d-1", product_id: "p-ai", product_name: "AI", created_at: "2026-02-01T00:00:00Z" }),
  ];
  assert.deepEqual(productNamesOf(lines, "d-1"), ["DDS", "AI"]);
  assert.equal(dealHasProduct(lines, "d-1", "p-ai"), true);
  assert.equal(dealHasProduct(lines, "d-1", "p-other"), false);
});

// ---------- 商材別サマリー ----------

test("商材別に受注額と進行中の金額を分けて集計する", () => {
  const deals = [
    { id: "d-won", stage: "won" },
    { id: "d-open", stage: "follow_up" },
    { id: "d-lost", stage: "lost" },
  ];
  const lines = [
    line({ id: "l-1", deal_id: "d-won", amount: 2_000_000 }),
    line({ id: "l-2", deal_id: "d-open", amount: 1_000_000 }),
    line({ id: "l-3", deal_id: "d-lost", amount: 5_000_000 }),
    line({ id: "l-4", deal_id: "d-won", product_id: "p-ai", product_name: "AI", amount: 500_000 }),
  ];
  const stats = buildProductStats([DDS, AI], deals, lines);
  const dds = stats.find((s) => s.product.id === "p-dds")!;
  assert.equal(dds.wonAmount, 2_000_000);
  assert.equal(dds.openAmount, 1_000_000);
  assert.equal(dds.wonCount, 1);
  assert.equal(dds.dealCount, 3); // 失注も「載っていた案件」として数える
  // 失注案件の金額はどちらにも入れない
  assert.equal(dds.wonAmount + dds.openAmount, 3_000_000);
});

test("受注額の多い商材が先に並ぶ", () => {
  const deals = [{ id: "d-1", stage: "won" }];
  const lines = [
    line({ id: "l-1", deal_id: "d-1", amount: 100 }),
    line({ id: "l-2", deal_id: "d-1", product_id: "p-ai", product_name: "AI", amount: 900 }),
  ];
  assert.deepEqual(
    buildProductStats([DDS, AI], deals, lines).map((s) => s.product.name),
    ["AI", "DDS"]
  );
});

test("消えた案件の明細は集計に入れない", () => {
  const lines = [line({ id: "l-1", deal_id: "d-missing", amount: 9_999 })];
  const stats = buildProductStats([DDS], [], lines);
  assert.equal(stats[0].dealCount, 0);
  assert.equal(stats[0].wonAmount, 0);
});

// ---------- クロスセル率 ----------

test("2商材以上が載っている案件の割合を出す", () => {
  const lines = [
    line({ id: "l-1", deal_id: "d-1" }),
    line({ id: "l-2", deal_id: "d-1", product_id: "p-ai", product_name: "AI" }),
    line({ id: "l-3", deal_id: "d-2" }),
  ];
  assert.deepEqual(crossSellRate(["d-1", "d-2"], lines), { multi: 1, total: 2, rate: 50 });
});

test("商材が未設定の案件は母数に入れない", () => {
  const lines = [line({ id: "l-1", deal_id: "d-1" })];
  // d-2 は明細なし → 母数は d-1 だけ
  assert.deepEqual(crossSellRate(["d-1", "d-2"], lines), { multi: 0, total: 1, rate: 0 });
});

test("明細が1件も無ければ率は出さない（0%とは言わない）", () => {
  assert.deepEqual(crossSellRate(["d-1"], []), { multi: 0, total: 0, rate: null });
});

test("同じ商材を2行に分けても1商材として数える", () => {
  const lines = [
    line({ id: "l-1", deal_id: "d-1", amount: 500 }),
    line({ id: "l-2", deal_id: "d-1", amount: 500 }),
  ];
  assert.equal(crossSellRate(["d-1"], lines).multi, 0);
});

test("未知の配色は既定色に落とす", () => {
  assert.equal(productColor("cyan"), productColor("cyan"));
  assert.equal(productColor("なにこれ"), productColor("slate"));
});

// ---------- 事業部 ----------

const UNITS: BusinessUnit[] = [
  { id: "bu-banking", name: "銀行営業", slug: "banking", is_active: true, created_at: "" },
  { id: "bu-alliance", name: "アライアンス営業", slug: "alliance", is_active: true, created_at: "" },
];

test("事業部ごとに画面の呼び名が変わる", () => {
  assert.equal(termsOf(BANKING).parent, "銀行");
  assert.equal(termsOf(BANKING).child, "支店");
  assert.equal(termsOf(ALLIANCE).parent, "1次代理店");
  assert.equal(termsOf(ALLIANCE).child, "2次代理店");
});

test("未知の slug は銀行営業として扱う", () => {
  assert.equal(normalizeUnitSlug("なにか"), BANKING);
  assert.equal(normalizeUnitSlug(null), BANKING);
  assert.equal(normalizeUnitSlug(ALLIANCE), ALLIANCE);
});

test("事業部が見つからないときは銀行営業に倒す", () => {
  assert.equal(resolveUnit(UNITS, "bu-alliance").slug, ALLIANCE);
  assert.equal(resolveUnit(UNITS, "存在しないid").slug, BANKING);
  assert.equal(resolveUnit([], null).unit, null);
});

test("事業部が未設定の行は銀行営業のものとして扱う（既存データの互換）", () => {
  assert.equal(belongsToUnit(null, "bu-banking", "bu-banking"), true);
  assert.equal(belongsToUnit(null, "bu-alliance", "bu-banking"), false);
  assert.equal(belongsToUnit("bu-alliance", "bu-alliance", "bu-banking"), true);
});

test("事業部を絞らない（null）ときは全件返す", () => {
  const rows = [{ business_unit_id: "bu-banking" }, { business_unit_id: "bu-alliance" }];
  assert.equal(filterByUnit(rows, null, "bu-banking").length, 2);
  assert.equal(filterByUnit(rows, "bu-alliance", "bu-banking").length, 1);
});
