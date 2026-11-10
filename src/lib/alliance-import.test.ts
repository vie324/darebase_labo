// ★案件管理表★『全体管理』の取込のユニットテスト
//   npm test
//
// 貼り付けるテキストは、Google スプレッドシートで『全体管理』を選択してコピーしたときの形
// （タブ区切り・改行を含むセルは "…" で囲まれる・右側の集計表も一緒に付いてくる）。

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildImportPlan, findHeader, parseDate, parseNumber, parseTable, readSheetRows } from "./alliance-import.ts";
import type { Bank, Branch, Deal, DealProduct, Product } from "./types.ts";

const HEADER = [
  "紹介日", "商談実施日", "1次代理店", "2次代理店", "企業名", "商談種別", "セールスフェーズ",
  "成約日orロスト日", "失注理由", "販売協力フェーズ", "契約締結日", "プラン", "プラン数", "契約備考",
  "機器台数", "月額", "機器代金", "工事費", "販売粗利", "ストック分", "代理店支払い分", "設置日",
  "代理店支払日", "対応", "備考欄", "", "", "紹介数", "成約数", "成約率", "代理店支払い分",
];

function row(cells: Record<number, string>): string {
  return Array.from({ length: HEADER.length }, (_, i) => cells[i] ?? "").join("\t");
}

const SHEET = [
  ["", "案件管理表"].join("\t"),
  row({ 26: "1次代理店", 27: "当月実績（2026年9月）" }),
  HEADER.join("\t"),
  // ネクストゲート（宮田先生・直紹介・成約・プラン10×1・機器3台）
  row({ 0: "2026/09/02", 1: "2026/09/08", 2: "宮田先生", 3: "直紹介", 4: "株式会社ネクストゲート", 5: "セールス", 6: "成約", 7: "2026/09/30", 9: "初回紹介済み", 10: "2026/09/30", 11: "プラン10", 12: "1", 14: "3", 16: "¥847,200", 18: "¥738,400", 23: "クライアントボール", 24: "設置可能な旨ご連絡済み　回答待ち", 26: "ラフール", 27: "8", 28: "0" }),
  // 販売協力だけ（セールスフェーズは「‐」）
  row({ 0: "2026/09/05", 1: "2026/09/04", 2: "松橋社長", 3: "森さん", 4: "株式会社NSO", 5: "販売協力", 6: "‐", 9: "契約締結", 10: "2026/10/02" }),
  // 直販（1次代理店なし）・リースURL連携済み・備考に改行
  row({ 0: "2026/09/17", 1: "2026/09/18", 2: "直販", 3: "直紹介", 4: "ソルー株式会社", 5: "セールス", 6: "リースURL連携済み", 7: "2026/09/30", 9: "‐", 11: "プラン50", 12: "1", 14: "2", 23: "弊社ボール", 24: '"見積もり書連携\n2台構成"' }),
  // 全角数字・シリアル値の日付・ロスト
  row({ 0: "2026/10/13", 1: "2026/10/26", 2: "松橋社長", 3: "ペアブレイブ", 4: "株式会社デンケン", 5: "セールス", 6: "ロスト", 7: "46,321", 9: "‐" }),
  row({ 0: "2026/10/09", 1: "2026/10/21", 2: "ラフール", 3: "直紹介", 4: "株式会社コスモ技研", 5: "セールス", 6: "成約", 7: "2026/10/30", 9: "‐", 11: "プラン50", 12: "１", 14: "１", 23: "弊社ボール", 24: "リース連携" }),
  // 種別・フェーズとも未入力（入ったばかりの紹介）・新しい1次代理店
  row({ 0: "2026/11/06", 2: "きむらさん", 3: "直紹介", 4: "エージェント社" }),
  // 企業名が空の行は読まない
  row({ 0: "2026/11/07", 2: "宮田先生" }),
].join("\n");

function product(id: string, name: string, price: number, profit: number, fee: number, unit = "contract"): Product {
  return {
    id, name, slug: id, color: "cyan", unit_price: price, unit_profit: profit, agency_fee: fee,
    count_unit: unit, sort_order: 0, is_active: true, memo: "", business_unit_id: null, updated_at: "", created_at: "",
  };
}

const PRODUCTS = [
  product("plan10", "プラン10", 811_200, 311_200, 500_000),
  product("plan50", "プラン50", 1_852_800, 652_800, 1_200_000),
  product("device", "機器", 282_400, 162_400, 0, "device"),
];

