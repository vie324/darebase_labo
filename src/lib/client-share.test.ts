// クライアント共有リンクのユニットテスト
//   npm test
//
// collectShareRows は supabase/migrations/0015 の get_client_share と1対1。
// ここは「紹介元に何を見せて、何を見せないか」の期待表も兼ねる。

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildDemoSharePayload,
  clientProgressOf,
  clientStatusOf,
  collectShareRows,
  countByStatus,
  defaultShareTitle,
  expiresAtFrom,
  formatExpiry,
  generateShareToken,
  isValidShareToken,
  parseSharePayload,
  sanitizeCell,
  shareCsvRows,
  shareState,
  toClientRows,
  type ShareDataset,
} from "./client-share.ts";
import type {
  Appointment,
  Bank,
  Branch,
  BusinessUnit,
  CalendarEvent,
  ClientShare,
  Deal,
  DealProduct,
} from "./types.ts";

const NOW = new Date("2026-09-29T03:00:00Z"); // 2026-09-29 12:00 JST

function appointment(over: Partial<Appointment> & { id: string }): Appointment {
  return {
    bank_id: "bank-a",
    branch_id: "br-a1",
    assigned_to: null,
    assigned_name: "田中 美咲",
    organization_id: null,
    received_at: "2026-09-01",
    scheduled_at: "",
    company_name: "株式会社サンプル",
    industry: "製造",
    revenue_scale: "1〜5億円",
    contact_role: "decision_maker",
    source_note: "社内メモ（公開しない）",
    status: "scheduled",
    deal_id: null,
    event_id: null,
    business_unit_id: null,
    updated_at: "2026-09-01T00:00:00Z",
    created_at: "2026-09-01T00:00:00Z",
    ...over,
  };
}

function deal(over: Partial<Deal> & { id: string }): Deal {
  return {
    name: "案件",
    company: "株式会社サンプル",
    contact_name: "山田 太郎",
    stage: "appointment",
    amount: 9_999_999,
    probability: 30,
    expected_close: "2026-10-31",
    owner_name: "伊藤 翔",
    next_action: "",
    memo: "競合はA社（公開しない）",
    updated_at: "2026-09-10T00:00:00Z",
    created_at: "2026-09-05T00:00:00Z",
    bank_id: "bank-a",
    branch_id: "br-a1",
    confidence_rank: "C",
    ...over,
  };
}

const BRANCHES = [
  { id: "br-a1", name: "渋谷支店" },
  { id: "br-a2", name: "新宿支店" },
  { id: "br-b1", name: "別銀行の支店" },
] as Branch[];

function dataset(over: Partial<ShareDataset> = {}): ShareDataset {
  return { appointments: [], deals: [], dealProducts: [], branches: BRANCHES, events: [], ...over };
}

// ---------- どの行を見せるか ----------

test("紹介元のアポだけを出し、他の紹介元のアポは出さない", () => {
  const rows = collectShareRows(
    { bank_id: "bank-a", branch_id: null },
    dataset({
      appointments: [
        appointment({ id: "ap-1", company_name: "A社" }),
        appointment({ id: "ap-2", company_name: "B社", branch_id: "br-a2" }),
        appointment({ id: "ap-3", company_name: "他行の紹介", bank_id: "bank-b", branch_id: "br-b1" }),
      ],
    }),
    NOW
  );
  assert.deepEqual(rows.map((r) => r.company).sort(), ["A社", "B社"]);
});

test("窓口で絞ったリンクは、その窓口の紹介だけ", () => {
  const rows = collectShareRows(
    { bank_id: "bank-a", branch_id: "br-a2" },
    dataset({
      appointments: [
        appointment({ id: "ap-1", company_name: "A社" }),
        appointment({ id: "ap-2", company_name: "B社", branch_id: "br-a2" }),
      ],
      deals: [deal({ id: "d-direct", company: "C社", branch_id: "br-a1" })],
    }),
    NOW
  );
  assert.deepEqual(
    rows.map((r) => r.company),
    ["B社"]
  );
});

