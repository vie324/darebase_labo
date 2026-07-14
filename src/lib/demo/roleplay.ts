import type { RoleplaySession, TalkScript } from "../types";
import { daysFromNow } from "../utils";

export const DEMO_SCRIPTS: TalkScript[] = [
  {
    id: "script-1",
    title: "新規テレアポ標準スクリプト v2",
    scenario: "IT企業の情シス部門への初回架電。受付突破〜アポ獲得まで。",
    content: `## 受付突破
「お世話になっております。DareBase株式会社の◯◯と申します。**情報システムのご担当者様**はいらっしゃいますでしょうか。」

（用件を聞かれたら）
「営業効率化の件で、◯◯様宛にご案内の連絡です。」

## 担当者フック
「突然のお電話失礼いたします。実は**同業の△△様で営業工数を30%削減**した事例がございまして、同じ課題をお持ちではないかと思いお電話しました。」

## アポ打診
「詳しい資料もございますので、**15分だけ**オンラインでご説明の機会をいただけないでしょうか。来週の火曜と木曜ですと、どちらがご都合よろしいですか？」

## 切り返し
- 「忙しい」→「承知しました。では資料だけお送りし、来週改めてお電話します」
- 「間に合ってる」→「皆様そうおっしゃるのですが、比較されたことはありますか？」`,
    category: "テレアポ",
    author_name: "佐藤 健太",
    updated_at: daysFromNow(-10),
    created_at: daysFromNow(-50),
  },
  {
    id: "script-2",
    title: "クロージング（見積提示後）",
    scenario: "見積提示済みの商談で、契約の意思決定を促すシーン。",
    content: `## 温度感の確認
「ここまでのご説明で、気になる点や不安な点はございますか？」

## テストクロージング
「仮に導入いただくとしたら、**いつ頃から使い始めたい**イメージでしょうか？」

## 特典付きクローズ
「今月中にご契約いただけますと、初期設定サポートを無償でお付けできます。」

## 沈黙の使い方
条件提示後は**こちらから話さない**。沈黙は相手が考えている時間。`,
    category: "クロージング",
    author_name: "田中 美咲",
    updated_at: daysFromNow(-15),
    created_at: daysFromNow(-35),
  },
];

export const DEMO_ROLEPLAY_SESSIONS: RoleplaySession[] = [
  {
    id: "rp-1",
    script_id: "script-1",
    script_title: "新規テレアポ標準スクリプト v2",
    user_name: "鈴木 大輔",
    mode: "audio",
    duration_sec: 185,
    transcript:
      "お世話になっております。DareBase株式会社の鈴木と申します。情報システムのご担当者様はいらっしゃいますでしょうか。…実は同業の企業様で営業工数を30%削減した事例がございまして、ぜひ15分だけお時間をいただけないでしょうか。",
    self_note: "受付突破はスムーズだったが、アポ打診で選択肢を提示し忘れた。",
    feedbacks: [
      {
        author_name: "佐藤 健太",
        rating: 4,
        comment:
          "声のトーンが良い。アポ打診は「火曜と木曜どちらが」の二択提示を忘れずに。",
        created_at: daysFromNow(-2, 18),
      },
    ],
    media_url: "",
    created_at: daysFromNow(-2, 17),
  },
];
