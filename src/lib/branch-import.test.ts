// 銀行・支店CSV取込のユニットテスト（node --test / 型ストリップで実行）
//   npm test

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildImportPlan,
  guessBranchMapping,
  isMappingReady,
  parseBranchCsv,
  type BranchColumnMapping,
} from "./branch-import.ts";
import type { Bank, Branch } from "./types.ts";

function bank(over: Partial<Bank> & { id: string }): Bank {
  return {
    id: over.id,
    name: "テスト銀行",
    code: "",
    is_active: true,
    business_unit_id: null,
    created_at: "",
    ...over,
  };
}

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
    status: "active",
    last_contact_at: "",
    note: "",
    business_unit_id: null,
    updated_at: "",
    created_at: "",
    ...over,
  };
}

// =============================================================
// 列マッピングの推測
// =============================================================

test("guessBranchMapping: 一般的な見出しを拾う", () => {
  const m = guessBranchMapping(["金融機関コード", "銀行名", "支店コード", "支店名", "都道府県", "住所"]);
  assert.equal(m.bankCode, 0);
  assert.equal(m.bankName, 1);
  assert.equal(m.branchCode, 2);
  assert.equal(m.branchName, 3);
  assert.equal(m.prefecture, 4);
  assert.equal(m.address, 5);
});

test("guessBranchMapping: コード列を名称列として誤検出しない", () => {
  const m = guessBranchMapping(["銀行コード", "支店コード"]);
  assert.equal(m.bankName, -1);
  assert.equal(m.branchName, -1);
  assert.equal(m.bankCode, 0);
  assert.equal(m.branchCode, 1);
});

test("isMappingReady: 銀行名と支店名が揃って初めて取込可能", () => {
  assert.equal(isMappingReady({ ...blank(), bankName: 0, branchName: 1 }), true);
  assert.equal(isMappingReady({ ...blank(), bankName: 0 }), false);
});

function blank(): BranchColumnMapping {
  return {
    bankName: -1,
    bankCode: -1,
    branchName: -1,
    branchCode: -1,
    prefecture: -1,
    address: -1,
    assignee: -1,
    note: -1,
  };
}

// =============================================================
// CSV解析
// =============================================================

test("parseBranchCsv: ヘッダを検出してデータ行だけを返す", () => {
  const csv = ["銀行名,支店名,支店コード", "みらい銀行,渋谷支店,001", "みらい銀行,新宿支店,002"].join(
    "\n"
  );
  const r = parseBranchCsv(csv);
  assert.equal(r.hasHeader, true);
  assert.equal(r.rows.length, 2);
  assert.equal(r.mapping.bankName, 0);
  assert.equal(r.mapping.branchName, 1);
});

test("parseBranchCsv: ヘッダが無いCSVも1行目をデータとして扱う", () => {
  const r = parseBranchCsv("みらい銀行,渋谷支店\nみらい銀行,新宿支店");
  assert.equal(r.hasHeader, false);
  assert.equal(r.rows.length, 2);
});

test("parseBranchCsv: 空のテキストでも落ちない", () => {
  const r = parseBranchCsv("");
  assert.equal(r.rows.length, 0);
  assert.equal(isMappingReady(r.mapping), false);
});

test("parseBranchCsv: 引用符で囲まれたカンマを含む住所を壊さない", () => {
  const csv = ['銀行名,支店名,住所', 'みらい銀行,渋谷支店,"東京都渋谷区1-2-3, 4F"'].join("\n");
  const r = parseBranchCsv(csv);
  assert.equal(r.rows[0][2], "東京都渋谷区1-2-3, 4F");
});

// =============================================================
// ドライラン（取込プラン）
// =============================================================

const MAPPING: BranchColumnMapping = {
  ...blank(),
  bankName: 0,
  bankCode: 1,
  branchName: 2,
  branchCode: 3,
};

test("buildImportPlan: 未登録の銀行・支店はすべて新規", () => {
  const plan = buildImportPlan(
    [
      ["みらい銀行", "0001", "渋谷支店", "001"],
      ["みらい銀行", "0001", "新宿支店", "002"],
    ],
    MAPPING,
    [],
    []
  );
  assert.equal(plan.createCount, 2);
  assert.equal(plan.updateCount, 0);
  // 銀行は2行に出てくるが作成は1件だけ
  assert.equal(plan.newBanks.length, 1);
  assert.equal(plan.newBanks[0].name, "みらい銀行");
  assert.equal(plan.rows[0].createsBank, true);
  assert.equal(plan.rows[1].createsBank, false);
});

test("buildImportPlan: 銀行コード+支店コードが一致する行は更新扱い", () => {
  const banks = [bank({ id: "bank-1", name: "みらい銀行", code: "0001" })];
  const branches = [branch({ id: "br-1", bank_id: "bank-1", name: "渋谷支店", code: "001" })];
  const plan = buildImportPlan(
    [["みらい銀行", "0001", "渋谷支店", "001"]],
    MAPPING,
    banks,
    branches
  );
  assert.equal(plan.updateCount, 1);
  assert.equal(plan.createCount, 0);
  assert.equal(plan.rows[0].existingBranchId, "br-1");
});

