// アライアンスの実績集計（日報・月次集計・月次実績）のユニットテスト
//   npm test
//
// ★案件管理表★『全体管理』の数え方（紹介日・商談実施日・成約日で月に振る）を、
// 小さな案件の集まりで確かめる。

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  achievement,
  agencyStarts,
  buildReferrals,
  byAgency,
  closeRateOf,
  closings,
  cumAgenciesAt,
  dailyReportText,
  inMonth,
  newAgenciesIn,
  onDay,
  partnershipFunnel,
  planBreakdown,
  planVsActual,
  prospectsByAgency,
  tally,
  anyDate,
  DIRECT_KEY,
} from "./alliance-kpi.ts";
import { lineMoney } from "./alliance.ts";
import { DEFAULT_ALLIANCE_PLAN, buildPlan } from "./alliance-plan.ts";
import type { Appointment, Bank, Deal, DealProduct, Product } from "./types.ts";

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
const PRODUCTS = [PLAN10, PLAN50, DEVICE];

function line(dealId: string, p: Product, quantity: number): DealProduct {
  return {
    id: `${dealId}-${p.id}`,
    created_at: "2026-10-01T00:00:00Z",
    deal_id: dealId,
    product_id: p.id,
    product_name: p.name,
    quantity,
    memo: "",
    ...lineMoney(p, quantity),
  };
}

function bank(id: string, name: string, order: number): Bank {
  return {
    id,
    name,
    code: "",
    is_active: true,
    business_unit_id: "bu-alliance",
    created_at: `2026-08-0${order}T00:00:00Z`,
  };
}

const BANKS = [bank("miyata", "宮田先生", 1), bank("rafuru", "ラフール", 2), bank("matsu", "松橋社長", 3)];

function deal(over: Partial<Deal> & { id: string }): Deal {
  return {
    created_at: "2026-11-09T00:00:00Z",
    name: over.company ?? "",
    company: "",
    contact_name: "",
    stage: "appointment",
    amount: 0,
    probability: 10,
    expected_close: "2026-12-31",
    owner_name: "",
    next_action: "",
    memo: "",
    updated_at: "2026-11-09T00:00:00Z",
    business_unit_id: "bu-alliance",
    ...over,
  };
}

// 全体管理の抜粋（数字はシートのまま）
const DEALS: Deal[] = [
  deal({ id: "smile", company: "スマイルエンジン", bank_id: "rafuru", referred_at: "2026-09-01", visited_at: "2026-09-04", deal_kind: "partnership", stage: "partnership", partnership_phase: "first_referral", partnership_contracted_at: "2026-09-30" }),
  deal({ id: "ng", company: "ネクストゲート", bank_id: "miyata", referred_at: "2026-09-02", visited_at: "2026-09-08", deal_kind: "sales", stage: "won", sales_phase: "won", contracted_at: "2026-09-30", partnership_phase: "first_referral" }),
  deal({ id: "dk", company: "ディーケー", bank_id: "miyata", referred_at: "2026-09-03", visited_at: "2026-09-11", deal_kind: "sales_partnership", stage: "follow_up", confidence_rank: "C", sales_phase: "prospect_c", partnership_phase: "contracted", partnership_contracted_at: "2026-09-30" }),
  deal({ id: "solu", company: "ソルー", bank_id: null, referred_at: "2026-09-17", visited_at: "2026-09-18", deal_kind: "sales", stage: "won", sales_phase: "lease_url", contracted_at: "2026-09-30" }),
  deal({ id: "cosmo", company: "コスモ技研", bank_id: "rafuru", referred_at: "2026-10-09", visited_at: "2026-10-21", deal_kind: "sales", stage: "won", sales_phase: "won", contracted_at: "2026-10-30" }),
  deal({ id: "denken", company: "デンケン", bank_id: "matsu", referred_at: "2026-10-13", visited_at: "2026-10-26", deal_kind: "sales", stage: "lost", sales_phase: "lost", lost_at: "2026-10-26" }),
  deal({ id: "teraya", company: "寺谷組", bank_id: "matsu", referred_at: "2026-10-13", visited_at: "2026-10-26", deal_kind: "sales", stage: "follow_up", confidence_rank: "B", sales_phase: "prospect_b" }),
  deal({ id: "sugoru", company: "スーゴル", bank_id: null, referred_at: "2026-09-22", deal_kind: "sales", stage: "follow_up", confidence_rank: "B", sales_phase: "prospect_b" }),
  deal({ id: "kitasetsu", company: "キタセツ", bank_id: "matsu", referred_at: "2026-11-04", visited_at: "2026-11-12", deal_kind: "sales", stage: "appointment", sales_phase: "waiting" }),
];

