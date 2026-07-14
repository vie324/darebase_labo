import type { TrainingLog } from "../types";
import { dateFromNow, daysFromNow } from "../utils";

export const DEMO_TRAININGS: TrainingLog[] = [
  {
    id: "tr-1",
    title: "クラウド会計ツール『カウントA』新機能勉強会",
    tool_name: "カウントA",
    category: "SaaS",
    held_at: dateFromNow(-7),
    presenter: "伊藤 翔",
    summary: "4月アップデートの新機能（インボイス自動仕訳）と訴求ポイントの共有",
    content: `## アジェンダ
1. 新機能デモ（20分）
2. 想定FAQ（15分）
3. トーク練習（25分）

## 新機能の訴求ポイント
- インボイス制度対応の**自動仕訳**が目玉。経理工数を月10時間削減できる
- 競合B社はまだ手動対応 → 差別化ポイントとして使える

## 想定FAQ
**Q. 既存データの移行は？**
A. CSVインポートで対応可能。移行サポートは無償。

**Q. 料金は上がる？**
A. 既存プランのまま利用可能。

## 次回までの宿題
新機能を使ったデモを各自1回はロープレで練習しておくこと。`,
    video_url: "",
    material_url: "",
    tags: ["会計", "新機能", "代理店"],
    created_at: daysFromNow(-7),
  },
  {
    id: "tr-2",
    title: "通信回線商材の基礎研修（新人向け）",
    tool_name: "ひかりコネクト",
    category: "通信",
    held_at: dateFromNow(-21),
    presenter: "佐藤 健太",
    summary: "回線商材の基本、よくある断り文句と切り返しの練習ログ",
    content: `## 押さえるべき基礎知識
- 開通までのリードタイム: 通常2〜4週間
- 解約金・工事費の扱いは**必ず契約前に説明**（クレーム防止）

## よくある断り文句トップ3
1. 「今の回線で困ってない」
2. 「工事が面倒」
3. 「違約金がかかる」

それぞれの切り返しはナレッジの「切り返しトーク」カテゴリを参照。

## ロープレ結果メモ
新人2名とも料金説明で詰まる傾向 → 料金表の暗記より「概算＋あとで正確に」の型を推奨。`,
    video_url: "",
    material_url: "",
    tags: ["通信", "新人研修"],
    created_at: daysFromNow(-21),
  },
  {
    id: "tr-3",
    title: "人材紹介SaaS『ジンザイクラウド』提案トーク勉強会",
    tool_name: "ジンザイクラウド",
    category: "人材",
    held_at: dateFromNow(-3),
    presenter: "田中 美咲",
    summary: "採用DXツールの提案フローと、決裁者に刺さる訴求ポイントの共有",
    content: `## 商材概要
- 中小企業の採用業務をワンストップで支援する人材紹介プラットフォーム
- 求人票作成〜応募者管理〜面接調整までを一元化

## 決裁者に刺さる訴求
1. **採用単価の可視化** — 媒体ごとのコストを自動集計
2. **母集団形成の自動化** — スカウト文面をAIが下書き
3. 初期費用ゼロの成功報酬型 → 稟議が通りやすい

## 提案フロー
> ヒアリング → 現状の採用課題の言語化 → デモ → 見積 → クロージング

## ロープレ振り返り
「他社と何が違うの？」への切り返しが弱い。競合比較表を資料化して次回配布する。`,
    video_url: "https://example.com/rec/jinzai-cloud",
    material_url: "https://example.com/docs/jinzai-cloud-deck.pdf",
    tags: ["人材", "採用DX", "提案トーク"],
    created_at: daysFromNow(-3),
  },
  {
    id: "tr-4",
    title: "『カウントA』応用編 — インボイス実務Q&Aログ",
    tool_name: "カウントA",
    category: "SaaS",
    held_at: dateFromNow(-2),
    presenter: "伊藤 翔",
    summary: "現場から挙がったインボイス関連の質問と、その場での回答をまとめた実務ログ",
    content: `## 目的
前回の新機能勉強会のフォローアップ。実際に提案して出た**顧客の生の質問**を持ち寄って回答をすり合わせる。

## 実務Q&A
**Q. 免税事業者の取引先が多い顧客への訴求は？**
A. 「登録番号の有無を自動判定 → 仕訳を出し分け」できる点を推す。手作業のミス削減が刺さる。

**Q. 他社会計ソフトからの乗り換え負荷は？**
A. 主要3サービスは変換インポートに対応。移行チェックリストを配布する。

## 決定事項
- 競合比較表を営業資料に追加（担当: 伊藤）
- 移行チェックリストをナレッジに登録`,
    video_url: "",
    material_url: "https://example.com/docs/counta-invoice-qa.pdf",
    tags: ["会計", "インボイス", "実務"],
    created_at: daysFromNow(-2),
  },
  {
    id: "tr-5",
    title: "Web広告運用ツール『アドブースト』基礎勉強会",
    tool_name: "アドブースト",
    category: "広告",
    held_at: dateFromNow(-10),
    presenter: "鈴木 大輔",
    summary: "運用型広告の基礎と、代理店として提案する際の見積の考え方",
    content: `## 押さえる基礎
- 運用型広告（リスティング/SNS）の仕組みと課金モデル
- 「予算 × 運用手数料20%」が基本の見積構造

## 提案の型
1. 現状の集客チャネルをヒアリング
2. 目標CPA（獲得単価）を握る
3. 初月はテスト予算 → 数値を見て増額提案

## 注意点
効果を過度に約束しないこと。**「改善サイクルを回す」提案**に徹する。`,
    video_url: "https://example.com/rec/adboost-basic",
    material_url: "",
    tags: ["広告", "運用型", "新人研修"],
    created_at: daysFromNow(-10),
  },
  {
    id: "tr-6",
    title: "社内SFA『DARE BASE』活用勉強会 — 案件入力の徹底",
    tool_name: "DARE BASE",
    category: "社内ツール",
    held_at: dateFromNow(-35),
    presenter: "佐藤 健太",
    summary: "案件管理の入力ルール統一と、日報・活動ログの運用ルールの共有",
    content: `## 背景
案件のステージ更新が属人化しており、パイプラインの数字が読めない。入力ルールを統一する。

## 入力ルール
- 商談したら**その日のうちに**活動ログを残す
- ステージは「次アクションが確定した時点」で進める
- 失注時は理由を必ずメモに残す（横展開のため）

## 運用
毎週月曜の朝会でパイプラインをレビューする。`,
    video_url: "",
    material_url: "https://example.com/docs/darebase-sfa-guide.pdf",
    tags: ["社内ツール", "SFA", "運用ルール"],
    created_at: daysFromNow(-35),
  },
  {
    id: "tr-7",
    title: "『ひかりコネクト』料金改定アップデート勉強会",
    tool_name: "ひかりコネクト",
    category: "通信",
    held_at: dateFromNow(-1),
    presenter: "山田 花子",
    summary: "7月からの新料金プランと、既存顧客への案内トークの注意点",
    content: `## 変更点サマリ
- スタンダードプランが月額200円値上げ、代わりに**通信速度が1.5倍**
- 長期利用割引の適用条件が緩和（24ヶ月 → 12ヶ月）

## 既存顧客への案内
> 「値上げ」ではなく「速度アップを含むプラン刷新」として案内する

- 速度アップのメリットを先に伝える
- 割引条件の緩和で**実質据え置き**になるケースを試算して提示

## 想定クレームと対応
「勝手に上がった」への対応 → 事前通知済みである旨と、割引で相殺できる旨を丁寧に説明。`,
    video_url: "https://example.com/rec/hikari-price-update",
    material_url: "https://example.com/docs/hikari-price-2607.pdf",
    tags: ["通信", "料金改定", "既存顧客"],
    created_at: daysFromNow(-1),
  },
];
