// ロールと権限の対応表のユニットテスト
//   npm test
//
// ここは画面の出し分けの「唯一の正」なので、意図しない権限の増減を
// テストで止める。実際のデータ分離は RLS 側（supabase/migrations）。

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ROLE_KEYS,
  can,
  isHqRole,
  isPartnerRole,
  normalizeRole,
  type Capability,
  type RoleKey,
} from "./roles.ts";

const HQ: RoleKey[] = ["executive", "backoffice", "manager", "member"];
const PARTNER: RoleKey[] = ["partner_admin", "partner_member"];

function rolesWith(cap: Capability): RoleKey[] {
  return ROLE_KEYS.filter((r) => can(r, cap));
}

// ---------- 銀行・支店マスタ ----------

test("銀行・支店の登録は本部社員全員ができる", () => {
  for (const role of HQ) {
    assert.equal(can(role, "master_add"), true, role);
  }
});

test("銀行・支店の削除と担当の一括振り替えはマネージャー以上だけ", () => {
  assert.deepEqual(rolesWith("master_edit"), ["executive", "backoffice", "manager"]);
  assert.equal(can("member", "master_edit"), false);
});

test("代理店ユーザーは銀行・支店を登録も編集もできない", () => {
  for (const role of PARTNER) {
    assert.equal(can(role, "master_add"), false, role);
    assert.equal(can(role, "master_edit"), false, role);
  }
});

// ---------- そのほかの権限の線引き ----------

test("経営数値・請求・採用は経営と管理部まで", () => {
  assert.deepEqual(rolesWith("billing"), ["executive", "backoffice"]);
  assert.deepEqual(rolesWith("recruiting"), ["executive", "backoffice"]);
  assert.deepEqual(rolesWith("executive_dashboard"), ["executive"]);
});

test("ロール付与ができるのは経営だけ", () => {
  assert.deepEqual(rolesWith("role_admin"), ["executive"]);
});

test("勤怠・経費・評価の承認はマネージャーには無い（管理部の仕事）", () => {
  assert.deepEqual(rolesWith("hr_admin"), ["executive", "backoffice"]);
  // 自分の勤怠・経費は本部社員全員
  assert.deepEqual(rolesWith("hr_self"), HQ);
});

test("代理店ユーザーには画面の権限を1つも与えない（見える範囲は RLS が決める）", () => {
  for (const role of PARTNER) {
    for (const cap of [
      "executive_dashboard",
      "billing",
      "internal_comms",
      "scheduling_poll",
      "content_edit",
      "master_add",
      "master_edit",
      "settings_admin",
      "role_admin",
      "all_sales_data",
      "recruiting",
      "hr_self",
      "hr_admin",
    ] as Capability[]) {
      assert.equal(can(role, cap), false, `${role}/${cap}`);
    }
  }
});

// ---------- ロールの判定 ----------

test("所属区分の判定", () => {
  for (const role of HQ) assert.equal(isHqRole(role), true, role);
  for (const role of PARTNER) assert.equal(isPartnerRole(role), true, role);
});

test("ロール未確定のときは何も許可しない（安全側）", () => {
  assert.equal(can(null, "master_add"), false);
  assert.equal(can(undefined, "master_edit"), false);
  assert.equal(isHqRole(null), false);
  assert.equal(isPartnerRole(null), false);
});

test("DBから来た未知の文字列は一般社員として扱う", () => {
  assert.equal(normalizeRole("admin"), "member");
  assert.equal(normalizeRole(null), "member");
  assert.equal(normalizeRole(42), "member");
  assert.equal(normalizeRole("executive"), "executive");
});
