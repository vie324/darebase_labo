# DareBase — 営業チームのオールインワン基地

サイボウズのようなグループウェアの使いやすさを目指した、**営業会社向けオールインワン管理ツール**です。
Next.js (Vercel) + Supabase で動作します。

## 機能一覧

| モジュール | 内容 |
| --- | --- |
| 📊 ダッシュボード | 今日の予定・自分のタスク・パイプライン・最近の活動を一望 |
| 📅 スケジュール | 月/週/リスト表示のチームカレンダー。カテゴリ・担当者フィルタ |
| 🗓 日程調整 | 候補日を出して◯△×で回答を集約。確定後は Google カレンダー登録・ICS 出力・社内予定登録 |
| 💼 案件管理 | ステージ別カンバン（ドラッグ&ドロップ）、活動履歴、レポート（パイプライン・受注率・担当者別） |
| ✅ タスク管理 | かんばん + リスト、優先度・期限管理、クイック追加 |
| 🪪 名刺管理 | 名刺画像付きの連絡先データベース。タグ・会社別ビュー・CSV エクスポート |
| 📚 ナレッジ共有 | Markdown 記事、カテゴリ・タグ、いいね・閲覧数、ピン留め |
| 📁 営業資料 | 提案書・料金表などのファイルライブラリ（Supabase Storage） |
| 🎙 ロープレ練習 | トークスクリプト管理 → 録音/画面録画 → リアルタイム文字起こし → 話速・フィラー分析 → メンバーからのフィードバック |
| 🎓 勉強会 | 営業代理業の商材・ツール勉強会の議事録/録画/資料アーカイブ |
| 💬 チャット | チャンネル制チームチャット（Supabase Realtime 対応） |
| 📌 掲示板 | お知らせ・質問・共有のスレッド + コメント |

## デモモード

**Supabase の設定なしでもすべての機能が動きます。**
環境変数が未設定の場合は自動的にデモモードになり、サンプルデータ入りで起動、データはブラウザの localStorage に保存されます。まず試す → 気に入ったら Supabase を接続、という流れを想定しています。

```bash
npm install
npm run dev
# http://localhost:3000 を開く（デモモードで起動）
```

## 本番セットアップ

### 1. Supabase

1. [supabase.com](https://supabase.com) でプロジェクトを作成
2. ダッシュボードの **SQL Editor** で [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) を実行
   （全テーブル・RLS ポリシー・Realtime 設定・Storage バケットが作成されます）
3. **Project Settings → API** から URL と anon key を取得

### 2. 環境変数

`.env.example` をコピーして `.env.local` を作成:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

設定するとログイン画面（メール + パスワード）が有効になり、データがクラウド保存・チーム共有に切り替わります。

### 3. Vercel へデプロイ

1. このリポジトリを GitHub から Vercel にインポート
2. Environment Variables に上記 2 つを設定
3. Deploy

### 4. Google カレンダー連携について

「日程調整」モジュールは、確定した予定を **Google カレンダーの予定作成画面へワンクリックで引き継ぐ** 方式（認証不要）と **ICS ダウンロード**（Outlook 等）に対応しています。

組織全体での双方向同期（空き時間の自動取得・自動予定作成）を行いたい場合は、Google Cloud Console で OAuth 2.0 クライアントを作成し、Google Calendar API を有効化した上でサーバーサイド連携を追加実装してください（このリポジトリの日程調整データモデルはそのまま流用できます）。

## 技術構成

- **Next.js 16**（App Router / TypeScript / Turbopack）
- **Tailwind CSS v4** — ダークモード対応のカスタムデザインシステム
- **Supabase** — PostgreSQL / Auth / Storage / Realtime
- **lucide-react** — アイコン
- ロープレ機能: `MediaRecorder` / `getDisplayMedia` / Web Speech API（文字起こし。Chrome / Edge 推奨）

## プロジェクト構成

```
src/
├── app/
│   ├── (app)/           # サイドバー付きアプリ本体（各モジュール）
│   ├── login/           # ログイン（Supabase Auth）
│   ├── layout.tsx       # ルートレイアウト（テーマ初期化）
│   └── globals.css      # デザインシステム
├── components/
│   ├── ui/              # 共通UIコンポーネント
│   └── layout/          # サイドバー・トップバー
└── lib/
    ├── types.ts         # 全エンティティ型定義
    ├── constants.ts     # カテゴリ・ステージのラベル/色
    ├── use-collection.ts# Supabase/デモ両対応のデータフック
    ├── use-user.tsx     # ユーザーコンテキスト
    ├── supabase.ts      # クライアント + ファイル保存
    └── demo/            # デモ用シードデータ
supabase/
└── migrations/          # DBスキーマ（SQL）
```

## 補足

- ブラウザ対応: 文字起こし（Web Speech API）は Chrome / Edge のみ。他ブラウザでは録音 + 手動文字起こしにフォールバックします
- RLS は「認証済みユーザーに全権限」の社内ツール前提です。部署別権限などが必要な場合は `0001_init.sql` のポリシーを調整してください