const LINES: DealProduct[] = [
  line("ng", PLAN10, 1),
  line("ng", DEVICE, 3),
  line("solu", PLAN50, 1),
  line("solu", DEVICE, 2),
  line("cosmo", PLAN50, 1),
  line("cosmo", DEVICE, 1),
  line("teraya", PLAN50, 1),
];

// まだ案件にしていない紹介アポ（11/6 に紹介を受けた）と、案件化済みのアポ（数えない）
const APPOINTMENTS: Appointment[] = [
  {
    id: "a-agent",
    created_at: "2026-11-06T00:00:00Z",
    bank_id: "matsu",
    branch_id: null,
    assigned_to: null,
    assigned_name: "",
    organization_id: null,
    received_at: "2026-11-06",
    scheduled_at: "",
    company_name: "大英組",
    industry: "",
    revenue_scale: "",
    contact_role: "",
    source_note: "",
    status: "scheduled",
    deal_id: null,
    event_id: null,
    business_unit_id: "bu-alliance",
    updated_at: "2026-11-06T00:00:00Z",
  },
  {
    id: "a-done",
    created_at: "2026-11-01T00:00:00Z",
    bank_id: "matsu",
    branch_id: null,
    assigned_to: null,
    assigned_name: "",
    organization_id: null,
    received_at: "2026-11-01",
    scheduled_at: "2026-11-04T05:00:00Z",
    company_name: "キタセツ",
    industry: "",
    revenue_scale: "",
    contact_role: "",
    source_note: "",
    status: "done",
    deal_id: "kitasetsu",
    event_id: null,
    business_unit_id: "bu-alliance",
    updated_at: "2026-11-06T00:00:00Z",
  },
];

const REFS = buildReferrals({ deals: DEALS, lines: LINES, products: PRODUCTS, appointments: APPOINTMENTS });

test("紹介の一覧：案件＋未案件化のアポ（案件化済みのアポは二重に数えない）", () => {
  assert.equal(REFS.length, DEALS.length + 1);
  const agent = REFS.find((r) => r.company === "大英組")!;
  assert.equal(agent.dealId, null);
  assert.equal(agent.referredOn, "2026-11-06");
  assert.equal(agent.metOn, "");
});

test("9月の集計（全体管理の当月実績と同じ数え方）", () => {
  const t = tally(REFS, inMonth("2026-09"));
  assert.equal(t.referrals, 5); // スマイル・ネクストゲート・ディーケー・ソルー・スーゴル
  assert.deepEqual(t.referralsByKind, { sales: 3, partnership: 1, sales_partnership: 1 });
  assert.equal(t.meetings, 4);
  assert.equal(t.salesMeetings, 3);
  assert.equal(t.closings, 2); // ネクストゲート・ソルー（成約日 9/30）
  assert.equal(t.devices, 5);
  assert.equal(t.sales, 811_200 + 847_200 + 1_852_800 + 564_800);
  assert.equal(t.fee, 500_000); // ソルーは直販なので報酬ゼロ
  // 販売協力フェーズが「契約締結」以降のもの。商談種別は問わない（日報生成と同じ）：
  // スマイル（初回紹介済み）・ディーケー（契約締結）・ネクストゲート（セールスだが初回紹介済み）
  assert.equal(t.partnershipContracts, 3);
  assert.equal(closeRateOf(t), 40);
});

test("10月：成約1（コスモ技研）・ロスト1（デンケン）", () => {
  const t = tally(REFS, inMonth("2026-10"));
  assert.equal(t.referrals, 3);
  assert.equal(t.closings, 1);
  assert.equal(t.lost, 1);
  assert.equal(t.sales, 2_135_200);
  assert.equal(t.profit, 815_200);
  assert.equal(t.fee, 1_200_000);
});

test("日報：指定日の紹介・商談", () => {
  const day = tally(REFS, onDay("2026-11-06"));
  assert.equal(day.referrals, 1); // アポだけの紹介も数える
  assert.equal(tally(REFS, onDay("2026-11-12")).meetings, 1);
});

test("代理店数：初めて紹介が来た月が新規獲得、月末までの社数が累計（直販は数えない）", () => {
  const starts = agencyStarts(REFS);
  assert.deepEqual(Object.fromEntries(starts), {
    rafuru: "2026-09-01",
    miyata: "2026-09-02",
    matsu: "2026-10-13",
  });
  assert.equal(newAgenciesIn(starts, "2026-09"), 2);
  assert.equal(newAgenciesIn(starts, "2026-10"), 1);
  assert.equal(cumAgenciesAt(starts, "2026-09"), 2);
  assert.equal(cumAgenciesAt(starts, "2026-11"), 3);
});

