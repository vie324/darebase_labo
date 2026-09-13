"use client";

// =============================================================
// useAccess — 現在ユーザーのロールと権限
//
// 画面・導線の出し分けに使う。実際のデータ分離は RLS
// （supabase/migrations/0006_roles_rls.sql）が担保しており、
// ここはあくまで「見せない・触らせない」ための UI 層。
// ロールの定義は lib/roles.ts に集約。
// =============================================================

import { useCollection } from "./use-collection";
import { useUser } from "./use-user";
import {
  can as roleCan,
  isPartnerRole,
  normalizeRole,
  type Capability,
  type RoleKey,
} from "./roles";

export interface AccessState {
  /** 解決前は null。null の間は can() が常に false になる（安全側） */
  role: RoleKey | null;
  /** 代理店ユーザーの所属組織（本部社員は null） */
  organizationId: string | null;
  isExecutive: boolean;
  isPartner: boolean;
  loading: boolean;
  can: (cap: Capability) => boolean;
}

export function useAccess(): AccessState {
  const { user, loading: userLoading } = useUser();
  const { items: profiles, loading: profilesLoading } = useCollection("profiles");
  const loading = userLoading || profilesLoading;

  if (!user) {
    return {
      role: null,
      organizationId: null,
      isExecutive: false,
      isPartner: false,
      loading,
      can: () => false,
    };
  }

  // id → email → name の順で現在ユーザーのプロフィール行を特定する。
  // （Supabase接続時は profiles.id = auth.uid()。デモモードは DEMO_TEAM の id）
  const me =
    profiles.find((p) => p.id === user.id) ??
    profiles.find((p) => p.email !== "" && p.email === user.email) ??
    profiles.find((p) => p.name === user.name);

  // role_key 未設定の古い行は access_level から推定する（0006 以前との互換）
  const role: RoleKey | null = me
    ? me.role_key
      ? normalizeRole(me.role_key)
      : me.access_level === "executive"
        ? "executive"
        : "member"
    : null;

  return {
    role,
    organizationId: me?.organization_id ?? null,
    isExecutive: role === "executive",
    isPartner: isPartnerRole(role),
    loading,
    can: (cap: Capability) => roleCan(role, cap),
  };
}