const BANKS: Bank[] = [
  { id: "miyata", name: "宮田先生", code: "", is_active: true, business_unit_id: "bu-a", created_at: "" },
  { id: "matsu", name: "松橋社長", code: "", is_active: true, business_unit_id: "bu-a", created_at: "" },
  { id: "rafuru", name: "ラフール", code: "", is_active: true, business_unit_id: "bu-a", created_at: "" },
];

function branch(id: string, bank_id: string, name: string): Branch {
  return {
    id, bank_id, name, code: "", address: "", prefecture: "", assigned_to: null, assigned_name: "",
    assigned_org_id: null, status: "active", last_contact_at: "", note: "", business_unit_id: "bu-a",
    updated_at: "", created_at: "",
  };
}

const BRANCHES = [branch("miyata-direct", "miyata", "直接"), branch("matsu-mori", "matsu", "森さん")];

test("貼り付けの解析：タブ区切り・引用符の中の改行・行頭の空セル", () => {
  const rows = parseTable('a\t"b\nc"\td\n\t\tx\n');
  assert.deepEqual(rows, [["a", "b\nc", "d"], ["", "", "x"]]);
  assert.deepEqual(parseTable("a,b\n\"x,y\",z"), [["a", "b"], ["x,y", "z"]]);
});

test("日付と数値の読み取り", () => {
  assert.equal(parseDate("2026/09/01"), "2026-09-01");
  assert.equal(parseDate("2026/9/1"), "2026-09-01");
  assert.equal(parseDate("２０２６年９月１日"), "2026-09-01");
  assert.equal(parseDate("46,325"), "2026-10-30"); // 書式の外れたシリアル値
  assert.equal(parseDate(""), "");
  assert.equal(parseDate("来週"), null);
  assert.equal(parseNumber("¥847,200"), 847_200);
  assert.equal(parseNumber("１"), 1);
  assert.equal(parseNumber("‐"), 0);
});

test("見出し行を探す（右側の集計表の同名列は無視）", () => {
  const header = findHeader(parseTable(SHEET))!;
  assert.equal(header.index, 2);
  assert.equal(header.columns.company, 4);
  assert.equal(header.columns.memo, 24);
  assert.equal(readSheetRows([["a", "b"]]).error !== null, true);
});

test("1行ずつの読み取り：直販・直紹介・‐・全角・シリアル値", () => {
  const { rows, error } = readSheetRows(parseTable(SHEET));
  assert.equal(error, null);
  assert.equal(rows.length, 6); // 企業名が空の行は読まない
  const [ng, nso, solu, denken, cosmo, agent] = rows;
  assert.equal(ng.primary, "宮田先生");
  assert.equal(ng.secondary, ""); // 直紹介
  assert.equal(ng.salesPhase, "won");
  assert.equal(ng.contractedAt, "2026-09-30");
  assert.equal(ng.partnershipPhase, "first_referral");
  assert.equal(ng.ball, "client");
  assert.equal(nso.kind, "partnership");
  assert.equal(nso.salesPhase, "");
  assert.equal(nso.partnershipContractedAt, "2026-10-02");
  assert.equal(solu.primary, ""); // 直販
  assert.equal(solu.memo, "見積もり書連携\n2台構成");
  assert.equal(denken.lostAt, "2026-10-26");
  assert.equal(cosmo.planQty, 1);
  assert.equal(cosmo.devices, 1);
  assert.equal(agent.kind, "sales");
  assert.equal(agent.salesPhase, "");
  assert.deepEqual(agent.warnings, []);
});

test("取込プラン：マスタに無い1次・2次代理店、明細、ステージ", () => {
  const plan = buildImportPlan(SHEET, {
    banks: BANKS,
    branches: BRANCHES,
    deals: [],
    lines: [],
    products: PRODUCTS,
    today: "2026-11-09",
  });
  assert.equal(plan.error, null);
  assert.deepEqual(plan.newPrimaries, ["きむらさん"]);
  assert.deepEqual(plan.newSecondaries, [
    { primary: "松橋社長", name: "ペアブレイブ" },
    { primary: "ラフール", name: "直接" },
    { primary: "きむらさん", name: "直接" },
  ]);
  assert.deepEqual(plan.unknownPlans, []);

  const [ng, nso, solu, denken, cosmo, agent] = plan.items;
  assert.equal(ng.status, "new");
  assert.equal(ng.fields.stage, "won");
  assert.equal(ng.fields.fulfillment_status, "contract");
  assert.equal(ng.fields.expected_close, "2026-09-30");
  assert.deepEqual(
    ng.lines.map((l) => [l.product_name, l.quantity, l.amount, l.agency_fee]),
    [
      ["プラン10", 1, 811_200, 500_000],
      ["機器", 3, 847_200, 0],
    ]
  );
  assert.equal(nso.fields.stage, "partnership");
  assert.equal(solu.fields.fulfillment_status, "lease_apply");
  assert.equal(denken.fields.stage, "lost");
  assert.equal(denken.fields.lost_at, "2026-10-26");
  assert.equal(cosmo.lines.length, 2);
  assert.equal(agent.fields.stage, "appointment");
  assert.equal(agent.fields.expected_close, "2026-12-06"); // 紹介日 + 30日
});

