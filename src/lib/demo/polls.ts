import type { SchedulePoll } from "../types";
import { daysFromNow } from "../utils";

export const DEMO_POLLS: SchedulePoll[] = [
  {
    id: "poll-1",
    title: "ネクストステージ様 オンラインデモ",
    description: "SFA導入支援のオンラインデモ。小林様ほか2名参加予定。",
    organizer: "鈴木 大輔",
    location: "Zoom（URLは確定後に送付）",
    duration_min: 60,
    candidates: [
      { start: daysFromNow(3, 10, 0), end: daysFromNow(3, 11, 0) },
      { start: daysFromNow(3, 15, 0), end: daysFromNow(3, 16, 0) },
      { start: daysFromNow(4, 13, 0), end: daysFromNow(4, 14, 0) },
      { start: daysFromNow(5, 10, 0), end: daysFromNow(5, 11, 0) },
    ],
    responses: [
      {
        name: "小林 亮",
        answers: ["ok", "ng", "ok", "maybe"],
        comment: "3日後の午前が最も確実です。",
        created_at: daysFromNow(-1, 13),
      },
      {
        name: "鈴木 大輔",
        answers: ["ok", "ok", "ok", "ok"],
        comment: "",
        created_at: daysFromNow(-1, 9),
      },
    ],
    status: "open",
    confirmed_index: null,
    created_at: daysFromNow(-2),
  },
  {
    id: "poll-2",
    title: "下期キックオフ 幹事打ち合わせ",
    description: "会場手配と進行の分担決め（30分）",
    organizer: "佐藤 健太",
    location: "会議室B",
    duration_min: 30,
    candidates: [
      { start: daysFromNow(1, 13, 0), end: daysFromNow(1, 13, 30) },
      { start: daysFromNow(2, 17, 0), end: daysFromNow(2, 17, 30) },
    ],
    responses: [
      {
        name: "田中 美咲",
        answers: ["ok", "ok"],
        comment: "",
        created_at: daysFromNow(-1, 18),
      },
      {
        name: "山田 花子",
        answers: ["ng", "ok"],
        comment: "明日は終日外出です。",
        created_at: daysFromNow(-1, 19),
      },
    ],
    status: "confirmed",
    confirmed_index: 1,
    created_at: daysFromNow(-3),
  },
  {
    id: "poll-3",
    title: "アクア食品様 契約前 最終すり合わせ",
    description: "先方の法務・情シスも交えて条件面の最終確認。45分想定。",
    organizer: "田中 美咲",
    location: "Google Meet（当日リンク送付）",
    duration_min: 45,
    candidates: [
      { start: daysFromNow(2, 11, 0), end: daysFromNow(2, 11, 45) },
      { start: daysFromNow(4, 14, 0), end: daysFromNow(4, 14, 45) },
      { start: daysFromNow(6, 16, 0), end: daysFromNow(6, 16, 45) },
    ],
    responses: [
      {
        name: "田中 美咲",
        answers: ["ok", "ok", "maybe"],
        comment: "どこでも調整可能です。",
        created_at: daysFromNow(-1, 10),
      },
      {
        name: "渡辺 由紀（アクア食品）",
        answers: ["maybe", "ok", "ng"],
        comment: "4日後の午後が最も都合が良いです。",
        created_at: daysFromNow(-1, 15),
      },
      {
        name: "佐藤 健太",
        answers: ["ng", "ok", "ok"],
        comment: "初日午前は別商談のため不可。",
        created_at: daysFromNow(0, 9),
      },
    ],
    status: "open",
    confirmed_index: null,
    created_at: daysFromNow(-1),
  },
];
