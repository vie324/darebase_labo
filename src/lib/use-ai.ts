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
import type { MeetingAnalysis, MeetingContext } from "./meeting-analysis";

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
