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

// =============================================================
// 確度ランク A/B/C の判定基準
//
// 「A とは何か」は先方の運用で決まる値なので、コードに直書きせず
// app_settings に置いて設定画面から編集できるようにする。
// 既定値はこちらの提案（暫定）で、確定版が届いたら画面から上書きすれば足りる。
// この文言は将来、商談ログから確度を自動判定する際の判定条件にもそのまま使う。
// =============================================================

export interface ConfidenceCriteria {
  A: string;
  B: string;
  C: string;
}

export const DEFAULT_CONFIDENCE_CRITERIA: ConfidenceCriteria = {
  A: "決裁者が同席し、導入時期と予算の両方が出ている（見積提出済み）",
  B: "反応は前向きだが、決裁者・導入時期・予算のいずれかが未確定",
  C: "情報収集の段階。次のアクションの日程が決まっていない",
};

export const CONFIDENCE_SETTINGS_KEY = "confidence_ranks";

export interface ConfidenceCriteriaHandle {
  criteria: ConfidenceCriteria;
  loading: boolean;
  /** 未保存（提案のままの暫定値）かどうか */
  isDefault: boolean;
  save: (next: ConfidenceCriteria) => Promise<void>;
}

function coerceCriteria(raw: Record<string, unknown> | undefined): ConfidenceCriteria {
  const pick = (key: keyof ConfidenceCriteria) => {
    const v = raw?.[key];
    return typeof v === "string" && v.trim() !== "" ? v : DEFAULT_CONFIDENCE_CRITERIA[key];
  };
  return { A: pick("A"), B: pick("B"), C: pick("C") };
}

export function useConfidenceCriteria(): ConfidenceCriteriaHandle {
  const rows = useCollection("app_settings");
  const row = rows.items.find((r) => r.key === CONFIDENCE_SETTINGS_KEY);
  const raw = row?.value;

  const criteria = useMemo(() => coerceCriteria(raw), [raw]);

  const save = async (next: ConfidenceCriteria) => {
    const value = { ...next } as unknown as Record<string, unknown>;
    const updated_at = new Date().toISOString();
    const existing = rows.items.find((r) => r.key === CONFIDENCE_SETTINGS_KEY);
    if (existing) {
      await rows.update(existing.id, { value, updated_at });
    } else {
      await rows.add({ key: CONFIDENCE_SETTINGS_KEY, value, updated_at });
    }
  };

  return { criteria, loading: rows.loading, isDefault: !row, save };
}
