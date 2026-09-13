"use client";

// 一覧の表示密度の切り替え（ゆったり / コンパクト）。
// 設定はブラウザに保存され、他の一覧にも同時に反映される。

import { Rows2, Rows3 } from "lucide-react";
import { useDensity, type Density } from "@/lib/use-density";
import { cn } from "@/lib/utils";

const OPTIONS: { key: Density; label: string; icon: typeof Rows2 }[] = [
  { key: "comfortable", label: "ゆったり", icon: Rows2 },
  { key: "compact", label: "コンパクト", icon: Rows3 },
];

export function DensityToggle({ className }: { className?: string }) {
  const { density, setDensity } = useDensity();

  return (
    <div
      role="group"
      aria-label="一覧の表示密度"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-xl bg-slate-100 p-0.5 dark:bg-slate-800/60",
        className
      )}
    >
      {OPTIONS.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => setDensity(key)}
          aria-pressed={density === key}
          title={label}
          className={cn(
            "flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors",
            density === key
              ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          )}
        >
          <Icon className="h-4 w-4" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
