"use client";

// 事業部の切り替え。銀行営業とアライアンス営業で同じ画面を出し分ける。
// 選択はブラウザに保存され、他の画面にも引き継がれる（lib/use-business-unit.ts）。

import { Handshake, Landmark } from "lucide-react";
import { ALLIANCE, BANKING, UNIT_TERMS, type BusinessUnitSlug } from "@/lib/business-units";
import { cn } from "@/lib/utils";

const ICONS: Record<BusinessUnitSlug, React.ReactNode> = {
  [BANKING]: <Landmark className="h-3.5 w-3.5" />,
  [ALLIANCE]: <Handshake className="h-3.5 w-3.5" />,
};

export function UnitSwitch({
  slug,
  onChange,
  className,
}: {
  slug: BusinessUnitSlug;
  onChange: (next: BusinessUnitSlug) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label="事業部"
      className={cn(
        "flex snap-x gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-slate-800/60",
        className
      )}
    >
      {([BANKING, ALLIANCE] as BusinessUnitSlug[]).map((key) => (
        <button
          key={key}
          role="tab"
          aria-selected={slug === key}
          onClick={() => onChange(key)}
          className={cn(
            "flex shrink-0 cursor-pointer snap-start items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all sm:px-3.5",
            slug === key
              ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          )}
        >
          {ICONS[key]}
          {UNIT_TERMS[key].unit}
        </button>
      ))}
    </div>
  );
}
