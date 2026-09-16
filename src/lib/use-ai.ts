"use client";

// =============================================================
// AI解析の呼び出し（クライアント側）
//
// Claude はサーバー経由でのみ呼ぶ（APIキーをブラウザに配らないため）。
// デモモードでは実際には呼ばず、サンプルの解析結果を少し待って返す。
// =============================================================

import { useCallback, useEffect, useState } from "react";
import { isSupabaseConfigured } from "./supabase";
import { DEMO_ANALYSIS } from "./demo/meetings";
import { DEMO_CARD_READ } from "./demo/contacts";
import type { MeetingAnalysis, MeetingContext } from "./meeting-analysis";
import type { LossCase, LossInsight } from "./loss-analysis";
import type { CardRead } from "./card-analysis";
import type {
  Crosscheck,
  InterviewQuestions,
  RecruitContext,
  ResumeAnalysis,
} from "./recruiting";
import { DEMO_CANDIDATES } from "./demo/recruiting";

export interface AiStatus {
  /** サーバーに APIキーが設定されているか */
  configured: boolean;
  model: string;
  /** デモモード（Supabase未接続）。AIは呼ばずサンプルを返す */
  isDemo: boolean;
  loading: boolean;
}

export function useAiStatus(): AiStatus {
  const isDemo = !isSupabaseConfigured();
  const [state, setState] = useState<{ configured: boolean; model: string; loading: boolean }>({
    configured: false,
    model: "",
    loading: !isDemo,
  });

  useEffect(() => {
    if (isDemo) return;
    let alive = true;
    fetch("/api/ai/status")
      .then((r) => r.json())
      .then((d: { configured?: boolean; model?: string }) => {
        if (!alive) return;
        setState({ configured: Boolean(d.configured), model: d.model ?? "", loading: false });
      })
      .catch(() => {
        if (alive) setState({ configured: false, model: "", loading: false });
      });
    return () => {
      alive = false;
    };
  }, [isDemo]);

  return { ...state, isDemo };
}

export interface AnalyzeResult {
  analysis: MeetingAnalysis;
  model: string;
}

export interface AnalyzeState {
  analyzing: boolean;
  error: string;
  analyze: (transcript: string, context: MeetingContext) => Promise<AnalyzeResult | null>;
}

export function useMeetingAnalyzer(): AnalyzeState {
  const isDemo = !isSupabaseConfigured();
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");

  const analyze = useCallback(
    async (transcript: string, context: MeetingContext): Promise<AnalyzeResult | null> => {
      setAnalyzing(true);
      setError("");
      try {
        if (isDemo) {
          // デモは実際に課金せず、サンプルを返す（画面と反映の流れを確認するため）
          await new Promise((resolve) => setTimeout(resolve, 1200));
          return { analysis: DEMO_ANALYSIS, model: "demo" };
        }
        const res = await fetch("/api/ai/analyze-meeting", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ transcript, context }),
        });
        const data = (await res.json()) as {
          analysis?: MeetingAnalysis;
          model?: string;
          error?: string;
        };
        if (!res.ok || !data.analysis) {
          setError(data.error ?? "解析に失敗しました。");
          return null;
        }
        return { analysis: data.analysis, model: data.model ?? "" };
      } catch {
        setError("解析に失敗しました。通信環境を確認してください。");
        return null;
      } finally {
        setAnalyzing(false);
      }
    },
    [isDemo]
  );

  return { analyzing, error, analyze };
}

// ---------- 失注の横断分析 ----------

export interface LossInsightState {
  analyzing: boolean;
  error: string;
  insight: LossInsight | null;
  analyze: (cases: LossCase[]) => Promise<void>;
}

/** デモモードで返すサンプル（実際には Claude を呼ばない） */
const DEMO_LOSS_INSIGHT: LossInsight = {
  summary:
    "失注の多くは価格そのものではなく、価格を判断する材料を出す前に決裁の流れが止まっていることに起因しています。決裁者が同席しないまま提案が進み、社内で説明できずに保留になる型が繰り返されています。工事による業務停止への不安も、現場責任者に直接説明できていない案件で表面化しています。",
  themes: [
    {
      title: "決裁者が同席しないまま提案が進む",
      affected: 2,
      detail:
        "面談相手は前向きでも決裁権がなく、社内で説明しきれずに保留・失注に至っています。",
      countermeasure:
        "確度Bに上げる条件として「決裁者の同席」を必須にし、同席が取れない場合は担当者向けの社内説明資料を提案時に渡します。",
    },
    {
      title: "現場責任者の不安が解消されていない",
      affected: 1,
      detail: "設置工事による業務停止への懸念が、現場責任者に直接説明されないまま残っています。",
      countermeasure:
        "2回目の商談までに現場責任者の同席を依頼し、夜間工事の実績資料を standard で持参します。",
    },
  ],
  biggest_gap:
    "確度Aと判定した案件からも失注しており、A の判定条件に「決裁者の合意」が含まれていないことが最大の改善余地です。",
};