test("案件化したアポは1行にまとめ、案件のステージ・商材・更新日を付ける", () => {
  const rows = collectShareRows(
    { bank_id: "bank-a", branch_id: null },
    dataset({
      appointments: [appointment({ id: "ap-1", deal_id: "d-1", updated_at: "2026-09-02T00:00:00Z" })],
      deals: [deal({ id: "d-1", stage: "follow_up", appointment_id: "ap-1" })],
      dealProducts: [
        { id: "l-2", deal_id: "d-1", product_id: "p-ai", product_name: "AI", amount: 1, quantity: 1, memo: "", created_at: "2026-09-06T00:00:00Z" },
        { id: "l-1", deal_id: "d-1", product_id: "p-dds", product_name: "DDS", amount: 1, quantity: 1, memo: "", created_at: "2026-09-05T00:00:00Z" },
      ] as DealProduct[],
    }),
    NOW
  );
  assert.equal(rows.length, 1, "アポと案件で2行にならない");
  assert.equal(rows[0].deal_stage, "follow_up");
  assert.equal(rows[0].products, "DDS / AI");
  assert.equal(rows[0].updated_at, "2026-09-10T00:00:00Z", "新しい方の更新日");
  assert.equal(rows[0].channel, "渋谷支店");
});

test("アポを経ずに紹介元を付けて登録した案件も出す（商談日は紐づく予定から）", () => {
  const events = [
    { id: "ev-past", deal_id: "d-2", start_at: "2026-09-20T01:00:00Z" },
    { id: "ev-next", deal_id: "d-2", start_at: "2026-10-03T05:00:00Z" },
    { id: "ev-later", deal_id: "d-2", start_at: "2026-10-10T05:00:00Z" },
  ] as CalendarEvent[];
  const rows = collectShareRows(
    { bank_id: "bank-a", branch_id: null },
    dataset({ deals: [deal({ id: "d-2", company: "直紹介の会社", created_at: "2026-09-18T16:00:00Z" })], events }),
    NOW
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].appointment_status, "");
  assert.equal(rows[0].meeting_at, "2026-10-03T05:00:00Z", "次に来る商談");
  assert.equal(rows[0].referred_on, "2026-09-19", "登録日を日本時間で切る");
});

test("予定が過去のものしかなければ、最後の商談日を出す", () => {
  const events = [
    { id: "ev-1", deal_id: "d-2", start_at: "2026-09-01T01:00:00Z" },
    { id: "ev-2", deal_id: "d-2", start_at: "2026-09-20T01:00:00Z" },
  ] as CalendarEvent[];
  const rows = collectShareRows(
    { bank_id: "bank-a", branch_id: null },
    dataset({ deals: [deal({ id: "d-2" })], events }),
    NOW
  );
  assert.equal(rows[0].meeting_at, "2026-09-20T01:00:00Z");
});

test("紹介日の新しい順に並べる", () => {
  const rows = collectShareRows(
    { bank_id: "bank-a", branch_id: null },
    dataset({
      appointments: [
        appointment({ id: "ap-1", company_name: "古い", received_at: "2026-08-01" }),
        appointment({ id: "ap-2", company_name: "新しい", received_at: "2026-09-20" }),
      ],
    }),
    NOW
  );
  assert.deepEqual(
    rows.map((r) => r.company),
    ["新しい", "古い"]
  );
});

test("金額・メモ・確度・先方担当者は行に含めない", () => {
  const rows = collectShareRows(
    { bank_id: "bank-a", branch_id: null },
    dataset({
      appointments: [appointment({ id: "ap-1", deal_id: "d-1" })],
      deals: [deal({ id: "d-1" })],
    }),
    NOW
  );
  const json = JSON.stringify(rows);
  for (const secret of ["9999999", "競合はA社", "社内メモ", "山田 太郎", "1〜5億円", "probability", "confidence"]) {
    assert.ok(!json.includes(secret), `${secret} が公開行に入っている`);
  }
});

// ---------- 見せる言葉 ----------

test("案件化していれば案件のステージを、紹介元向けの言葉に置き換える", () => {
  const s = (deal_stage: string) => clientStatusOf({ deal_stage, appointment_status: "scheduled", meeting_at: "" });
  assert.equal(s("appointment"), "scheduled");
  assert.equal(s("follow_up"), "considering");
  assert.equal(s("po_wait"), "ordering");
  assert.equal(s("won"), "won");
  assert.equal(s("partnership"), "partnership");
  assert.equal(s("lost"), "declined");
});

test("未案件化のアポはアポのステータスから決める", () => {
  const s = (appointment_status: string, meeting_at = "") =>
    clientStatusOf({ deal_stage: "", appointment_status, meeting_at });
  assert.equal(s("scheduled"), "arranging", "日程未定");
  assert.equal(s("scheduled", "2026-10-01T01:00:00Z"), "scheduled");
  assert.equal(s("done"), "considering");
  assert.equal(s("won"), "won");
  assert.equal(s("lost"), "declined");
  assert.equal(s("cancelled"), "cancelled");
  assert.equal(s("something_new"), "arranging", "未知の値でも落ちない");
});

