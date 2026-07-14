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
];