export function useLossInsight(): LossInsightState {
  const isDemo = !isSupabaseConfigured();
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [insight, setInsight] = useState<LossInsight | null>(null);

  const analyze = useCallback(
    async (cases: LossCase[]) => {
      setAnalyzing(true);
      setError("");
      try {
        if (isDemo) {
          await new Promise((resolve) => setTimeout(resolve, 1200));
          setInsight(DEMO_LOSS_INSIGHT);
          return;
        }
        const res = await fetch("/api/ai/analyze-losses", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ cases }),
        });
        const data = (await res.json()) as { insight?: LossInsight; error?: string };
        if (!res.ok || !data.insight) {
          setError(data.error ?? "分析に失敗しました。");
          return;
        }
        setInsight(data.insight);
      } catch {
        setError("分析に失敗しました。通信環境を確認してください。");
      } finally {
        setAnalyzing(false);
      }
    },
    [isDemo]
  );

  return { analyzing, error, insight, analyze };
}

// ---------- 採用（履歴書解析 / 面接質問 / 矛盾チェック） ----------

export type RecruitTask = "resume" | "questions" | "crosscheck";

export interface RecruitInput {
  task: RecruitTask;
  resumeText: string;
  /** crosscheck のときだけ使う */
  transcript?: string;
  context: RecruitContext;
  /** questions のときに渡すと、質問が「確認すべき点」に寄る */
  resumeAnalysis?: ResumeAnalysis | null;
}

/** task ごとの返り値。呼び出し側で絞り込んで使う */
export type RecruitOutput = ResumeAnalysis | InterviewQuestions | Crosscheck;

export interface RecruitAiState {
  /** 実行中の task（null = 待機中）。ボタンごとに出し分けるため種類を持つ */
  running: RecruitTask | null;
  error: string;
  run: (input: RecruitInput) => Promise<{ result: RecruitOutput; model: string } | null>;
}

/** デモモードで返すサンプル（実際には Claude を呼ばない）。シードの解析済み1件を使う */
const DEMO_RECRUIT = DEMO_CANDIDATES[0];

export function useRecruitAi(): RecruitAiState {
  const isDemo = !isSupabaseConfigured();
  const [running, setRunning] = useState<RecruitTask | null>(null);
  const [error, setError] = useState("");

  const run = useCallback(
    async (input: RecruitInput) => {
      setRunning(input.task);
      setError("");
      try {
        if (isDemo) {
          await new Promise((resolve) => setTimeout(resolve, 1200));
          const sample =
            input.task === "resume"
              ? DEMO_RECRUIT.resume_analysis
              : input.task === "questions"
                ? DEMO_RECRUIT.questions
                : DEMO_RECRUIT.crosscheck;
          return { result: sample as RecruitOutput, model: "demo" };
        }
        const res = await fetch("/api/ai/recruit", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            task: input.task,
            resumeText: input.resumeText,
            transcript: input.transcript ?? "",
            context: input.context,
            resumeAnalysis: input.resumeAnalysis ?? null,
          }),
        });
        const data = (await res.json()) as {
          result?: RecruitOutput;
          model?: string;
          error?: string;
        };
        if (!res.ok || !data.result) {
          setError(data.error ?? "解析に失敗しました。");
          return null;
        }
        return { result: data.result, model: data.model ?? "" };
      } catch {
        setError("解析に失敗しました。通信環境を確認してください。");
        return null;
      } finally {
        setRunning(null);
      }
    },
    [isDemo]
  );

  return { running, error, run };
}

// ---------- 名刺の読み取り ----------

export interface CardReadState {
  reading: boolean;
  error: string;
  /** 画像を渡すと読み取り結果を返す。失敗時は null */
  read: (image: string, mediaType: string) => Promise<CardRead | null>;
}

/**
 * 名刺画像を Claude に読ませる。
 * tesseract.js の OCR より精度が出るので、こちらを本線にする（ocr.ts は控え）。
 */
export function useCardReader(): CardReadState {
  const isDemo = !isSupabaseConfigured();
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");

  const read = useCallback(
    async (image: string, mediaType: string): Promise<CardRead | null> => {
      setReading(true);
      setError("");
      try {
        if (isDemo) {
          // デモは実際に課金せず、サンプルを返す（反映の流れを確認するため）
          await new Promise((resolve) => setTimeout(resolve, 1200));
          return DEMO_CARD_READ;
        }
        const res = await fetch("/api/ai/read-card", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ image, mediaType }),
        });
        const data = (await res.json()) as { read?: CardRead; error?: string };
        if (!res.ok || !data.read) {
          setError(data.error ?? "読み取りに失敗しました。");
          return null;
        }
        return data.read;
      } catch {
        setError("読み取りに失敗しました。通信環境を確認してください。");
        return null;
      } finally {
        setReading(false);
      }
    },
    [isDemo]
  );

  return { reading, error, read };
}
