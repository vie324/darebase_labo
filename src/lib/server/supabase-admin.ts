// =============================================================
// サーバー専用 Supabase クライアント（service role）
//
// LINE Webhook など認証セッションを持たないサーバー処理からDB/Storageへ
// 書き込むために使う。SUPABASE_SERVICE_ROLE_KEY は RLS をバイパスする
// 強力な鍵のため、絶対に NEXT_PUBLIC_ を付けずサーバーのみに設定すること。
// このファイルは src/lib/server/ 配下 = クライアントコンポーネントから
// import しない規約。
// =============================================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function supabaseUrl(): string | undefined {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
}

export function isSupabaseAdminConfigured(): boolean {
  return Boolean(supabaseUrl() && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

let adminClient: SupabaseClient | null = null;

/** service role クライアント。未設定の場合は null（呼び出し側で degrade する） */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (!isSupabaseAdminConfigured()) return null;
  if (!adminClient) {
    adminClient = createClient(supabaseUrl()!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}
