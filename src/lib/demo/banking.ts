// 銀行営業モジュールのデモシード。
// Supabase 未接続のデモモードでのみ使われる（本番接続時は空から始まり、
// 各画面は Empty State を表示する）。
//
// 「100支店持っていて実際に動いているのは30支店」という現状課題が
// ダッシュボード上で再現されるよう、稼働・休眠を意図的に散らしてある。

import type {
  Appointment,
  Bank,
  Branch,
  BranchActivity,
  BusinessUnit,
  Organization,
} from "../types";
import { daysFromNow, toDateStr } from "../utils";

const BU_BANKING = "bu-banking";

export const DEMO_BUSINESS_UNITS: BusinessUnit[] = [
  {
    id: BU_BANKING,
    name: "銀行営業",
    slug: "banking",
    is_active: true,
    created_at: daysFromNow(-500),
  },
];

const ORG_HQ = "org-hq";
const ORG_A = "org-agency-a";
const ORG_B = "org-agency-b";

export const DEMO_ORGANIZATIONS: Organization[] = [
  {
    id: ORG_HQ,
    name: "DARE BASE（本部）",
    type: "headquarters",
    commission_rate: 0,
    is_active: true,
    business_unit_id: BU_BANKING,
    created_at: daysFromNow(-500),
  },
  {
    id: ORG_A,
    name: "アルファセールス",
    type: "agency",
    commission_rate: 40,
    is_active: true,
    business_unit_id: BU_BANKING,
    created_at: daysFromNow(-300),
  },
  {
    id: ORG_B,
    name: "ブリッジ商事",
    type: "agency",
    commission_rate: 35,
    is_active: true,
    business_unit_id: BU_BANKING,
    created_at: daysFromNow(-200),
  },
];

// ---------- 銀行 ----------
interface BankSeed {
  id: string;
  name: string;
  code: string;
  branches: { name: string; code: string; pref: string }[];
}

const BANK_SEEDS: BankSeed[] = [
  {
    id: "bank-mirai",
    name: "みらい銀行",
    code: "0011",
    branches: [
      { name: "渋谷支店", code: "001", pref: "東京都" },
      { name: "新宿支店", code: "002", pref: "東京都" },
      { name: "池袋支店", code: "003", pref: "東京都" },
      { name: "品川支店", code: "004", pref: "東京都" },
      { name: "町田支店", code: "005", pref: "東京都" },
      { name: "横浜支店", code: "006", pref: "神奈川県" },
      { name: "川崎支店", code: "007", pref: "神奈川県" },
      { name: "藤沢支店", code: "008", pref: "神奈川県" },
      { name: "大宮支店", code: "009", pref: "埼玉県" },
      { name: "所沢支店", code: "010", pref: "埼玉県" },
      { name: "船橋支店", code: "011", pref: "千葉県" },
      { name: "柏支店", code: "012", pref: "千葉県" },
    ],
  },
  {
    id: "bank-tokai",
    name: "東海中央銀行",
    code: "0022",
    branches: [
      { name: "名古屋支店", code: "101", pref: "愛知県" },
      { name: "栄支店", code: "102", pref: "愛知県" },
      { name: "岡崎支店", code: "103", pref: "愛知県" },
      { name: "豊橋支店", code: "104", pref: "愛知県" },
      { name: "一宮支店", code: "105", pref: "愛知県" },
      { name: "岐阜支店", code: "106", pref: "岐阜県" },
      { name: "大垣支店", code: "107", pref: "岐阜県" },
      { name: "四日市支店", code: "108", pref: "三重県" },
      { name: "津支店", code: "109", pref: "三重県" },
      { name: "静岡支店", code: "110", pref: "静岡県" },
      { name: "浜松支店", code: "111", pref: "静岡県" },
    ],
  },
  {
    id: "bank-kansai",
    name: "関西信用金庫",
    code: "1033",
    branches: [
      { name: "梅田支店", code: "201", pref: "大阪府" },
      { name: "難波支店", code: "202", pref: "大阪府" },
      { name: "堺支店", code: "203", pref: "大阪府" },
      { name: "東大阪支店", code: "204", pref: "大阪府" },
      { name: "枚方支店", code: "205", pref: "大阪府" },
      { name: "三宮支店", code: "206", pref: "兵庫県" },
      { name: "姫路支店", code: "207", pref: "兵庫県" },
      { name: "京都中央支店", code: "208", pref: "京都府" },
      { name: "奈良支店", code: "209", pref: "奈良県" },
    ],
  },
  {
    id: "bank-kyushu",
    name: "九州さくら銀行",
    code: "0044",
    branches: [
      { name: "博多支店", code: "301", pref: "福岡県" },
      { name: "天神支店", code: "302", pref: "福岡県" },
      { name: "小倉支店", code: "303", pref: "福岡県" },
      { name: "久留米支店", code: "304", pref: "福岡県" },
      { name: "熊本支店", code: "305", pref: "熊本県" },
      { name: "鹿児島支店", code: "306", pref: "鹿児島県" },
      { name: "長崎支店", code: "307", pref: "長崎県" },
      { name: "大分支店", code: "308", pref: "大分県" },
    ],
  },
];

