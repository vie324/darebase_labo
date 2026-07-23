// LINE連携の設定状況を返す（クライアントはサーバー環境変数を見られないため）。
// 秘密情報は一切返さず、設定済みかどうかの真偽値のみ。

import { isLineConfigured } from "@/lib/server/line";
import { isSupabaseAdminConfigured } from "@/lib/server/supabase-admin";

export async function GET() {
  return Response.json({
    configured: isLineConfigured() && isSupabaseAdminConfigured(),
  });
}
