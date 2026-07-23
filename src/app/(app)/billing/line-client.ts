"use client";

// LINE連携のクライアント側ヘルパー（サーバーAPI /api/line/* の呼び出し）

import { getSupabase } from "@/lib/supabase";

export interface LineStatus {
  configured: boolean;
}

/** サーバー側のLINE設定状況を取得する（未デプロイ・デモ環境では false） */
export async function fetchLineStatus(): Promise<LineStatus> {
  try {
    const res = await fetch("/api/line/status");
    if (!res.ok) return { configured: false };
    const data = (await res.json()) as { configured?: boolean };
    return { configured: data.configured === true };
  } catch {
    return { configured: false };
  }
}

/**
 * 請求書をLINEグループへ送付する。
 * 認証はログイン中ユーザーのアクセストークンをBearerで送り、サーバー側で検証する。
 */
export async function pushInvoiceToLine(
  invoiceId: string
): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: "デモモードではLINE送付は利用できません" };
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, error: "ログインセッションが見つかりません" };
  try {
    const res = await fetch("/api/line/push", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ invoiceId }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return { ok: false, error: body.error ?? `送信に失敗しました (${res.status})` };
    return { ok: true };
  } catch {
    return { ok: false, error: "ネットワークエラーが発生しました" };
  }
}
