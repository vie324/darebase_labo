// 販売協力 → 2次代理店 のユニットテスト
//   npm test

import { test } from "node:test";
import assert from "node:assert/strict";

import { partnerBranchDraft, partnerBranchOf, sameName, sameNameBranch } from "./partnership.ts";
import type { Branch, Deal } from "./types.ts";

function branch(over: Partial<Branch> & { id: string; bank_id: string; name: string }): Branch {
  return {
    code: "",
    address: "",
    prefecture: "",
    assigned_to: null,
    assigned_name: "",
    assigned_org_id: null,
    status: "active",
    last_contact_at: "",
    note: "",
    business_unit_id: "bu-alliance",
    updated_at: "2026-09-01T00:00:00Z",
    created_at: "2026-09-01T00:00:00Z",
    ...over,
  };
}

const DEAL: Deal = {
  id: "deal-1",
  created_at: "2026-09-01T00:00:00Z",
  name: "さくら建材 DDS導入",
  company: " 株式会社さくら建材 ",
  contact_name: "",
  stage: "partnership",
  amount: 0,
  probability: 0,
  expected_close: "2026-10-01",
  owner_name: "伊藤 翔",
  next_action: "",
  memo: "",
  updated_at: "2026-09-10T00:00:00Z",
  bank_id: "al-2",
  branch_id: "albr-al-2-201",
};

test("空白の有無だけ違う名前は同じとみなす（空欄同士は同じにしない）", () => {
  assert.equal(sameName("株式会社 さくら建材", "株式会社さくら建材"), true);
  assert.equal(sameName("株式会社　さくら建材", "株式会社さくら建材 "), true);
  assert.equal(sameName("さくら建材", "株式会社さくら建材"), false);
  assert.equal(sameName("", " "), false);
});

test("案件から登録した2次代理店を source_deal_id で探す", () => {
  const branches = [
    branch({ id: "b-1", bank_id: "al-2", name: "株式会社さくら建材", source_deal_id: "deal-1" }),
    branch({ id: "b-2", bank_id: "al-2", name: "別の会社" }),
  ];
  assert.equal(partnerBranchOf(branches, "deal-1")?.id, "b-1");
  assert.equal(partnerBranchOf(branches, "deal-2"), null);
});

test("同じ1次代理店の下の同名の窓口だけを重複とみなす", () => {
  const branches = [
    branch({ id: "b-1", bank_id: "al-2", name: "株式会社 さくら建材" }),
    branch({ id: "b-2", bank_id: "al-1", name: "株式会社ハルカ製作所" }),
  ];
  assert.equal(sameNameBranch(branches, "al-2", "株式会社さくら建材")?.id, "b-1");
  // 別の1次代理店の下にあるものは重複ではない
  assert.equal(sameNameBranch(branches, "al-1", "株式会社さくら建材"), null);
});

test("初期値は案件を紹介してくれた1次代理店・会社名・担当者を引き継ぐ", () => {
  const draft = partnerBranchDraft(DEAL, "member-ito");
  assert.equal(draft.bank_id, "al-2");
  assert.equal(draft.name, "株式会社さくら建材");
  assert.equal(draft.assigned_to, "member-ito");
  assert.match(draft.note, /さくら建材 DDS導入/);
});

test("紹介元の無い案件・担当が見つからない案件は空欄から始める", () => {
  const draft = partnerBranchDraft({ ...DEAL, bank_id: null }, null);
  assert.equal(draft.bank_id, "");
  assert.equal(draft.assigned_to, "");
});
