import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "DareBase LABO | 営業力を研究し、売上を上げる",
    template: "%s | DareBase LABO",
  },
  description:
    "営業力を研究し売上を上げる営業支援ラボ。スケジュール・案件・名刺・ナレッジ・ロープレ練習・日程調整まで、営業チームのすべてをひとつに。",
  applicationName: "DareBase LABO",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DareBase LABO",
  },
  formatDetection: { telephone: false },
};

// スマホ最適化: 端末幅にフィット、セーフエリア(viewport-fit=cover)、テーマカラー
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
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
