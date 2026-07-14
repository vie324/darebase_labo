import type { BoardPost } from "../types";
import { daysFromNow } from "../utils";

export const DEMO_POSTS: BoardPost[] = [
  {
    id: "post-1",
    title: "【重要】2026年度下期のキックオフについて",
    content: `下期キックオフを以下の日程で開催します。

- 日時: 10月第1週の金曜 15:00〜18:00
- 場所: 本社大会議室 + オンライン配信
- 内容: 上期表彰、下期目標発表、新商材の紹介

**全員参加必須**です。都合が悪い場合は事前に佐藤まで連絡してください。`,
    category: "announce",
    author_name: "佐藤 健太",
    pinned: true,
    likes: 12,
    comments: [
      {
        author_name: "田中 美咲",
        content: "承知しました！表彰楽しみにしています 🏆",
        created_at: daysFromNow(-3, 12),
      },
    ],
    created_at: daysFromNow(-3, 10),
  },
  {
    id: "post-2",
    title: "訪問時の手土産、みなさんどうしてますか？",
    content: `重要商談の初回訪問時、手土産を持っていくか迷っています。
最近は「不要」という会社も多いと聞きますが、みなさんの経験を教えてください。`,
    category: "question",
    author_name: "鈴木 大輔",
    pinned: false,
    likes: 5,
    comments: [
      {
        author_name: "山田 花子",
        content:
          "基本は不要派です。ただ地方の老舗企業さんは喜ばれることが多い印象。相手によりけりかと！",
        created_at: daysFromNow(-2, 14),
      },
      {
        author_name: "佐藤 健太",
        content: "コンプラ的にNGの会社もあるので、迷ったら持って行かないが正解です。",
        created_at: daysFromNow(-2, 15),
      },
    ],
    created_at: daysFromNow(-2, 11),
  },
  {
    id: "post-3",
    title: "営業ロープレ機能、使ってみた感想",
    content: `新しく入ったロープレ機能を試してみました。

自分の声を文字起こしで見返すと「えー」「あのー」が想像以上に多くて衝撃…。
録画で表情も確認できるので、オンライン商談の練習に特におすすめです。`,
    category: "share",
    author_name: "伊藤 翔",
    pinned: false,
    likes: 8,
    comments: [],
    created_at: daysFromNow(-1, 16),
  },
  {
    id: "post-4",
    title: "商談前日チェックリストを作ってみました📋",
    content: `毎回バタつくので、前日にやることを整理しました。よかったら使ってください。

- 訪問先の最新ニュース・IR確認
- 前回議事録と宿題の棚卸し
- 提案資料の誤字・金額の最終チェック
- 想定質問と切り返しの準備
- 移動ルート・到着時刻の確認

> 「準備した分だけ落ち着いて話せる」を実感しています。`,
    category: "share",
    author_name: "山田 花子",
    pinned: false,
    likes: 15,
    comments: [
      {
        author_name: "鈴木 大輔",
        content: "これ地味に効きますよね。IR確認は特に刺さります、真似します！",
        created_at: daysFromNow(-4, 10),
      },
      {
        author_name: "伊藤 翔",
        content: "ナレッジにも転記しておくと後輩が助かりそうです 🙌",
        created_at: daysFromNow(-4, 11),
      },
    ],
    created_at: daysFromNow(-4, 9),
  },
  {
    id: "post-5",
    title: "オンライン商談、画面共有のおすすめ設定ありますか？",
    content: `最近オンライン商談が増えてきたのですが、資料の文字が相手に小さく見えていないか不安です。
みなさんが実践している画面共有のコツや、見やすくする設定があれば教えてください🙏`,
    category: "question",
    author_name: "鈴木 大輔",
    pinned: false,
    likes: 3,
    comments: [],
    created_at: daysFromNow(-1, 9),
  },
  {
    id: "post-6",
    title: "今週のランチ、新しくできたお店が当たりでした🍜",
    content: `本社裏に新しくオープンした定食屋さん、コスパ最高でした。
14時以降は空いているので、外回りの合間にぜひ。雑談ついでの情報共有まで。`,
    category: "free",
    author_name: "田中 美咲",
    pinned: false,
    likes: 7,
    comments: [
      {
        author_name: "佐藤 健太",
        content: "気になっていたお店です！今度行ってみます 😋",
        created_at: daysFromNow(-5, 13),
      },
    ],
    created_at: daysFromNow(-5, 12),
  },
];
