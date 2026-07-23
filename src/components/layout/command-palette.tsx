"use client";

// グローバルコマンドパレット（⌘K / Ctrl+K）。
// モジュールへの高速ナビ、データ横断検索（名刺・案件・ナレッジ・タスク）、
// クイックアクション（テーマ切替・設定）をキーボードで操作できる。

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  Calendar,
  CalendarClock,
  CheckSquare,
  CornerDownLeft,
  Contact as ContactIcon,
  FileText,
  BookOpen,
  LayoutDashboard,
  Mic,
  MessageSquare,
  Moon,
  Newspaper,
  GraduationCap,
  Receipt,
  Search,
  Settings,
  Sun,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCollection } from "@/lib/use-collection";
import { useAccess } from "@/lib/use-access";
import { useToast } from "@/components/ui/toast";
import type { ReactNode } from "react";

interface CmdItem {
  id: string;
  group: string;
  label: string;
  sub?: string;
  icon: ReactNode;
  keywords: string;
  run: () => void;
}

const IC = "h-4 w-4";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const router = useRouter();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 横断検索用データ
  const contacts = useCollection("contacts");
  const deals = useCollection("deals");
  const knowledge = useCollection("knowledge");
  const tasks = useCollection("tasks");
  const { isExecutive } = useAccess();

  // ⌘K / Ctrl+K でトグル
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    // カスタムイベントでも開ける（トップバーの検索ボタン用）
    const openEvt = () => setOpen(true);
    window.addEventListener("dbl:open-command", openEvt);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("dbl:open-command", openEvt);
    };
  }, []);

  useEffect(() => {
    if (open) {
      // パレットを開いたときの初期化（開閉という外部イベントへの同期）
      /* eslint-disable react-hooks/set-state-in-effect */
      setQuery("");
      setActive(0);
      /* eslint-enable react-hooks/set-state-in-effect */
      // フォーカスは描画後に
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      document.body.style.overflow = "hidden";
      return () => {
        clearTimeout(t);
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  const go = useCallback(
    (href: string) => {
      router.push(href);
      setOpen(false);
    },
    [router]
  );

  const toggleTheme = useCallback(() => {
    const isDark = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem("dbl:theme", isDark ? "dark" : "light");
    } catch {}
    toast(isDark ? "ダークモードに切り替えました" : "ライトモードに切り替えました", "info");
    setOpen(false);
  }, [toast]);

  const items = useMemo<CmdItem[]>(() => {
    const nav: CmdItem[] = [
      { id: "n-dash", group: "移動", label: "ダッシュボード", icon: <LayoutDashboard className={IC} />, keywords: "dashboard home ホーム", run: () => go("/dashboard") },
      { id: "n-sched", group: "移動", label: "スケジュール", icon: <Calendar className={IC} />, keywords: "schedule calendar 予定 カレンダー", run: () => go("/schedule") },
      { id: "n-book", group: "移動", label: "日程調整", icon: <CalendarClock className={IC} />, keywords: "booking 調整 予約", run: () => go("/booking") },
      { id: "n-deal", group: "移動", label: "案件管理", icon: <Briefcase className={IC} />, keywords: "deals 案件 パイプライン", run: () => go("/deals") },
      { id: "n-task", group: "移動", label: "タスク", icon: <CheckSquare className={IC} />, keywords: "tasks todo タスク", run: () => go("/tasks") },
      { id: "n-contact", group: "移動", label: "名刺管理", icon: <ContactIcon className={IC} />, keywords: "contacts 名刺 連絡先", run: () => go("/contacts") },
      { id: "n-billing", group: "移動", label: "請求・支払", icon: <Receipt className={IC} />, keywords: "billing invoice 請求 請求書 支払 入金 消込 明細", run: () => go("/billing") },
      ...(isExecutive
        ? [{ id: "n-exec", group: "移動", label: "経営ダッシュボード", icon: <TrendingUp className={IC} />, keywords: "executive 経営 売上 粗利 キャッシュフロー", run: () => go("/executive") } satisfies CmdItem]
        : []),
      { id: "n-know", group: "移動", label: "ナレッジ", icon: <BookOpen className={IC} />, keywords: "knowledge ナレッジ 記事", run: () => go("/knowledge") },
      { id: "n-doc", group: "移動", label: "営業資料", icon: <FileText className={IC} />, keywords: "documents 資料 ファイル", run: () => go("/documents") },
      { id: "n-role", group: "移動", label: "ロープレ練習", icon: <Mic className={IC} />, keywords: "roleplay ロープレ 練習", run: () => go("/roleplay") },
      { id: "n-train", group: "移動", label: "勉強会", icon: <GraduationCap className={IC} />, keywords: "training 勉強会", run: () => go("/training") },
      { id: "n-chat", group: "移動", label: "チャット", icon: <MessageSquare className={IC} />, keywords: "chat チャット", run: () => go("/chat") },
      { id: "n-board", group: "移動", label: "掲示板", icon: <Newspaper className={IC} />, keywords: "board 掲示板", run: () => go("/board") },
    ];
    const actions: CmdItem[] = [
      { id: "a-theme", group: "アクション", label: "テーマを切り替え", icon: <Moon className={IC} />, keywords: "theme dark light テーマ ダーク", run: toggleTheme },
      { id: "a-settings", group: "アクション", label: "設定を開く", icon: <Settings className={IC} />, keywords: "settings 設定", run: () => go("/settings") },
    ];
    const data: CmdItem[] = [
      ...contacts.items.slice(0, 40).map((c) => ({
        id: `c-${c.id}`,
        group: "名刺",
        label: c.name,
        sub: [c.company, c.title].filter(Boolean).join(" ・ "),
        icon: <ContactIcon className={IC} />,
        keywords: `${c.name} ${c.name_kana} ${c.company} ${c.email}`,
        run: () => go("/contacts"),
      })),
      ...deals.items.slice(0, 40).map((d) => ({
        id: `d-${d.id}`,
        group: "案件",
        label: d.name,
        sub: d.company,
        icon: <Briefcase className={IC} />,
        keywords: `${d.name} ${d.company} ${d.contact_name}`,
        run: () => go("/deals"),
      })),
      ...knowledge.items.slice(0, 40).map((k) => ({
        id: `k-${k.id}`,
        group: "ナレッジ",
        label: k.title,
        sub: k.author_name,
        icon: <BookOpen className={IC} />,
        keywords: `${k.title} ${k.tags.join(" ")}`,
        run: () => go("/knowledge"),
      })),
      ...tasks.items.slice(0, 40).map((t) => ({
        id: `t-${t.id}`,
        group: "タスク",
        label: t.title,
        sub: t.assignee_name,
        icon: <CheckSquare className={IC} />,
        keywords: `${t.title} ${t.assignee_name} ${t.related_deal}`,
        run: () => go("/tasks"),
      })),
    ];
    return [...nav, ...actions, ...data];
  }, [contacts.items, deals.items, knowledge.items, tasks.items, isExecutive, go, toggleTheme]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.filter((i) => i.group === "移動" || i.group === "アクション");
    return items
      .filter((i) => (i.label + " " + i.keywords).toLowerCase().includes(q))
      .slice(0, 40);
  }, [items, query]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[active]?.run();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  // アクティブ項目までスクロール
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  // グループごとに区切って表示
  let lastGroup = "";

  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 animate-fade-in bg-slate-950/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="card relative flex max-h-[70vh] w-full max-w-xl animate-scale-in flex-col overflow-hidden p-0">
        {/* 入力 */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 dark:border-slate-800">
          <Search className="h-5 w-5 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="移動・検索…（名刺 / 案件 / ナレッジ / タスク）"
            className="h-14 flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
          />
          <kbd className="hidden rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 sm:block dark:border-slate-700">
            ESC
          </kbd>
        </div>

        {/* 結果 */}
        <div ref={listRef} className="scrollbar-thin flex-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-slate-400">該当する項目がありません</p>
          ) : (
            filtered.map((it, idx) => {
              const showGroup = it.group !== lastGroup;
              lastGroup = it.group;
              return (
                <div key={it.id}>
                  {showGroup && (
                    <p className="px-3 pt-3 pb-1 text-[11px] font-bold tracking-wider text-slate-400">
                      {it.group}
                    </p>
                  )}
                  <button
                    data-idx={idx}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => it.run()}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                      idx === active
                        ? "bg-cyan-50 dark:bg-cyan-500/15"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    )}
                  >
                    <span
                      className={cn(
                        "shrink-0",
                        idx === active ? "text-cyan-600 dark:text-cyan-400" : "text-slate-400"
                      )}
                    >
                      {it.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                        {it.label}
                      </span>
                      {it.sub && (
                        <span className="block truncate text-xs text-slate-400">{it.sub}</span>
                      )}
                    </span>
                    {idx === active && (
                      <CornerDownLeft className="h-4 w-4 shrink-0 text-slate-400" />
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* フッター */}
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400 dark:border-slate-800">
          <span className="flex items-center gap-2">
            <kbd className="rounded border border-slate-200 px-1 dark:border-slate-700">↑</kbd>
            <kbd className="rounded border border-slate-200 px-1 dark:border-slate-700">↓</kbd>
            で移動
          </span>
          <span className="flex items-center gap-1">
            <Sun className="h-3 w-3" /> DARE BASE LABO
          </span>
        </div>
      </div>
    </div>
  );
}
