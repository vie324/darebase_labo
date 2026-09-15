// 支店のかんたん入力のユニットテスト
//   npm test

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildQuickRows,
  parseBranchLine,
  parseBranchLines,
  QUICK_ADD_MAPPING,
} from "./branch-quick-add.ts";
import { buildImportPlan } from "./branch-import.ts";
import type { Bank, Branch } from "./types.ts";

function parsed(line: string) {
  const b = parseBranchLine(line);
  return b === null ? null : { name: b.name, code: b.code, prefecture: b.prefecture, address: b.address };
}

// ---------- 1行の解析 ----------

test("支店名だけの行を取り込める", () => {
  assert.deepEqual(parsed("中央支店"), {
    name: "中央支店",
    code: "",
    prefecture: "",
    address: "",
  });
});

test("空行・コメント行は取り込まない", () => {
  for (const line of ["", "   ", "\t", "# みらい銀行のぶん", "// メモ"]) {
    assert.equal(parseBranchLine(line), null, JSON.stringify(line));
  }
});

test("区切りはタブ・カンマ・全角カンマ・読点・2つ以上の空白", () => {
  const expected = { name: "中央支店", code: "001", prefecture: "", address: "" };
  for (const line of ["中央支店\t001", "中央支店,001", "中央支店，001", "中央支店、001", "中央支店  001"]) {
    assert.deepEqual(parsed(line), expected, line);
  }
});

test("コードが先に来ていても支店名と取り違えない", () => {
  assert.deepEqual(parsed("001\t中央支店"), {
    name: "中央支店",
    code: "001",
    prefecture: "",
    address: "",
  });
});

test("括弧書き・空白区切りの支店コードを名前から剥がす", () => {
  assert.deepEqual(parsed("中央支店(001)"), {
    name: "中央支店",
    code: "001",
    prefecture: "",
    address: "",
  });
  assert.deepEqual(parsed("中央支店（001）"), {
    name: "中央支店",
    code: "001",
    prefecture: "",
    address: "",
  });
  assert.deepEqual(parsed("中央支店 001"), {
    name: "中央支店",
    code: "001",
    prefecture: "",
    address: "",
  });
});

test("行頭の連番は取り除くが、支店コードは残す", () => {
  assert.deepEqual(parsed("1. 中央支店"), {
    name: "中央支店",
    code: "",
    prefecture: "",
    address: "",
  });
  assert.deepEqual(parsed("2）丸の内支店"), {
    name: "丸の内支店",
    code: "",
    prefecture: "",
    address: "",
  });
  // カンマ・読点・空白で区切られた数字は連番ではなく支店コードとして扱う
  for (const line of ["001 中央支店", "001,中央支店", "001、中央支店"]) {
    assert.deepEqual(
      parsed(line),
      { name: "中央支店", code: "001", prefecture: "", address: "" },
      line
    );
  }
});

test("都道府県と住所を拾う（順番は問わない）", () => {
  assert.deepEqual(parsed("中央支店\t001\t東京都\t千代田区丸の内1-1-1"), {
    name: "中央支店",
    code: "001",
    prefecture: "東京都",
    address: "千代田区丸の内1-1-1",
  });
  assert.deepEqual(parsed("東京都,中央支店,001"), {
    name: "中央支店",
    code: "001",
    prefecture: "東京都",
    address: "",
  });
});

test("都道府県から続く住所は切り分ける", () => {
  assert.deepEqual(parsed("中央支店\t東京都千代田区丸の内1-1-1"), {
    name: "中央支店",
    code: "",
    prefecture: "東京都",
    address: "千代田区丸の内1-1-1",
  });
});

test("全角数字のコードは半角に直す", () => {
  assert.deepEqual(parsed("中央支店\t００１"), {
    name: "中央支店",
    code: "001",
    prefecture: "",
    address: "",
  });
});

test("5桁以上の数字は支店コードとして扱わない（電話番号などを拾わない）", () => {
  assert.deepEqual(parsed("中央支店\t0312345678"), {
    name: "中央支店",
    code: "",
    prefecture: "",
    address: "0312345678",
  });
});

test("コードだけの行は支店名が無いので取り込まない", () => {
  assert.equal(parseBranchLine("001"), null);
});

test("支店名に空白が1つ入っていても壊さない", () => {
  assert.deepEqual(parsed("JR 新宿支店"), {
    name: "JR 新宿支店",
    code: "",
    prefecture: "",
    address: "",
  });
});

// ---------- 複数行 ----------

test("行番号は空行も数える（貼り付けた位置と対応させるため）", () => {
  const rows = parseBranchLines("中央支店\n\n丸の内支店\n");
  assert.deepEqual(
    rows.map((r) => [r.lineNo, r.name]),
    [
      [1, "中央支店"],
      [3, "丸の内支店"],
    ]
  );
});

test("CRLF で貼り付けても行が崩れない", () => {
  assert.equal(parseBranchLines("中央支店\r\n丸の内支店\r\n").length, 2);
});

// ---------- 取込プランとの接続 ----------

const BANK: Bank = {
  id: "bank-1",
  name: "みらい銀行",
  code: "0011",
  is_active: true,
  business_unit_id: null,
  created_at: "2026-01-01T00:00:00Z",
};

function branch(over: Partial<Branch> & { id: string; name: string }): Branch {
  return {
    bank_id: "bank-1",
    code: "",
    prefecture: "",
    address: "",
    assigned_to: null,
    assigned_name: "",
    assigned_org_id: null,
    status: "active",
    last_contact_at: "",
    note: "",
    business_unit_id: null,
    updated_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

test("既存の銀行に貼り付けると、新規と更新に振り分けられる", () => {
  const rows = buildQuickRows("中央支店\t001\n丸の内支店\t002", {
    name: "みらい銀行",
    code: "0011",
  });
  const plan = buildImportPlan(
    rows,
    QUICK_ADD_MAPPING,
    [BANK],
    [branch({ id: "br-1", name: "中央支店", code: "001" })],
    0
  );
  assert.equal(plan.createCount, 1);
  assert.equal(plan.updateCount, 1);
  assert.equal(plan.newBanks.length, 0);
  assert.equal(plan.rows[0].action, "update");
  assert.equal(plan.rows[1].action, "create");
});

test("新しい銀行名で貼り付けると銀行も1件だけ作られる", () => {
  const rows = buildQuickRows("中央支店\n丸の内支店", { name: "さくら信用金庫", code: "1234" });
  const plan = buildImportPlan(rows, QUICK_ADD_MAPPING, [BANK], [], 0);
  assert.equal(plan.createCount, 2);
  assert.deepEqual(plan.newBanks, [{ name: "さくら信用金庫", code: "1234" }]);
});

test("貼り付けた中に同じ支店が2回あればスキップされる", () => {
  const rows = buildQuickRows("中央支店\n中央支店", { name: "みらい銀行", code: "0011" });
  const plan = buildImportPlan(rows, QUICK_ADD_MAPPING, [BANK], [], 0);
  assert.equal(plan.createCount, 1);
  assert.equal(plan.skipCount, 1);
});

test("行番号は1始まりで振られる（見出し行が無いため）", () => {
  const rows = buildQuickRows("中央支店", { name: "みらい銀行", code: "0011" });
  const plan = buildImportPlan(rows, QUICK_ADD_MAPPING, [BANK], [], 0);
  assert.equal(plan.rows[0].lineNo, 1);
});
