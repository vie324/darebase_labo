"use client";

// =============================================================
// 一覧の表示密度（ゆったり / コンパクト）
//
// 支店は100件規模、案件も溜まっていくため、1画面に何行入るかが
// 効率に直結する。設定はブラウザに保存し、どの一覧でも同じ密度になる。
//
// useSyncExternalStore で共有しているので、片方の一覧で切り替えると
// 他の一覧も同時に切り替わる。
// =============================================================

import { useSyncExternalStore } from "react";

export type Density = "comfortable" | "compact";

const STORAGE_KEY = "dbl:density";

let current: Density | null = null;
const listeners = new Set<() => void>();

function read(): Density {
  if (current !== null) return current;
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    // プライベートモードなどで読めない場合は既定値
  }
  current = stored === "compact" ? "compact" : "comfortable";
  return current;
}

/** SSR では常に既定値（ハイドレーション後に実際の設定へ切り替わる） */
function readServer(): Density {
  return "comfortable";
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function setDensity(next: Density): void {
  current = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // 保存できなくてもその場の切り替えは効く
  }
  listeners.forEach((fn) => fn());
}

export interface DensityState {
  density: Density;
  isCompact: boolean;
  setDensity: (next: Density) => void;
}

export function useDensity(): DensityState {
  const density = useSyncExternalStore(subscribe, read, readServer);
  return { density, isCompact: density === "compact", setDensity };
}

/**
 * 密度に応じた行の余白クラス。
 * 一覧ごとに数値を散らかさないよう、ここ1箇所で決める。
 */
export function rowPadding(isCompact: boolean): string {
  return isCompact ? "px-3 py-1.5" : "px-3 py-3";
}
