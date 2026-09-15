// アライアンス営業モジュールのデモシード。
//
// 骨格は銀行営業と同じで、呼び名だけが変わる（lib/business-units.ts）。
//   1次代理店 = banks(business_unit_id = アライアンス)
//   2次代理店 = branches(同上)
// 1次代理店から直接紹介が来るケースは、その1次代理店の下に
// 「直接」という2次代理店を1つ置いて表す（銀行営業の本店営業部と同じ扱い）。
//
// 入口は DDS で、そこに AI を乗せられているか（クロスセル）が
// 画面で分かるように、商材明細を散らしてある。

import type {
  Appointment,
  Bank,
  Branch,
  BusinessUnit,
  Deal,
  DealProduct,
  Organization,
  Product,
} from "../types";
import { daysFromNow, dateFromNow } from "../utils";

export const BU_ALLIANCE = "bu-alliance";

export const DEMO_ALLIANCE_UNIT: BusinessUnit = {
  id: BU_ALLIANCE,
  name: "アライアンス営業",
  slug: "alliance",
  is_active: true,
  created_at: daysFromNow(-120),
};

export const DEMO_PRODUCTS: Product[] = [
  {
    id: "prod-dds",
    name: "DDS",
    slug: "dds",
    color: "cyan",
    unit_price: 1_200_000,
    sort_order: 10,
    is_active: true,
    memo: "入口商材。設置を伴う",
    business_unit_id: null,
    updated_at: daysFromNow(-120),
    created_at: daysFromNow(-120),
  },
  {
    id: "prod-ai",
    name: "AI",
    slug: "ai",
    color: "violet",
    unit_price: 600_000,
    sort_order: 20,
    is_active: true,
    memo: "クロスセル商材",
    business_unit_id: null,
    updated_at: daysFromNow(-90),
    created_at: daysFromNow(-90),
  },
];

/** 1次代理店（＝銀行営業でいう銀行） */
const PRIMARY = [
  { id: "al-1", name: "株式会社ブリッジパートナーズ", code: "AP01" },
  { id: "al-2", name: "コネクトリンク株式会社", code: "AP02" },
  { id: "al-3", name: "株式会社シナジーワークス", code: "AP03" },
];

export const DEMO_ALLIANCE_BANKS: Bank[] = PRIMARY.map((p, i) => ({
  id: p.id,
  name: p.name,
  code: p.code,
  is_active: true,
  business_unit_id: BU_ALLIANCE,
  created_at: daysFromNow(-110 + i * 15),
}));

/**
 * 2次代理店（＝銀行営業でいう支店）。
 * 「直接」は1次代理店から直に紹介が来るぶんの受け皿。
 */
const SECONDARY: {
  primary: string;
  name: string;
  code: string;
  pref: string;
  owner: string;
  ownerName: string;
  /** 最終接点からの経過日数（null = 一度も接点なし） */
  lastDays: number | null;
}[] = [
  { primary: "al-1", name: "直接", code: "000", pref: "東京都", owner: "member-tanaka", ownerName: "田中 美咲", lastDays: 2 },
  { primary: "al-1", name: "株式会社アップリンク", code: "101", pref: "東京都", owner: "member-tanaka", ownerName: "田中 美咲", lastDays: 9 },
  { primary: "al-1", name: "ミラクルセールス株式会社", code: "102", pref: "神奈川県", owner: "member-ito", ownerName: "伊藤 翔", lastDays: 41 },
  { primary: "al-1", name: "株式会社トップギア", code: "103", pref: "千葉県", owner: "member-suzuki", ownerName: "鈴木 大輔", lastDays: null },
  { primary: "al-2", name: "直接", code: "000", pref: "大阪府", owner: "member-ito", ownerName: "伊藤 翔", lastDays: 5 },
  { primary: "al-2", name: "関西ビジネスサポート株式会社", code: "201", pref: "大阪府", owner: "member-ito", ownerName: "伊藤 翔", lastDays: 17 },
  { primary: "al-2", name: "株式会社なにわ商会", code: "202", pref: "兵庫県", owner: "member-suzuki", ownerName: "鈴木 大輔", lastDays: 73 },
  { primary: "al-3", name: "直接", code: "000", pref: "愛知県", owner: "member-suzuki", ownerName: "鈴木 大輔", lastDays: 28 },
  { primary: "al-3", name: "中部エージェンシー株式会社", code: "301", pref: "愛知県", owner: "member-tanaka", ownerName: "田中 美咲", lastDays: 96 },
];

