"use client";

// 初回ロード時のスプラッシュスクリーン。
// ロゴがアニメーションで表示され、少し待ってからフェードアウトする。
// 同一セッション中は再表示しない（sessionStorage）。

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Logo, LogoMark } from "./logo";
import { APP_TAGLINE } from "@/lib/constants";

const SESSION_KEY = "dbl:splash-shown";

export function SplashScreen() {
  // SSRとの不一致を避けるため、マウント後に表示判定する
  const [phase, setPhase] = useState<"hidden" | "visible" | "leaving">("hidden");

  useEffect(() => {
    let shown = false;
    try {
      shown = sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {}
    if (shown) return;

    // sessionStorageはSSRで参照できないため、マウント後に表示を開始する
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhase("visible");
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {}

    const leaveTimer = setTimeout(() => setPhase("leaving"), 1500);
    const hideTimer = setTimeout(() => setPhase("hidden"), 2100);
    return () => {
      clearTimeout(leaveTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (phase === "hidden") return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white transition-opacity duration-500 dark:bg-slate-950",
        phase === "leaving" ? "pointer-events-none opacity-0" : "opacity-100"
      )}
    >
      {/* 背景のうっすらしたグロー */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/15 blur-3xl" />
      </div>

      <div className="relative flex flex-col items-center">
        <LogoMark className="h-20 w-auto drop-shadow-[0_0_24px_rgba(34,211,238,0.35)]" animated />
        <div className="mt-6 animate-fade-up [animation-delay:0.35s]">
          <Logo variant="stacked" className="text-2xl" />
        </div>
        <p className="mt-4 animate-fade-up text-sm text-slate-400 [animation-delay:0.55s] dark:text-slate-500">
          {APP_TAGLINE}
        </p>
      </div>

      {/* ローディングバー */}
      <div className="absolute bottom-20 h-1 w-40 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full w-full origin-left animate-splash-bar bg-gradient-to-r from-cyan-400 to-sky-400" />
      </div>
    </div>
  );
}
