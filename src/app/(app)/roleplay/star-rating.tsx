"use client";

// ロープレ練習 — 星評価コンポーネント（表示 / 入力の両対応）

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "h-3.5 w-3.5",
  md: "h-5 w-5",
  lg: "h-7 w-7",
};

/** 読み取り専用の星表示（平均値などに対応、半端は四捨五入で塗り分け） */
export function StarRating({
  value,
  size = "sm",
  className,
}: {
  value: number;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-0.5", className)} aria-label={`評価 ${value} / 5`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={cn(
            SIZES[size],
            s <= Math.round(value)
              ? "fill-amber-400 text-amber-400"
              : "text-slate-300 dark:text-slate-600"
          )}
        />
      ))}
    </div>
  );
}

/** クリックで 1〜5 を選択できる入力用の星 */
export function StarRatingInput({
  value,
  onChange,
  size = "lg",
}: {
  value: number;
  onChange: (v: number) => void;
  size?: keyof typeof SIZES;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="評価を選択">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={value === s}
          aria-label={`${s} つ星`}
          onClick={() => onChange(s)}
          onMouseEnter={() => setHover(s)}
          onMouseLeave={() => setHover(0)}
          className="cursor-pointer rounded-md p-0.5 transition-transform hover:scale-110 active:scale-95"
        >
          <Star
            className={cn(
              SIZES[size],
              "transition-colors",
              s <= shown
                ? "fill-amber-400 text-amber-400"
                : "text-slate-300 dark:text-slate-600"
            )}
          />
        </button>
      ))}
    </div>
  );
}
