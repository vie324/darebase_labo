// 銀行・支店モジュール内で共有するヘルパー・型

import type { DormancyLevel } from "@/lib/branch-metrics";
import type { Bank, Branch, BranchActivityType, BranchStatus } from "@/lib/types";
import { todayStr } from "@/lib/utils";

// ---------- 休眠レベルの見た目 ----------

/** 休眠バッジの色。閾値そのものは設定（settings.ts）から来る */
export const DORMANCY_STYLE: Record<DormancyLevel, { label: string; badge: string; dot: string }> =
  {
    fresh: {
      label: "稼働",
      badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
      dot: "bg-emerald-500",
    },
    warn: {
      label: "要フォロー",
      badge: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
      dot: "bg-amber-400",
    },
    alert: {
      label: "休眠ぎみ",
      badge: "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
      dot: "bg-orange-500",
    },
    critical: {
      label: "放置",
      badge: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
      dot: "bg-rose-500",
    },
    never: {
      label: "接点なし",
      badge: "bg-slate-900 text-white dark:bg-white dark:text-slate-900",
      dot: "bg-slate-500",
    },
  };

/** 経過日数の表示（接点がなければ "—"。0で埋めない） */
export function formatDaysSince(days: number | null): string {
  if (days === null) return "—";
  if (days === 0) return "本日";
  return `${days}日`;
}

/**
 * 休眠バッジの文言。
 * 接点が一度もない支店は日数が出せず、"—" だけの黒いバッジになって
 * 何を意味するのか伝わらないため、状態そのもの（接点なし）を出す。
 */
export function formatDormancyBadge(days: number | null, level: DormancyLevel): string {
  if (level === "never" || days === null) return DORMANCY_STYLE.never.label;
  return formatDaysSince(days);
}

/** 「状態 · 経過日数」形式の表示（接点なしのときは日数を付けない） */
export function formatDormancyDetail(days: number | null, level: DormancyLevel): string {
  const label = DORMANCY_STYLE[level].label;
  if (level === "never" || days === null) return label;
  return `${label} · ${formatDaysSince(days)}`;
}

/** 稼働率の表示（母数0は "—"） */
export function formatRate(rate: number | null): string {
  return rate === null ? "—" : `${rate}%`;
}

// 稼働率に応じた色。30%未満=赤 / 60%未満=橙 / それ以上=緑。
// ProgressBar の既定はグラデーション（background-image）なので、
// bg-none で打ち消さないと背景色が見えない点に注意。
export function rateBarClass(rate: number | null): string {
  if (rate === null) return "bg-none bg-slate-300 dark:bg-slate-600";
  if (rate < 30) return "bg-none bg-rose-500";
  if (rate < 60) return "bg-none bg-amber-500";
  return "bg-none bg-emerald-500";
}

export function rateTextClass(rate: number | null): string {
  if (rate === null) return "text-slate-400";
  if (rate < 30) return "text-rose-500";
  if (rate < 60) return "text-amber-500";
  return "text-emerald-500";
}

// ---------- 銀行フォーム ----------

export interface BankFormValues {
  name: string;
  code: string;
  is_active: boolean;
}

export function emptyBankForm(): BankFormValues {
  return { name: "", code: "", is_active: true };
}

export function toBankForm(b: Bank): BankFormValues {
  return { name: b.name, code: b.code, is_active: b.is_active };
}

// ---------- 支店フォーム ----------

export interface BranchFormValues {
  bank_id: string;
  name: string;
  code: string;
  prefecture: string;
  address: string;
  assigned_to: string; // "" = 未割当
  assigned_org_id: string; // "" = 未設定
  status: BranchStatus;
  note: string;
}

export function emptyBranchForm(bankId: string): BranchFormValues {
  return {
    bank_id: bankId,
    name: "",
    code: "",
    prefecture: "",
    address: "",
    assigned_to: "",
    assigned_org_id: "",
    status: "active",
    note: "",
  };
}

export function toBranchForm(b: Branch): BranchFormValues {
  return {
    bank_id: b.bank_id,
    name: b.name,
    code: b.code,
    prefecture: b.prefecture,
    address: b.address,
    assigned_to: b.assigned_to ?? "",
    assigned_org_id: b.assigned_org_id ?? "",
    status: b.status,
    note: b.note,
  };
}

// ---------- 活動ログフォーム ----------

export interface BranchActivityFormValues {
  type: BranchActivityType;
  occurred_at: string;
  memo: string;
}

export function emptyActivityForm(): BranchActivityFormValues {
  return { type: "visit", occurred_at: todayStr(), memo: "" };
}

// ---------- 並び替え ----------

export type BranchSortKey =
  | "name"
  | "assigned"
  | "lastContact"
  | "recentAppointments"
  | "wonCount"
  | "winRate";