export const DEMO_BANKS: Bank[] = BANK_SEEDS.map((b, i) => ({
  id: b.id,
  name: b.name,
  code: b.code,
  is_active: true,
  business_unit_id: BU_BANKING,
  created_at: daysFromNow(-400 + i * 20),
}));

// 担当者（DEMO_TEAM と id / 氏名を合わせる）
const OWNERS = [
  { id: "member-tanaka", name: "田中 美咲", org: ORG_HQ },
  { id: "member-yamada", name: "山田 花子", org: ORG_A },
  { id: "member-ito", name: "伊藤 翔", org: ORG_B },
];

/** 決定的な擬似乱数（シード固定。読み込みのたびに結果が変わらない） */
function pseudo(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function daysAgo(n: number): string {
  return toDateStr(new Date(Date.now() - n * 86_400_000));
}

// 最終接点日の分布。
// 「100支店持っていて実際に動かせているのは30支店」という現状を再現するため、
// 稼働（既定の判定=直近90日）に入るのは約3割だけになるよう散らしている。
//   0-55日 = 稼働 / 105-190日 = 休眠 / 200-400日 = 放置 / null = 一度も接点なし
function seedLastContact(n: number): string | null {
  const r = pseudo(n + 1);
  if (r < 0.3) return daysAgo(Math.floor(r * 180));
  if (r < 0.55) return daysAgo(105 + Math.floor(r * 150));
  if (r < 0.8) return daysAgo(200 + Math.floor(r * 250));
  return null;
}

export const DEMO_BRANCHES: Branch[] = BANK_SEEDS.flatMap((bank, bankIdx) =>
  bank.branches.map((br, i) => {
    const n = bankIdx * 20 + i;
    const owner = OWNERS[n % OWNERS.length];
    const last = seedLastContact(n);
    return {
      id: `br-${bank.code}-${br.code}`,
      bank_id: bank.id,
      name: br.name,
      code: br.code,
      address: "",
      prefecture: br.pref,
      assigned_to: owner.id,
      assigned_name: owner.name,
      assigned_org_id: owner.org,
      status: (n === 7 ? "suspended" : "active") as Branch["status"],
      last_contact_at: last ?? "",
      note: "",
      business_unit_id: BU_BANKING,
      updated_at: daysFromNow(-30),
      created_at: daysFromNow(-360 + n),
    };
  })
);

// ---------- アポイント ----------
const COMPANIES = [
  "大和精機",
  "コスモ物流",
  "みどり建設",
  "しおり工業",
  "サンライズ運輸",
  "北斗フーズ",
  "テクノ電機",
  "共栄メンテナンス",
  "ひかり印刷",
  "青葉クリニック",
  "山王不動産",
  "つばさ商会",
  "第一化成",
  "まるみ食品",
  "高砂鉄工",
  "サクラ介護サービス",
];

const INDUSTRIES = ["製造", "運輸", "建設", "小売", "飲食", "医療・介護", "サービス"];
const SCALES = ["〜1億円", "1〜5億円", "5〜10億円", "10〜50億円"];
// 先頭（＝商談日が未来のアポ）が "予定" になるよう並べ、
// 「これから」「要フォロー」「受注」の各タブに件数が入るようにする
const STATUSES: Appointment["status"][] = [
  "scheduled",
  "won",
  "done",
  "lost",
  "scheduled",
  "won",
  "done",
  "lost",
];

// アポは「最近接点があった支店」にだけ紐付ける。
// 受電日は支店の最終接点日以前に置き、稼働の分布と矛盾しないようにする。
const ACTIVE_BRANCHES = DEMO_BRANCHES.filter(
  (b) => b.last_contact_at !== "" && b.status !== "suspended" && b.last_contact_at >= daysAgo(60)
);

export const DEMO_APPOINTMENTS: Appointment[] = COMPANIES.map((company, i) => {
  const branch = ACTIVE_BRANCHES[(i * 3) % ACTIVE_BRANCHES.length];
  // 直近45日に3日おき。当月分も数件入るようにして月次サマリーが動くようにする
  const elapsed = i * 3;
  const received = daysAgo(elapsed);
  const owner = OWNERS.find((o) => o.id === branch.assigned_to) ?? OWNERS[0];
  return {
    id: `appt-${i + 1}`,
    bank_id: branch.bank_id,
    branch_id: branch.id,
    assigned_to: owner.id,
    assigned_name: owner.name,
    organization_id: owner.org,
    received_at: received,
    // 受電の3日後に商談、という運用を想定
    scheduled_at: daysFromNow(-elapsed + 3, 10 + (i % 6), 0),
    company_name: company,
    industry: INDUSTRIES[i % INDUSTRIES.length],
    revenue_scale: SCALES[i % SCALES.length],
    contact_role: i % 3 === 0 ? "decision_maker" : "staff",
    source_note: "",
    status: STATUSES[i % STATUSES.length],
    deal_id: null,
    event_id: null,
    business_unit_id: BU_BANKING,
    updated_at: daysFromNow(-elapsed),
    created_at: daysFromNow(-elapsed),
  } satisfies Appointment;
});

// ---------- 支店への活動ログ ----------
const ACTIVITY_TYPES: BranchActivity["type"][] = ["visit", "call", "study", "training"];

export const DEMO_BRANCH_ACTIVITIES: BranchActivity[] = ACTIVE_BRANCHES.slice(0, 12).map(
  (branch, i) => {
    const elapsed = i * 4 + 1;
    const occurred = daysAgo(elapsed);
    const owner = OWNERS.find((o) => o.id === branch.assigned_to) ?? OWNERS[0];
    return {
      id: `bract-${i + 1}`,
      branch_id: branch.id,
      bank_id: branch.bank_id,
      user_id: owner.id,
      user_name: owner.name,
      type: ACTIVITY_TYPES[i % ACTIVITY_TYPES.length],
      occurred_at: occurred,
      memo:
        i % 4 === 0
          ? "支店長へ商材説明。次回は行員向け勉強会を打診。"
          : i % 4 === 1
            ? "担当者へ電話。紹介候補が2件あるとのこと。"
            : i % 4 === 2
              ? "行員向け勉強会を実施（参加8名）。"
              : "研修会に同席。事例共有を実施。",
      business_unit_id: BU_BANKING,
      created_at: daysFromNow(-elapsed),
    } satisfies BranchActivity;
  }
);

// アポ・活動ログの日付が支店の最終接点日より新しい場合は、
// 支店側のキャッシュ（last_contact_at）を合わせておく。
// 実運用ではアポ登録時にアプリが同じ更新を行う。
for (const a of DEMO_APPOINTMENTS) {
  const b = DEMO_BRANCHES.find((x) => x.id === a.branch_id);
  if (b && a.received_at > b.last_contact_at) b.last_contact_at = a.received_at;
}
for (const a of DEMO_BRANCH_ACTIVITIES) {
  const b = DEMO_BRANCHES.find((x) => x.id === a.branch_id);
  if (b && a.occurred_at > b.last_contact_at) b.last_contact_at = a.occurred_at;
}
