// 全モジュール共通のラベル・色定義。
// ラベルと色はここで一元管理し、各モジュールはこれを参照する。

import type {
  ActivityType,
  AppointmentStatus,
  BranchActivityType,
  BranchStatus,
  ContactRole,
  DealStage,
  DocCategory,
  EventCategory,
  InvoiceDirection,
  InvoiceSource,
  InvoiceStatus,
  KnowledgeCategory,
  LineGroupStatus,
  OrganizationType,
  PartnerKind,
  PostCategory,
  StatementStatus,
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

// ---------- 案件（1階：商談パイプライン） ----------
//
// 商談は「商談予定 → 商談後追い（確度 C/B/A）→ 発注書待ち → 受注／失注」。
// 「後追い C/B/A」はステージではなく "後追い × 確度" の組み合わせなので、
// DB は stage='follow_up' + confidence_rank を持ち、カンバンだけ3列に分ける
// （確度が変わればカードは自動で列を移動する）。列の定義は PIPELINE_COLUMNS。
//
// 受注（発注書を受領）した案件は 2階＝受注後フェーズ（FULFILLMENT_STAGES /
// FULFILLMENT_GROUPS）へ引き継がれる。
export const DEAL_STAGES: Record<
  DealStage,
  { label: string; color: string; bar: string; order: number }
> = {
  appointment: {
    label: "商談予定",
    color: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    bar: "bg-sky-500",
    order: 0,
  },
  follow_up: {
    label: "商談後追い",
    color: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
    bar: "bg-indigo-500",
    order: 1,
  },
  po_wait: {
    label: "発注書待ち",
    color: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
    bar: "bg-violet-500",
    order: 2,
  },
  won: {
    label: "受注",
    color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    bar: "bg-emerald-500",
    order: 3,
  },
  lost: {
    label: "失注",
    color: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    bar: "bg-rose-400",
    order: 4,
  },
};

/**
 * 商談カンバンの列。stage と confidence_rank の組み合わせで1列になる。
 * 表示順はこの配列の順。
 */
export interface PipelineColumn {
  key: string;
  label: string;
  stage: DealStage;
  /** follow_up の列のみ。確度ランク */
  rank?: "A" | "B" | "C";
  /** 列に落としたときの既定の確度(%)。手入力済みの値は上書きしない */
  defaultProbability: number;
  bar: string;
  color: string;
}

export const PIPELINE_COLUMNS: PipelineColumn[] = [
  {
    key: "appointment",
    label: "商談予定",
    stage: "appointment",
    defaultProbability: 10,
    bar: "bg-sky-500",
    color: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
  {
    key: "follow_up_c",
    label: "後追い C",
    stage: "follow_up",
    rank: "C",
    defaultProbability: 15,
    bar: "bg-slate-400",
    color: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
  },
  {
    key: "follow_up_b",
    label: "後追い B",
    stage: "follow_up",
    rank: "B",
    defaultProbability: 40,
    bar: "bg-amber-500",
    color: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  {
    key: "follow_up_a",
    label: "後追い A",
    stage: "follow_up",
    rank: "A",
    defaultProbability: 70,
    bar: "bg-emerald-500",
    color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  {
    key: "po_wait",
    label: "発注書待ち",
    stage: "po_wait",
    defaultProbability: 90,
    bar: "bg-violet-500",
    color: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  },
  {
    key: "won",
    label: "受注",
    stage: "won",
    defaultProbability: 100,
    bar: "bg-emerald-500",
    color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  {
    key: "lost",
    label: "失注",
    stage: "lost",
    defaultProbability: 0,
    bar: "bg-rose-400",
    color: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  },
];

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

// ---------- 請求・支払（経営管理） ----------
export const PARTNER_KINDS: Record<PartnerKind, { label: string; color: string }> = {
  maker: {
    label: "メーカー",
    color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  agency: {
    label: "代理店",
    color: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  },
  client: {
    label: "顧客",
    color: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
};

export const INVOICE_DIRECTIONS: Record<InvoiceDirection, { label: string; color: string }> = {
  receivable: {
    label: "入金（請求）",
    color: "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300",
  },
  payable: {
    label: "支払",
    color: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
};

export const INVOICE_STATUSES: Record<
  InvoiceStatus,
  { label: string; color: string; order: number }
> = {
  draft: {
    label: "下書き",
    color: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
    order: 0,
  },
  sent: {
    label: "送付済",
    color: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    order: 1,
  },
  received: {
    label: "受領",
    color: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    order: 2,
  },
  confirmed: {
    label: "確認済",
    color: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
    order: 3,
  },
  paid: {
    label: "入金・支払済",
    color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    order: 4,
  },
  cancelled: {
    label: "取消",
    color: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    order: 5,
  },
};

export const STATEMENT_STATUSES: Record<
  StatementStatus,
  { label: string; color: string; order: number }
> = {
  draft: {
    label: "下書き",
    color: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
    order: 0,
  },
  calculated: {
    label: "計算済",
    color: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    order: 1,
  },
  approved: {
    label: "承認済",
    color: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
    order: 2,
  },
  invoiced: {
    label: "請求書発行済",
    color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    order: 3,
  },
};

export const INVOICE_SOURCES: Record<InvoiceSource, { label: string; color: string }> = {
  manual: {
    label: "手動",
    color: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
  },
  line: {
    label: "LINE",
    color: "bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300",
  },
  statement: {
    label: "明細計算",
    color: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  },
};

export const LINE_GROUP_STATUSES: Record<LineGroupStatus, { label: string; color: string }> = {
  unmapped: {
    label: "未紐付け",
    color: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  active: {
    label: "紐付け済",
    color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  left: {
    label: "退出",
    color: "bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-400",
  },
};

// =============================================================
// 銀行営業（銀行・支店マスタ / アポイント / 支店稼働）
// =============================================================

export const ORGANIZATION_TYPES: Record<OrganizationType, { label: string; color: string }> = {
  headquarters: {
    label: "本部（自社）",
    color: "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300",
  },
  agency: {
    label: "代理店",
    color: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  },
};

export const BRANCH_STATUSES: Record<BranchStatus, { label: string; color: string }> = {
  active: {
    label: "稼働",
    color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  dormant: {
    label: "休眠",
    color: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  suspended: {
    label: "取引停止",
    color: "bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-400",
  },
};

export const APPOINTMENT_STATUSES: Record<
  AppointmentStatus,
  { label: string; color: string; order: number }
> = {
  scheduled: {
    label: "予定",
    color: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    order: 0,
  },
  done: {
    label: "実施済",
    color: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
    order: 1,
  },
  won: {
    label: "受注",
    color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    order: 2,
  },
  lost: {
    label: "失注",
    color: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    order: 3,
  },
  cancelled: {
    label: "キャンセル",
    color: "bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-400",
    order: 4,
  },
};

export const CONTACT_ROLES: Record<ContactRole, { label: string; color: string }> = {
  decision_maker: {
    label: "決裁者",
    color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  staff: {
    label: "担当者",
    color: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
  unknown: {
    label: "不明",
    color: "bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-400",
  },
};

export const BRANCH_ACTIVITY_TYPES: Record<
  BranchActivityType,
  { label: string; icon: string }
> = {
  visit: { label: "訪問", icon: "🏢" },
  call: { label: "電話", icon: "📞" },
  study: { label: "勉強会", icon: "📚" },
  training: { label: "研修会", icon: "🎓" },
  other: { label: "その他", icon: "📝" },
};

/**
 * 業種の選択肢。先方から確定版が届いたらここを差し替える（§7-2）。
 * アポイント登録は速度優先のためボタン選択にしている。
 */
export const INDUSTRY_OPTIONS: string[] = [
  "製造",
  "建設",
  "小売",
  "飲食",
  "医療・介護",
  "運輸",
  "不動産",
  "サービス",
  "IT",
  "その他",
];

/** 売上規模のレンジ選択肢（§7-2 で確定予定） */
export const REVENUE_SCALE_OPTIONS: string[] = [
  "〜1億円",
  "1〜5億円",
  "5〜10億円",
  "10〜50億円",
  "50億円〜",
  "不明",
];

/**
 * 受注後フェーズ（§3 の fulfillment_status）。
 *
 * 【重要】正式なフェーズ名・粒度は先方から確定版が届く（§7-1）。
 * 増減できるようにフェーズ定義は **この配列1箇所だけ** に置き、
 * DB は text カラム（enum型を使わない）にしてある。
 * 画面・集計は必ずここを参照すること。
 */
export const FULFILLMENT_STAGES: { key: string; label: string; bar: string; color: string }[] = [
  {
    key: "contract",
    label: "契約締結",
    bar: "bg-cyan-500",
    color: "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300",
  },
  {
    key: "quote_request",
    label: "見積依頼",
    bar: "bg-sky-500",
    color: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
  {
    key: "quote_sent",
    label: "見積提出",
    bar: "bg-sky-500",
    color: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
  {
    key: "lease_apply",
    label: "リース申込",
    bar: "bg-indigo-500",
    color: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  },
  {
    key: "lease_review",
    label: "リース審査中",
    bar: "bg-indigo-500",
    color: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  },
  {
    key: "lease_done",
    label: "リース契約完了",
    bar: "bg-violet-500",
    color: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  },
  {
    key: "install_request",
    label: "設置依頼",
    bar: "bg-violet-500",
    color: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  },
  {
    key: "install_schedule",
    label: "設置日程調整",
    bar: "bg-amber-500",
    color: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  {
    key: "install_work",
    label: "設置工事",
    bar: "bg-amber-500",
    color: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  {
    key: "install_done",
    label: "設置完了",
    bar: "bg-emerald-500",
    color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  {
    key: "accepted",
    label: "検収/請求",
    bar: "bg-emerald-500",
    color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
];

/**
 * 受注後カンバンの列（2階）。
 *
 * 先方指定の粒度は「発注書待ち → 設置調整中 → 設置待ち → 開通済み」の4段だが、
 * 既存の詳細フェーズ（FULFILLMENT_STAGES／見積・リース審査など）は実務で
 * 追う必要があるため捨てずに残し、カンバンの列だけ大分類に畳んで表示する。
 * 「発注書待ち」は受注前なので1階（PIPELINE_COLUMNS）側にある。
 */
export interface FulfillmentGroup {
  key: string;
  label: string;
  /** この列に含まれる FULFILLMENT_STAGES のキー（先頭が列に落としたときの既定値） */
  stages: string[];
  bar: string;
  color: string;
}

export const FULFILLMENT_GROUPS: FulfillmentGroup[] = [
  {
    key: "contract",
    label: "契約・見積",
    stages: ["contract", "quote_request", "quote_sent"],
    bar: "bg-cyan-500",
    color: "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300",
  },
  {
    key: "lease",
    label: "リース審査",
    stages: ["lease_apply", "lease_review", "lease_done"],
    bar: "bg-indigo-500",
    color: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  },
  {
    key: "install_adjust",
    label: "設置調整中",
    stages: ["install_request", "install_schedule"],
    bar: "bg-violet-500",
    color: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  },
  {
    key: "install_wait",
    label: "設置待ち",
    stages: ["install_work"],
    bar: "bg-amber-500",
    color: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  {
    key: "activated",
    label: "開通済み",
    stages: ["install_done", "accepted"],
    bar: "bg-emerald-500",
    color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
];

/** 確度ランク（§7-7 で定義が確定するまでの初期値。判定文は設定画面から編集可能にする） */
export const CONFIDENCE_RANKS: Record<string, { label: string; color: string }> = {
  A: {
    label: "A",
    color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  B: {
    label: "B",
    color: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  C: {
    label: "C",
    color: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
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
