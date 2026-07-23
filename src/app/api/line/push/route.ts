// =============================================================
// 請求書のLINE送付エンドポイント
//
// アプリの「LINEへ送付」ボタンから呼ばれる。
// - 認証: クライアントのSupabaseアクセストークンを Bearer で受け取り検証
//   （リクエスト内容は信用せず、請求書・宛先グループはサーバー側で解決）
// - 添付は非公開バケットの署名URL（7日）で共有 — 公開バケット不要
// - LINEにPDFメッセージ型はないため、ファイルはリンクとして送り、
//   画像の場合のみ画像メッセージも併送する
// =============================================================

import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { isLineConfigured, linePush, type LineMessage } from "@/lib/server/line";
import { formatYen } from "@/lib/utils";

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp"]);
const SIGNED_URL_EXPIRES = 7 * 24 * 3600; // 7日

export async function POST(request: Request) {
  const admin = getSupabaseAdmin();
  if (!admin || !isLineConfigured()) {
    return Response.json({ error: "LINE連携が設定されていません" }, { status: 503 });
  }

  // --- 認証（ログイン済みユーザーのみ） ---
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return Response.json({ error: "認証情報がありません" }, { status: 401 });
  }
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) {
    return Response.json({ error: "認証に失敗しました" }, { status: 401 });
  }

  // --- 入力 ---
  let invoiceId = "";
  try {
    const body = (await request.json()) as { invoiceId?: string };
    invoiceId = body.invoiceId ?? "";
  } catch {
    return Response.json({ error: "リクエスト形式が不正です" }, { status: 400 });
  }
  if (!invoiceId) {
    return Response.json({ error: "invoiceId が必要です" }, { status: 400 });
  }

  // --- 請求書と宛先グループの解決（すべてサーバー側で） ---
  const { data: invoice } = await admin
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice) {
    return Response.json({ error: "請求書が見つかりません" }, { status: 404 });
  }

  let groupId: string = invoice.line_group_id ?? "";
  if (!groupId && invoice.partner_id) {
    const { data: group } = await admin
      .from("line_groups")
      .select("group_id")
      .eq("partner_id", invoice.partner_id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    groupId = group?.group_id ?? "";
  }
  if (!groupId) {
    return Response.json(
      { error: "送付先のLINEグループがありません（マスタタブで取引先に紐付けてください）" },
      { status: 400 }
    );
  }

  // --- メッセージ組み立て ---
  const lines = [
    "【請求書のご案内】DARE BASE",
    `件名: ${invoice.title || "請求書"}`,
    invoice.invoice_number ? `請求書番号: ${invoice.invoice_number}` : "",
    `金額: ${formatYen(invoice.total)}（税込）`,
    invoice.due_date ? `お支払期日: ${invoice.due_date}` : "",
  ].filter(Boolean);

  const messages: LineMessage[] = [];
  let signedUrl = "";
  const fileRef: string = invoice.file_url ?? "";
  const isStoragePath = fileRef !== "" && !/^(https?:|data:|blob:)/.test(fileRef);
  if (isStoragePath) {
    const { data: signed } = await admin.storage
      .from("invoices")
      .createSignedUrl(fileRef, SIGNED_URL_EXPIRES);
    if (signed?.signedUrl) {
      signedUrl = signed.signedUrl;
      lines.push("", `▼請求書ファイル（7日間有効）`, signedUrl);
    }
  } else if (/^https?:/.test(fileRef)) {
    signedUrl = fileRef;
    lines.push("", `▼請求書ファイル`, signedUrl);
  }

  messages.push({ type: "text", text: lines.join("\n") });
  if (signedUrl && IMAGE_EXTS.has(String(invoice.file_type ?? "").toLowerCase())) {
    messages.push({
      type: "image",
      originalContentUrl: signedUrl,
      previewImageUrl: signedUrl,
    });
  }

  const ok = await linePush(groupId, messages);
  if (!ok) {
    return Response.json(
      { error: "LINEへの送信に失敗しました（アクセストークン・グループ状態を確認してください）" },
      { status: 502 }
    );
  }
  return Response.json({ ok: true });
}