test("計画対比（月次実績）：達成率と代理店報酬の累計", () => {
  const rows = planVsActual(buildPlan(DEFAULT_ALLIANCE_PLAN), REFS);
  assert.equal(rows.length, 8);
  const [sep, oct, nov] = rows;
  assert.equal(sep.plan.referrals, 10);
  assert.equal(sep.actual.referrals, 5);
  assert.equal(achievement(sep.actual.referrals, sep.plan.referrals), 50);
  assert.equal(sep.actual.newAgencies, 2);
  assert.equal(sep.actual.perAgencyReferrals, 2.5);
  assert.equal(oct.actual.cumFee, 1_700_000);
  assert.equal(nov.actual.cumFee, 1_700_000);
  assert.equal(nov.actual.referrals, 2); // キタセツ（案件）＋大英組（アポ）
  assert.equal(achievement(0, 0), null);
});

test("1次代理店別：マスタの並び＋直販。紹介ゼロの代理店も行を出す", () => {
  const rows = byAgency(REFS, BANKS, inMonth("2026-09"));
  assert.deepEqual(
    rows.map((r) => [r.name, r.tally.referrals, r.tally.closings]),
    [
      ["宮田先生", 2, 1],
      ["ラフール", 1, 0],
      ["松橋社長", 0, 0],
      ["直販", 2, 1],
    ]
  );
  const all = byAgency(REFS, BANKS, anyDate);
  assert.equal(all.find((r) => r.key === "rafuru")!.tally.fee, 1_200_000);
  assert.equal(all.find((r) => r.key === DIRECT_KEY)!.tally.fee, 0);
});

test("見込み分析：確度A/B/Cの件数と見込み金額（プラン未定は件数だけ）", () => {
  const rows = prospectsByAgency(REFS, BANKS);
  const matsu = rows.find((r) => r.key === "matsu")!;
  assert.deepEqual([matsu.A, matsu.B, matsu.C, matsu.count], [0, 1, 0, 1]);
  assert.equal(matsu.sales, 1_852_800);
  assert.equal(matsu.fee, 1_200_000);
  const miyata = rows.find((r) => r.key === "miyata")!;
  assert.deepEqual([miyata.C, miyata.noPlan], [1, 1]);
  const direct = rows.find((r) => r.key === DIRECT_KEY)!;
  assert.deepEqual([direct.B, direct.noPlan], [1, 1]);
});

test("プラン別の実績件数と成約明細", () => {
  const [sep, oct] = planBreakdown(REFS, ["2026-09", "2026-10"]);
  assert.deepEqual(sep.counts, { プラン10: 1, プラン50: 1 });
  assert.equal(sep.devices, 5);
  assert.equal(sep.contracts, 2);
  assert.deepEqual(oct.counts, { プラン50: 1 });
  assert.deepEqual(
    closings(REFS).map((r) => r.company),
    ["ソルー", "ネクストゲート", "コスモ技研"]
  );
});

test("販売協力フェーズ別の件数（セールスでもフェーズが入っていれば数える）", () => {
  const f = partnershipFunnel(REFS);
  assert.equal(f.get("first_referral"), 2); // スマイル・ネクストゲート
  assert.equal(f.get("contracted"), 1);
  assert.equal(f.has(""), false); // セールスだけでフェーズ未入力の紹介は入れない
});

test("日報の文面：その日の数字と、当月の計画進捗", () => {
  const text = dailyReportText({
    dayLabel: "2026/11/06(金)",
    day: tally(REFS, onDay("2026-11-06")),
    dayByAgency: byAgency(REFS, BANKS, onDay("2026-11-06")),
    monthLabel: "2026年11月",
    month: tally(REFS, inMonth("2026-11")),
    plan: buildPlan(DEFAULT_ALLIANCE_PLAN)[2],
  });
  assert.match(text, /^【アライアンス日報】2026\/11\/06\(金\)/);
  assert.match(text, /紹介 1件 \/ 商談 0件/);
  assert.match(text, /・松橋社長：紹介1/);
  assert.match(text, /紹介 2\/35件（5\.7%）/);
  assert.match(text, /★代理店報酬 ¥0 \/ 計画 ¥6,300,000（0\.0%）/);
});
