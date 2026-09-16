// =============================================================
// POST /api/ai/read-card
//
// 名刺の画像を Claude に読ませ、連絡先の項目を構造化して返す。
// tesseract.js の OCR（ocr.ts）より精度が出るので、こちらを本線にする。
//
// 認証・未設定時の扱いは他のAI経路と同じ（ログイン必須）。
// 名刺は個人情報なので、エラー時も画像や本文をログに出さない。
// =============================================================

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  ANALYSIS_MODEL,
  describeAnthropicError,
  getAnthropic,
  isAnthropicConfigured,
} from "@/lib/server/anthropic";
import {
  MAX_IMAGE_BYTES,
  SYSTEM_PROMPT,
  USER_PROMPT,
  cardReadSchema,
} from "@/lib/card-analysis";

export const maxDuration = 300;

/** Claude が受け付ける画像形式 */
const ALLOWED_MEDIA = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type AllowedMedia = (typeof ALLOWED_MEDIA)[number];

function supabaseEnv(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

async function currentUserId(): Promise<string | null> {
  const env = supabaseEnv();
  if (!env) return null;
  const store = await cookies();
  const supabase = createServerClient(env.url, env.key, {
    cookies: { getAll: () => store.getAll(), setAll: () => {} },
  });
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function POST(request: Request) {
  if (!supabaseEnv()) {
    return Response.json(
      { error: "この環境ではAI読み取りを利用できません（デモモード）。" },
      { status: 503 }
    );
  }
  if (!isAnthropicConfigured()) {
    return Response.json(
      { error: "AIが未設定です。ANTHROPIC_API_KEY をサーバーに設定してください。" },
      { status: 503 }
    );
  }
  if (!(await currentUserId())) {
    return Response.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  let image = "";
  let mediaType: AllowedMedia = "image/jpeg";
  try {
    const body = (await request.json()) as { image?: string; mediaType?: string };
    image = typeof body.image === "string" ? body.image : "";
    if (
      typeof body.mediaType === "string" &&
      (ALLOWED_MEDIA as readonly string[]).includes(body.mediaType)
    ) {
      mediaType = body.mediaType as AllowedMedia;
    }
  } catch {
    return Response.json({ error: "リクエストの形式が不正です。" }, { status: 400 });
  }

  // data URL で送られてきた場合はヘッダを落とす
  const commaAt = image.indexOf(",");
  if (image.startsWith("data:") && commaAt > 0) image = image.slice(commaAt + 1);

  if (image.length < 100) {
    return Response.json({ error: "画像が読み取れませんでした。" }, { status: 400 });
  }
  if (image.length > MAX_IMAGE_BYTES) {
    return Response.json(
      { error: "画像が大きすぎます。もう一度撮り直してください。" },
      { status: 413 }
    );
  }

  const client = getAnthropic();
  if (!client) return Response.json({ error: "AIが未設定です。" }, { status: 503 });

  try {
    const response = await client.messages.parse({
      model: ANALYSIS_MODEL,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            // 画像はテキストより前に置く（そのほうが指示が効く）
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: image },
            },
            { type: "text", text: USER_PROMPT },
          ],
        },
      ],
      output_config: { format: zodOutputFormat(cardReadSchema) },
    });

    if (!response.parsed_output) {
      return Response.json(
        { error: "読み取り結果を取得できませんでした。もう一度お試しください。" },
        { status: 502 }
      );
    }
    return Response.json({ read: response.parsed_output, model: response.model });
  } catch (error) {
    const { status, message } = describeAnthropicError(error);
    // 名刺は個人情報。画像も本文もログに出さず、種類だけ残す
    console.error("[read-card]", error instanceof Error ? error.name : "unknown");
    return Response.json({ error: message }, { status });
  }
}
