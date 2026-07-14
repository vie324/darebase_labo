// 全モジュール共通のラベル・色定義。
// ラベルと色はここで一元管理し、各モジュールはこれを参照する。

import type {
  ActivityType,
  DealStage,
  DocCategory,
  EventCategory,
  KnowledgeCategory,
  PostCategory,
  TaskPriority,
  TaskStatus,
} from "./types";

export const APP_NAME = "DARE BASE LABO";
export const APP_TAGLINE = "営業力を研究し、売上を上げる";
/** 運営会社名（DARE BASE LABO は株式会社DARE BASEが運営する営業支援ツール） */
export const COMPANY_NAME = "DARE BASE";
/** 代表者名（トップの名言表示などで使用） */
export const CEO_NAME = "岡崎 佑真";

// ---------- スケジュール ----------
export const EVENT_CATEGORIES: Record<
  EventCategory,
  { label: string; dot: string; chip: string }
> = {
  visit: {
    label: "訪問",
    dot: "bg-indigo-500",
    chip: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  },
  meeting: {
    label: "会議",
    dot: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  call: {
    label: "架電",
    dot: "bg-sky-500",
    chip: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
  deadline: {
    label: "締切",
    dot: "bg-rose-500",
    chip: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  },
  other: {
    label: "その他",
    dot: "bg-slate-400",
    chip: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
  },
};

// ---------- 案件 ----------
export const DEAL_STAGES: Record<
  DealStage,
  { label: string; color: string; bar: string; order: number }
> = {
  lead: {
    label: "リード",
    color: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
    bar: "bg-slate-400",
    order: 0,
  },
  qualified: {
    label: "アプローチ",
    color: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    bar: "bg-sky-500",
    order: 1,
  },
  proposal: {
    label: "提案",
    color: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
    bar: "bg-indigo-500",
    order: 2,
  },
  negotiation: {
    label: "交渉",
    color: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
    bar: "bg-violet-500",
    order: 3,
  },
  won: {
    label: "受注",
    color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    bar: "bg-emerald-500",
    order: 4,
  },
  lost: {
    label: "失注",
    color: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    bar: "bg-rose-400",
    order: 5,
  },
};

export const ACTIVITY_TYPES: Record<ActivityType, { label: string; icon: string }> = {
  call: { label: "架電", icon: "📞" },
  visit: { label: "訪問", icon: "🏢" },
  mail: { label: "メール", icon: "✉️" },
  meeting: { label: "商談", icon: "🤝" },
  note: { label: "メモ", icon: "📝" },
  stage_change: { label: "ステージ変更", icon: "🚀" },
};

// ---------- タスク ----------
export const TASK_STATUSES: Record<TaskStatus, { label: string; color: string }> = {
  todo: {
    label: "未着手",
    color: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
  },
  doing: {
    label: "進行中",
    color: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  },
  done: {
    label: "完了",
    color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
};

export const TASK_PRIORITIES: Record<TaskPriority, { label: string; color: string }> = {
  high: {
    label: "高",
    color: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  },
  mid: {
    label: "中",
    color: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  low: {
    label: "低",
    color: "bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-400",
  },
};

// ---------- ナレッジ ----------
export const KNOWLEDGE_CATEGORIES: Record<KnowledgeCategory, { label: string; color: string }> = {
  sales_tips: {
    label: "営業テクニック",
    color: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  },
  objection: {
    label: "切り返しトーク",
    color: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  },
  industry: {
    label: "業界情報",
    color: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
  product: {
    label: "商材知識",
    color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  case_study: {
    label: "成功事例",
    color: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  other: {
    label: "その他",
    color: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
  },
};

// ---------- 資料 ----------
export const DOC_CATEGORIES: Record<DocCategory, { label: string; color: string }> = {
  proposal: {
    label: "提案書",
    color: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  },
  pricing: {
    label: "料金表",
    color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  case_study: {
    label: "事例集",
    color: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  manual: {
    label: "マニュアル",
    color: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
  contract: {
    label: "契約書式",
    color: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  },
  other: {
    label: "その他",
    color: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
  },
};

// ---------- 掲示板 ----------
export const POST_CATEGORIES: Record<PostCategory, { label: string; color: string }> = {
  announce: {
    label: "お知らせ",
    color: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  },
  question: {
    label: "質問",
    color: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
  share: {
    label: "共有",
    color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  free: {
    label: "雑談",
    color: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
};

// ---------- アバター色（Profile.color の値） ----------
export const AVATAR_COLORS: Record<string, string> = {
  indigo: "bg-indigo-500",
  violet: "bg-violet-500",
  emerald: "bg-emerald-500",
  sky: "bg-sky-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  teal: "bg-teal-500",
  slate: "bg-slate-500",
};