export const DEMO_ALLIANCE_BRANCHES: Branch[] = SECONDARY.map((s, i) => ({
  id: `albr-${s.primary}-${s.code}`,
  bank_id: s.primary,
  name: s.name,
  code: s.code,
  address: "",
  prefecture: s.pref,
  assigned_to: s.owner,
  assigned_name: s.ownerName,
  assigned_org_id: "org-hq",
  status: "active" as Branch["status"],
  last_contact_at: s.lastDays === null ? "" : dateFromNow(-s.lastDays),
  note: "",
  business_unit_id: BU_ALLIANCE,
  updated_at: daysFromNow(-(s.lastDays ?? 120)),
  created_at: daysFromNow(-100 + i * 8),
}));

/** 紹介（アポ）。2次代理店ごとに件数を散らして稼働の差を作る */
const REFERRALS: {
  branch: string;
  company: string;
  days: number;
  status: Appointment["status"];
  owner: string;
  ownerName: string;
  industry: string;
  scale: string;
}[] = [
  { branch: "albr-al-1-000", company: "株式会社ハルカ製作所", days: 2, status: "scheduled", owner: "member-tanaka", ownerName: "田中 美咲", industry: "製造業", scale: "1〜5億円" },
  { branch: "albr-al-1-000", company: "有限会社みどり運輸", days: 20, status: "won", owner: "member-tanaka", ownerName: "田中 美咲", industry: "運輸・物流", scale: "1億円未満" },
  { branch: "albr-al-1-101", company: "株式会社ソレイユ", days: 9, status: "done", owner: "member-tanaka", ownerName: "田中 美咲", industry: "小売業", scale: "1〜5億円" },
  { branch: "albr-al-1-101", company: "カワセ工業株式会社", days: 34, status: "won", owner: "member-tanaka", ownerName: "田中 美咲", industry: "製造業", scale: "5〜10億円" },
  { branch: "albr-al-1-101", company: "株式会社ニシムラ", days: 52, status: "lost", owner: "member-ito", ownerName: "伊藤 翔", industry: "建設業", scale: "1〜5億円" },
  { branch: "albr-al-1-102", company: "オオタ食品株式会社", days: 41, status: "won", owner: "member-ito", ownerName: "伊藤 翔", industry: "製造業", scale: "1〜5億円" },
  { branch: "albr-al-2-000", company: "株式会社ヤマト印刷", days: 5, status: "scheduled", owner: "member-ito", ownerName: "伊藤 翔", industry: "製造業", scale: "1億円未満" },
  { branch: "albr-al-2-201", company: "関西メディカル株式会社", days: 17, status: "won", owner: "member-ito", ownerName: "伊藤 翔", industry: "医療・福祉", scale: "5〜10億円" },
  { branch: "albr-al-2-201", company: "株式会社さくら建材", days: 38, status: "done", owner: "member-ito", ownerName: "伊藤 翔", industry: "建設業", scale: "1〜5億円" },
  { branch: "albr-al-2-202", company: "神戸フーズ株式会社", days: 73, status: "lost", owner: "member-suzuki", ownerName: "鈴木 大輔", industry: "製造業", scale: "1〜5億円" },
  { branch: "albr-al-3-000", company: "株式会社トーカイ商事", days: 28, status: "won", owner: "member-suzuki", ownerName: "鈴木 大輔", industry: "卸売業", scale: "10億円以上" },
  { branch: "albr-al-3-301", company: "名古屋テック株式会社", days: 96, status: "cancelled", owner: "member-tanaka", ownerName: "田中 美咲", industry: "情報通信", scale: "1〜5億円" },
];

export const DEMO_ALLIANCE_APPOINTMENTS: Appointment[] = REFERRALS.map((r, i) => {
  const branch = DEMO_ALLIANCE_BRANCHES.find((b) => b.id === r.branch)!;
  const dealId = r.status === "won" || r.status === "lost" || r.status === "done"
    ? `aldeal-${i}`
    : null;
  return {
    id: `alap-${i}`,
    bank_id: branch.bank_id,
    branch_id: branch.id,
    assigned_to: r.owner,
    assigned_name: r.ownerName,
    organization_id: null,
    received_at: dateFromNow(-r.days),
    scheduled_at: daysFromNow(-r.days + 3, 14, 0),
    company_name: r.company,
    industry: r.industry,
    revenue_scale: r.scale,
    contact_role: "decision_maker" as const,
    source_note: `${branch.name === "直接" ? "1次代理店から直接" : branch.name}からの紹介`,
    status: r.status,
    deal_id: dealId,
    event_id: null,
    business_unit_id: BU_ALLIANCE,
    updated_at: daysFromNow(-r.days),
    created_at: daysFromNow(-r.days),
  };
});

