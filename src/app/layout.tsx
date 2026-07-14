import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "DareBase | 営業チームのオールインワン基地",
    template: "%s | DareBase",
  },
  description:
    "スケジュール・案件・名刺・ナレッジ・ロープレ練習まで、営業チームのすべてをひとつに。",
};

// ペイント前にテーマを適用してダークモードのちらつきを防ぐ
const themeScript = `
try {
  const t = localStorage.getItem("dbl:theme");
  if (t === "dark" || (!t && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.classList.add("dark");
  }
} catch (_) {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
