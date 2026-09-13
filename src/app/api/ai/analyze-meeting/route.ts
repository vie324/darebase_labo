// =============================================================
// POST /api/ai/analyze-meeting
//
// 1マイクで録った商談ログ（話者混在の文字起こし）を Claude に渡し、
// 話者分離 / 議事録 / ToDo / 確度 / 失注リスク を構造化して返す。
//
// ■ 認証
// このエンドポイントは会社のAPIキーを消費するため、**ログイン必須**にする。
// Supabase 接続時はリクエストのセッションを検証し、未ログインは 401。
// Supabase 未接続（デモ）の場合は AI を呼ばず 503 を返す
// （デモは画面側のモック解析で完結させる）。
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
  SYSTEM_PROMPT,
  buildAnalysisPrompt,
  meetingAnalysisSchema,
  type MeetingContext,
} from "@/lib/meeting-analysis";

/** 解析は数十秒かかることがあるため、実行時間の上限を延ばす */
export const maxDuration = 300;

interface RequestBody {
  transcript?: unknown;
  context?: Partial<MeetingContext>;
}

function supabaseEnv(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

/** ログイン中のユーザーを返す。未ログイン・未設定は null */
async function currentUserId(): Promise<string | null> {
  const env = supabaseEnv();
  if (!env) return null;
  const store = await cookies();
  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll: () => store.getAll(),
      // 読み取り専用で使うため、書き戻しは行わない
      setAll: () => {},
    },
  });
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function POST(request: Request) {
  if (!supabaseEnv()) {
    return Response.json(
      { error: "この環境ではAI解析を利用できません（デモモード）。" },
      { status: 503 }
    );
  }
  if (!isAnthropicConfigured()) {
    return Response.json(
      { error: "AIが未設定です。ANTHROPIC_API_KEY をサーバーに設定してください。" },
      { status: 503 }
    );
  }

  const userId = await currentUserId();
  if (!userId) {
    return Response.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return Response.json({ error: "リクエストの形式が不正です。" }, { status: 400 });
  }

  const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
  if (transcript.length < 20) {
    return Response.json(
      { error: "文字起こしが短すぎます。20文字以上のログを入れてください。" },
      { status: 400 }
    );
  }

  const context: MeetingContext = {
    kind: body.context?.kind ?? "meeting",
    companyName: body.context?.companyName ?? "",
    industry: body.context?.industry ?? "",
    revenueScale: body.context?.revenueScale ?? "",
    criteria: {
      A: body.context?.criteria?.A ?? "",
      B: body.context?.criteria?.B ?? "",
      C: body.context?.criteria?.C ?? "",
    },
  };

  const client = getAnthropic();
  if (!client) {
    return Response.json({ error: "AIが未設定です。" }, { status: 503 });
  }

  try {
    const response = await client.messages.parse({
      model: ANALYSIS_MODEL,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildAnalysisPrompt(transcript, context) }],
      output_config: { format: zodOutputFormat(meetingAnalysisSchema) },
    });

    if (!response.parsed_output) {
      return Response.json(
        { error: "AIの出力を読み取れませんでした。もう一度実行してください。" },
        { status: 502 }
      );
    }

    return Response.json({
      analysis: response.parsed_output,
      model: response.model,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    });
  } catch (error) {
    const { status, message } = describeAnthropicError(error);
    // 失敗の詳細はサーバーログにだけ残す（利用者には出さない）
    console.error("[analyze-meeting]", error);
    return Response.json({ error: message }, { status });
  }
}
