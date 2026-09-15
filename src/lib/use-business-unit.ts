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
  normalizeUnitSlug,
  resolveUnit,
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
  /** 画面に出す呼び名 */
  terms: UnitTerms;
  /** 選べる事業部（is_active のみ） */
  units: BusinessUnit[];
  loading: boolean;
  setSlug: (next: BusinessUnitSlug) => void;
}

export function useBusinessUnit(): BusinessUnitState {
  const slug = useSyncExternalStore(subscribe, read, readServer);
  const rows = useCollection("business_units");
  const units = rows.items.filter((u) => u.is_active);

  const byId = new Map(units.map((u) => [u.slug, u.id]));
  const unitId = byId.get(slug) ?? null;
  const defaultUnitId = byId.get(BANKING) ?? units[0]?.id ?? null;
  const { terms } = resolveUnit(units, unitId);

  return {
    slug,
    unitId,
    defaultUnitId,
    terms,
    units,
    loading: rows.loading,
    setSlug: setBusinessUnit,
  };
}
