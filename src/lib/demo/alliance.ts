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
//
// アライアンス数値管理（/alliance）で計画対比が見えるよう、案件には
// ★案件管理表★の項目（紹介日・商談種別・セールスフェーズ・販売協力フェーズ・対応）と、
// プラン単価表（事業計画※確定版『前提条件』）のプラン・機器を載せてある。
// 1次代理店・顧客の名前はすべて架空。

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
import { applySalesPhase, lineMoney } from "../alliance";

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
    // クロスセルは DDHBOX の契約数には入れない（金額だけ集計する）
    count_unit: "none",
    business_unit_id: null,
    updated_at: daysFromNow(-90),
    created_at: daysFromNow(-90),
  },
  // プラン単価表（事業計画※確定版『前提条件』のプラン単価マスター。0016 の初期値と同じ）
  ...(
    [
      ["plan10", "プラン10", 811_200, 311_200, 500_000, "contract", 110, "共有プラン"],
      ["plan20", "プラン20", 1_012_800, 312_800, 700_000, "contract", 120, "共有プラン（事業計画の平均プラン）"],
      ["plan30", "プラン30", 1_432_800, 532_800, 900_000, "contract", 130, "共有プラン"],
      ["plan50", "プラン50", 1_852_800, 652_800, 1_200_000, "contract", 140, "共有プラン"],
      ["plan100", "プラン100", 2_692_800, 992_800, 1_700_000, "contract", 150, "共有プラン"],
      ["plan300", "プラン300", 6_209_040, 3_409_040, 2_800_000, "contract", 160, "共有プラン"],
      ["device", "機器", 282_400, 162_400, 0, "device", 170, "1台あたり。契約数とは別に台数で数える"],
      ["direct_other", "直販・その他", 0, 0, 0, "contract", 180, "単価手入力。売上＝利益で入力すれば代理店報酬はゼロ"],
    ] as const
  ).map(
    ([slug, name, price, profit, fee, unit, order, memo]): Product => ({
      id: `prod-${slug}`,
      name,
      slug,
      color: slug === "device" ? "amber" : slug === "direct_other" ? "slate" : "cyan",
      unit_price: price,
      unit_profit: profit,
      agency_fee: fee,
      count_unit: unit,
      sort_order: order,
      is_active: true,
      memo,
      business_unit_id: BU_ALLIANCE,
      updated_at: daysFromNow(-70),
      created_at: daysFromNow(-70),
    })
  ),
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

/**
 * 案件の中身（★案件管理表★の1行）。紹介アポから起こした案件は appointment に
 * アポの番号（REFERRALS の並び）を、アポを経ずに登録した案件は branch を入れる。
 * 日付はすべて「今日から何日前か」。
 */
interface AllianceDealSpec {
  id: string;
  appointment?: number;
  /** アポを経ない案件の窓口（null = 直販） */
  branch?: string | null;
  company?: string;
  owner?: [string, string];
  kind: "sales" | "partnership" | "sales_partnership";
  /** セールスフェーズ（"" = 販売協力のみ） */
  phase: string;
  partnership?: string;
  /** 代理店契約の締結日（何日前） */
  partnerContracted?: number;
  referred?: number;
  met?: number;
  /** 成約日・ロスト日（何日前） */
  closed?: number;
  plan?: string;
  planQty?: number;
  devices?: number;
  /** AI をクロスセルで載せる */
  ai?: boolean;
  ball?: string;
  loss?: string;
  memo?: string;
}

