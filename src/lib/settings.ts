"use client";

// =============================================================
// アプリ設定 — 「先方から追って共有される値」をコードに直書きしないための層
//
// 指示書 §7 の未確定事項（休眠判定の日数閾値・確度A/B/Cの定義など）は
// すべてここを経由し、設定画面から変更できるようにする。
// 既定値はあくまで仮値であり、確定値が届いたら画面から更新すれば足りる。
//
// 保存先は app_settings テーブル（key 単位の jsonb）。
// デモモードでは localStorage に載る（useCollection の共通挙動）。
// =============================================================

import { useMemo } from "react";
import { useCollection } from "./use-collection";
import type { BranchActivityThresholds } from "./branch-metrics";

/** 支店稼働・アポイントまわりの設定 */
export interface BranchSettings extends BranchActivityThresholds {
  /** 商談予定日から何日経っても結果未入力ならアラートを出すか（§5-2 のリマインド） */
  followUpDays: number;
  /**
   * 支店稼働ダッシュボードを全ロールに見せるか。
   * 先方確認済み: 支店の稼働状況は全体が見えても業務上の支障はない（§4）。
   * 他社の売上・報酬額は Phase 2 の権限スコープで別途遮断する。
   */
  shareBranchDashboard: boolean;
}

/** 仮の既定値。確定版が届いたら設定画面から変更する（§7-6） */
export const DEFAULT_BRANCH_SETTINGS: BranchSettings = {
  activeWindowDays: 90,
  dormantWarnDays: 30,
  dormantAlertDays: 60,
  dormantCriticalDays: 90,
  recentMonths: 3,
  followUpDays: 3,
  shareBranchDashboard: true,
};

export const BRANCH_SETTINGS_KEY = "branch_activity";

function coerce(raw: Record<string, unknown> | undefined): BranchSettings {
  if (!raw) return { ...DEFAULT_BRANCH_SETTINGS };
  const num = (key: keyof BranchSettings, fallback: number) => {
    const v = raw[key];
    return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : fallback;
  };
  return {
    activeWindowDays: num("activeWindowDays", DEFAULT_BRANCH_SETTINGS.activeWindowDays),
    dormantWarnDays: num("dormantWarnDays", DEFAULT_BRANCH_SETTINGS.dormantWarnDays),
    dormantAlertDays: num("dormantAlertDays", DEFAULT_BRANCH_SETTINGS.dormantAlertDays),
    dormantCriticalDays: num("dormantCriticalDays", DEFAULT_BRANCH_SETTINGS.dormantCriticalDays),
    recentMonths: Math.max(1, num("recentMonths", DEFAULT_BRANCH_SETTINGS.recentMonths)),
    followUpDays: num("followUpDays", DEFAULT_BRANCH_SETTINGS.followUpDays),
    shareBranchDashboard:
      typeof raw.shareBranchDashboard === "boolean"
        ? raw.shareBranchDashboard
        : DEFAULT_BRANCH_SETTINGS.shareBranchDashboard,
  };
}

export interface BranchSettingsHandle {
  settings: BranchSettings;
  loading: boolean;
  /** 未保存（既定値のまま）かどうか。設定画面で「仮の値です」と示すのに使う */
  isDefault: boolean;
  save: (next: BranchSettings) => Promise<void>;
}

/** 支店稼働設定の読み書き */
export function useBranchSettings(): BranchSettingsHandle {
  const rows = useCollection("app_settings");
  const row = rows.items.find((r) => r.key === BRANCH_SETTINGS_KEY);
  const raw = row?.value;

  // 集計フック（buildBranchStats）の依存に使うため、参照を安定させる
  const settings = useMemo(() => coerce(raw), [raw]);

  const save = async (next: BranchSettings) => {
    const value = { ...next } as unknown as Record<string, unknown>;
    const updated_at = new Date().toISOString();
    const existing = rows.items.find((r) => r.key === BRANCH_SETTINGS_KEY);
    if (existing) {
      await rows.update(existing.id, { value, updated_at });
    } else {
      await rows.add({ key: BRANCH_SETTINGS_KEY, value, updated_at });
    }
  };

  return { settings, loading: rows.loading, isDefault: !row, save };
}
