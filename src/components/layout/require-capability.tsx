"use client";

// =============================================================
// 権限ゲート — URL 直打ちでの到達を防ぐ画面側のガード。
//
// データそのものの遮断は RLS（0006_roles_rls.sql）が行う。
// ここは「権限のない画面をそれと分かる形で閉じる」ためのもので、
// これ単体をセキュリティ境界として扱わないこと。
// =============================================================

import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { useAccess } from "@/lib/use-access";
import type { Capability } from "@/lib/roles";
import { Card, PageSkeleton } from "@/components/ui";

export function RequireCapability({
  cap,
  title,
  message,
  children,
}: {
  cap: Capability;
  /** 拒否画面に出す見出し */
  title: string;
  message?: string;
  children: ReactNode;
}) {
  const { can, loading } = useAccess();

  if (loading) return <PageSkeleton />;
  if (can(cap)) return <>{children}</>;

  return (
    <Card className="flex flex-col items-center gap-3 py-16 text-center">
      <ShieldAlert className="h-10 w-10 text-slate-300 dark:text-slate-600" />
      <div>
        <p className="font-semibold text-slate-600 dark:text-slate-300">{title}</p>
        <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
          {message ??
            "閲覧権限が必要な場合は、経営層のメンバーに「設定 > 権限管理」からの変更を依頼してください"}
        </p>
      </div>
    </Card>
  );
}
