// =============================================================
// 事業部 — 銀行営業 / アライアンス営業 の2本立て
//
// ■ なぜ同じテーブルを共有するのか
// 紹介元 → 紹介の窓口 → アポ → 案件、という骨格は両事業部で同じ。
//   銀行営業:       銀行     → 支店       → アポ → 案件
//   アライアンス:   1次代理店 → 2次代理店  → アポ → 案件
// 稼働率・紹介数・成約率・休眠判定（branch-metrics.ts）も、アポの案件化も、
// そのまま同じ計算で成り立つ。テーブルを分けると集計・スコープ・RLS・
// デモデータを丸ごと二重に持つことになり、片方だけ直す事故が起きる。
//
// そこで banks / branches は共有し、**画面に出す呼び名だけ**を
// 事業部ごとに切り替える。この対応表がその唯一の定義。
//
// 【ランタイム依存なし】node の型ストリップでテストできるよう、
// 値の import を持たない（型のみ）。
// =============================================================

import type { BusinessUnit } from "./types";

/** 事業部の識別子。DB には business_units.slug として入る */
export const BANKING = "banking";
export const ALLIANCE = "alliance";

export type BusinessUnitSlug = typeof BANKING | typeof ALLIANCE;

/** 画面に出す呼び名。banks / branches の実体は同じで、ラベルだけ変わる */
export interface UnitTerms {
  /** 事業部そのものの名前 */
  unit: string;
  /** banks にあたるもの */
  parent: string;
  /** branches にあたるもの */
  child: string;
  /** banks.code の呼び名 */
  parentCode: string;
  /** branches.code の呼び名 */
  childCode: string;
  /** アポの received_at（接点を持った日）の呼び名 */
  received: string;
  /** 一覧ページの説明文 */
  description: string;
  /** 稼働ダッシュボードの説明文 */
  activityDescription: string;
  /** 「紹介を受ける側」から見た1件の呼び名（アポ画面などで使う） */
  referral: string;
  /** 件数の数え方（例: 12支店 / 12社） */
  countUnit: string;
}

export const UNIT_TERMS: Record<BusinessUnitSlug, UnitTerms> = {
  [BANKING]: {
    unit: "銀行営業",
    parent: "銀行",
    child: "支店",
    parentCode: "金融機関コード",
    childCode: "支店コード",
    received: "銀行から連絡を受けた日",
    description: "支店ごとの稼働状況を可視化し、放置支店の担当を振り替える",
    activityDescription: "支店ごとの紹介数・成約率と、放置されている支店を洗い出す",
    referral: "銀行紹介",
    countUnit: "支店",
  },
  [ALLIANCE]: {
    unit: "アライアンス営業",
    parent: "1次代理店",
    child: "2次代理店",
    parentCode: "提携先コード",
    childCode: "代理店コード",
    received: "紹介を受けた日",
    description: "代理店ごとの紹介状況を可視化し、止まっている代理店に手を打つ",
    activityDescription: "代理店ごとの紹介数・成約率と、紹介が止まっている代理店を洗い出す",
    referral: "代理店紹介",
    countUnit: "社",
  },
};

/** 既定の事業部。未設定のデータはこちらに寄せる（0001〜0013 のデータはすべて銀行営業） */
export const DEFAULT_UNIT: BusinessUnitSlug = BANKING;

export const UNIT_SLUGS: BusinessUnitSlug[] = [BANKING, ALLIANCE];

/** DB から来た未知の slug を安全に変換する */
export function normalizeUnitSlug(value: unknown): BusinessUnitSlug {
  return value === ALLIANCE ? ALLIANCE : BANKING;
}

export function termsOf(slug: unknown): UnitTerms {
  return UNIT_TERMS[normalizeUnitSlug(slug)];
}

/**
 * business_units の行から、いま見ている事業部を解決する。
 * id が未指定・見つからない場合は銀行営業に倒す（既存データの互換）。
 */
export function resolveUnit(
  units: BusinessUnit[],
  unitId: string | null
): { unit: BusinessUnit | null; slug: BusinessUnitSlug; terms: UnitTerms } {
  const unit =
    (unitId ? units.find((u) => u.id === unitId) : undefined) ??
    units.find((u) => u.slug === DEFAULT_UNIT) ??
    units[0] ??
    null;
  const slug = normalizeUnitSlug(unit?.slug);
  return { unit, slug, terms: UNIT_TERMS[slug] };
}

/**
 * 行が指定の事業部に属するか。
 * business_unit_id が未設定の行は既定の事業部（銀行営業）のものとして扱う。
 * ＝ アライアンスを足したことで既存データが消えないようにするための判定。
 */
export function belongsToUnit(
  rowUnitId: string | null | undefined,
  unitId: string | null,
  defaultUnitId: string | null
): boolean {
  if (unitId === null) return true; // 事業部を絞っていない
  const resolved = rowUnitId ?? defaultUnitId;
  return resolved === unitId;
}

/** 事業部で行を絞る。business_unit_id を持つどのテーブルにも使える */
export function filterByUnit<T extends { business_unit_id?: string | null }>(
  rows: T[],
  unitId: string | null,
  defaultUnitId: string | null
): T[] {
  if (unitId === null) return rows;
  return rows.filter((r) => belongsToUnit(r.business_unit_id, unitId, defaultUnitId));
}
