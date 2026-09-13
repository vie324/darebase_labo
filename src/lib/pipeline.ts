// =============================================================
// 案件パイプラインの判定ロジック（純粋関数・テスト付き）
//
// 1階：商談   PIPELINE_COLUMNS   … stage × confidence_rank で列が決まる
// 2階：受注後 FULFILLMENT_GROUPS … fulfillment_status を大分類に畳んだ列
//
// UI（カンバンのドラッグ&ドロップ）はここが返すパッチをそのまま保存する。
// =============================================================

import {
  FULFILLMENT_GROUPS,
  FULFILLMENT_STAGES,
  PIPELINE_COLUMNS,
  type FulfillmentGroup,
  type PipelineColumn,
} from "./constants.ts";
import type { Deal } from "./types";

/** 判定に必要な最小限のフィールドだけを受け取る（テストしやすさのため） */
export type DealLike = Pick<Deal, "stage"> &
  Partial<Pick<Deal, "confidence_rank" | "probability" | "fulfillment_status">>;

export function columnByKey(key: string): PipelineColumn | undefined {
  return PIPELINE_COLUMNS.find((c) => c.key === key);
}

/**
 * 案件がどの商談カンバン列に入るか。
 * 後追いで確度が未判定の場合は C 列（最も低い扱い）に置く。
 */
export function columnKeyOf(deal: DealLike): string {
  if (deal.stage !== "follow_up") return deal.stage;
  const rank = deal.confidence_rank;
  if (rank === "A" || rank === "B" || rank === "C") return `follow_up_${rank.toLowerCase()}`;
  return "follow_up_c";
}

/** 確度ランクが未入力のまま後追いに入っている（＝要判定）か */
export function needsConfidenceRank(deal: DealLike): boolean {
  return deal.stage === "follow_up" && !["A", "B", "C"].includes(deal.confidence_rank ?? "");
}

/**
 * 確度(%)が「列の既定値のまま」か。
 * 手入力で調整された値をドラッグ操作で上書きしないための判定。
 */
export function hasAutoProbability(deal: DealLike): boolean {
  const col = columnByKey(columnKeyOf(deal));
  return col !== undefined && deal.probability === col.defaultProbability;
}

/**
 * 商談カンバンで列を移動したときに保存するパッチ。
 * - 確度(%)は既定値のままだったときだけ新しい列の既定値に合わせる
 * - 受注に入れたら受注後フェーズ（2階）を開始する
 */
export function pipelineTransition(
  deal: DealLike,
  toColumnKey: string,
  today: string
): Partial<Deal> {
  const col = columnByKey(toColumnKey);
  if (!col) return {};

  const patch: Partial<Deal> = {
    stage: col.stage,
    confidence_rank: col.rank ?? "",
    updated_at: new Date().toISOString(),
  };

  if (col.stage === "won" || col.stage === "lost" || hasAutoProbability(deal)) {
    patch.probability = col.defaultProbability;
  }

  if (col.stage === "won") {
    // 受注後カンバンの先頭フェーズから開始する（既に入っていれば触らない）
    if (!deal.fulfillment_status) {
      patch.fulfillment_status = FULFILLMENT_STAGES[0]?.key ?? "";
      patch.fulfillment_updated_at = today;
    }
    patch.contracted_at = today;
  }

  return patch;
}

// ---------- 2階：受注後 ----------

export function groupByKey(key: string): FulfillmentGroup | undefined {
  return FULFILLMENT_GROUPS.find((g) => g.key === key);
}

/** 受注後フェーズがどの大分類（カンバン列）に入るか。未設定・未知の値は先頭列 */
export function fulfillmentGroupOf(status: string | undefined): string {
  if (status) {
    const hit = FULFILLMENT_GROUPS.find((g) => g.stages.includes(status));
    if (hit) return hit.key;
  }
  return FULFILLMENT_GROUPS[0].key;
}

/** 受注後カンバンで列を移動したときのパッチ。列の先頭フェーズに設定する */
export function fulfillmentTransition(toGroupKey: string, today: string): Partial<Deal> {
  const group = groupByKey(toGroupKey);
  if (!group || group.stages.length === 0) return {};
  return {
    fulfillment_status: group.stages[0],
    fulfillment_updated_at: today,
    updated_at: new Date().toISOString(),
  };
}

/** 受注後フェーズの表示ラベル（詳細フェーズ名） */
export function fulfillmentLabel(status: string | undefined): string {
  if (!status) return "未設定";
  return FULFILLMENT_STAGES.find((s) => s.key === status)?.label ?? status;
}

/**
 * 現フェーズに入ってからの停滞日数。
 * fulfillment_updated_at が未設定なら null（判定不能）。
 */
export function stagnantDays(deal: Partial<Deal>, today: string): number | null {
  const from = deal.fulfillment_updated_at;
  if (!from) return null;
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/** 受注後の進捗率（0-100）。詳細フェーズの並び順で計算する */
export function fulfillmentProgress(status: string | undefined): number {
  if (!status) return 0;
  const idx = FULFILLMENT_STAGES.findIndex((s) => s.key === status);
  if (idx < 0) return 0;
  return Math.round(((idx + 1) / FULFILLMENT_STAGES.length) * 100);
}
