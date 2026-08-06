"use client";

// インクリメンタルサーチ付きセレクト。
// 銀行が10〜20行 / 支店が100件規模になるため、通常の <select> では
// スマホから素早く選べない。入力で絞り込み、タップで確定する。

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  sub?: string;
}

export function SearchableSelect({
  value,
  options,
  placeholder,
  emptyText = "候補がありません",
  disabled,
  onChange,
}: {
  value: string;
  options: SelectOption[];
  placeholder: string;
  emptyText?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => `${o.label} ${o.sub ?? ""}`.toLowerCase().includes(q));
  }, [options, query]);

  // 閉じるときは次回のために検索語もリセットする
  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  // 外側クリックで閉じる
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, close]);

  // 開いたら検索欄にフォーカスする（描画後）
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 20);
    return () => clearTimeout(t);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => (open ? close() : setOpen(true))}
        className={cn(
          "flex w-full cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-sm transition-shadow focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/15 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900",
          open && "border-cyan-400 ring-4 ring-cyan-500/15"
        )}
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            selected ? "text-slate-900 dark:text-slate-100" : "text-slate-400"
          )}
        >
          {selected ? selected.label : placeholder}
        </span>
        {selected && !disabled && (
          <span
            role="button"
            tabIndex={-1}
            aria-label="選択を解除"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            className="shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        )}
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {open && (
        <div className="card absolute z-30 mt-1 flex max-h-72 w-full animate-scale-in flex-col overflow-hidden p-0">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 dark:border-slate-800">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="入力して絞り込み…"
              className="h-11 flex-1 bg-transparent text-sm placeholder:text-slate-400 focus:outline-none"
            />
          </div>
          <div className="scrollbar-thin flex-1 overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-400">{emptyText}</p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    close();
                  }}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-left transition-colors",
                    o.value === value
                      ? "bg-cyan-50 dark:bg-cyan-500/15"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{o.label}</span>
                    {o.sub && <span className="block truncate text-xs text-slate-400">{o.sub}</span>}
                  </span>
                  {o.value === value && (
                    <Check className="h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-400" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** ボタン選択（業種・売上規模など。タップ1回で選べるようにする） */
export function ChoiceGroup({
  value,
  options,
  onChange,
  allowEmpty = true,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  allowEmpty?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(active && allowEmpty ? "" : o.value)}
            className={cn(
              "cursor-pointer rounded-xl px-3.5 py-2 text-sm font-medium transition-all active:scale-[0.97]",
              active
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