test("貼り直し：同じ紹介（企業名×1次代理店×紹介日）は更新、変わっていなければそのまま", () => {
  const existing: Deal = {
    id: "deal-ng",
    created_at: "2026-09-02T00:00:00Z",
    name: "株式会社ネクストゲート",
    company: "株式会社ネクストゲート",
    contact_name: "",
    stage: "follow_up",
    amount: 0,
    probability: 40,
    expected_close: "2026-09-30",
    owner_name: "",
    next_action: "",
    memo: "設置可能な旨ご連絡済み　回答待ち",
    updated_at: "",
    bank_id: "miyata",
    referred_at: "2026-09-02",
    sales_phase: "prospect_b",
  };
  const plan = buildImportPlan(SHEET, {
    banks: BANKS,
    branches: BRANCHES,
    deals: [existing],
    lines: [],
    products: PRODUCTS,
    today: "2026-11-09",
  });
  const ng = plan.items[0];
  assert.equal(ng.status, "update");
  assert.equal(ng.dealId, "deal-ng");
  assert.ok(ng.changes.includes("セールスフェーズ"));
  assert.ok(ng.changes.includes("プラン・機器台数"));

  // 取り込んだ結果をそのまま既存にして貼り直すと「変更なし」
  const saved: Deal = { ...existing, ...ng.fields };
  const lines: DealProduct[] = ng.lines.map((l, i) => ({
    id: `l${i}`, created_at: "", deal_id: "deal-ng", memo: "", ...l,
  }));
  const again = buildImportPlan(SHEET, {
    banks: BANKS, branches: BRANCHES, deals: [saved], lines, products: PRODUCTS, today: "2026-11-09",
  });
  assert.equal(again.items[0].status, "same");
  assert.deepEqual(again.items[0].changes, []);
});

test("商材マスタに無いプランは明細にせず知らせる・1次代理店の列が無いシートは既定の1次代理店", () => {
  const text = ["紹介日\t企業名\tプラン\tセールスフェーズ", "2026/09/08\t株式会社ケンコウ\tプラン999\t見込みC"].join("\n");
  const plan = buildImportPlan(text, {
    banks: BANKS, branches: BRANCHES, deals: [], lines: [], products: PRODUCTS, today: "2026-11-09",
    defaultPrimary: "ラフール",
  });
  assert.deepEqual(plan.unknownPlans, ["プラン999"]);
  assert.equal(plan.items[0].lines.length, 0);
  assert.equal(plan.items[0].row.primary, "ラフール");
  assert.equal(plan.items[0].fields.confidence_rank, "C");
});

test("成約・ロストで日付が空の行は、商談実施日の月で数えるようにして知らせる", () => {
  const text = [
    "紹介日\t商談実施日\t1次代理店\t企業名\tセールスフェーズ\t成約日orロスト日",
    "2026/10/13\t2026/10/26\t松橋社長\t株式会社デンケン\tロスト\t",
    "2026/10/09\t\t松橋社長\t株式会社ワイズ\t成約\t",
  ].join("\n");
  const plan = buildImportPlan(text, {
    banks: BANKS, branches: BRANCHES, deals: [], lines: [], products: PRODUCTS, today: "2026-11-09",
  });
  const [lost, won] = plan.items;
  assert.equal(lost.fields.lost_at, "");
  assert.equal(lost.fields.expected_close, "2026-10-26");
  assert.match(lost.row.warnings.join(), /ロスト日が空/);
  assert.equal(won.fields.contracted_at, "");
  assert.equal(won.fields.expected_close, "2026-10-09"); // 商談実施日が無ければ紹介日
});
