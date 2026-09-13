// =============================================================
// POST /api/ai/recruit
//
// 採用の3つの解析をまとめて受ける入口。task で分岐する。
//   resume     : 履歴書・職務経歴書の整理
//   questions  : この候補者向けの面接質問
//   crosscheck : 書類と面接内容の突き合わせ
//
// 応募者の個人情報を Claude に渡すので、
//   - ログイン必須（未ログインは 401。/api/ai/analyze-meeting と同じ扱い）
//   - 本文はサーバーのログに残さない（エラー時も本文は出さない）
// を守る。合否判断はさせない（プロンプト側で縛っている。lib/recruiting.ts 参照）。
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
  CROSSCHECK_SYSTEM_PROMPT,
  QUESTIONS_SYSTEM_PROMPT,
  RESUME_SYSTEM_PROMPT,
  buildCrosscheckPrompt,
  buildQuestionsPrompt,
  buildResumePrompt,
  crosscheckSchema,
  interviewQuestionsSchema,
  readResumeAnalysis,
  resumeAnalysisSchema,
  type RecruitContext,
} from "@/lib/recruiting";

export const maxDuration = 300;

const TASKS = ["resume", "questions", "crosscheck"] as const;
type RecruitTask = (typeof TASKS)[number];

interface RecruitRequest {
  task?: string;
  resumeText?: string;
  transcript?: string;
  context?: Partial<RecruitContext>;
  /** 質問生成のときだけ使う。履歴書の解析結果（あれば質問がそこへ寄る） */
  resumeAnalysis?: unknown;
}

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

  let body: RecruitRequest;
  try {
    body = (await request.json()) as RecruitRequest;
  } catch {
    return Response.json({ error: "リクエストの形式が不正です。" }, { status: 400 });
  }

  const task = body.task as RecruitTask;
  if (!TASKS.includes(task)) {
    return Response.json({ error: "解析の種類が不正です。" }, { status: 400 });
  }

  const resumeText = typeof body.resumeText === "string" ? body.resumeText.trim() : "";
  const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
  const ctx: RecruitContext = {
    position: typeof body.context?.position === "string" ? body.context.position : "",
    requirements:
      typeof body.context?.requirements === "string" ? body.context.requirements : "",
  };

  if (resumeText.length < 50) {
    return Response.json(
      { error: "履歴書・職務経歴書の本文が足りません。" },
      { status: 400 }
    );
  }
  if (task === "crosscheck" && transcript.length < 50) {
    return Response.json({ error: "面接の文字起こしがありません。" }, { status: 400 });
  }

  const client = getAnthropic();
  if (!client) return Response.json({ error: "AIが未設定です。" }, { status: 503 });

  // task ごとの system / prompt / スキーマ
  const plan =
    task === "resume"
      ? {
          system: RESUME_SYSTEM_PROMPT,
          prompt: buildResumePrompt(resumeText, ctx),
          schema: resumeAnalysisSchema,
        }
      : task === "questions"
        ? {
            system: QUESTIONS_SYSTEM_PROMPT,
            prompt: buildQuestionsPrompt(
              resumeText,
              ctx,
              readResumeAnalysis(body.resumeAnalysis)
            ),
            schema: interviewQuestionsSchema,
          }
        : {
            system: CROSSCHECK_SYSTEM_PROMPT,
            prompt: buildCrosscheckPrompt(resumeText, transcript, ctx),
            schema: crosscheckSchema,
          };

  try {
    const response = await client.messages.parse({
      model: ANALYSIS_MODEL,
      max_tokens: 16000,
      system: plan.system,
      messages: [{ role: "user", content: plan.prompt }],
      output_config: { format: zodOutputFormat(plan.schema) },
    });

    if (!response.parsed_output) {
      return Response.json(
        { error: "AIの出力を読み取れませんでした。もう一度実行してください。" },
        { status: 502 }
      );
    }
    return Response.json({ result: response.parsed_output, model: response.model });
  } catch (error) {
    const { status, message } = describeAnthropicError(error);
    // 応募者の本文がログに残らないよう、task と種類だけを出す
    console.error("[recruit]", task, error instanceof Error ? error.name : "unknown");
    return Response.json({ error: message }, { status });
  }
}
