"use client";

// アライアンス数値管理の画面で共有する表の部品と書式。
// シートと同じく「実績・計画・達成率」を並べるので、その3点セットをここで揃える。

import { useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, Card } from "@/components/ui";

export function yen(n: number): string {
  const v = Math.round(n);
  return `${v < 0 ? "-" : ""}¥${Math.abs(v).toLocaleString("ja-JP")}`;
}

export function num(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("ja-JP", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function pct(n: number | null | undefined): string {
  return n === null || n === undefined ? "—" : `${n.toFixed(1)}%`;
}

/** 達成率の色。100%以上＝緑 / 70%以上＝黄 / それ未満＝赤 / 計画なし＝灰 */
export function rateClass(rate: number | null): string {
  if (rate === null) return "text-slate-400 dark:text-slate-500";
  if (rate >= 100) return "text-emerald-600 dark:text-emerald-400";
  if (rate >= 70) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

export function Rate({ value }: { value: number | null }) {
  return <span className={cn("font-semibold tabular-nums", rateClass(value))}>{pct(value)}</span>;
}

/** 表の外枠（横スクロール付き） */
export function TableCard({
  title,
  description,
  actions,
  children,
  minWidth = 720,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  minWidth?: number;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
        <div className="min-w-0">
          <h2 className="text-sm font-bold">{title}</h2>
          {description && (
            <p className="mt-0.5 text-xs leading-relaxed text-slate-400 dark:text-slate-500">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full text-left text-sm" style={{ minWidth }}>
          {children}
        </table>
      </div>
    </Card>
  );
}

export function Th({
  children,
  className,
  colSpan,
  rowSpan,
  left = false,
}: {
  children?: ReactNode;
  className?: string;
  colSpan?: number;
  rowSpan?: number;
  left?: boolean;
}) {
  return (
    <th
      colSpan={colSpan}
      rowSpan={rowSpan}
      className={cn(
        "border-b border-slate-100 bg-slate-50/80 px-3 py-2 text-[11px] font-bold whitespace-nowrap text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400",
        left ? "text-left" : "text-right",
        className
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  left = false,
}: {
  children?: ReactNode;
  className?: string;
  left?: boolean;
}) {
  return (
    <td
      className={cn(
        "px-3 py-2 whitespace-nowrap tabular-nums",
        left ? "text-left" : "text-right",
        className
      )}
    >
      {children}
    </td>
  );
}

/** 先頭列（月・代理店名）。横スクロールしても見えるよう貼り付ける */
export function StickyTd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <td
      className={cn(
        "sticky left-0 z-[1] bg-white px-4 py-2 text-left font-semibold whitespace-nowrap dark:bg-slate-900",
        className
      )}
    >
      {children}
    </td>
  );
}

export function StickyTh({ children, rowSpan }: { children?: ReactNode; rowSpan?: number }) {
  return (
    <th
      rowSpan={rowSpan}
      className="sticky left-0 z-[2] border-b border-slate-100 bg-slate-50 px-4 py-2 text-left text-[11px] font-bold whitespace-nowrap text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400"
    >
      {children}
    </th>
  );
}

/** 文面をクリップボードへ（日報・月次目標）。失敗したら選択できる形で残す */
export function CopyButton({ text, label = "文面をコピー" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    } catch {
      window.prompt("コピーしてください", text);
    }
  };
  return (
    <Button type="button" size="sm" variant="secondary" onClick={copy} className="shrink-0 whitespace-nowrap">
      {done ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
      {done ? "コピーしました" : label}
    </Button>
  );
}

export function TextPreview({ text }: { text: string }) {
  return (
    <pre className="scrollbar-thin max-h-80 overflow-auto rounded-xl bg-slate-50 p-4 text-xs leading-relaxed whitespace-pre-wrap text-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
      {text}
    </pre>
  );
}
