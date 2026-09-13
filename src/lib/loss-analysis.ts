// =============================================================
// 失注（ロスト）の横断分析
//
// 商談ログのAI解析（meeting-analysis）が出す失注要因は1件ごとの自由文なので、
// そのままでは傾向が見えない。ここで
//   - キーワードによる分類（AIなしでも必ず動く土台）
//   - 件数・金額・確度ランク・担当者・月次の集計
// を作り、その上で AI に「傾向と打ち手」をまとめさせる。
//
// AI が未設定でも集計だけは常に見える、という切り分けにしている。
// =============================================================

import { z } from "zod";
import type { Deal, MeetingLog } from "./types";
import type { MeetingAnalysis } from "./meeting-analysis";

// ---------- 失注要因の分類 ----------

export interface LossCategory {
  key: string;
  label: string;
  /** この語を含めばそのカテゴリとみなす。上から順に判定する */
  keywords: string[];
  color: string;
}

/**
 * 失注要因のカテゴリ。上から順に評価するので、具体的なものを先に置く。
 * 運用しながら語彙を足す前提で、この配列1箇所にまとめている。
 */
export const LOSS_CATEGORIES: LossCategory[] = [
  {
    key: "competitor",
    label: "競合に決定",
    keywords: ["競合", "他社", "相見積", "コンペ", "乗り換え先"],
    color: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  },
  {
    key: "price",
    label: "価格・コスト",
    keywords: ["価格", "値段", "高い", "コスト", "費用対効果", "割高"],
    color: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  {
    key: "budget",
    label: "予算がない",
    keywords: ["予算", "資金", "投資枠"],
    color: "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  },
  {
    key: "authority",
    label: "決裁・社内調整",
    keywords: ["決裁", "稟議", "役員", "社内", "上長", "承認", "反対"],
    color: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  },
  {
    key: "timing",
    label: "時期が合わない",
    keywords: ["時期", "タイミング", "来期", "先送り", "保留", "延期"],
    color: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
  {
    key: "install",
    label: "工事・設置の懸念",
    keywords: ["工事", "設置", "業務停止", "停止", "現場", "ダウンタイム"],
    color: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  },
  {
    key: "spec",
    label: "機能・仕様が合わない",
    keywords: ["機能", "仕様", "要件", "対応できない", "不足"],
    color: "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300",
  },
  {
    key: "contact",
    label: "連絡が途絶えた",
    keywords: ["連絡", "音信", "返信がない", "つながらない", "放置"],
    color: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
  },
  {
    key: "other",
    label: "その他",
    keywords: [],
    color: "bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-400",
  },
];

export function categoryMeta(key: string): LossCategory {
  return LOSS_CATEGORIES.find((c) => c.key === key) ?? LOSS_CATEGORIES[LOSS_CATEGORIES.length - 1];
}

/** 自由文の失注要因を、キーワードでカテゴリに割り当てる */
export function categorizeReason(text: string): string {
  const t = text.toLowerCase();
  for (const cat of LOSS_CATEGORIES) {
    if (cat.keywords.some((k) => t.includes(k.toLowerCase()))) return cat.key;
  }
  return "other";
}

// ---------- 集計 ----------

/** 1件の失注案件（商談ログの要因を紐付けたもの） */
export interface LossCase {
  dealId: string;
  name: string;
  company: string;
  amount: number;
  /** 失注時点の確度ランク（"" = 未判定） */
  rank: string;
  ownerName: string;
  /** 失注した月 YYYY-MM（判定できない場合は ""） */
  month: string;
  /** 商談ログのAI解析から拾った失注要因 */
  reasons: string[];
  /** 同じく懸念点 */
  concerns: string[];
}

export interface CategoryCount {
  key: string;
  label: string;
  count: number;
  /** そのカテゴリに入った要因の実文（重複除去） */
  samples: string[];
}

export interface LossStats {
  cases: LossCase[];
  lostCount: number;
  wonCount: number;
  lostAmount: number;
  /** 失注率（受注+失注が0なら null） */
  lossRate: number | null;
  categories: CategoryCount[];
  /** 確度ランク別の失注件数。A から落ちているほど見極めが甘い */
  byRank: { rank: string; count: number }[];
  byOwner: { name: string; lost: number; won: number; rate: number | null }[];
  monthly: { month: string; count: number; amount: number }[];
  /** 失注要因が1件も取れていない案件の数（商談ログ未解析） */
  withoutReasons: number;
}

function readAnalysis(value: unknown): MeetingAnalysis | null {
  if (!value || typeof value !== "object") return null;
  const a = value as Partial<MeetingAnalysis>;
  return a.lost_risk && a.confidence ? (value as MeetingAnalysis) : null;
}

function monthOf(iso: string): string {
  return /^\d{4}-\d{2}/.test(iso) ? iso.slice(0, 7) : "";
}

/**
 * 失注案件と、それに紐づく商談ログの解析結果から統計を作る。
 * 商談ログは deal_id で案件に紐付いているものだけを見る。
 */
export function buildLossStats(deals: Deal[], logs: MeetingLog[]): LossStats {
  const lost = deals.filter((d) => d.stage === "lost");
  const won = deals.filter((d) => d.stage === "won");

  const cases: LossCase[] = lost.map((d) => {
    const related = logs.filter((m) => m.deal_id === d.id);
    const reasons: string[] = [];
    const concerns: string[] = [];
    for (const log of related) {
      const a = readAnalysis(log.analysis);
      if (!a) continue;
      reasons.push(...a.lost_risk.reasons);
      concerns.push(...a.concerns);
    }
    return {
      dealId: d.id,
      name: d.name,
      company: d.company,
      amount: d.amount,
      rank: d.confidence_rank ?? "",
      ownerName: d.owner_name,
      // 失注日は持っていないため、最終更新月を失注月として扱う
      month: monthOf(d.updated_at),
      reasons: Array.from(new Set(reasons)),
      concerns: Array.from(new Set(concerns)),
    };
  });

  // カテゴリ集計
  const buckets = new Map<string, { count: number; samples: Set<string> }>();
  for (const c of cases) {
    for (const reason of c.reasons) {
      const key = categorizeReason(reason);
      const bucket = buckets.get(key) ?? { count: 0, samples: new Set<string>() };
      bucket.count += 1;
      bucket.samples.add(reason);
      buckets.set(key, bucket);
    }
  }
  const categories: CategoryCount[] = Array.from(buckets.entries())
    .map(([key, b]) => ({
      key,
      label: categoryMeta(key).label,
      count: b.count,
      samples: Array.from(b.samples).slice(0, 5),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  // 確度ランク別
  const rankOrder = ["A", "B", "C", ""];
  const byRank = rankOrder
    .map((rank) => ({
      rank,
      count: cases.filter((c) => (c.rank || "") === rank).length,
    }))
    .filter((r) => r.count > 0);

  // 担当者別
  const owners = Array.from(new Set([...lost, ...won].map((d) => d.owner_name))).filter(Boolean);
  const byOwner = owners
    .map((name) => {
      const l = lost.filter((d) => d.owner_name === name).length;
      const w = won.filter((d) => d.owner_name === name).length;
      return { name, lost: l, won: w, rate: l + w > 0 ? Math.round((l / (l + w)) * 100) : null };
    })
    .filter((o) => o.lost > 0)
    .sort((a, b) => b.lost - a.lost);

  // 月次
  const monthMap = new Map<string, { count: number; amount: number }>();
  for (const c of cases) {
    if (c.month === "") continue;
    const m = monthMap.get(c.month) ?? { count: 0, amount: 0 };
    m.count += 1;
    m.amount += c.amount;
    monthMap.set(c.month, m);
  }
  const monthly = Array.from(monthMap.entries())
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return {
    cases,
    lostCount: lost.length,
    wonCount: won.length,
    lostAmount: lost.reduce((s, d) => s + d.amount, 0),
    lossRate:
      lost.length + won.length > 0
        ? Math.round((lost.length / (lost.length + won.length)) * 100)
        : null,
    categories,
    byRank,
    byOwner,
    monthly,
    withoutReasons: cases.filter((c) => c.reasons.length === 0).length,
  };
}

// ---------- AI（傾向と打ち手） ----------

export const lossInsightSchema = z.object({
  summary: z.string().describe("失注全体の傾向。3〜5文"),
  themes: z
    .array(
      z.object({
        title: z.string().describe("要因のまとまりを表す短い見出し"),
        affected: z.number().describe("この要因が当てはまる案件数"),
        detail: z.string().describe("何が起きているのか。1〜2文"),
        countermeasure: z.string().describe("次から防ぐための具体的な打ち手。1〜2文"),
      })
    )
    .describe("多い順の失注テーマ"),
  biggest_gap: z.string().describe("最も改善余地が大きい点。1文"),
});

export type LossInsight = z.infer<typeof lossInsightSchema>;

export const LOSS_SYSTEM_PROMPT = `あなたは法人営業の失注分析を行う日本語のアシスタントです。
渡された失注案件の一覧から、共通する原因を見つけ、次から防ぐための打ち手を出します。

守ること:
- 渡されたデータに無い事実を足さない
- 打ち手は「誰が・いつ・何をするか」が分かる具体性で書く。精神論にしない
- 件数が少ない場合は断定せず、傾向の候補として書く
- 出力はすべて日本語。敬体（です・ます）で簡潔に`;

/** 失注案件の一覧をプロンプトに落とす */
export function buildLossPrompt(cases: LossCase[]): string {
  const lines = cases.map((c, i) => {
    const parts = [
      `${i + 1}. ${c.company || c.name}（金額 ${c.amount.toLocaleString()}円 / 失注時の確度 ${c.rank || "未判定"} / 担当 ${c.ownerName || "不明"}）`,
    ];
    if (c.reasons.length > 0) parts.push(`   失注要因: ${c.reasons.join(" / ")}`);
    if (c.concerns.length > 0) parts.push(`   商談中の懸念: ${c.concerns.join(" / ")}`);
    if (c.reasons.length === 0 && c.concerns.length === 0) {
      parts.push("   （商談ログの解析なし）");
    }
    return parts.join("\n");
  });

  return [
    "# 失注案件の一覧",
    lines.join("\n"),
    "",
    "この一覧から、共通する失注の原因と、次から防ぐための打ち手をまとめてください。",
  ].join("\n");
}

/** AI に渡す価値があるか（要因が1件も無ければ渡さない） */
export function hasAnalyzableLosses(stats: LossStats): boolean {
  return stats.cases.some((c) => c.reasons.length > 0 || c.concerns.length > 0);
}
