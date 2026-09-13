// =============================================================
// 採用 — 選考ステータスと、AI解析（履歴書 / 面接質問 / 矛盾チェック）の型・プロンプト
//
// 扱うのは応募者の個人情報なので、次の3点をこのファイルの前提にする。
//   1. AI は「人が判断するための材料」を作るだけ。合否は出させない
//   2. 書類・面接に書かれていないことを推測させない
//   3. 公正な採用選考の観点から、本籍・家族・生活環境・思想信条など
//      本人の適性・能力に関係のない事項には触れさせない
//
// サーバー（api/ai/recruit）とクライアント（表示）の両方から読むため、
// ここには Anthropic SDK を持ち込まない（型と純粋関数だけ）。
// =============================================================

import { z } from "zod";

// ---------- 選考ステータス ----------

export const CANDIDATE_STATUSES = {
  applied: { label: "応募", color: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300", open: true },
  screening: { label: "書類選考", color: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300", open: true },
  interview: { label: "面接", color: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300", open: true },
  offer: { label: "内定", color: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300", open: true },
  hired: { label: "入社", color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", open: false },
  rejected: { label: "不採用", color: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300", open: false },
  declined: { label: "辞退", color: "bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-400", open: false },
} as const;

export type CandidateStatus = keyof typeof CANDIDATE_STATUSES;

export const CANDIDATE_STATUS_KEYS = Object.keys(CANDIDATE_STATUSES) as CandidateStatus[];

export function statusMeta(status: string): (typeof CANDIDATE_STATUSES)[CandidateStatus] {
  return CANDIDATE_STATUSES[status as CandidateStatus] ?? CANDIDATE_STATUSES.applied;
}

/** 選考中（＝対応が必要）か */
export function isOpenStatus(status: string): boolean {
  return statusMeta(status).open;
}

// ---------- 入力の上限 ----------

export const RESUME_MAX_CHARS = 40_000;
export const INTERVIEW_MAX_CHARS = 60_000;

// ---------- 1. 履歴書・職務経歴書の解析 ----------

export const resumeAnalysisSchema = z.object({
  summary: z.string().describe("経歴の要約。3〜5文。事実のみ"),
  experience_years: z
    .number()
    .describe("社会人経験の年数。書類から読み取れない場合は 0"),
  sales_years: z.number().describe("営業職の経験年数。読み取れない場合は 0"),
  career: z
    .array(
      z.object({
        company: z.string().describe("会社名。書類の表記のまま"),
        period: z.string().describe("在籍期間。例: 2019年4月〜2023年3月"),
        role: z.string().describe("職種・役割"),
        highlights: z.array(z.string()).describe("その在籍中の実績。書類に書かれていることだけ"),
      })
    )
    .describe("職歴。新しい順"),
  skills: z.array(z.string()).describe("書類から読み取れるスキル・資格"),
  strengths: z
    .array(
      z.object({
        point: z.string().describe("強みとして読み取れる点"),
        evidence: z.string().describe("そう読み取った根拠。書類の記述をそのまま引用する"),
      })
    )
    .describe("募集職種に対して強みになりそうな点"),
  /** 「懸念」ではなく「面接で確かめること」として出させる（AIに評価させない） */
  verify_points: z
    .array(
      z.object({
        point: z.string().describe("書類だけでは判断できない点"),
        reason: z.string().describe("なぜ確認が必要か。1〜2文"),
      })
    )
    .describe("面接で確認すべき点"),
  job_changes: z
    .object({
      count: z.number().describe("転職回数。読み取れない場合は 0"),
      blanks: z.array(z.string()).describe("在籍期間の空白。例: 2021年4月〜2021年9月"),
    })
    .describe("在籍の推移。事実のみを並べ、良し悪しの評価はしない"),
});

export type ResumeAnalysis = z.infer<typeof resumeAnalysisSchema>;

// ---------- 2. 面接質問の生成 ----------

export const interviewQuestionsSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string().describe("候補者に投げる質問。そのまま読める日本語で"),
        intent: z.string().describe("この質問で何を確かめたいのか。1文"),
        category: z
          .enum(["経歴確認", "実績の再現性", "志望動機", "行動特性", "条件・稼働"])
          .describe("質問の狙い"),
        follow_ups: z.array(z.string()).describe("回答が浅い場合の追い質問。1〜2個"),
      })
    )
    .describe("面接で使う質問。この候補者の書類に即した内容にする"),
  focus: z.string().describe("この候補者の面接で特に確かめるべきこと。2〜3文"),
});

export type InterviewQuestions = z.infer<typeof interviewQuestionsSchema>;

// ---------- 3. 履歴書と面接内容の突き合わせ ----------

export const crosscheckSchema = z.object({
  summary: z.string().describe("突き合わせの結果。2〜4文"),
  findings: z
    .array(
      z.object({
        topic: z.string().describe("食い違っている項目。例: 前職の在籍期間"),
        resume_says: z.string().describe("書類での記述。原文を引用する"),
        interview_says: z.string().describe("面接での発言。原文を引用する"),
        level: z
          .enum(["high", "mid", "low"])
          .describe("high=明確な食い違い / mid=説明が必要 / low=言い回しの差の可能性"),
        how_to_confirm: z.string().describe("本人にどう確認するか。角の立たない聞き方で1文"),
      })
    )
    .describe("書類と面接で食い違う点。無い場合は空配列"),
  consistent_points: z.array(z.string()).describe("書類と面接で一致していた重要な点"),
  unanswered: z.array(z.string()).describe("書類にあるのに面接で触れられなかった点"),
});

export type Crosscheck = z.infer<typeof crosscheckSchema>;

// ---------- プロンプト ----------

/** 3つの解析で共通の土台。個人情報の扱いはここで一度だけ縛る */
const COMMON_RULES = `守ること:
- 合否・採否の判断はしない。順位付けやスコアリングもしない。あなたの役割は面接官が判断するための材料を整理することだけ
- 書類・発言に無いことを補わない。読み取れない項目は空欄・0 のままにする
- 引用は原文のまま使う。要約や言い換えをしない
- 本籍・出身地・国籍・家族構成・住宅事情・資産・信条・支持政党・宗教・性別・年齢を理由にした記述は一切しない（公正な採用選考の観点から、本人の適性と能力に関係のない事項は扱わない）
- 出力はすべて日本語。敬体（です・ます）で簡潔に書く`;

export const RESUME_SYSTEM_PROMPT = `あなたは日本の法人営業チームの採用担当を補助するアシスタントです。
渡された履歴書・職務経歴書を読み、面接官が短時間で把握できるように事実を整理します。

${COMMON_RULES}`;

export const QUESTIONS_SYSTEM_PROMPT = `あなたは日本の法人営業チームの採用担当を補助するアシスタントです。
候補者の書類を読み、その人にだけ意味のある面接質問を作ります。誰にでも当てはまる一般的な質問は作りません。

${COMMON_RULES}
- 質問は候補者の経歴の具体的な記述に紐づける（会社名・数字・期間を引く）
- 圧迫的な聞き方や、答えに窮させることを目的とした質問は作らない`;

export const CROSSCHECK_SYSTEM_PROMPT = `あなたは日本の法人営業チームの採用担当を補助するアシスタントです。
書類の記述と面接での発言を突き合わせ、食い違っている点を洗い出します。

${COMMON_RULES}
- 食い違いを見つけても、それが不正であるとは決めつけない。言い間違い・記憶違い・書類の書き方の差である可能性を常に残す
- 見つからなければ findings は空配列にする。無理に探さない`;

export interface RecruitContext {
  /** 募集職種 */
  position: string;
  /** 募集職種の説明・求める人物像（設定で編集した文言） */
  requirements: string;
}

/** 募集要件の既定値。設定画面から編集できるようにする */
export const DEFAULT_REQUIREMENTS = `銀行の紹介を起点に、中小企業へ設備・サービスを提案する法人営業。
初回訪問から受注・設置完了までを一人で担当する。
求めるのは、断られた理由を次の商談に持ち込める人、記録を残せる人、社内外の期限を守れる人。`;

function contextBlock(ctx: RecruitContext): string {
  return [
    `# 募集職種`,
    ctx.position || "（未設定）",
    ``,
    `# 求める人物像・職務内容`,
    ctx.requirements || DEFAULT_REQUIREMENTS,
  ].join("\n");
}

export function buildResumePrompt(resumeText: string, ctx: RecruitContext): string {
  return [
    contextBlock(ctx),
    ``,
    `# 履歴書・職務経歴書`,
    resumeText.slice(0, RESUME_MAX_CHARS),
  ].join("\n");
}

export function buildQuestionsPrompt(
  resumeText: string,
  ctx: RecruitContext,
  analysis: ResumeAnalysis | null
): string {
  const lines = [contextBlock(ctx), ``];

  // 解析済みなら「確認すべき点」を渡して、質問をそこへ寄せる
  if (analysis && analysis.verify_points.length > 0) {
    lines.push(
      `# 書類解析で挙がった「面接で確認すべき点」（質問はここを優先的に潰すこと）`,
      ...analysis.verify_points.map((v) => `- ${v.point}（理由: ${v.reason}）`),
      ``
    );
  }

  lines.push(
    `# 履歴書・職務経歴書`,
    resumeText.slice(0, RESUME_MAX_CHARS),
    ``,
    `# 依頼`,
    `この候補者向けの面接質問を6〜10問作ってください。`
  );
  return lines.join("\n");
}

export function buildCrosscheckPrompt(
  resumeText: string,
  transcript: string,
  ctx: RecruitContext
): string {
  return [
    contextBlock(ctx),
    ``,
    `# 履歴書・職務経歴書`,
    resumeText.slice(0, RESUME_MAX_CHARS),
    ``,
    `# 面接の文字起こし`,
    `1本のマイクで録音したもので、面接官と候補者の発言が混ざっています。`,
    `文脈から候補者本人の発言を見分けて、書類と突き合わせてください。`,
    ``,
    transcript.slice(0, INTERVIEW_MAX_CHARS),
  ].join("\n");
}

// ---------- 表示・保存のヘルパー ----------

export const GAP_STYLE: Record<string, { label: string; color: string }> = {
  high: {
    label: "要確認",
    color: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  },
  mid: {
    label: "説明が必要",
    color: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  low: {
    label: "表現の差",
    color: "bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-400",
  },
};

export const QUESTION_CATEGORY_STYLE: Record<string, string> = {
  経歴確認: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  実績の再現性: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  志望動機: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  行動特性: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  "条件・稼働": "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
};

/** jsonb から履歴書解析を取り出す（未解析・壊れている場合は null） */
export function readResumeAnalysis(value: unknown): ResumeAnalysis | null {
  if (!value || typeof value !== "object") return null;
  const a = value as Partial<ResumeAnalysis>;
  return Array.isArray(a.career) && Array.isArray(a.verify_points)
    ? (value as ResumeAnalysis)
    : null;
}

export function readQuestions(value: unknown): InterviewQuestions | null {
  if (!value || typeof value !== "object") return null;
  const q = value as Partial<InterviewQuestions>;
  return Array.isArray(q.questions) ? (value as InterviewQuestions) : null;
}

export function readCrosscheck(value: unknown): Crosscheck | null {
  if (!value || typeof value !== "object") return null;
  const c = value as Partial<Crosscheck>;
  return Array.isArray(c.findings) && Array.isArray(c.consistent_points)
    ? (value as Crosscheck)
    : null;
}

/** 突き合わせ結果のうち、面接官が必ず追う必要があるもの */
export function seriousGaps(check: Crosscheck | null): Crosscheck["findings"] {
  if (!check) return [];
  return check.findings.filter((f) => f.level === "high" || f.level === "mid");
}
