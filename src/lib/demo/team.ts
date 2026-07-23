import type { Profile } from "../types";
import { daysFromNow } from "../utils";

// デモモードのチームメンバー。ログインユーザーもここから選択する。
// access_level: "executive" のメンバーのみ経営ダッシュボードを閲覧できる。
export const DEMO_TEAM: Profile[] = [
  {
    id: "member-sato",
    name: "佐藤 健太",
    email: "sato@example.com",
    role: "マネージャー",
    department: "営業部",
    color: "indigo",
    access_level: "executive",
    created_at: daysFromNow(-400),
  },
  {
    id: "member-tanaka",
    name: "田中 美咲",
    email: "tanaka@example.com",
    role: "フィールドセールス",
    department: "営業部",
    color: "emerald",
    created_at: daysFromNow(-320),
  },
  {
    id: "member-suzuki",
    name: "鈴木 大輔",
    email: "suzuki@example.com",
    role: "インサイドセールス",
    department: "営業部",
    color: "sky",
    created_at: daysFromNow(-250),
  },
  {
    id: "member-yamada",
    name: "山田 花子",
    email: "yamada@example.com",
    role: "フィールドセールス",
    department: "営業部",
    color: "rose",
    created_at: daysFromNow(-180),
  },
  {
    id: "member-ito",
    name: "伊藤 翔",
    email: "ito@example.com",
    role: "インサイドセールス",
    department: "営業代理事業部",
    color: "amber",
    created_at: daysFromNow(-90),
  },
  {
    id: "member-okazaki",
    name: "岡崎 佑真",
    email: "okazaki@example.com",
    role: "代表取締役",
    department: "経営",
    color: "teal",
    access_level: "executive",
    created_at: daysFromNow(-500),
  },
];

export const DEMO_MEMBER_NAMES = DEMO_TEAM.map((m) => m.name);
