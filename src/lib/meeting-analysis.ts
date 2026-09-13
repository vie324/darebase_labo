// =============================================================
// 商談ログのAI解析 — 出力の形とプロンプトの組み立て
//
// 1マイクで録った「話者が混ざった文字起こし」を渡し、
//   話者分離 / 議事録 / ToDo抽出 / 確度判定(A・B・C) / 失注リスク
// を一度に出させる。出力の形はここ1箇所で決める（DBは jsonb で受ける）。
//
// サーバー（api/ai/analyze-meeting）とクライアント（表示）の両方から参照するため、
// ここには Anthropic SDK を持ち込まない（型と純粋関数だけ）。
// =============================================================

import { z } from "zod";

/** 話者の役割。1マイクの音声を文章から推定して振り分ける */
export const SPEAKER_ROLES = ["自社", "顧客", "銀行", "不明"] as const;
export type SpeakerRole = (typeof SPEAKER_ROLES)[number];

export const meetingAnalysisSchema = z.object({
  /** 話者分離した発言ログ。順序は発話順 */
  segments: z
    .array(
      z.object({
        role: z.enum(SPEAKER_ROLES).describe("発言者の立場"),
        speaker: z.string().describe("名前が分かる場合は名前。不明なら空文字"),
        text: z.string().describe("発言内容"),
      })
    )
    .describe("話者ごとに分けた発言ログ"),
  summary: z.string().describe("商談の要約。3〜5文"),
  decisions: z.array(z.string()).describe("その場で決まったこと"),
  concerns: z.array(z.string()).describe("先方の懸念・障害になりそうな点"),
  next_actions: z
    .array(
      z.object({
        title: z.string().describe("やること。動詞で終わる短い文"),
        owner: z.enum(["自社", "顧客", "銀行"]).describe("誰がやるか"),
        due_hint: z.string().describe("期限の手がかり（例: 今週中 / 3営業日以内 / 空文字）"),
        priority: z.enum(["high", "mid", "low"]).describe("優先度"),
      })
    )
    .describe("次にやること"),
  confidence: z
    .object({
      rank: z.enum(["A", "B", "C"]).describe("判定基準に照らした確度"),
      reason: z.string().describe("なぜそのランクなのか。1〜2文"),
      evidence: z
        .array(z.string())
        .describe("判断の根拠になった発言の引用。ログ中の表現をそのまま使う"),
    })
    .describe("確度の判定"),
  lost_risk: z
    .object({
      level: z.enum(["high", "mid", "low"]).describe("失注しそうな度合い"),
      reasons: z.array(z.string()).describe("失注につながりそうな要因"),
    })
    .describe("失注リスク"),
});

export type MeetingAnalysis = z.infer<typeof meetingAnalysisSchema>;

/** 解析に渡す文脈。分かっている範囲だけ埋める */
export interface MeetingContext {
  /** meeting（商談） | internal（社内会議・DDS） | study（勉強会） */
  kind: string;
  companyName: string;
  industry: string;
  revenueScale: string;
  /** 確度A/B/Cの判定基準（設定画面で編集した文言） */
  criteria: { A: string; B: string; C: string };
}

/** 文字起こしの上限。これを超える場合は呼び出し側で分割・要約を検討する */
export const TRANSCRIPT_MAX_CHARS = 60_000;

export const SYSTEM_PROMPT = `あなたは法人営業の商談ログを分析する日本語のアシスタントです。

渡されるのは1本のマイクで録音した文字起こしで、複数人の発言が混ざっており、話者ラベルはありません。
言い回し・敬語・立場・話の流れから、誰の発言かを推定して分離してください。

守ること:
- 文字起こしに無い事実を足さない。推測が必要な箇所は断定しない
- 引用（evidence）は文字起こしにある表現をそのまま使う。要約や言い換えをしない
- 話者が判別できない発言は role を「不明」にする。無理に割り当てない
- 出力はすべて日本語。敬体（です・ます）で簡潔に書く`;

/** 解析リクエストのユーザーメッセージを組み立てる */
export function buildAnalysisPrompt(transcript: string, ctx: MeetingContext): string {
  const kindLabel =
    ctx.kind === "internal" ? "社内会議" : ctx.kind === "study" ? "勉強会" : "商談";
  const facts = [
    ctx.companyName && `相手先: ${ctx.companyName}`,
    ctx.industry && `業種: ${ctx.industry}`,
    ctx.revenueScale && `売上規模: ${ctx.revenueScale}`,
  ].filter(Boolean);

  return [
    `# 対象`,
    `${kindLabel}の文字起こしです。`,
    facts.length > 0 ? facts.join("\n") : "",
    ``,
    `# 確度の判定基準（この組織の定義。これに厳密に従うこと）`,
    `A: ${ctx.criteria.A}`,
    `B: ${ctx.criteria.B}`,
    `C: ${ctx.criteria.C}`,
    ``,
    `# 文字起こし`,
    transcript.slice(0, TRANSCRIPT_MAX_CHARS),
  ]
    .filter((line) => line !== "")
    .join("\n");
}

// ---------- 表示・反映のためのヘルパー ----------

export const LOST_RISK_STYLE: Record<string, { label: string; color: string }> = {
  high: {
    label: "失注リスク 高",
    color: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  },
  mid: {
    label: "失注リスク 中",
    color: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  low: {
    label: "失注リスク 低",
    color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
};

export const SPEAKER_STYLE: Record<string, string> = {
  自社: "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300",
  顧客: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  銀行: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  不明: "bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-400",
};

/**
 * 「今週中」「3営業日以内」といった期限の手がかりを日付に落とす。
 * 解釈できない場合は空文字（＝期限なし）を返す。
 */
export function resolveDueDate(hint: string, today: string): string {
  const base = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(base)) return "";
  const add = (days: number) => new Date(base + days * 86_400_000).toISOString().slice(0, 10);

  const text = hint.trim();
  if (text === "") return "";
  if (/(本日|今日|即日)/.test(text)) return today;
  if (/明日/.test(text)) return add(1);
  if (/明後日/.test(text)) return add(2);

  // 「3営業日以内」「5日以内」「2週間後」など、数字を伴う表現
  const num = text.match(/(\d+)\s*(営業日|日|週間|ヶ月|か月|カ月)/);
  if (num) {
    const n = Number(num[1]);
    switch (num[2]) {
      case "営業日":
        // 土日をまたぐ分をざっくり足す（週5日換算）
        return add(n + Math.floor(n / 5) * 2);
      case "日":
        return add(n);
      case "週間":
        return add(n * 7);
      default:
        return add(n * 30);
    }
  }

  if (/今週/.test(text)) return add(5);
  if (/来週/.test(text)) return add(10);
  if (/今月/.test(text)) return add(14);
  if (/来月/.test(text)) return add(30);
  return "";
}

/** ToDo のうちタスク化するもの（自社がやることだけ） */
export function ownActions(analysis: MeetingAnalysis | null): MeetingAnalysis["next_actions"] {
  if (!analysis) return [];
  return analysis.next_actions.filter((a) => a.owner === "自社");
}
