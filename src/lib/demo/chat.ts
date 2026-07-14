import type { Channel, ChatMessage } from "../types";
import { daysFromNow } from "../utils";

export const DEMO_CHANNELS: Channel[] = [
  {
    id: "ch-general",
    name: "全体",
    description: "チーム全体の連絡・雑談",
    emoji: "🏠",
    created_at: daysFromNow(-100),
  },
  {
    id: "ch-sales",
    name: "営業報告",
    description: "日々の商談・架電の報告と相談",
    emoji: "📈",
    created_at: daysFromNow(-100),
  },
  {
    id: "ch-agency",
    name: "代理店事業",
    description: "営業代理業の商材情報・パートナー連絡",
    emoji: "🤝",
    created_at: daysFromNow(-80),
  },
  {
    id: "ch-random",
    name: "雑談",
    description: "ランチ・趣味・なんでも",
    emoji: "☕",
    created_at: daysFromNow(-100),
  },
];

export const DEMO_MESSAGES: ChatMessage[] = [
  {
    id: "msg-1",
    channel_id: "ch-general",
    author_name: "佐藤 健太",
    content: "今週の営業会議は本日16時からです。パイプラインの更新をお願いします！",
    created_at: daysFromNow(0, 9, 5),
  },
  {
    id: "msg-2",
    channel_id: "ch-general",
    author_name: "田中 美咲",
    content: "承知しました！ミライテックの件、交渉ステージに進んだので共有します 🎉",
    created_at: daysFromNow(0, 9, 12),
  },
  {
    id: "msg-3",
    channel_id: "ch-general",
    author_name: "鈴木 大輔",
    content: "おめでとうございます！切り返しトークのナレッジ、早速使わせてもらってます",
    created_at: daysFromNow(0, 9, 20),
  },
  {
    id: "msg-4",
    channel_id: "ch-sales",
    author_name: "山田 花子",
    content:
      "グローバル商事の渡辺様から返信あり。提案書は今週中に欲しいとのことなので、優先で進めます。",
    created_at: daysFromNow(-1, 15, 30),
  },
  {
    id: "msg-5",
    channel_id: "ch-agency",
    author_name: "伊藤 翔",
    content:
      "カウントAの勉強会ログをアップしました。新機能のデモ、各自ロープレ練習お願いします！",
    created_at: daysFromNow(-1, 10, 0),
  },
];
