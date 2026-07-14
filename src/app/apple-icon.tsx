import { ImageResponse } from "next/og";

// iOS「ホーム画面に追加」用アイコン（PNGを動的生成）。
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          background: "#ffffff",
        }}
      >
        {/* 上向き三角 △ */}
        <div
          style={{
            width: 0,
            height: 0,
            borderLeft: "38px solid transparent",
            borderRight: "38px solid transparent",
            borderBottom: "50px solid #22d3ee",
          }}
        />
        {/* 下向き三角 ▽ */}
        <div
          style={{
            width: 0,
            height: 0,
            borderLeft: "38px solid transparent",
            borderRight: "38px solid transparent",
            borderTop: "50px solid #22d3ee",
          }}
        />
      </div>
    ),
    size
  );
}
