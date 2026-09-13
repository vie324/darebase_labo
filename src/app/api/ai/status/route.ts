// AI解析の設定状況を返す（クライアントはサーバー環境変数を見られないため）。
// 秘密情報は一切返さず、設定済みかどうかとモデル名のみ。

import { ANALYSIS_MODEL, isAnthropicConfigured } from "@/lib/server/anthropic";

export async function GET() {
  return Response.json({
    configured: isAnthropicConfigured(),
    model: isAnthropicConfigured() ? ANALYSIS_MODEL : "",
  });
}