const DEAL_SPECS: AllianceDealSpec[] = [
  // ---- 紹介アポから起こした案件 ----
  { id: "aldeal-1", appointment: 1, kind: "sales", phase: "lease_url", closed: 12, plan: "plan20", devices: 1, ai: true, ball: "ours", memo: "リース審査の結果待ち" },
  { id: "aldeal-2", appointment: 2, kind: "sales", phase: "prospect_b", plan: "plan10", ball: "client", memo: "概算見積もり提出済み　先方プラン選定中" },
  { id: "aldeal-3", appointment: 3, kind: "sales", phase: "installed", closed: 25, plan: "plan50", devices: 2, ball: "ours" },
  { id: "aldeal-4", appointment: 4, kind: "sales", phase: "lost", closed: 44, ball: "", loss: "他社で導入済み" },
  { id: "aldeal-5", appointment: 5, kind: "sales_partnership", phase: "paid_in", closed: 30, plan: "plan30", partnership: "first_referral", partnerContracted: 33, ball: "ours" },
  { id: "aldeal-7", appointment: 7, kind: "sales", phase: "won", closed: 3, plan: "plan100", devices: 3, ai: true, ball: "ours", memo: "サインバック回収待ち" },
  { id: "aldeal-8", appointment: 8, kind: "partnership", phase: "", partnership: "contracting", ball: "alliance", memo: "代理店契約書の送付" },
  { id: "aldeal-9", appointment: 9, kind: "sales", phase: "lost", closed: 60, loss: "予算の都合で見送り" },
  { id: "aldeal-10", appointment: 10, kind: "sales", phase: "signback", closed: 9, plan: "plan20", planQty: 2, ai: true, ball: "client", memo: "関連会社2社まとめて契約" },
  // ---- アポを経ずに登録した案件（予定・案件管理から） ----
  { id: "aldeal-11", branch: null, company: "株式会社ミナト精工", owner: ["member-tanaka", "田中 美咲"], kind: "sales", phase: "won", referred: 45, met: 40, closed: 12, plan: "plan50", devices: 2, ball: "ours", memo: "直販。見積もり書連携" },
  { id: "aldeal-12", branch: null, company: "グリーンフーズ株式会社", owner: ["member-tanaka", "田中 美咲"], kind: "sales", phase: "prospect_b", referred: 15, met: 9, plan: "plan100", ball: "client", memo: "候補日程待ち" },
  { id: "aldeal-13", branch: "albr-al-2-000", company: "株式会社リンクス", owner: ["member-ito", "伊藤 翔"], kind: "partnership", phase: "", partnership: "first_referral", partnerContracted: 30, referred: 50, met: 46, ball: "alliance" },
  { id: "aldeal-14", branch: "albr-al-3-301", company: "中部ロジテック株式会社", owner: ["member-suzuki", "鈴木 大輔"], kind: "sales_partnership", phase: "prospect_a", partnership: "group_created", referred: 12, met: 6, plan: "plan20", ball: "ours", memo: "NDA送付→ネットワーク構成図回収の上、必要台数見積もり" },
  { id: "aldeal-15", branch: "albr-al-1-103", company: "ベイサイド商事株式会社", owner: ["member-suzuki", "鈴木 大輔"], kind: "sales", phase: "prospect_c", referred: 8, met: 3, ball: "client" },
  { id: "aldeal-16", branch: "albr-al-1-000", company: "株式会社アオバ", owner: ["member-tanaka", "田中 美咲"], kind: "sales", phase: "scheduling", referred: 1, ball: "alliance" },
  { id: "aldeal-17", branch: "albr-al-2-000", company: "株式会社ナニワ工務店", owner: ["member-ito", "伊藤 翔"], kind: "sales_partnership", phase: "waiting", partnership: "waiting", referred: 3, ball: "ours" },
  { id: "aldeal-18", branch: "albr-al-3-000", company: "株式会社オワリ電装", owner: ["member-suzuki", "鈴木 大輔"], kind: "sales", phase: "agency_paid", referred: 66, met: 62, closed: 55, plan: "plan10", devices: 1, ball: "" },
];

const TODAY = dateFromNow(0);