/** アポから起こした案件。stage はアポの結果に合わせる */
const STAGE_OF: Record<string, Deal["stage"]> = {
  won: "won",
  lost: "lost",
  done: "follow_up",
};

export const DEMO_ALLIANCE_DEALS: Deal[] = DEMO_ALLIANCE_APPOINTMENTS.filter(
  (a) => a.deal_id !== null
).map((a) => {
  const referral = REFERRALS[DEMO_ALLIANCE_APPOINTMENTS.indexOf(a)];
  const stage = STAGE_OF[referral.status] ?? "follow_up";
  return {
    id: a.deal_id!,
    name: `${a.company_name} DDS導入`,
    company: a.company_name,
    contact_name: "",
    stage,
    // 金額は明細の合計と一致させる（アプリ側も商材を足すたびに同期する）
    amount: 0, // ← 下の withAmounts で明細の合計に差し替える
    probability: stage === "won" ? 100 : stage === "lost" ? 0 : 50,
    expected_close: dateFromNow(stage === "won" ? -referral.days + 20 : 25),
    owner_name: a.assigned_name,
    owner_id: a.assigned_to,
    next_action: stage === "follow_up" ? "見積提示" : "",
    memo: a.source_note,
    updated_at: daysFromNow(-referral.days + 10),
    created_at: daysFromNow(-referral.days),
    bank_id: a.bank_id,
    branch_id: a.branch_id,
    appointment_id: a.id,
    organization_id: null,
    business_unit_id: BU_ALLIANCE,
    contract_amount: 0,
    gross_profit: 0,
    confidence_rank: stage === "won" ? "A" : stage === "lost" ? "C" : "B",
    // 設置を伴わない商材が混ざるため、受注後フェーズは使わない
    fulfillment_status: "",
  } satisfies Deal;
});

/**
 * 案件ごとの商材明細。
 * 入口はすべて DDS で、そのうち3件に AI を乗せてある（クロスセル率が出る）。
 */
const CROSS_SELL_DEALS = new Set(["aldeal-1", "aldeal-7", "aldeal-10"]);

export const DEMO_DEAL_PRODUCTS: DealProduct[] = DEMO_ALLIANCE_DEALS.flatMap((deal, i) => {
  const dds: DealProduct = {
    id: `dp-${deal.id}-dds`,
    deal_id: deal.id,
    product_id: "prod-dds",
    product_name: "DDS",
    amount: 1_200_000 + (i % 3) * 400_000,
    quantity: 1,
    memo: "",
    created_at: deal.created_at,
  };
  if (!CROSS_SELL_DEALS.has(deal.id)) return [dds];
  return [
    dds,
    {
      id: `dp-${deal.id}-ai`,
      deal_id: deal.id,
      product_id: "prod-ai",
      product_name: "AI",
      amount: 600_000,
      quantity: 1,
      memo: "商談中にクロスセル",
      created_at: deal.created_at,
    },
  ];
});

// 案件の金額を明細の合計に揃える。
// 画面は deals.amount を見て集計するので、ここがずれると数字が合わなくなる。
for (const deal of DEMO_ALLIANCE_DEALS) {
  const total = DEMO_DEAL_PRODUCTS.filter((l) => l.deal_id === deal.id).reduce(
    (sum, l) => sum + l.amount,
    0
  );
  deal.amount = total;
  deal.contract_amount = deal.stage === "won" ? total : 0;
  deal.gross_profit = deal.stage === "won" ? Math.round(total * 0.35) : 0;
}

/** アライアンス事業部の営業組織。代理店ユーザーは今のところ置かない */
export const DEMO_ALLIANCE_ORGANIZATIONS: Organization[] = [
  {
    id: "org-hq-alliance",
    name: "DARE BASE（アライアンス）",
    type: "headquarters",
    commission_rate: 0,
    is_active: true,
    business_unit_id: BU_ALLIANCE,
    partner_id: null,
    created_at: daysFromNow(-120),
  },
];
