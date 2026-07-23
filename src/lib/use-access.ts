"use client";

// =============================================================
// useAccess — 経営層（access_level = "executive"）判定フック
//
// 経営ダッシュボードなどのUI上のゲートに使う。
// 注意: RLSは「認証済みユーザーに全権限」のままなので、これは
// セキュリティ境界ではなく画面上の区分（0004_billing.sql 冒頭参照）。
// =============================================================

import { useCollection } from "./use-collection";
import { useUser } from "./use-user";

export function useAccess(): { isExecutive: boolean; loading: boolean } {
  const { user, loading: userLoading } = useUser();
  const { items: profiles, loading: profilesLoading } = useCollection("profiles");
  const loading = userLoading || profilesLoading;

  if (!user) return { isExecutive: false, loading };

  // id → email → name の順で現在ユーザーのプロフィール行を特定する。
  // （Supabase接続時は profiles.id = auth.uid()。デモモードは DEMO_TEAM の id）
  const me =
    profiles.find((p) => p.id === user.id) ??
    profiles.find((p) => p.email !== "" && p.email === user.email) ??
    profiles.find((p) => p.name === user.name);

  return { isExecutive: me?.access_level === "executive", loading };
}
