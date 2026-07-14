import type { MetadataRoute } from "next";

// PWA マニフェスト。ホーム画面に追加するとアプリのように全画面(standalone)で起動する。
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DareBase LABO — 営業支援",
    short_name: "DareBase",
    description: "営業力を研究し、売上を上げる営業支援ツール",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    lang: "ja",
    icons: [
      {
        src: "/darebase-mark.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
