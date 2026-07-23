// =============================================================
// LINE Messaging API のサーバー専用ヘルパー
// 署名検証・メッセージ送信・コンテンツ取得。トークン類はサーバー環境変数のみ。
// =============================================================

import { createHmac, timingSafeEqual } from "node:crypto";

const API_BASE = "https://api.line.me/v2/bot";
const DATA_API_BASE = "https://api-data.line.me/v2/bot";

export function isLineConfigured(): boolean {
  return Boolean(process.env.LINE_CHANNEL_SECRET && process.env.LINE_CHANNEL_ACCESS_TOKEN);
}

/**
 * Webhook の X-Line-Signature を検証する。
 * 署名は「チャネルシークレットをキーに生ボディを HMAC-SHA256 → base64」。
 * 必ずパース前の生ボディ文字列で計算すること。
 */
export function verifyLineSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(signature, "base64");
  } catch {
    return false;
  }
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

// ---------- メッセージ型（必要最小限） ----------

export interface LineTextMessage {
  type: "text";
  text: string;
}

export interface LineImageMessage {
  type: "image";
  originalContentUrl: string;
  previewImageUrl: string;
}

export type LineMessage = LineTextMessage | LineImageMessage;

async function callLineApi(path: string, body: unknown): Promise<boolean> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return false;
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(`[line] ${path} failed: ${res.status} ${await res.text().catch(() => "")}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[line] ${path} error`, err);
    return false;
  }
}

/** 返信（Webhookイベントの replyToken に対して） */
export function lineReply(replyToken: string, messages: LineMessage[]): Promise<boolean> {
  return callLineApi("/message/reply", { replyToken, messages });
}

/** プッシュ送信（グループID・ユーザーIDへ） */
export function linePush(to: string, messages: LineMessage[]): Promise<boolean> {
  return callLineApi("/message/push", { to, messages });
}

/** 受信メッセージの添付コンテンツ（画像・ファイル）を取得する */
export async function fetchLineContent(
  messageId: string
): Promise<{ data: ArrayBuffer; contentType: string } | null> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`${DATA_API_BASE}/message/${messageId}/content`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      console.error(`[line] content ${messageId} failed: ${res.status}`);
      return null;
    }
    return {
      data: await res.arrayBuffer(),
      contentType: res.headers.get("content-type") ?? "application/octet-stream",
    };
  } catch (err) {
    console.error(`[line] content ${messageId} error`, err);
    return null;
  }
}

/** グループの表示名を取得する（失敗時 null） */
export async function fetchGroupSummary(groupId: string): Promise<{ groupName: string } | null> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}/group/${groupId}/summary`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { groupName?: string };
    return { groupName: data.groupName ?? "" };
  } catch {
    return null;
  }
}

/** Content-Type から保存用の拡張子を推定する */
export function extFromContentType(contentType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "application/pdf": "pdf",
  };
  return map[contentType.split(";")[0].trim()] ?? "bin";
}
