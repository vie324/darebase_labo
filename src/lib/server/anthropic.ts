// =============================================================
// サーバー専用 Claude クライアント
//
// ANTHROPIC_API_KEY は NEXT_PUBLIC_ を付けず**サーバーのみ**に設定すること。
// クライアントから直接 Claude を呼ぶ構成にはしない（鍵が配布されてしまう）。
// このファイルは src/lib/server/ 配下 = クライアントコンポーネントから
// import しない規約。
// =============================================================

import Anthropic from "@anthropic-ai/sdk";

/** 解析に使うモデル。変更はここ1箇所 */
export const ANALYSIS_MODEL = "claude-opus-5";

export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;

/** 未設定の場合は null（呼び出し側で「未設定」を返す） */
export function getAnthropic(): Anthropic | null {
  if (!isAnthropicConfigured()) return null;
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

/** SDK の例外を、利用者に出してよい日本語メッセージへ変換する */
export function describeAnthropicError(error: unknown): { status: number; message: string } {
  if (error instanceof Anthropic.AuthenticationError) {
    return { status: 500, message: "AIの認証に失敗しました。APIキーの設定を確認してください。" };
  }
  if (error instanceof Anthropic.RateLimitError) {
    return { status: 429, message: "AIの利用が混み合っています。少し待って再実行してください。" };
  }
  if (error instanceof Anthropic.BadRequestError) {
    return { status: 400, message: "AIへの依頼内容が不正でした。ログが長すぎる可能性があります。" };
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return { status: 502, message: "AIに接続できませんでした。時間をおいて再実行してください。" };
  }
  if (error instanceof Anthropic.APIError) {
    return { status: 502, message: `AIの呼び出しに失敗しました（${error.status ?? "unknown"}）。` };
  }
  return { status: 500, message: "解析に失敗しました。時間をおいて再実行してください。" };
}
