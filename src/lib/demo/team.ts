import type { Profile } from "../types";
import { daysFromNow } from "../utils";

// デモモードのチームメンバー。ログインユーザーもここから選択する。
// role_key で画面の出し分けが変わる（定義は lib/roles.ts）。
// 代理店ユーザー（partner_*）を2名入れてあるので、ユーザー切替で
// 「代理店にはどこまで見えるか」をそのまま確認できる。
export const DEMO_TEAM: Profile[] = [
  {
    id: "member-sato",
    name: "佐藤 健太",
    email: "sato@example.com",
    role: "マネージャー",
    department: "営業部",
    color: "indigo",
    role_key: "manager",
    created_at: daysFromNow(-400),
  },
  {
    id: "member-tanaka",
    name: "田中 美咲",
    email: "tanaka@example.com",
    role: "フィールドセールス",
    department: "営業部",
    color: "emerald",
    role_key: "member",
    created_at: daysFromNow(-320),
  },
  {
    id: "member-suzuki",
    name: "鈴木 大輔",
    email: "suzuki@example.com",
    role: "インサイドセールス",
    department: "営業部",
    color: "sky",
    role_key: "member",
    created_at: daysFromNow(-250),
  },
  {
    id: "member-yamada",
    name: "山田 花子",
    email: "yamada@example.com",
    role: "経理・総務",
    department: "管理部",
    color: "rose",
    role_key: "backoffice",
    created_at: daysFromNow(-180),
  },
  {
    id: "member-ito",
    name: "伊藤 翔",
    email: "ito@example.com",
    role: "インサイドセールス",
    department: "営業代理事業部",
    color: "amber",
    role_key: "member",
    created_at: daysFromNow(-90),
  },
  {
    id: "member-okazaki",
    name: "岡崎 佑真",
    email: "okazaki@example.com",
    role: "代表取締役",
    department: "経営",
    color: "teal",
    role_key: "executive",
    access_level: "executive",
    created_at: daysFromNow(-500),
  },
  // ---- 代理店ユーザー（社外）。organization_id で見える範囲が絞られる ----
  {
    id: "member-partner-admin",
    name: "村上 亮",
    email: "murakami@alpha-sales.example.com",
    role: "代理店 責任者",
    department: "アルファセールス",
    color: "violet",
    role_key: "partner_admin",
    organization_id: "org-agency-a",
    created_at: daysFromNow(-200),
  },
  {
    id: "member-partner-member",
    name: "小林 彩",
    email: "kobayashi@alpha-sales.example.com",
    role: "代理店 営業",
    department: "アルファセールス",
    color: "slate",
    role_key: "partner_member",
    organization_id: "org-agency-a",
    created_at: daysFromNow(-120),
  },
];

export const DEMO_MEMBER_NAMES = DEMO_TEAM.map((m) => m.name);
