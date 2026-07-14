"use client";

/* eslint-disable @next/next/no-img-element */

// 初回ロード時のスプラッシュ。動きのあるブランド演出:
//  - 背景のグラデーショングロー（脈動）
//  - シンボルマーク（△▽）を線で「描く」アニメ + 浮遊
//  - 実ロゴのワードマークがフェードアップ + シマー（光沢）スイープ
//  - ローディングバー
// 同一セッション中は再表示しない（sessionStorage）。

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { APP_TAGLINE } from "@/lib/constants";

const SESSION_KEY = "dbl:splash-shown";

/** 線で描かれる △▽ マーク（スプラッシュ専用の可変ロゴ） */
function DrawingMark() {
  const common = {
    stroke: "currentColor",
    strokeWidth: 3.2,
    strokeLinejoin: "round" as const,
    fill: "none",
    pathLength: 100,
    strokeDasharray: 100,
  };
  return (
    <svg viewBox="0 0 40 48" className="h-24 w-24 text-cyan-400" aria-hidden="true">
      <path
        d="M20 3 L36 22 H4 Z"
        {...common}
        style={{ strokeDashoffset: 100, animation: "draw-stroke 0.7s ease-out 0.1s forwards" }}
      />
      <path
        d="M4 26 H36 L20 45 Z"
        {...common}
        style={{ strokeDashoffset: 100, animation: "draw-stroke 0.7s ease-out 0.35s forwards" }}
      />
    </svg>
  );
}

export function SplashScreen() {
  const [phase, setPhase] = useState<"hidden" | "visible" | "leaving">("hidden");

  useEffect(() => {
    let shown = false;
    try {
      shown = sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {}
    if (shown) return;

    // sessionStorageはSSRで参照できないため、マウント後に開始する
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhase("visible");
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {}

    const leaveTimer = setTimeout(() => setPhase("leaving"), 1900);
    const hideTimer = setTimeout(() => setPhase("hidden"), 2500);
    return () => {
      clearTimeout(leaveTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (phase === "hidden") return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-white transition-opacity duration-500 dark:bg-slate-950",
        phase === "leaving" ? "pointer-events-none opacity-0" : "opacity-100"
      )}
    >
      {/* 背景の脈動グロー（transform競合を避けるため中央寄せは外側、アニメは内側） */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="animate-glow h-[520px] w-[520px] rounded-full bg-cyan-400/20 blur-3xl" />
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="animate-spin-slow h-[380px] w-[380px] rounded-full bg-[conic-gradient(from_0deg,transparent,rgba(34,211,238,0.14),transparent_60%)] blur-2xl" />
        </div>
      </div>

      <div className="relative flex flex-col items-center">
        {/* 浮遊する描画マーク */}
        <div className="animate-float drop-shadow-[0_0_24px_rgba(34,211,238,0.4)]">
          <DrawingMark />
        </div>

        {/* 実ロゴのワードマーク（フェードアップ + シマースイープ） */}
        <div className="relative mt-6 animate-fade-up overflow-hidden [animation-delay:0.7s]">
          <img
            src="/darebase-logo.png"
            alt="DARE BASE LABO"
            className="block h-14 w-auto dark:hidden"
          />
          <img
            src="/darebase-logo-dark.png"
            alt=""
            aria-hidden="true"
            className="hidden h-14 w-auto dark:block"
          />
          {/* 光沢スイープ */}
          <span
            className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/60 to-transparent"
            style={{ animation: "sweep 1.1s ease-in-out 1.1s" }}
          />
        </div>

        <p className="mt-4 animate-fade-up text-sm font-medium text-slate-400 [animation-delay:1s] dark:text-slate-500">
          {APP_TAGLINE}
        </p>
      </div>

      {/* ローディングバー */}
      <div className="absolute bottom-[18%] h-1 w-44 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="animate-splash-bar h-full w-full origin-left bg-gradient-to-r from-cyan-400 to-sky-400" />
      </div>
    </div>
  );
}
