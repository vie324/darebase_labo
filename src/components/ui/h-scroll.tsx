"use client";

// =============================================================
// HScroll — 横スクロール領域（カンバンの列・フィルタチップなど）
//
// 画面幅に収まらない列やチップが「そこで終わり」に見えてしまうと、
// 先にある列（発注書待ち・受注・失注など）に気づけない。
// 端のフェードと送りボタンで「まだ続きがある」ことを示す。
// =============================================================

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function HScroll({
  children,
  className,
  /** 送りボタン1回のスクロール量(px) */
  step = 320,
  label = "横スクロール領域",
}: {
  children: ReactNode;
  className?: string;
  step?: number;
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);
  // カンバンのカードをドラッグしている間は送りボタンを消す。
  // 端に置いたボタンがドロップ先を奪ってしまうため。
  const [dragging, setDragging] = useState(false);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setAtStart(el.scrollLeft <= 1);
    // 1px の誤差で矢印が残らないように余裕を持たせる
    setAtEnd(max <= 1 || el.scrollLeft >= max - 1);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // 初回計測は次フレームで行う（レンダー中の setState を避ける）
    const raf = requestAnimationFrame(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [measure]);

  useEffect(() => {
    const start = () => setDragging(true);
    const end = () => setDragging(false);
    window.addEventListener("dragstart", start);
    window.addEventListener("dragend", end);
    window.addEventListener("drop", end);
    return () => {
      window.removeEventListener("dragstart", start);
      window.removeEventListener("dragend", end);
      window.removeEventListener("drop", end);
    };
  }, []);

  const scrollBy = (dir: 1 | -1) => {
    ref.current?.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  const arrow =
    "absolute top-1/2 z-10 hidden -translate-y-1/2 cursor-pointer rounded-full border border-slate-200 bg-white p-1.5 text-slate-500 shadow-md transition-colors hover:text-slate-900 sm:flex dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-white";
  const fade =
    "pointer-events-none absolute inset-y-0 z-[5] w-10 from-slate-50 to-transparent dark:from-slate-950";

  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={measure}
        role="group"
        aria-label={label}
        className={cn("scrollbar-thin overflow-x-auto", className)}
      >
        {children}
      </div>

      {!atStart && (
        <>
          <div className={cn(fade, "left-0 bg-gradient-to-r")} aria-hidden="true" />
          {!dragging && (
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            aria-label="前へスクロール"
            className={cn(arrow, "left-1")}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          )}
        </>
      )}
      {!atEnd && (
        <>
          <div className={cn(fade, "right-0 bg-gradient-to-l")} aria-hidden="true" />
          {!dragging && (
          <button
            type="button"
            onClick={() => scrollBy(1)}
            aria-label="次へスクロール"
            className={cn(arrow, "right-1")}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          )}
        </>
      )}
    </div>
  );
}