test("成約後の進捗は粗い言葉だけ（リース審査などの与信に関わる段階は出さない）", () => {
  const p = (fulfillment_status: string) =>
    clientProgressOf({ deal_stage: "won", appointment_status: "", meeting_at: "", fulfillment_status });
  assert.equal(p("lease_review"), "お手続き中");
  assert.equal(p("quote_sent"), "お手続き中");
  assert.equal(p("install_schedule"), "設置準備中");
  assert.equal(p("install_work"), "設置準備中");
  assert.equal(p("install_done"), "開通済み");
  assert.equal(p(""), "");
  // 成約していなければ進捗は出さない
  assert.equal(
    clientProgressOf({ deal_stage: "follow_up", appointment_status: "", meeting_at: "", fulfillment_status: "contract" }),
    ""
  );
});

test("ステータスごとの件数", () => {
  const rows = toClientRows([
    { referred_on: "", company: "", channel: "", meeting_at: "", appointment_status: "cancelled", deal_stage: "", fulfillment_status: "", products: "", owner: "", updated_at: "" },
    { referred_on: "", company: "", channel: "", meeting_at: "", appointment_status: "", deal_stage: "won", fulfillment_status: "", products: "", owner: "", updated_at: "" },
    { referred_on: "", company: "", channel: "", meeting_at: "", appointment_status: "", deal_stage: "won", fulfillment_status: "", products: "", owner: "", updated_at: "" },
  ]);
  const counts = countByStatus(rows);
  assert.equal(counts.won, 2);
  assert.equal(counts.cancelled, 1);
  assert.equal(counts.considering, 0);
});

// ---------- CSV ----------

test("CSV は日本時間で、見せる言葉のまま出す", () => {
  const rows = toClientRows([
    {
      referred_on: "2026-09-01",
      company: "株式会社サンプル",
      channel: "渋谷支店",
      meeting_at: "2026-09-03T05:30:00Z",
      appointment_status: "",
      deal_stage: "won",
      fulfillment_status: "install_done",
      products: "DDS / AI",
      owner: "田中 美咲",
      updated_at: "2026-09-28T15:10:00Z",
    },
  ]);
  const { headers, body } = shareCsvRows(rows, "支店");
  assert.deepEqual(headers, ["紹介日", "企業名", "支店", "商談日", "ステータス", "進捗", "商材", "担当", "最終更新"]);
  assert.deepEqual(body[0], [
    "2026-09-01",
    "株式会社サンプル",
    "渋谷支店",
    "2026-09-03 14:30",
    "ご成約",
    "開通済み",
    "DDS / AI",
    "田中 美咲",
    "2026-09-29 00:10",
  ]);
});

test("式として動く先頭文字は無害化する（CSV インジェクション対策）", () => {
  assert.equal(sanitizeCell("=HYPERLINK(\"http://evil\")"), "'=HYPERLINK(\"http://evil\")");
  assert.equal(sanitizeCell("+81"), "'+81");
  assert.equal(sanitizeCell("-1"), "'-1");
  assert.equal(sanitizeCell("@SUM(A1)"), "'@SUM(A1)");
  assert.equal(sanitizeCell("株式会社サンプル"), "株式会社サンプル");
  assert.equal(sanitizeCell("2026-09-01"), "2026-09-01");
  assert.equal(sanitizeCell(""), "");
});

// ---------- リンク ----------

test("トークンは推測できない長さで、毎回ちがう", () => {
  const a = generateShareToken();
  const b = generateShareToken();
  assert.notEqual(a, b);
  assert.ok(isValidShareToken(a), a);
  assert.ok(a.length >= 43);
});

test("短い・記号入りのトークンは受け付けない", () => {
  assert.equal(isValidShareToken("abc"), false);
  assert.equal(isValidShareToken("a".repeat(31)), false);
  assert.equal(isValidShareToken("a".repeat(32)), true);
  assert.equal(isValidShareToken("a".repeat(40) + "'; drop"), false);
});

test("停止中・期限切れ・公開中の判定", () => {
  assert.equal(shareState({ is_active: false, expires_at: null }, NOW), "stopped");
  assert.equal(shareState({ is_active: true, expires_at: "2026-09-28T00:00:00Z" }, NOW), "expired");
  assert.equal(shareState({ is_active: true, expires_at: "2026-10-28T00:00:00Z" }, NOW), "active");
  assert.equal(shareState({ is_active: true, expires_at: null }, NOW), "active", "無期限");
});

