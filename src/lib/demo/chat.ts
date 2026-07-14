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
  // ---- 全体 ----
  {
    id: "msg-6",
    channel_id: "ch-general",
    author_name: "山田 花子",
    content: "了解です！パイプライン更新しました。今日は15時まで外回りなので、会議はオンライン参加でお願いします 🙏",
    created_at: daysFromNow(0, 9, 25),
  },
  {
    id: "msg-7",
    channel_id: "ch-general",
    author_name: "佐藤 健太",
    content: "OKです！議事録は共有しておくので安心してください。みなさん今週も頑張っていきましょう💪",
    created_at: daysFromNow(0, 9, 42),
  },
  // ---- 営業報告 ----
  {
    id: "msg-8",
    channel_id: "ch-sales",
    author_name: "鈴木 大輔",
    content: "承知しました！提案書のたたき台、明日午前中にドラフト共有します。料金表は最新版を使いますね。",
    created_at: daysFromNow(-1, 15, 45),
  },
  {
    id: "msg-9",
    channel_id: "ch-sales",
    author_name: "佐藤 健太",
    content: "今朝の架電、アポ2件獲得できました！どちらも来週訪問予定です。",
    created_at: daysFromNow(0, 8, 50),
  },
  {
    id: "msg-10",
    channel_id: "ch-sales",
    author_name: "山田 花子",
    content: "グローバル商事、無事に提案書お渡しできました。手応えありです！",
    created_at: daysFromNow(0, 13, 5),
  },
  {
    id: "msg-11",
    channel_id: "ch-sales",
    author_name: "山田 花子",
    content: "先方から追加で見積もり依頼も来たので、そのまま交渉ステージに進めます 🎯",
    created_at: daysFromNow(0, 13, 7),
  },
  {
    id: "msg-12",
    channel_id: "ch-sales",
    author_name: "田中 美咲",
    content: "さすがです！見積もりのテンプレ、営業資料フォルダに最新版あるので使ってくださいね。",
    created_at: daysFromNow(0, 13, 22),
  },
  // ---- 代理店事業 ----
  {
    id: "msg-13",
    channel_id: "ch-agency",
    author_name: "佐藤 健太",
    content: "ありがとうございます！勉強会ログ確認しました。デモの流れがすごく分かりやすかったです。",
    created_at: daysFromNow(-1, 10, 20),
  },
  {
    id: "msg-14",
    channel_id: "ch-agency",
    author_name: "伊藤 翔",
    content:
      "新商材の紹介資料が公開されました。商談前に目を通しておいてください → https://example.com/agency/new-feature",
    created_at: daysFromNow(0, 11, 10),
  },
  {
    id: "msg-15",
    channel_id: "ch-agency",
    author_name: "伊藤 翔",
    content: "デモ動画も同じページに載っています。パートナー各社への展開は来週からの予定です！",
    created_at: daysFromNow(0, 11, 12),
  },
  // ---- 雑談 ----
  {
    id: "msg-16",
    channel_id: "ch-random",
    author_name: "鈴木 大輔",
    content: "駅前に新しくできたカレー屋さん、ランチにおすすめです🍛 スパイスが効いてて午後の商談も気合い入ります",
    created_at: daysFromNow(-2, 12, 30),
  },
  {
    id: "msg-17",
    channel_id: "ch-random",
    author_name: "田中 美咲",
    content: "気になってました！今度みんなで行きましょう😊",
    created_at: daysFromNow(-2, 12, 45),
  },
];
