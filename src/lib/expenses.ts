// =============================================================
// 経費精算 — 勘定科目とワークフロー
//
// 申請 → 承認 → 支払 の3段階。承認・支払は管理部（＋経営）だけが行う。
// DB 側も同じ制限を持たせてある（0012 の expenses_guard トリガー）。
// =============================================================

export const EXPENSE_STATUSES = {
  draft: {
    label: "下書き",
    color: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
  },
  submitted: {
    label: "承認待ち",
    color: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  approved: {
    label: "承認済み",
    color: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
  rejected: {
    label: "差し戻し",
    color: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  },
  paid: {
    label: "支払済み",
    color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
} as const;

export type ExpenseStatus = keyof typeof EXPENSE_STATUSES;

export const EXPENSE_STATUS_KEYS = Object.keys(EXPENSE_STATUSES) as ExpenseStatus[];

export function expenseStatusMeta(
  status: string
): (typeof EXPENSE_STATUSES)[ExpenseStatus] {
  return EXPENSE_STATUSES[status as ExpenseStatus] ?? EXPENSE_STATUSES.draft;
}

/** 勘定科目。仕訳に合わせて増減させる想定なので、ここ1箇所で持つ */
export const EXPENSE_CATEGORIES = {
  transport: { label: "旅費交通費", needsCounterparty: false },
  entertainment: { label: "接待交際費", needsCounterparty: true },
  supplies: { label: "消耗品費", needsCounterparty: false },
  communication: { label: "通信費", needsCounterparty: false },
  book: { label: "新聞図書費", needsCounterparty: false },
  meeting: { label: "会議費", needsCounterparty: true },
  commission: { label: "支払手数料", needsCounterparty: true },
  other: { label: "雑費", needsCounterparty: false },
} as const;

export type ExpenseCategory = keyof typeof EXPENSE_CATEGORIES;

export const EXPENSE_CATEGORY_KEYS = Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[];

export function categoryLabel(category: string): string {
  return EXPENSE_CATEGORIES[category as ExpenseCategory]?.label ?? category;
}

/**
 * 相手先の記載が要る科目か。
 * 接待交際費・会議費は、税務上「誰と」が無いと経費として説明できない。
 */
export function needsCounterparty(category: string): boolean {
  return EXPENSE_CATEGORIES[category as ExpenseCategory]?.needsCounterparty ?? false;
}

/** 承認・支払を行える人か（画面の出し分け用。DB 側は can_backoffice()） */
export type ExpenseActor = "owner" | "approver";

/** 許可する遷移。ここに無い組み合わせは弾く */
const TRANSITIONS: Record<ExpenseStatus, { to: ExpenseStatus; by: ExpenseActor }[]> = {
  draft: [{ to: "submitted", by: "owner" }],
  submitted: [
    { to: "approved", by: "approver" },
    { to: "rejected", by: "approver" },
    // 承認前なら本人が引っ込められる
    { to: "draft", by: "owner" },
  ],
  approved: [{ to: "paid", by: "approver" }],
  rejected: [{ to: "submitted", by: "owner" }],
  paid: [],
};

export function canTransition(
  from: string,
  to: string,
  actor: ExpenseActor
): boolean {
  const allowed = TRANSITIONS[from as ExpenseStatus];
  if (!allowed) return false;
  return allowed.some((t) => t.to === to && (t.by === actor || actor === "approver"));
}

/** その状態から次に進める先（画面のボタンを組み立てるのに使う） */
export function nextStatuses(from: string, actor: ExpenseActor): ExpenseStatus[] {
  const allowed = TRANSITIONS[from as ExpenseStatus] ?? [];
  return allowed
    .filter((t) => t.by === actor || actor === "approver")
    .map((t) => t.to);
}

/** 申請者が内容を編集できる状態か */
export function isEditableByOwner(status: string): boolean {
  return status === "draft" || status === "rejected";
}

/** 集計に必要な最小限の形 */
export interface ExpenseLike {
  spent_on: string;
  category: string;
  amount: number;
  status: string;
  owner_name: string;
}

export interface ExpenseTotals {
  /** 承認待ちの件数と金額（管理部が今さばくべき量） */
  pendingCount: number;
  pendingAmount: number;
  /** 承認済み・未払いの金額（これから出ていくお金） */
  payableAmount: number;
  /** 支払済みの金額 */
  paidAmount: number;
  byCategory: { category: string; label: string; amount: number; count: number }[];
  byOwner: { name: string; amount: number; count: number }[];
}

/** 一覧の集計。差し戻し・下書きは「まだ申請ではない」ので金額に入れない */
export function summarize(rows: ExpenseLike[]): ExpenseTotals {
  const totals: ExpenseTotals = {
    pendingCount: 0,
    pendingAmount: 0,
    payableAmount: 0,
    paidAmount: 0,
    byCategory: [],
    byOwner: [],
  };
  const byCategory = new Map<string, { amount: number; count: number }>();
  const byOwner = new Map<string, { amount: number; count: number }>();

  for (const row of rows) {
    if (row.status === "submitted") {
      totals.pendingCount += 1;
      totals.pendingAmount += row.amount;
    }
    if (row.status === "approved") totals.payableAmount += row.amount;
    if (row.status === "paid") totals.paidAmount += row.amount;

    // 科目別・担当者別は「申請として生きているもの」だけ数える
    if (row.status === "draft" || row.status === "rejected") continue;

    const c = byCategory.get(row.category) ?? { amount: 0, count: 0 };
    byCategory.set(row.category, { amount: c.amount + row.amount, count: c.count + 1 });

    const o = byOwner.get(row.owner_name) ?? { amount: 0, count: 0 };
    byOwner.set(row.owner_name, { amount: o.amount + row.amount, count: o.count + 1 });
  }

  totals.byCategory = [...byCategory.entries()]
    .map(([category, v]) => ({ category, label: categoryLabel(category), ...v }))
    .sort((a, b) => b.amount - a.amount);
  totals.byOwner = [...byOwner.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.amount - a.amount);
  return totals;
}

/** 提出前のチェック。空配列なら提出できる */
export function validateForSubmit(row: {
  spent_on: string;
  amount: number;
  purpose: string;
  category: string;
  counterparty: string;
  receipt_file: string;
}): string[] {
  const errors: string[] = [];
  if (row.spent_on === "") errors.push("利用日を入れてください");
  if (row.amount <= 0) errors.push("金額を入れてください");
  if (row.purpose.trim() === "") errors.push("用途（何のための支出か）を入れてください");
  if (needsCounterparty(row.category) && row.counterparty.trim() === "") {
    errors.push(`${categoryLabel(row.category)}は相手先の記載が必要です`);
  }
  if (row.receipt_file === "") errors.push("領収書を添付してください");
  return errors;
}
