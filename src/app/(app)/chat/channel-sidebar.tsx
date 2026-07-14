"use client";

import { MessageSquare, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Channel } from "@/lib/types";

export function ChannelSidebar({
  channels,
  counts,
  selectedId,
  onSelect,
  onCreate,
}: {
  channels: Channel[];
  counts: Record<string, number>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
}) {
  return (
    <div className="card flex h-full flex-col overflow-hidden">
      {/* ヘッダー */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 px-4 py-3.5 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4.5 w-4.5 text-cyan-500" />
          <h2 className="text-sm font-bold">チャンネル</h2>
          <span className="rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {channels.length}
          </span>
        </div>
        <button
          onClick={onCreate}
          aria-label="チャンネルを作成"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-cyan-50 hover:text-cyan-600 dark:text-slate-400 dark:hover:bg-cyan-500/15 dark:hover:text-cyan-300"
        >
          <Plus className="h-4.5 w-4.5" />
        </button>
      </div>

      {/* チャンネル一覧 */}
      <nav className="scrollbar-thin flex-1 space-y-0.5 overflow-y-auto p-2">
        {channels.map((ch) => {
          const active = ch.id === selectedId;
          const count = counts[ch.id] ?? 0;
          return (
            <button
              key={ch.id}
              onClick={() => onSelect(ch.id)}
              className={cn(
                "group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-all duration-150",
                active
                  ? "bg-gradient-to-r from-cyan-50 to-sky-50 dark:from-cyan-500/15 dark:to-sky-500/15"
                  : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg transition-colors",
                  active
                    ? "bg-white shadow-sm dark:bg-slate-900"
                    : "bg-slate-100 dark:bg-slate-800"
                )}
              >
                {ch.emoji || "#"}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block truncate text-sm font-semibold",
                    active
                      ? "text-cyan-700 dark:text-cyan-300"
                      : "text-slate-700 dark:text-slate-200"
                  )}
                >
                  {ch.name}
                </span>
                {ch.description && (
                  <span className="block truncate text-[11px] text-slate-400 dark:text-slate-500">
                    {ch.description}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-1.5 text-[11px] font-semibold leading-5",
                  active
                    ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/25 dark:text-cyan-200"
                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
