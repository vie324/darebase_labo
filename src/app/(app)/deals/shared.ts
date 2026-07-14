// 案件管理モジュール内で共有するヘルパー・型

import { DEAL_STAGES } from "@/lib/constants";
import { dateFromNow } from "@/lib/utils";
import type { Deal, DealStage } from "@/lib/types";

/** ステージを order 順（lead → lost）に並べた配列 */
export const STAGE_KEYS: DealStage[] = (Object.keys(DEAL_STAGES) as DealStage[]).sort(
  (a, b) => DEAL_STAGES[a].order - DEAL_STAGES[b].order
);

/** 進行中（won / lost 以外）かどうか */
export function isOpenStage(stage: DealStage): boolean {
  return stage !== "won" && stage !== "lost";
}

/** 確度(%)に応じたバッジ色 */
export function probabilityClass(p: number): string {
  if (p >= 70)
    return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
  if (p >= 40) return "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
  return "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300";
}

export function sumAmount(rows: Deal[]): number {
  return rows.reduce((sum, d) => sum + d.amount, 0);
}

/** 加重パイプライン（金額 × 確度） */
export function weightedAmount(rows: Deal[]): number {
  return rows.reduce((sum, d) => sum + (d.amount * d.probability) / 100, 0);
}

/** フォーム入力値（Deal から id / created_at / updated_at を除いたもの） */
export interface DealFormValues {
  name: string;
  company: string;
  contact_name: string;
  stage: DealStage;
  amount: number;
  probability: number;
  expected_close: string;
  owner_name: string;
  next_action: string;
  memo: string;
}

export function toFormValues(d: Deal): DealFormValues {
  return {
    name: d.name,
    company: d.company,
    contact_name: d.contact_name,
    stage: d.stage,
    amount: d.amount,
    probability: d.probability,
    expected_close: d.expected_close,
    owner_name: d.owner_name,
    next_action: d.next_action,
    memo: d.memo,
  };
}

export function emptyFormValues(owner: string): DealFormValues {
  return {
    name: "",
    company: "",
    contact_name: "",
    stage: "lead",
    amount: 0,
    probability: 10,
    expected_close: dateFromNow(30),
    owner_name: owner,
    next_action: "",
    memo: "",
  };
}
