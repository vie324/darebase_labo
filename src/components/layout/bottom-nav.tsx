"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  CalendarDays,
  Contact,
  LayoutDashboard,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";

// スマホ用の下部タブナビ（片手操作向け）。lg未満でのみ表示。
// 主要4モジュール + 「メニュー」（サイドバードロワーを開く）。

const ITEMS: { href: string; label: string; icon: ReactNode }[] = [
  { href: "/dashboard", label: "ホーム", icon: <LayoutDashboard className="h-[22px] w-[22px]" /> },
  { href: "/schedule", label: "予定", icon: <CalendarDays className="h-[22px] w-[22px]" /> },
  { href: "/deals", label: "案件", icon: <Briefcase className="h-[22px] w-[22px]" /> },
  { href: "/contacts", label: "名刺", icon: <Contact className="h-[22px] w-[22px]" /> },
];

export function BottomNav({ onMenuOpen }: { onMenuOpen: () => void }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="モバイルナビゲーション"
      className="glass fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 pb-safe lg:hidden dark:border-slate-800"
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around px-1">
        {ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[10px] font-medium transition-colors",
                active
                  ? "text-cyan-600 dark:text-cyan-400"
                  : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-full items-center justify-center rounded-xl transition-colors",
                  active && "bg-cyan-50 dark:bg-cyan-500/15"
                )}
              >
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
        <button
          onClick={onMenuOpen}
          aria-label="メニューを開く"
          className="flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[10px] font-medium text-slate-400 transition-colors hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
        >
          <span className="flex h-9 w-full items-center justify-center rounded-xl">
            <Menu className="h-[22px] w-[22px]" />
          </span>
          メニュー
        </button>
      </div>
    </nav>
  );
}
