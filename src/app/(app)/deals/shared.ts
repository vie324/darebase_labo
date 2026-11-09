// 案件管理モジュール内で共有するヘルパー・型

import { dateFromNow } from "@/lib/utils";
import type { Deal, DealStage } from "@/lib/types";

/** 進行中（受注・販売協力・失注以外）かどうか。判定は lib/pipeline.ts に1本化 */
export { isOpenStage } from "@/lib/pipeline";

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
  /** 確度ランク A/B/C（"" = 未判定）。後追いステージのみ意味を持つ */
  confidence_rank: string;
  amount: number;
  probability: number;
  expected_close: string;
  owner_name: string;
  next_action: string;
  memo: string;
  /** 受注後フェーズ（FULFILLMENT_STAGES のキー。"" = 未設定） */
  fulfillment_status: string;
  /** 紹介元（銀行 / 1次代理店）。"" = 紐づけなし */
  bank_id: string;
  /** 紹介の窓口（支店 / 2次代理店）。"" = 紐づけなし */
  branch_id: string;

  // ---- アライアンス営業（★案件管理表★の列。値の一覧は lib/alliance.ts） ----
  /** 紹介日 */
  referred_at: string;
  /** 商談実施日 */
  visited_at: string;
  /** 商談種別 */
  deal_kind: string;
  /** セールスフェーズ（stage・確度ランク・受注後フェーズはここから決める） */
  sales_phase: string;
  /** 販売協力フェーズ */
  partnership_phase: string;
  /** 契約締結日（代理店契約） */
  partnership_contracted_at: string;
  /** 成約日 */
  contracted_at: string;
  /** ロスト日 */
  lost_at: string;
  loss_reason: string;
  /** 対応（ボール） */
  ball: string;
  installed_at: string;
  agency_paid_at: string;
  contract_note: string;
  monthly_fee: number;
  construction_fee: number;
  stock_amount: number;
}

export function toFormValues(d: Deal): DealFormValues {
  return {
    name: d.name,
    company: d.company,
    contact_name: d.contact_name,
    stage: d.stage,
    confidence_rank: d.confidence_rank ?? "",
    amount: d.amount,
    probability: d.probability,
    expected_close: d.expected_close,
    owner_name: d.owner_name,
    next_action: d.next_action,
    memo: d.memo,
    fulfillment_status: d.fulfillment_status ?? "",
    bank_id: d.bank_id ?? "",
    branch_id: d.branch_id ?? "",
    referred_at: d.referred_at ?? "",
    visited_at: d.visited_at ?? "",
    deal_kind: d.deal_kind ?? "",
    sales_phase: d.sales_phase ?? "",
    partnership_phase: d.partnership_phase ?? "",
    partnership_contracted_at: d.partnership_contracted_at ?? "",
    contracted_at: d.contracted_at ?? "",
    lost_at: d.lost_at ?? "",
    loss_reason: d.loss_reason ?? "",
    ball: d.ball ?? "",
    installed_at: d.installed_at ?? "",
    agency_paid_at: d.agency_paid_at ?? "",
    contract_note: d.contract_note ?? "",
    monthly_fee: d.monthly_fee ?? 0,
    construction_fee: d.construction_fee ?? 0,
    stock_amount: d.stock_amount ?? 0,
  };
}

export function emptyFormValues(owner: string): DealFormValues {
  return {
    name: "",
    company: "",
    contact_name: "",
    stage: "appointment",
    confidence_rank: "",
    amount: 0,
    probability: 10,
    expected_close: dateFromNow(30),
    owner_name: owner,
    next_action: "",
    memo: "",
    fulfillment_status: "",
    bank_id: "",
    branch_id: "",
    referred_at: "",
    visited_at: "",
    deal_kind: "",
    sales_phase: "",
    partnership_phase: "",
    partnership_contracted_at: "",
    contracted_at: "",
    lost_at: "",
    loss_reason: "",
    ball: "",
    installed_at: "",
    agency_paid_at: "",
    contract_note: "",
    monthly_fee: 0,
    construction_fee: 0,
    stock_amount: 0,
  };
}

/**
 * アライアンス営業の新規案件の初期値。紹介日は今日、商談種別はセールス、
 * セールスフェーズは「日程調整中」から始める（★案件管理表★に1行足すときと同じ）。
 */
export function emptyAllianceFormValues(owner: string, today: string): DealFormValues {
  return {
    ...emptyFormValues(owner),
    referred_at: today,
    deal_kind: "sales",
    sales_phase: "scheduling",
  };
}
