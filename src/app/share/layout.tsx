import type { Metadata } from "next";

// 紹介状況の共有ページ（/share/[token]）の共通設定。
// URL のトークンが鍵なので、検索エンジンに載せず、リンク先へ URL を漏らさない。
export const metadata: Metadata = {
  title: "ご紹介案件の進捗",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function ShareLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
