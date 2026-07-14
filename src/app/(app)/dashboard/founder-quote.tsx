"use client";

import { useCallback, useEffect, useState } from "react";
import { Quote, RefreshCw } from "lucide-react";
import { CEO_QUOTES } from "@/lib/quotes";
import { CEO_NAME } from "@/lib/constants";

// 代表 岡崎 佑真 の名言をトップにランダム表示する。
// SSRとの不一致を避けるため、マウント後にランダム選択する。
export function FounderQuote() {
  const [index, setIndex] = useState<number | null>(null);

  const pick = useCallback(() => {
    setIndex((prev) => {
      if (CEO_QUOTES.length <= 1) return 0;
      let next = prev;
      // 直前と同じ言葉を避ける
      while (next === prev) {
        next = Math.floor(Math.random() * CEO_QUOTES.length);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIndex(Math.floor(Math.random() * CEO_QUOTES.length));
  }, []);

  return (
    <div className="group relative mb-6 overflow-hidden rounded-3xl border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-sky-50 p-5 shadow-sm sm:p-6 dark:border-cyan-500/20 dark:from-cyan-950/30 dark:via-slate-900 dark:to-sky-950/20">
      {/* 装飾 */}
      <Quote
        className="pointer-events-none absolute -top-3 -left-2 h-24 w-24 rotate-180 text-cyan-500/10 dark:text-cyan-400/10"
        strokeWidth={1.5}
      />
      <div className="relative flex items-start gap-4">
        <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-sky-500 text-slate-900 shadow-lg shadow-cyan-500/25 sm:flex">
          <Quote className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold tracking-wider text-cyan-600 dark:text-cyan-400">
            今日の一言 — TODAY&apos;S WORD
          </p>
          <p className="mt-1.5 min-h-[3.5rem] text-lg leading-relaxed font-bold text-balance text-slate-800 sm:text-xl dark:text-slate-100">
            {index === null ? (
              <span className="inline-block h-6 w-3/4 animate-pulse rounded bg-cyan-100 align-middle dark:bg-cyan-500/10" />
            ) : (
              `“${CEO_QUOTES[index]}”`
            )}
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
            — {CEO_NAME}／DARE BASE LABO 代表
          </p>
        </div>
        <button
          onClick={pick}
          aria-label="別の言葉を表示"
          title="別の言葉を表示"
          className="shrink-0 cursor-pointer rounded-xl border border-cyan-200 bg-white/70 p-2 text-cyan-600 transition-all hover:bg-cyan-50 hover:text-cyan-700 active:scale-95 dark:border-cyan-500/30 dark:bg-slate-900/60 dark:text-cyan-400 dark:hover:bg-cyan-500/10"
        >
          <RefreshCw className="h-4 w-4 transition-transform group-hover:rotate-90" />
        </button>
      </div>
    </div>
  );
}
