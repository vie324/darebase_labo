// =============================================================
// POST /api/ai/analyze-losses
//
// 失注案件の一覧を Claude に渡し、共通する原因と打ち手をまとめさせる。
// 認証・未設定時の扱いは /api/ai/analyze-meeting と同じ（ログイン必須）。
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
  LOSS_SYSTEM_PROMPT,
  buildLossPrompt,
  lossInsightSchema,
  type LossCase,
} from "@/lib/loss-analysis";

export const maxDuration = 300;

/** 一度に渡す失注案件の上限（多すぎると入力が膨らむため） */
const MAX_CASES = 100;

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
  if (!(await currentUserId())) {
    return Response.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  let cases: LossCase[];
  try {
    const body = (await request.json()) as { cases?: LossCase[] };
    cases = Array.isArray(body.cases) ? body.cases.slice(0, MAX_CASES) : [];
  } catch {
    return Response.json({ error: "リクエストの形式が不正です。" }, { status: 400 });
  }

  if (cases.length === 0) {
    return Response.json({ error: "分析できる失注案件がありません。" }, { status: 400 });
  }

  const client = getAnthropic();
  if (!client) return Response.json({ error: "AIが未設定です。" }, { status: 503 });

  try {
    const response = await client.messages.parse({
      model: ANALYSIS_MODEL,
      max_tokens: 16000,
      system: LOSS_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildLossPrompt(cases) }],
      output_config: { format: zodOutputFormat(lossInsightSchema) },
    });

    if (!response.parsed_output) {
      return Response.json(
        { error: "AIの出力を読み取れませんでした。もう一度実行してください。" },
        { status: 502 }
      );
    }
    return Response.json({ insight: response.parsed_output, model: response.model });
  } catch (error) {
    const { status, message } = describeAnthropicError(error);
    console.error("[analyze-losses]", error);
    return Response.json({ error: message }, { status });
  }
}
