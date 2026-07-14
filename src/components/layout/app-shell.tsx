"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  Briefcase,
  CalendarClock,
  CalendarDays,
  CheckSquare,
  Contact,
  FolderOpen,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Mic,
  Moon,
  Newspaper,
  Settings,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isSupabaseConfigured } from "@/lib/supabase";
import { UserProvider, useUser } from "@/lib/use-user";
import { DEMO_TEAM } from "@/lib/demo/team";
import { Avatar } from "@/components/ui";

const NAV_SECTIONS: {
  heading: string;
  items: { href: string; label: string; icon: ReactNode }[];
}[] = [
  {
    heading: "ホーム",
    items: [
      { href: "/dashboard", label: "ダッシュボード", icon: <LayoutDashboard className="h-[18px] w-[18px]" /> },
      { href: "/schedule", label: "スケジュール", icon: <CalendarDays className="h-[18px] w-[18px]" /> },
      { href: "/booking", label: "日程調整", icon: <CalendarClock className="h-[18px] w-[18px]" /> },
    ],
  },
  {
    heading: "営業活動",
    items: [
      { href: "/deals", label: "案件管理", icon: <Briefcase className="h-[18px] w-[18px]" /> },
      { href: "/tasks", label: "タスク", icon: <CheckSquare className="h-[18px] w-[18px]" /> },
      { href: "/contacts", label: "名刺管理", icon: <Contact className="h-[18px] w-[18px]" /> },
    ],
  },
  {
    heading: "ナレッジ・育成",
    items: [
      { href: "/knowledge", label: "ナレッジ", icon: <BookOpen className="h-[18px] w-[18px]" /> },
      { href: "/documents", label: "営業資料", icon: <FolderOpen className="h-[18px] w-[18px]" /> },
      { href: "/roleplay", label: "ロープレ練習", icon: <Mic className="h-[18px] w-[18px]" /> },
      { href: "/training", label: "勉強会", icon: <GraduationCap className="h-[18px] w-[18px]" /> },
    ],
  },
  {
    heading: "コミュニケーション",
    items: [
      { href: "/chat", label: "チャット", icon: <MessageSquare className="h-[18px] w-[18px]" /> },
      { href: "/board", label: "掲示板", icon: <Newspaper className="h-[18px] w-[18px]" /> },
    ],
  },
];

function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {/* モバイル用オーバーレイ */}
      {open && (
        <div
          className="fixed inset-0 z-30 animate-fade-in bg-slate-950/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200/80 bg-white transition-transform duration-300 dark:border-slate-800 dark:bg-slate-900",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* ロゴ */}
        <div className="flex h-16 items-center justify-between gap-2 border-b border-slate-200/80 px-5 dark:border-slate-800">
          <Link href="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
            <div className="bg-brand-gradient flex h-8 w-8 items-center justify-center rounded-xl shadow-lg shadow-indigo-500/30">
              <Sparkles className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="text-lg font-extrabold tracking-tight">
              Dare<span className="text-gradient">Base</span>
            </span>
          </Link>
          <button
            onClick={onClose}
            aria-label="メニューを閉じる"
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ナビゲーション */}
        <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4">
          {NAV_SECTIONS.map((section) => (
            <div key={section.heading} className="mb-5">
              <p className="mb-1.5 px-3 text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500">
                {section.heading}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active =
                    pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className={cn(
                          "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150",
                          active
                            ? "bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700 dark:from-indigo-500/15 dark:to-violet-500/15 dark:text-indigo-300"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200"
                        )}
                      >
                        <span
                          className={cn(
                            "transition-colors",
                            active
                              ? "text-indigo-600 dark:text-indigo-400"
                              : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300"
                          )}
                        >
                          {item.icon}
                        </span>
                        {item.label}
                        {active && (
                          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-500" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* フッター: 設定 */}
        <div className="border-t border-slate-200/80 p-3 dark:border-slate-800">
          <Link
            href="/settings"
            onClick={onClose}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              pathname.startsWith("/settings")
                ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
                : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/60"
            )}
          >
            <Settings className="h-[18px] w-[18px] text-slate-400" />
            設定
          </Link>
        </div>
      </aside>
    </>
  );
}

function Topbar({ onMenuOpen }: { onMenuOpen: () => void }) {
  const { user, isDemo, switchDemoUser, signOut } = useUser();
  const [dark, setDark] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // SSRでは<html>のクラスを参照できないため、ハイドレーション後に実テーマを同期する
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("dbl:theme", next ? "dark" : "light");
    } catch {}
  };

  return (
    <header className="glass sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200/80 px-4 sm:px-6 dark:border-slate-800">
      <button
        onClick={onMenuOpen}
        aria-label="メニューを開く"
        className="cursor-pointer rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"
      >
        <Menu className="h-5 w-5" />
      </button>

      {isDemo && (
        <span className="hidden items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 sm:inline-flex dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
          デモモード — データはこのブラウザにのみ保存されます
        </span>
      )}

      <div className="ml-auto flex items-center gap-1.5">
        <button
          onClick={toggleTheme}
          aria-label="テーマ切替"
          className="cursor-pointer rounded-xl p-2.5 text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>

        {/* ユーザーメニュー */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            className="flex cursor-pointer items-center gap-2.5 rounded-xl py-1.5 pr-3 pl-1.5 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Avatar name={user?.name ?? "?"} color={user?.color} size="sm" />
            <div className="hidden text-left sm:block">
              <p className="text-sm leading-tight font-semibold">{user?.name}</p>
              <p className="text-[11px] leading-tight text-slate-400">{user?.role}</p>
            </div>
          </button>

          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
              <div className="card absolute right-0 z-20 mt-2 w-64 animate-scale-in p-2">
                {isDemo ? (
                  <>
                    <p className="px-3 py-2 text-[11px] font-bold tracking-wider text-slate-400">
                      デモユーザーを切替
                    </p>
                    {DEMO_TEAM.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          switchDemoUser(m.name);
                          setUserMenuOpen(false);
                        }}
                        className={cn(
                          "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-800",
                          user?.name === m.name && "bg-indigo-50 dark:bg-indigo-500/10"
                        )}
                      >
                        <Avatar name={m.name} color={m.color} size="xs" />
                        <span className="flex-1">
                          <span className="block leading-tight font-medium">{m.name}</span>
                          <span className="block text-[11px] leading-tight text-slate-400">
                            {m.role}
                          </span>
                        </span>
                        {user?.name === m.name && (
                          <span className="h-2 w-2 rounded-full bg-indigo-500" />
                        )}
                      </button>
                    ))}
                  </>
                ) : (
                  <button
                    onClick={async () => {
                      await signOut();
                      setUserMenuOpen(false);
                      router.push("/login");
                    }}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                  >
                    <LogOut className="h-4 w-4" />
                    ログアウト
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function ShellInner({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, loading } = useUser();
  const router = useRouter();

  // Supabase接続時のみ未ログインなら /login へ
  useEffect(() => {
    if (isSupabaseConfigured() && !loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  return (
    <div className="min-h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:pl-64">
        <Topbar onMenuOpen={() => setSidebarOpen(true)} />
        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
          <div className="animate-fade-up">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <UserProvider>
      <ShellInner>{children}</ShellInner>
    </UserProvider>
  );
}
