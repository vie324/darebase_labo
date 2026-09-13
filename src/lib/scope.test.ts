// 可視範囲の絞り込みのユニットテスト（node --test / 型ストリップで実行）
//   npm test
//
// このテストは supabase/migrations/0006_roles_rls.sql のポリシーと
// 1対1で対応する「期待表」も兼ねている。RLS を変えたらここも変える。

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  BACKOFFICE_ONLY_TABLES,
  HQ_ONLY_TABLES,
  OWN_SCOPE_TABLES,
  idSet,
  scopeRows,
  type ScopeContext,
} from "./scope.ts";
import type { RoleKey } from "./roles.ts";

const ORG_A = "org-a";
const ORG_B = "org-b";
const PARTNER_A = "partner-a";
const ME = "user-me";
const OTHER = "user-other";

function ctx(role: RoleKey, over: Partial<ScopeContext> = {}): ScopeContext {
  return {
    role,
    userId: ME,
    organizationId: role.startsWith("partner") ? ORG_A : null,
    partnerId: role.startsWith("partner") ? PARTNER_A : null,
    ...over,
  };
}

const BRANCHES = [
  { id: "br-1", assigned_org_id: ORG_A },
  { id: "br-2", assigned_org_id: ORG_B },
  { id: "br-3", assigned_org_id: null },
];

const APPOINTMENTS = [
  { id: "ap-1", organization_id: ORG_A, assigned_to: ME },
  { id: "ap-2", organization_id: ORG_A, assigned_to: OTHER },
  { id: "ap-3", organization_id: ORG_B, assigned_to: ME },
];

const DEALS = [
  { id: "d-1", organization_id: ORG_A, owner_id: ME },
  { id: "d-2", organization_id: ORG_A, owner_id: OTHER },
  { id: "d-3", organization_id: null, owner_id: ME },
];

// ---------- 本部ロール ----------

test("本部ロールはすべてのテーブルを全件見られる", () => {
  for (const role of ["executive", "backoffice", "manager", "member"] as RoleKey[]) {
    assert.equal(scopeRows("branches", BRANCHES, ctx(role)).length, 3);
    assert.equal(scopeRows("deals", DEALS, ctx(role)).length, 3);
    assert.equal(scopeRows("posts", [{ id: "p1" }], ctx(role)).length, 1);
    assert.equal(scopeRows("invoices", [{ id: "i1" }], ctx(role)).length, 1);
  }
});

test("ユーザー未確定(null)のときは絞り込まない", () => {
  assert.equal(scopeRows("deals", DEALS, null).length, 3);
});

// ---------- 代理店ロール: 遮断されるテーブル ----------

test("社内向けテーブルは代理店ユーザーには1行も返さない", () => {
  for (const table of HQ_ONLY_TABLES) {
    for (const role of ["partner_admin", "partner_member"] as RoleKey[]) {
      assert.deepEqual(scopeRows(table, [{ id: "x" }, { id: "y" }], ctx(role)), []);
    }
  }
});

test("応募者データは経営・管理部にしか見えない（本部の営業メンバーも不可）", () => {
  assert.ok(BACKOFFICE_ONLY_TABLES.includes("candidates"));
  const rows = [{ id: "cand-1" }, { id: "cand-2" }];
  for (const role of ["executive", "backoffice"] as RoleKey[]) {
    assert.equal(scopeRows("candidates", rows, ctx(role)).length, 2, role);
  }
  for (const role of ["manager", "member", "partner_admin", "partner_member"] as RoleKey[]) {
    assert.deepEqual(scopeRows("candidates", rows, ctx(role)), [], role);
  }
});

// ---------- 代理店ロール: 組織スコープ ----------

test("代理店は自社に割り当てられた支店だけ見える", () => {
  const rows = scopeRows("branches", BRANCHES, ctx("partner_admin"));
  assert.deepEqual(rows.map((r) => r.id), ["br-1"]);
});

test("代理店管理者は自社の全アポイント、メンバーは自分の担当分だけ", () => {
  assert.deepEqual(
    scopeRows("appointments", APPOINTMENTS, ctx("partner_admin")).map((r) => r.id),
    ["ap-1", "ap-2"]
  );
  assert.deepEqual(
    scopeRows("appointments", APPOINTMENTS, ctx("partner_member")).map((r) => r.id),
    ["ap-1"]
  );
});

test("商談ログは案件と同じスコープ（文字起こしに相手の発言が入るため）", () => {
  assert.deepEqual(
    scopeRows("meeting_logs", DEALS, ctx("partner_admin")).map((r) => r.id),
    ["d-1", "d-2"]
  );
  assert.deepEqual(
    scopeRows("meeting_logs", DEALS, ctx("partner_member")).map((r) => r.id),
    ["d-1"]
  );
  assert.deepEqual(scopeRows("meeting_logs", DEALS, ctx("executive")).length, 3);
});

