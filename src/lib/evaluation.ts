// =============================================================
// 人事評価 — 評価項目と点数の計算
//
// 「規定」（何をどの重みで見るか）は運用しながら変わるので、
// 項目そのものは設定（app_settings）に置き、ここは計算だけを持つ。
// 点数の計算は必ずこの純粋関数で行う（LLM には計算させない）。
//
// 歩合・保険料の計算はここには入れない。
// 雇用形態の内訳と人数が決まってから、この総合点と勤怠の実績値を
// 入力にして組む（0012_backoffice.sql の冒頭参照）。
// =============================================================

/** 5段階。1=期待を大きく下回る 〜 5=期待を大きく上回る */
export const SCORE_MIN = 1;
export const SCORE_MAX = 5;

export const EVALUATION_STATUSES = {
  draft: {
    label: "準備中",
    color: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
  },
  self: {
    label: "本人記入待ち",
    color: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  review: {
    label: "評価者記入中",
    color: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
  finalized: {
    label: "確定",
    color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
} as const;

export type EvaluationStatus = keyof typeof EVALUATION_STATUSES;

export const EVALUATION_STATUS_KEYS = Object.keys(
  EVALUATION_STATUSES
) as EvaluationStatus[];

export function evaluationStatusMeta(
  status: string
): (typeof EVALUATION_STATUSES)[EvaluationStatus] {
  return EVALUATION_STATUSES[status as EvaluationStatus] ?? EVALUATION_STATUSES.draft;
}

/** 1項目分。self_* は本人、reviewer_* は評価者が入れる */
export interface EvaluationItem {
  key: string;
  label: string;
  /** 何を見る項目なのか（評価者ごとのブレを減らすための説明） */
  description: string;
  /** 重み（%）。合計100を想定するが、ずれても正規化して計算する */
  weight: number;
  self_score: number | null;
  self_note: string;
  reviewer_score: number | null;
  reviewer_note: string;
}

/**
 * 評価項目の既定値。「規定」は先方が決めるものなので、
 * これはあくまで初期値で、設定画面から編集できるようにする。
 */
export const DEFAULT_EVALUATION_ITEMS: Omit<
  EvaluationItem,
  "self_score" | "self_note" | "reviewer_score" | "reviewer_note"
>[] = [
  {
    key: "result",
    label: "成果",
    description: "受注額・受注件数など、期の目標に対する達成度",
    weight: 40,
  },
  {
    key: "process",
    label: "プロセス",
    description: "訪問件数・提案数・記録の残し方など、成果に至る行動の量と質",
    weight: 20,
  },
  {
    key: "bank",
    label: "銀行・支店との関係",
    description: "担当支店の稼働、紹介の獲得、紹介元への報告",
    weight: 20,
  },
  {
    key: "team",
    label: "チームへの貢献",
    description: "ナレッジの共有、後輩の指導、勉強会への関与",
    weight: 10,
  },
  {
    key: "compliance",
    label: "規律",
    description: "期限の遵守、報告・連絡、勤怠",
    weight: 10,
  },
];

/** 既定の項目から、点数が空の評価シートを作る */
export function blankItems(
  source = DEFAULT_EVALUATION_ITEMS
): EvaluationItem[] {
  return source.map((item) => ({
    ...item,
    self_score: null,
    self_note: "",
    reviewer_score: null,
    reviewer_note: "",
  }));
}

/** jsonb から評価項目を読む（未作成・壊れている場合は空配列） */
export function readItems(value: unknown): EvaluationItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is EvaluationItem =>
      typeof v === "object" && v !== null && typeof (v as EvaluationItem).key === "string"
  );
}

/**
 * 総合点（100点換算）。
 * 重みの合計で正規化するので、項目を足し引きしても100点満点のままになる。
 * 未入力の項目は「重みごと除外」する（0点にはしない。入れ忘れで下がるのを防ぐ）。
 */
export function totalScore(items: EvaluationItem[], by: "self" | "reviewer"): number {
  let weighted = 0;
  let weightSum = 0;
  for (const item of items) {
    const score = by === "self" ? item.self_score : item.reviewer_score;
    if (score === null || Number.isNaN(score)) continue;
    const weight = Math.max(0, item.weight);
    if (weight === 0) continue;
    weighted += (clampScore(score) / SCORE_MAX) * weight;
    weightSum += weight;
  }
  if (weightSum === 0) return 0;
  return Math.round((weighted / weightSum) * 100);
}

export function clampScore(score: number): number {
  return Math.min(SCORE_MAX, Math.max(SCORE_MIN, score));
}

/** 記入済みの項目数 */
export function filledCount(items: EvaluationItem[], by: "self" | "reviewer"): number {
  return items.filter((i) => (by === "self" ? i.self_score : i.reviewer_score) !== null)
    .length;
}

/** 本人と評価者で開きが大きい項目（面談で話すべき論点） */
export function gapItems(items: EvaluationItem[], threshold = 2): EvaluationItem[] {
  return items.filter(
    (i) =>
      i.self_score !== null &&
      i.reviewer_score !== null &&
      Math.abs(i.self_score - i.reviewer_score) >= threshold
  );
}

/** 総合点の帯（S/A/B/C/D）。境目は運用で変わるのでここ1箇所に置く */
export const SCORE_BANDS: { min: number; label: string; color: string }[] = [
  { min: 90, label: "S", color: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
  { min: 75, label: "A", color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  { min: 60, label: "B", color: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" },
  { min: 45, label: "C", color: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  { min: 0, label: "D", color: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
];

export function scoreBand(score: number): (typeof SCORE_BANDS)[number] {
  return SCORE_BANDS.find((b) => score >= b.min) ?? SCORE_BANDS[SCORE_BANDS.length - 1];
}