test("buildImportPlan: 支店名が変わっていてもコードが同じなら更新（改称に追従）", () => {
  const banks = [bank({ id: "bank-1", name: "みらい銀行", code: "0001" })];
  const branches = [branch({ id: "br-1", bank_id: "bank-1", name: "渋谷支店", code: "001" })];
  const plan = buildImportPlan(
    [["みらい銀行", "0001", "渋谷中央支店", "001"]],
    MAPPING,
    banks,
    branches
  );
  assert.equal(plan.rows[0].action, "update");
  assert.equal(plan.rows[0].existingBranchId, "br-1");
});

test("buildImportPlan: コードが無い場合は銀行名+支店名で突き合わせる", () => {
  const banks = [bank({ id: "bank-1", name: "みらい銀行" })];
  const branches = [branch({ id: "br-1", bank_id: "bank-1", name: "渋谷支店" })];
  const plan = buildImportPlan(
    [["みらい銀行", "", "渋谷支店", ""]],
    MAPPING,
    banks,
    branches
  );
  assert.equal(plan.rows[0].action, "update");
  assert.equal(plan.rows[0].existingBranchId, "br-1");
});

test("buildImportPlan: コードの全角数字・空白・ハイフンを正規化して比較する", () => {
  const banks = [bank({ id: "bank-1", name: "みらい銀行", code: "0001" })];
  const branches = [branch({ id: "br-1", bank_id: "bank-1", name: "渋谷支店", code: "001" })];
  const plan = buildImportPlan(
    [["みらい銀行", "０００１", "渋谷支店", "０ ０ １"]],
    MAPPING,
    banks,
    branches
  );
  assert.equal(plan.rows[0].action, "update");
});

test("buildImportPlan: 銀行名の空白差は同一とみなす", () => {
  const banks = [bank({ id: "bank-1", name: "みらい銀行" })];
  const plan = buildImportPlan([["みらい 銀行", "", "渋谷支店", ""]], MAPPING, banks, []);
  assert.equal(plan.newBanks.length, 0);
  assert.equal(plan.rows[0].existingBankId, "bank-1");
});

test("buildImportPlan: 同一CSV内の重複行はスキップする", () => {
  const plan = buildImportPlan(
    [
      ["みらい銀行", "0001", "渋谷支店", "001"],
      ["みらい銀行", "0001", "渋谷支店", "001"],
    ],
    MAPPING,
    [],
    []
  );
  assert.equal(plan.createCount, 1);
  assert.equal(plan.skipCount, 1);
  assert.equal(plan.rows[1].reason, "同じCSV内に同一の支店が複数あります");
});

test("buildImportPlan: 銀行名・支店名が欠けた行はエラーとして数える", () => {
  const plan = buildImportPlan(
    [
      ["", "0001", "渋谷支店", "001"],
      ["みらい銀行", "0001", "", "002"],
      ["みらい銀行", "0001", "新宿支店", "003"],
    ],
    MAPPING,
    [],
    []
  );
  assert.equal(plan.errorCount, 2);
  assert.equal(plan.createCount, 1);
  assert.equal(plan.rows[0].reason, "銀行名がありません");
  assert.equal(plan.rows[1].reason, "支店名がありません");
});

test("buildImportPlan: 別銀行の同名支店は別レコードとして新規作成する", () => {
  const banks = [
    bank({ id: "bank-1", name: "みらい銀行", code: "0001" }),
    bank({ id: "bank-2", name: "さくら銀行", code: "0002" }),
  ];
  const branches = [branch({ id: "br-1", bank_id: "bank-1", name: "渋谷支店", code: "001" })];
  const plan = buildImportPlan(
    [["さくら銀行", "0002", "渋谷支店", "001"]],
    MAPPING,
    banks,
    branches
  );
  assert.equal(plan.rows[0].action, "create");
  assert.equal(plan.rows[0].existingBankId, "bank-2");
});

test("buildImportPlan: 行番号はヘッダ分をオフセットして表示する", () => {
  const plan = buildImportPlan([["みらい銀行", "", "渋谷支店", ""]], MAPPING, [], [], 1);
  assert.equal(plan.rows[0].lineNo, 2);
});

test("buildImportPlan: 任意列（都道府県・住所・担当者・備考）を取り込む", () => {
  const mapping: BranchColumnMapping = {
    ...MAPPING,
    prefecture: 4,
    address: 5,
    assignee: 6,
    note: 7,
  };
  const plan = buildImportPlan(
    [["みらい銀行", "0001", "渋谷支店", "001", "東京都", "渋谷区1-2-3", "田中 美咲", "重点支店"]],
    mapping,
    [],
    []
  );
  assert.equal(plan.rows[0].prefecture, "東京都");
  assert.equal(plan.rows[0].address, "渋谷区1-2-3");
  assert.equal(plan.rows[0].assignee, "田中 美咲");
  assert.equal(plan.rows[0].note, "重点支店");
});

test("buildImportPlan: 列数が足りない行でも落ちない", () => {
  const plan = buildImportPlan([["みらい銀行"]], MAPPING, [], []);
  assert.equal(plan.errorCount, 1);
});