test("代理店管理者は自社の全案件、メンバーは自分が担当する案件だけ", () => {
  assert.deepEqual(
    scopeRows("deals", DEALS, ctx("partner_admin")).map((r) => r.id),
    ["d-1", "d-2"]
  );
  assert.deepEqual(
    scopeRows("deals", DEALS, ctx("partner_member")).map((r) => r.id),
    ["d-1"]
  );
});

test("所属組織が未設定の代理店ユーザーは組織スコープの行を1件も見られない", () => {
  const orphan = ctx("partner_admin", { organizationId: null });
  assert.deepEqual(scopeRows("branches", BRANCHES, orphan), []);
  assert.deepEqual(scopeRows("deals", DEALS, orphan), []);
  assert.deepEqual(scopeRows("appointments", APPOINTMENTS, orphan), []);
});

test("代理店は自社の組織レコードだけ見える", () => {
  const rows = scopeRows(
    "organizations",
    [{ id: ORG_A }, { id: ORG_B }],
    ctx("partner_admin")
  );
  assert.deepEqual(rows.map((r) => r.id), [ORG_A]);
});

// ---------- 親子関係で絞るテーブル ----------

test("銀行は自社に割当のある支店を持つものだけ見える", () => {
  const visibleBranches = scopeRows("branches", BRANCHES, ctx("partner_admin"));
  const rows = scopeRows(
    "banks",
    [{ id: "bank-1" }, { id: "bank-2" }],
    ctx("partner_admin"),
    { visibleBankIds: new Set(["bank-1"]) }
  );
  assert.deepEqual(rows.map((r) => r.id), ["bank-1"]);
  // 親の絞り込み結果が渡らない場合は安全側（0件）に倒す
  assert.deepEqual(scopeRows("banks", [{ id: "bank-1" }], ctx("partner_admin")), []);
  assert.equal(visibleBranches.length, 1);
});

test("案件の活動履歴は見える案件のものだけ", () => {
  const visible = idSet(scopeRows("deals", DEALS, ctx("partner_member")));
  const rows = scopeRows(
    "deal_activities",
    [
      { id: "a1", deal_id: "d-1" },
      { id: "a2", deal_id: "d-2" },
    ],
    ctx("partner_member"),
    { visibleDealIds: visible }
  );
  assert.deepEqual(rows.map((r) => r.id), ["a1"]);
});

test("支店活動ログは見える支店のものだけ", () => {
  const rows = scopeRows(
    "branch_activities",
    [
      { id: "l1", branch_id: "br-1" },
      { id: "l2", branch_id: "br-2" },
    ],
    ctx("partner_admin"),
    { visibleBranchIds: idSet(scopeRows("branches", BRANCHES, ctx("partner_admin"))) }
  );
  assert.deepEqual(rows.map((r) => r.id), ["l1"]);
});

// ---------- 個人スコープ ----------

test("予定・タスク・名刺・ロープレは代理店ユーザー本人の行だけ", () => {
  for (const table of OWN_SCOPE_TABLES) {
    const rows = scopeRows(
      table,
      [
        { id: "own", owner_id: ME },
        { id: "others", owner_id: OTHER },
        { id: "legacy" }, // owner_id 未設定の既存行は見せない
      ],
      ctx("partner_member")
    );
    assert.deepEqual(rows.map((r) => r.id), ["own"], table);
  }
});

// ---------- 金額まわり ----------

test("代理店に見える請求書は自社宛の支払だけ", () => {
  const rows = scopeRows(
    "invoices",
    [
      { id: "in-1", direction: "payable", partner_id: PARTNER_A },
      { id: "in-2", direction: "receivable", partner_id: PARTNER_A },
      { id: "in-3", direction: "payable", partner_id: "partner-other" },
    ],
    ctx("partner_admin")
  );
  assert.deepEqual(rows.map((r) => r.id), ["in-1"]);
});

test("明細行は自社取り分の行だけ", () => {
  const rows = scopeRows(
    "statement_lines",
    [
      { id: "sl-1", agency_id: PARTNER_A },
      { id: "sl-2", agency_id: "partner-other" },
      { id: "sl-3", agency_id: null },
    ],
    ctx("partner_admin")
  );
  assert.deepEqual(rows.map((r) => r.id), ["sl-1"]);
});

// ---------- 共有テーブル ----------

test("営業資料・ナレッジ・スクリプト・勉強会は代理店にも見せる", () => {
  for (const table of ["documents", "knowledge", "scripts", "trainings"] as const) {
    assert.equal(scopeRows(table, [{ id: "x" }], ctx("partner_member")).length, 1, table);
  }
});
