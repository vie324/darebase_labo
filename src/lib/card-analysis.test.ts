// 名刺読み取りのユニットテスト
//   npm test

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CARD_FIELD_KEYS,
  CARD_FIELD_LABELS,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_EDGE,
  filledFieldsOf,
  uncertainLabelsOf,
  type CardRead,
} from "./card-analysis.ts";

function read(over: Partial<CardRead> = {}): CardRead {
  return {
    name: "",
    name_kana: "",
    company: "",
    department: "",
    title: "",
    email: "",
    phone: "",
    mobile: "",
    address: "",
    website: "",
    uncertain_fields: [],
    is_business_card: true,
    note: "",
    ...over,
  };
}

test("値の入っている項目だけを取り出す", () => {
  const parsed = filledFieldsOf(read({ name: "山田 太郎", company: "株式会社テスト" }));
  assert.deepEqual(parsed, { name: "山田 太郎", company: "株式会社テスト" });
});

test("空文字と空白だけの項目は取り込まない（推測で埋めさせないため）", () => {
  assert.deepEqual(filledFieldsOf(read({ name: "", company: "   ", title: "　" })), {});
});

test("前後の空白は落とす", () => {
  assert.deepEqual(filledFieldsOf(read({ name: "  山田 太郎  " })), { name: "山田 太郎" });
});

test("自信がない項目をラベルにして返す", () => {
  const labels = uncertainLabelsOf(
    read({ name: "髙橋 健一", company: "株式会社テスト", uncertain_fields: ["name"] })
  );
  assert.deepEqual(labels, ["氏名"]);
});

test("値が入っていない項目は「要確認」に出さない", () => {
  // AIが uncertain に挙げても、空欄なら確認しようがない
  const labels = uncertainLabelsOf(read({ name: "", uncertain_fields: ["name"] }));
  assert.deepEqual(labels, []);
});

test("知らないキーが混ざっても落ちない", () => {
  const labels = uncertainLabelsOf(
    read({ name: "山田 太郎", uncertain_fields: ["name", "fax", "なにか"] })
  );
  assert.deepEqual(labels, ["氏名"]);
});

test("フォームに流す項目すべてにラベルがある", () => {
  for (const key of CARD_FIELD_KEYS) {
    assert.equal(typeof CARD_FIELD_LABELS[key], "string", key);
    assert.notEqual(CARD_FIELD_LABELS[key], "", key);
  }
});

test("補助情報（is_business_card など）はフォームに流さない", () => {
  const keys = CARD_FIELD_KEYS as readonly string[];
  for (const key of ["uncertain_fields", "is_business_card", "note"]) {
    assert.equal(keys.includes(key), false, key);
  }
});

test("画像の上限はAPIが受け取れる範囲に収まっている", () => {
  // Claude の画像は 5MB まで。base64 で送るので余裕を持たせる
  assert.ok(MAX_IMAGE_BYTES < 5_000_000);
  // 名刺の文字が読める程度の解像度は確保する
  assert.ok(MAX_IMAGE_EDGE >= 1200);
});
