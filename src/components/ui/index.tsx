"use client";

// =============================================================
// DareBase 共通UIコンポーネント
// 全モジュールはここから import してデザインの一貫性を保つ。
// =============================================================

import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AVATAR_COLORS } from "@/lib/constants";
import { LogoMark } from "@/components/brand/logo";

// ---------- Button ----------
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
type ButtonSize = "sm" | "md" | "lg";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-cyan-400 to-sky-400 text-slate-900 shadow-sm shadow-cyan-500/30 hover:from-cyan-300 hover:to-sky-300 active:scale-[0.98]",
  secondary:
    "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
  ghost:
    "text-slate-600 hover:bg-slate-100 active:scale-[0.98] dark:text-slate-300 dark:hover:bg-slate-800",
  danger:
    "bg-rose-600 text-white shadow-sm hover:bg-rose-500 active:scale-[0.98]",
  success:
    "bg-emerald-600 text-white shadow-sm hover:bg-emerald-500 active:scale-[0.98]",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      className={cn(
        "inline-flex cursor-pointer items-center justify-center rounded-xl font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-50",
        buttonVariants[variant],
        buttonSizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// ---------- Badge ----------
export function Badge({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        className ?? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      )}
    >
      {children}
    </span>
  );
}

// ---------- Card ----------
export function Card({
  className,
  children,
  onClick,
  hover = false,
}: {
  className?: string;
  children: ReactNode;
  onClick?: () => void;
  hover?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={cn("card", hover && "card-hover cursor-pointer", className)}
    >
      {children}
    </div>
  );
}

// ---------- フォーム部品 ----------
const fieldBase =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-shadow focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/15 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(fieldBase, "min-h-24 resize-y leading-relaxed", className)}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldBase, "cursor-pointer appearance-auto", className)} {...props}>
      {children}
    </select>
  );
}

/** ラベル付きフォームフィールド */
export function Field({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-slate-400">
        {label}
        {required && <span className="ml-1 text-rose-500">*</span>}
      </span>
      {children}
    </label>
  );
}

// ---------- SearchInput ----------
export function SearchInput({
  value,
  onChange,
  placeholder = "検索…",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(fieldBase, "pl-10")}
      />
    </div>
  );
}

// ---------- Modal ----------
export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 animate-fade-in bg-slate-950/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={ref}
        className={cn(
          "card scrollbar-thin relative max-h-[90vh] w-full animate-scale-in overflow-y-auto p-6",
          wide ? "max-w-3xl" : "max-w-lg"
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------- Tabs ----------
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: { key: T; label: string; count?: number }[];
  active: T;
  onChange: (key: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "scrollbar-thin flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-slate-800/60",
        className
      )}
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            "flex cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-all",
            active === t.key
              ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          )}
        >
          {t.label}
          {typeof t.count === "number" && (
            <span
              className={cn(
                "rounded-full px-1.5 text-[11px] leading-4 font-semibold",
                active === t.key
                  ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300"
                  : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
              )}
            >
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ---------- Avatar ----------
export function Avatar({
  name,
  color = "indigo",
  size = "md",
  className,
}: {
  name: string;
  color?: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    xs: "h-6 w-6 text-[10px]",
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-14 w-14 text-lg",
  };
  return (
    <div
      title={name}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-bold text-white select-none",
        AVATAR_COLORS[color] ?? "bg-indigo-500",
        sizes[size],
        className
      )}
    >
      {name.slice(0, 1)}
    </div>
  );
}

// ---------- EmptyState ----------
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 py-16 text-center dark:border-slate-800">
      {icon && <div className="text-slate-300 dark:text-slate-600">{icon}</div>}
      <div>
        <p className="font-semibold text-slate-600 dark:text-slate-300">{title}</p>
        {description && (
          <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

// ---------- PageHeader ----------
export function PageHeader({
  title,
  description,
  icon,
  actions,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="bg-brand-gradient flex h-11 w-11 items-center justify-center rounded-2xl text-slate-900 shadow-lg shadow-cyan-500/25">
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
          {description && (
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        {/* 各ページに差し込むブランドマーク（装飾） */}
        <LogoMark className="hidden h-7 w-auto opacity-25 lg:block" />
      </div>
    </div>
  );
}

// ---------- StatCard ----------
export function StatCard({
  label,
  value,
  sub,
  icon,
  accent = "cyan",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  accent?: "cyan" | "emerald" | "amber" | "rose" | "sky" | "indigo" | "violet";
}) {
  const accents: Record<string, string> = {
    cyan: "bg-cyan-50 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
    rose: "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400",
    sky: "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400",
    // 後方互換（スイープ漏れ対策）
    indigo: "bg-cyan-50 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400",
    violet: "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400",
  };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-1.5 truncate text-2xl font-bold tracking-tight">{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{sub}</p>}
        </div>
        {icon && (
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              accents[accent]
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

// ---------- ProgressBar ----------
export function ProgressBar({
  value,
  max = 100,
  className,
  barClassName,
}: {
  value: number;
  max?: number;
  className?: string;
  barClassName?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800",
        className
      )}
    >
      <div
        className={cn(
          "h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500",
          barClassName
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ---------- Skeleton（ローディング） ----------
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className ?? "h-4 w-full")} />;
}

/** ページ全体のローディングスケルトン */
export function PageSkeleton() {
  return (
    <div className="animate-fade-in space-y-4">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}