export const DEMO_ALLIANCE_DEALS: Deal[] = DEAL_SPECS.map((spec) => {
  const appt = spec.appointment !== undefined ? DEMO_ALLIANCE_APPOINTMENTS[spec.appointment] : null;
  const branch = appt
    ? DEMO_ALLIANCE_BRANCHES.find((b) => b.id === appt.branch_id)!
    : spec.branch
      ? DEMO_ALLIANCE_BRANCHES.find((b) => b.id === spec.branch)!
      : null;
  const company = appt?.company_name ?? spec.company ?? "";
  const referredDays = spec.referred ?? REFERRALS[spec.appointment ?? 0].days;
  const closedOn = spec.closed !== undefined ? dateFromNow(-spec.closed) : "";
  const phase = spec.phase
    ? applySalesPhase({ contracted_at: closedOn, lost_at: closedOn }, spec.phase, closedOn || TODAY)
    : { stage: "partnership" as const, confidence_rank: "", probability: 0, sales_phase: "" };
  return {
    id: spec.id,
    name: spec.plan ? `${company} DDS導入` : company,
    company,
    contact_name: "",
    stage: phase.stage!,
    amount: 0, // ← 下で明細の合計に差し替える
    probability: phase.probability ?? 0,
    expected_close: closedOn || dateFromNow(25),
    owner_name: appt?.assigned_name ?? spec.owner?.[1] ?? "",
    owner_id: appt?.assigned_to ?? spec.owner?.[0] ?? null,
    next_action: spec.memo ?? "",
    memo: appt?.source_note ?? "",
    updated_at: daysFromNow(-Math.max(0, (spec.closed ?? referredDays) - 1)),
    created_at: daysFromNow(-referredDays),
    bank_id: branch?.bank_id ?? null,
    branch_id: branch?.id ?? null,
    appointment_id: appt?.id ?? null,
    organization_id: null,
    business_unit_id: BU_ALLIANCE,
    contract_amount: 0,
    gross_profit: 0,
    agency_fee: 0,
    confidence_rank: phase.confidence_rank ?? "",
    fulfillment_status: phase.fulfillment_status ?? "",
    fulfillment_updated_at: phase.fulfillment_status ? closedOn : "",
    contracted_at: phase.stage === "won" ? closedOn : "",
    lost_at: phase.stage === "lost" ? closedOn : "",
    loss_reason: spec.loss ?? "",
    referred_at: dateFromNow(-referredDays),
    visited_at:
      spec.met !== undefined
        ? dateFromNow(-spec.met)
        : appt && appt.status !== "scheduled"
          ? dateFromNow(-referredDays + 3)
          : "",
    deal_kind: spec.kind,
    sales_phase: phase.sales_phase ?? "",
    partnership_phase: spec.partnership ?? "",
    partnership_contracted_at:
      spec.partnerContracted !== undefined ? dateFromNow(-spec.partnerContracted) : "",
    ball: spec.ball ?? "",
  } satisfies Deal;
});

const productBySlug = (slug: string) => DEMO_PRODUCTS.find((p) => p.slug === slug)!;

/**
 * 案件ごとの商材明細（プラン・機器、ときどき AI のクロスセル）。
 * 金額は単価表 × 数量（lib/alliance.ts の lineMoney）。
 */
export const DEMO_DEAL_PRODUCTS: DealProduct[] = DEAL_SPECS.flatMap((spec) => {
  const deal = DEMO_ALLIANCE_DEALS.find((d) => d.id === spec.id)!;
  const out: DealProduct[] = [];
  const push = (slug: string, quantity: number, memo = "") => {
    const p = productBySlug(slug);
    out.push({
      id: `dp-${deal.id}-${slug}`,
      deal_id: deal.id,
      product_id: p.id,
      product_name: p.name,
      quantity,
      memo,
      created_at: deal.created_at,
      ...lineMoney(p, quantity),
    });
  };
  if (spec.plan) push(spec.plan, spec.planQty ?? 1);
  if (spec.devices) push("device", spec.devices);
  if (spec.ai) push("ai", 1, "商談中にクロスセル");
  return out;
});

// 案件の金額を明細の合計に揃える（画面は deals.amount も読むので、ここがずれると数字が合わない）。
// 直販（1次代理店なし）は代理店報酬を払わないので、報酬ぶんを自社利益に寄せる。
for (const deal of DEMO_ALLIANCE_DEALS) {
  const own = DEMO_DEAL_PRODUCTS.filter((l) => l.deal_id === deal.id);
  const sales = own.reduce((sum, l) => sum + l.amount, 0);
  const profit = own.reduce((sum, l) => sum + (l.profit ?? 0), 0);
  const fee = own.reduce((sum, l) => sum + (l.agency_fee ?? 0), 0);
  deal.amount = sales;
  deal.contract_amount = deal.stage === "won" ? sales : 0;
  deal.gross_profit = deal.bank_id ? profit : profit + fee;
  deal.agency_fee = deal.bank_id ? fee : 0;
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
