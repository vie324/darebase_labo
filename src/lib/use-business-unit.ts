"use client";

// =============================================================
// いま見ている事業部（銀行営業 / アライアンス営業）
//
// 銀行・支店、アポイント、案件管理、稼働ダッシュボードは、事業部を
// 切り替えると同じ画面が別の商売の顔になる。どの画面で切り替えても
// 他の画面が同じ事業部で開くよう、選択はブラウザに保存して共有する。
//
// 保存するのは slug（"banking" / "alliance"）。id はデモと本番で
// 変わるため、slug で覚えて表示時に id へ解決する。
// =============================================================

import { useSyncExternalStore } from "react";
import { useCollection } from "./use-collection";
import {
  BANKING,
  DEFAULT_UNIT,
  UNIT_TERMS,
  normalizeUnitSlug,
  type BusinessUnitSlug,
  type UnitTerms,
} from "./business-units";
import type { BusinessUnit } from "./types";

const STORAGE_KEY = "dbl:business-unit";

let current: BusinessUnitSlug | null = null;
const listeners = new Set<() => void>();

function read(): BusinessUnitSlug {
  if (current !== null) return current;
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    // プライベートモードなどで読めない場合は既定値
  }
  current = normalizeUnitSlug(stored);
  return current;
}

/** SSR では常に既定値（ハイドレーション後に実際の設定へ切り替わる） */
function readServer(): BusinessUnitSlug {
  return DEFAULT_UNIT;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function setBusinessUnit(next: BusinessUnitSlug): void {
  current = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // 保存できなくてもその場の切り替えは効く
  }
  listeners.forEach((fn) => fn());
}

export interface BusinessUnitState {
  slug: BusinessUnitSlug;
  /** 選択中の事業部の id（未作成なら null） */
  unitId: string | null;
  /** 既定の事業部の id。business_unit_id が空の既存行はこちら扱い */
  defaultUnitId: string | null;
  /** 画面に出す呼び名。選んだ事業部から引く（行の有無に依存しない） */
  terms: UnitTerms;
  /** 選べる事業部（is_active のみ） */
  units: BusinessUnit[];
  /**
   * 選択中の事業部が business_units に無い。
   * 画面はデータを出さず、作成を促すこと。
   * （null を「絞り込まない」と解釈して全件出すと、銀行営業のデータが
   *   アライアンスのタブに出てしまう）
   */
  missing: boolean;
  loading: boolean;
  setSlug: (next: BusinessUnitSlug) => void;
  /** 選択中の事業部を作る。作成後の id を返す */
  createUnit: () => Promise<string | null>;
}

export function useBusinessUnit(): BusinessUnitState {
  const slug = useSyncExternalStore(subscribe, read, readServer);
  const rows = useCollection("business_units");
  const units = rows.items.filter((u) => u.is_active);

  const idOf = new Map(units.map((u) => [u.slug, u.id]));
  const unitId = idOf.get(slug) ?? null;
  const defaultUnitId = idOf.get(BANKING) ?? units[0]?.id ?? null;

  // 呼び名は「選んだ事業部」から引く。行がまだ無くても、
  // アライアンスを選んだのに「銀行・支店」と出る、という食い違いを防ぐ。
  const terms = UNIT_TERMS[slug];

  const createUnit = async (): Promise<string | null> => {
    if (unitId) return unitId;
    const created = await rows.add({
      name: UNIT_TERMS[slug].unit,
      slug,
      is_active: true,
    });
    return created.id;
  };

  return {
    slug,
    unitId,
    defaultUnitId,
    terms,
    units,
    // 読み込み中は「無い」と断定しない（一瞬だけ未作成の画面が出るのを防ぐ）
    missing: !rows.loading && unitId === null,
    loading: rows.loading,
    setSlug: setBusinessUnit,
    createUnit,
  };
}
