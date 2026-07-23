// =============================================================
// LINE Webhook 受信エンドポイント
//
// 公式アカウントが参加する三者グループ（担当者＋クライアント＋公式アカウント）の
// イベントを受信する:
// - join / leave: line_groups テーブルへグループを自動登録・状態更新
// - message(画像・ファイル): 添付を非公開バケット "invoices" へ保存し、
//   invoices に「受領」ステータスで自動登録（受領ボックスに出る）
// - message(テキスト): 取り込まない（三者グループの雑談を保存しない方針。
//   必要になったら chat モジュールへの転記を検討）
//
// セキュリティ: X-Line-Signature を生ボディで HMAC-SHA256 検証。
// LINE 側のリトライストームを避けるため、個々のイベント処理の失敗は
// ログに残して全体としては 200 を返す。
// =============================================================

import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import {
  extFromContentType,
  fetchGroupSummary,
  fetchLineContent,
  isLineConfigured,
  lineReply,
  verifyLineSignature,
} from "@/lib/server/line";
import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_BODY_BYTES = 1024 * 1024; // Webhook本文の上限（添付の実体は含まれない）

interface LineWebhookEvent {
  type: string;
  timestamp?: number;
  replyToken?: string;
  source?: { type?: string; groupId?: string; userId?: string };
  message?: { id?: string; type?: string; fileName?: string };
}

export async function POST(request: Request) {
  // 署名検証はパース前の生ボディで行う（request.json() を先に呼ばないこと）
  const rawBody = await request.text();

  if (rawBody.length > MAX_BODY_BYTES) {
    return new Response("Payload too large", { status: 413 });
  }
  if (!isLineConfigured()) {
    return new Response("LINE is not configured", { status: 503 });
  }
  if (!verifyLineSignature(rawBody, request.headers.get("x-line-signature"))) {
    return new Response("Invalid signature", { status: 401 });
  }

  let events: LineWebhookEvent[] = [];
  try {
    const body = JSON.parse(rawBody) as { events?: LineWebhookEvent[] };
    events = body.events ?? [];
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // LINE Developers コンソールの検証ボタンは events が空で届く → そのまま200
  const admin = getSupabaseAdmin();
  for (const event of events) {
    try {
      if (!admin) {
        console.error("[line-webhook] SUPABASE_SERVICE_ROLE_KEY 未設定のためイベントを処理できません");
        break;
      }
      await handleEvent(admin, event);
    } catch (err) {
      // 個別イベントの失敗で全体を落とさない（LINEのリトライを避ける）
      console.error("[line-webhook] event handling failed", event.type, err);
    }
  }

  return new Response("ok", { status: 200 });
}

async function handleEvent(admin: SupabaseClient, event: LineWebhookEvent) {
  const groupId = event.source?.type === "group" ? event.source.groupId : undefined;

  if (event.type === "join" && groupId) {
    await handleJoin(admin, groupId, event.replyToken);
    return;
  }
  if (event.type === "leave" && groupId) {
    await admin.from("line_groups").update({ status: "left" }).eq("group_id", groupId);
    return;
  }
  if (event.type === "message" && groupId && event.message?.id) {
    const kind = event.message.type;
    if (kind === "image" || kind === "file") {
      await importAttachment(admin, groupId, event);
    }
    // text などは取り込まない
  }
}

/** グループ参加: line_groups へ自動登録し、紐付けを促す案内を返信する */
async function handleJoin(admin: SupabaseClient, groupId: string, replyToken?: string) {
  const summary = await fetchGroupSummary(groupId);
  const { data: existing } = await admin
    .from("line_groups")
    .select("id, partner_id, group_name")
    .eq("group_id", groupId)
    .maybeSingle();

  if (existing) {
    await admin
      .from("line_groups")
      .update({
        status: existing.partner_id ? "active" : "unmapped",
        joined_at: new Date().toISOString(),
        group_name: summary?.groupName || existing.group_name,
      })
      .eq("id", existing.id);
  } else {
    await admin.from("line_groups").insert({
      group_id: groupId,
      group_name: summary?.groupName ?? "",
      partner_id: null,
      status: "unmapped",
      joined_at: new Date().toISOString(),
      memo: "",
    });
  }

  if (replyToken) {
    await lineReply(replyToken, [
      {
        type: "text",
        text: "こんにちは、DARE BASEの請求書窓口です。\nこのグループに送っていただいた請求書（画像・PDF）は自動で社内システムに登録されます。\n※担当者の方は「請求・支払 > マスタ」でこのグループを取引先に紐付けてください。",
      },
    ]);
  }
}

/** 画像・ファイルメッセージを非公開バケットへ保存し、受領請求書として登録する */
async function importAttachment(admin: SupabaseClient, groupId: string, event: LineWebhookEvent) {
  const messageId = event.message!.id!;

  // 冪等性: LINEのリトライで同じメッセージが二重登録されないようにする
  const { data: dup } = await admin
    .from("invoices")
    .select("id")
    .eq("line_message_id", messageId)
    .limit(1);
  if (dup && dup.length > 0) return;

  const content = await fetchLineContent(messageId);
  if (!content) {
    console.error(`[line-webhook] コンテンツ取得に失敗: ${messageId}`);
    return;
  }

  const fileName = event.message?.fileName ?? "";
  const extFromName = fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : "";
  const ext = extFromName || extFromContentType(content.contentType);
  const path = `line/${groupId}/${messageId}.${ext}`;

  const { error: uploadError } = await admin.storage
    .from("invoices")
    .upload(path, content.data, { contentType: content.contentType, upsert: true });
  if (uploadError) {
    console.error("[line-webhook] Storageへの保存に失敗", uploadError);
    return;
  }

  // グループの紐付け先取引先を解決（未紐付けでも取り込む＝取りこぼさない）
  const { data: group } = await admin
    .from("line_groups")
    .select("partner_id")
    .eq("group_id", groupId)
    .maybeSingle();
  let partnerName = "";
  if (group?.partner_id) {
    const { data: partner } = await admin
      .from("partners")
      .select("name")
      .eq("id", group.partner_id)
      .maybeSingle();
    partnerName = partner?.name ?? "";
  }

  // 受領日はJST基準の日付にする
  const ts = event.timestamp ?? Date.now();
  const jstDate = new Date(ts + 9 * 3600 * 1000).toISOString().slice(0, 10);

  const { error: insertError } = await admin.from("invoices").insert({
    direction: "payable",
    partner_id: group?.partner_id ?? null,
    partner_name: partnerName,
    invoice_number: "",
    title: fileName ? `LINE受信 ${fileName}` : `LINE受信 請求書（${jstDate}）`,
    subtotal: 0,
    tax: 0,
    withholding: 0,
    total: 0,
    issue_date: jstDate,
    due_date: "",
    status: "received",
    paid_amount: 0,
    paid_date: "",
    source: "line",
    statement_id: null,
    line_group_id: groupId,
    line_message_id: messageId,
    file_url: path,
    file_type: ext,
    ocr_text: "",
    memo: "",
  });
  if (insertError) {
    console.error("[line-webhook] invoices への登録に失敗", insertError);
    return;
  }

  // グループへ受領確認を返信（雑談への応答はしない。添付受信時のみ）
  if (event.replyToken) {
    await lineReply(event.replyToken, [
      {
        type: "text",
        text: "書類を受け取りました。担当者が内容を確認のうえ登録いたします。（自動応答）",
      },
    ]);
  }
}