test("有効期限は期限日の終わりまで。無期限は null", () => {
  const exp = expiresAtFrom(30, new Date(2026, 8, 29, 12, 0));
  const d = new Date(exp!);
  assert.equal(d.getMonth(), 9); // 10月
  assert.equal(d.getDate(), 29);
  assert.equal(d.getHours(), 23);
  assert.equal(expiresAtFrom(null, NOW), null);
});

test("有効期限は年まで表示する（日本時間）", () => {
  assert.equal(formatExpiry("2027-02-26T14:59:59Z"), "2027/2/26");
  assert.equal(formatExpiry("2027-02-26T15:00:00Z"), "2027/2/27", "日本時間で日付が変わる");
  assert.equal(formatExpiry(null), "無期限");
});

test("見出しの初期値", () => {
  assert.equal(defaultShareTitle("みらい銀行"), "みらい銀行 様 ご紹介案件の進捗");
  assert.equal(defaultShareTitle("みらい銀行", "渋谷支店"), "みらい銀行 渋谷支店 様 ご紹介案件の進捗");
});

// ---------- 公開ページのデータ ----------

// get_client_share（supabase/migrations/0015）が実際に返した JSON と同じ形
const RPC_SAMPLE = {
  ok: true,
  rows: [
    {
      owner: "Tanaka",
      channel: "Direct",
      company: "Haruka Mfg",
      products: "DDS / AI",
      deal_stage: "won",
      meeting_at: "2026-09-03T05:30:00.000Z",
      updated_at: "2026-09-20T00:00:00.000Z",
      referred_on: "2026-09-01",
      appointment_status: "won",
      fulfillment_status: "install_done",
    },
  ],
  unit: "alliance",
  title: "Bridge all",
  source: "Bridge Partners",
  channel: null,
  expires_at: null,
  generated_at: "2026-09-29T09:50:48.572Z",
};

test("関数の返り値を取り込む（成功）", () => {
  const r = parseSharePayload(RPC_SAMPLE);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.data.source, "Bridge Partners");
  assert.equal(r.data.unit, "alliance");
  assert.equal(r.data.channel, null);
  assert.equal(r.data.rows[0].company, "Haruka Mfg");
  assert.equal(toClientRows(r.data.rows)[0].progress, "開通済み");
});

test("関数の返り値を取り込む（失敗・想定外の形）", () => {
  assert.deepEqual(parseSharePayload({ ok: false, error: "expired" }), { ok: false, error: "expired" });
  assert.deepEqual(parseSharePayload({ ok: false, error: "not_found" }), { ok: false, error: "not_found" });
  assert.deepEqual(parseSharePayload(null), { ok: false, error: "unavailable" });
  assert.deepEqual(parseSharePayload("oops"), { ok: false, error: "unavailable" });
  // 行の中身が壊れていても落ちない
  const r = parseSharePayload({ ok: true, rows: [null, { company: 1 }] });
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.data.rows[1].company, "");
});

test("デモモードでも関数と同じ判定（停止中は無いのと同じ・期限切れは期限切れ）", () => {
  const base: ClientShare = {
    id: "s-1",
    created_at: "2026-09-01T00:00:00Z",
    token: "t".repeat(40),
    title: "見出し",
    bank_id: "bank-a",
    branch_id: null,
    business_unit_id: "bu-a",
    expires_at: null,
    is_active: true,
    note: "社内メモ",
    created_by: "",
    last_accessed_at: null,
    access_count: 0,
    updated_at: "2026-09-01T00:00:00Z",
  };
  const tables = {
    ...dataset({ appointments: [appointment({ id: "ap-1" })] }),
    banks: [{ id: "bank-a", name: "みらい銀行", business_unit_id: "bu-a" }] as Bank[],
    units: [{ id: "bu-a", slug: "banking" }] as BusinessUnit[],
  };
  const ok = buildDemoSharePayload(base.token, { ...tables, shares: [base] }, NOW);
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.equal(ok.data.source, "みらい銀行");
    assert.equal(ok.data.rows.length, 1);
    assert.ok(!JSON.stringify(ok.data).includes("社内メモ"), "社内メモは出さない");
  }
  assert.deepEqual(
    buildDemoSharePayload(base.token, { ...tables, shares: [{ ...base, is_active: false }] }, NOW),
    { ok: false, error: "not_found" }
  );
  assert.deepEqual(
    buildDemoSharePayload(
      base.token,
      { ...tables, shares: [{ ...base, expires_at: "2026-09-01T00:00:00Z" }] },
      NOW
    ),
    { ok: false, error: "expired" }
  );
  assert.deepEqual(buildDemoSharePayload("short", { ...tables, shares: [base] }, NOW), {
    ok: false,
    error: "not_found",
  });
});
