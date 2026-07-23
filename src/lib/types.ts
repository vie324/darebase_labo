// =============================================================
// DARE BASE LABO — 全モジュール共通の型定義
// カラム名は Supabase (PostgreSQL) の snake_case に合わせる。
// すべてのテーブル行は id (uuid) と created_at (ISO文字列) を持つ。
// =============================================================

export interface BaseRow {
  id: string;
  created_at: string;
}

/** チームメンバー（デモモードでは demo/team.ts、Supabase では profiles テーブル） */
export interface Profile extends BaseRow {
  name: string;
  email: string;
  role: string; // 例: "マネージャー" | "フィールドセールス" | "インサイドセールス"
  department: string;
  color: string; // アバター用のtailwind色名 例: "indigo" | "emerald"
  /**
   * 経営層区分（任意・後方互換）。未設定は "member" 扱い。
   * "executive" のみ経営ダッシュボード・権限管理にアクセスできる（UI上のゲート）。
   */
  access_level?: "executive" | "member";
}

// ---------- スケジュール ----------
export type EventCategory = "visit" | "meeting" | "call" | "deadline" | "other";

export interface CalendarEvent extends BaseRow {
  title: string;
  description: string;
  start_at: string; // ISO
  end_at: string; // ISO
  all_day: boolean;
  category: EventCategory;
  location: string;
  owner_name: string;
}

// ---------- 案件管理 ----------
export type DealStage =
  | "lead"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost";

export interface Deal extends BaseRow {
  name: string; // 案件名
  company: string;
  contact_name: string;
  stage: DealStage;
  amount: number; // 円
  probability: number; // 0-100
  expected_close: string; // YYYY-MM-DD
  owner_name: string;
  next_action: string;
  memo: string;
  updated_at: string;
}

/** 案件の活動履歴（訪問・架電・メールなどの進捗ログ） */
export type ActivityType = "call" | "visit" | "mail" | "meeting" | "note" | "stage_change";

export interface DealActivity extends BaseRow {
  deal_id: string;
  type: ActivityType;
  note: string;
  author_name: string;
}

// ---------- タスク管理 ----------
export type TaskStatus = "todo" | "doing" | "done";
export type TaskPriority = "low" | "mid" | "high";

export interface TaskItem extends BaseRow {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string; // YYYY-MM-DD ("" = 期限なし)
  assignee_name: string;
  related_deal: string; // 案件名 ("" = なし)
  completed_at: string | null;
}

// ---------- 名刺管理 ----------
export interface Contact extends BaseRow {
  name: string;
  name_kana: string;
  company: string;
  department: string;
  title: string; // 役職
  email: string;
  phone: string;
  mobile: string;
  address: string;
  website: string;
  tags: string[];
  memo: string;
  card_image_url: string; // 名刺画像 (dataURL or Supabase Storage URL)
  exchanged_at: string; // YYYY-MM-DD 名刺交換日
  owner_name: string; // 登録者
}

// ---------- ナレッジ共有 ----------
export type KnowledgeCategory =
  | "sales_tips"
  | "industry"
  | "product"
  | "objection" // 切り返しトーク
  | "case_study"
  | "other";

export interface Knowledge extends BaseRow {
  title: string;
  content: string; // markdown
  category: KnowledgeCategory;
  tags: string[];
  author_name: string;
  likes: number;
  views: number;
  pinned: boolean;
  updated_at: string;
}

// ---------- 営業資料 ----------
export type DocCategory = "proposal" | "pricing" | "case_study" | "manual" | "contract" | "other";

export interface SalesDocument extends BaseRow {
  name: string;
  category: DocCategory;
  file_url: string; // dataURL or Storage URL ("" = リンクなし)
  file_type: string; // 拡張子 "pdf" | "pptx" など
  size_kb: number;
  description: string;
  tags: string[];
  uploaded_by: string;
  downloads: number;
}

// ---------- ロープレ練習 ----------
export interface TalkScript extends BaseRow {
  title: string;
  scenario: string; // 想定シーン（例: 初回テレアポ / クロージング）
  content: string; // スクリプト本文 (markdown)
  category: string; // "テレアポ" | "商談" | "クロージング" | "受付突破" など
  author_name: string;
  updated_at: string;
}

export interface RoleplayFeedback {
  author_name: string;
  rating: number; // 1-5
  comment: string;
  created_at: string;
}

export interface RoleplaySession extends BaseRow {
  script_id: string; // "" = スクリプトなし自由練習
  script_title: string;
  user_name: string;
  mode: "audio" | "screen"; // 録音のみ or 画面録画
  duration_sec: number;
  transcript: string; // 文字起こし結果
  self_note: string; // 振り返りメモ
  feedbacks: RoleplayFeedback[]; // jsonb
  media_url: string; // 録音/録画データ (objectURL or Storage URL)
}

// ---------- 勉強会（営業代理業のツール勉強会など） ----------
export interface TrainingLog extends BaseRow {
  title: string;
  tool_name: string; // 対象ツール/商材名
  category: string; // "SaaS" | "通信" | "人材" | "社内ツール" など
  held_at: string; // YYYY-MM-DD
  presenter: string;
  summary: string; // 一行サマリ
  content: string; // 議事録・ログ (markdown)
  video_url: string; // 録画リンク
  material_url: string; // 資料リンク
  tags: string[];
}

// ---------- チャット ----------
export interface Channel extends BaseRow {
  name: string;
  description: string;
  emoji: string;
}

export interface ChatMessage extends BaseRow {
  channel_id: string;
  author_name: string;
  content: string;
}

// ---------- 掲示板 ----------
export type PostCategory = "announce" | "question" | "share" | "free";

export interface PostComment {
  author_name: string;
  content: string;
  created_at: string;
}

export interface BoardPost extends BaseRow {
  title: string;
  content: string; // markdown
  category: PostCategory;
  author_name: string;
  pinned: boolean;
  likes: number;
  comments: PostComment[]; // jsonb
}

// ---------- 日程調整（Google カレンダー連携） ----------
export interface PollCandidate {
  start: string; // ISO
  end: string; // ISO
}

export interface PollResponse {
  name: string;
  /** candidates と同じ長さ。 "ok" | "maybe" | "ng" */
  answers: ("ok" | "maybe" | "ng")[];
  comment: string;
  created_at: string;
}

export interface SchedulePoll extends BaseRow {
  title: string;
  description: string;
  organizer: string;
  location: string; // 場所 or オンラインURL
  duration_min: number;
  candidates: PollCandidate[]; // jsonb
  responses: PollResponse[]; // jsonb
  status: "open" | "confirmed" | "closed";
  confirmed_index: number | null; // 確定した候補のindex
  /**
   * 調整の種別（任意・後方互換）。
   * - "group"（未設定含む）: 通常のチーム内日程調整
   * - "customer": 顧客Web会議予約リンク（公開ページ /invite/[id] で予約可能）
   */
  kind?: "group" | "customer";
}

// ---------- 請求・支払（経営管理） ----------

/** 取引先の種別。メーカー=商材の供給元 / 代理店=販売パートナー / 顧客=エンド顧客 */
export type PartnerKind = "maker" | "agency" | "client";

/** 取引先マスタ（メーカー・代理店・顧客を1テーブルで管理し kind で区別） */
export interface Partner extends BaseRow {
  name: string;
  kind: PartnerKind;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  payment_rule: string; // 表示用 例: "月末締め翌月末払い"
  default_due_days: number; // 請求書の支払期日サイト（発行日からの日数）
  memo: string;
  is_active: boolean;
}

/** 手数料率マスタ（代理店×メーカー、商材指定があればそちらを優先適用） */
export interface CommissionRate extends BaseRow {
  agency_id: string; // partners(kind=agency)
  maker_id: string; // partners(kind=maker)
  product_name: string; // "" = このメーカーの全商材に適用するデフォルト率
  rate_type: "percent" | "fixed";
  rate_percent: number; // rate_type=percent のとき使用 (0-100)
  fixed_fee: number; // rate_type=fixed のとき使用（円）
  effective_from: string; // YYYY-MM-DD ("" = 制限なし)
  effective_to: string; // YYYY-MM-DD ("" = 制限なし)
  memo: string;
}

/** メーカー明細のステータス（承認フロー） */
export type StatementStatus = "draft" | "calculated" | "approved" | "invoiced";

/** メーカーから受領した明細（ヘッダ）。承認フローは status で表現する */
export interface MakerStatement extends BaseRow {
  maker_id: string | null; // partners(kind=maker)
  title: string;
  statement_month: string; // 対象月 YYYY-MM
  status: StatementStatus;
  total_amount: number; // 明細行合計（円・キャッシュ）
  source: "csv" | "manual";
  approved_by: string; // 承認者名 ("" = 未承認)
  approved_at: string; // ISO ("" = 未承認)
  memo: string;
}

/** 明細行。計算実行時に率をスナップショットして保存する */
export interface StatementLine extends BaseRow {
  statement_id: string;
  agency_id: string | null; // 未割当は null（警告対象）
  product_name: string;
  customer_name: string;
  amount: number; // メーカー明細の金額（円）
  rate_percent: number | null; // 適用率のスナップショット（未計算は null）
  agency_amount: number; // 代理店取り分（円未満切り捨て）
  company_amount: number; // 自社取り分 = amount - agency_amount
  rate_source: "master" | "manual" | ""; // "" = 率未決定（警告）
  memo: string;
}

export type InvoiceDirection = "receivable" | "payable"; // 入金(こちらが請求) / 支払(こちらが支払う)
export type InvoiceStatus = "draft" | "sent" | "received" | "confirmed" | "paid" | "cancelled";
export type InvoiceSource = "manual" | "line" | "statement";

/** 請求書（受領・発行の両方向を1テーブルで管理） */
export interface Invoice extends BaseRow {
  direction: InvoiceDirection;
  partner_id: string | null; // 取引先（未紐付けは null）
  partner_name: string; // 表示用スナップショット（未紐付けLINE受信でも名前を残せる）
  invoice_number: string;
  title: string;
  subtotal: number; // 税抜（円）
  tax: number; // 消費税（円）
  withholding: number; // 源泉徴収（円・差し引き）
  total: number; // 請求合計 = subtotal + tax - withholding
  issue_date: string; // YYYY-MM-DD
  due_date: string; // YYYY-MM-DD（期限超過はここから導出）
  status: InvoiceStatus;
  paid_amount: number; // 消込済み金額（invoice_payments の合計キャッシュ）
  paid_date: string; // 全額消込日 YYYY-MM-DD ("" = 未完了)
  source: InvoiceSource;
  statement_id: string | null; // 明細計算から生成された場合の元明細
  line_group_id: string; // LINE経由の場合の受信/送付先グループ ("" = なし)
  line_message_id: string; // LINE受信メッセージID（取込の冪等性キー）
  file_url: string; // 添付ファイル。非公開バケットはStorageパス、デモはdataURL
  file_type: string; // 拡張子 "pdf" | "jpg" など
  ocr_text: string; // OCR結果の生テキスト
  memo: string;
  updated_at: string;
}

/** 入金・支払の消込履歴（一部入金に対応） */
export interface InvoicePayment extends BaseRow {
  invoice_id: string;
  amount: number; // 円
  paid_on: string; // YYYY-MM-DD
  method: string; // "振込" | "現金" など
  recorded_by: string; // 消込した担当者名
  memo: string;
}

export type LineGroupStatus = "unmapped" | "active" | "left";

/** 公式LINEが参加しているグループと取引先の紐付け */
export interface LineGroup extends BaseRow {
  group_id: string; // LINEのグループID（unique）
  group_name: string;
  partner_id: string | null; // 紐付け先取引先（null = 未紐付け）
  status: LineGroupStatus;
  joined_at: string; // ISO
  memo: string;
}

// ---------- テーブル名 → 行型のマッピング ----------
export interface TableMap {
  profiles: Profile;
  events: CalendarEvent;
  deals: Deal;
  deal_activities: DealActivity;
  tasks: TaskItem;
  contacts: Contact;
  knowledge: Knowledge;
  documents: SalesDocument;
  scripts: TalkScript;
  roleplay_sessions: RoleplaySession;
  trainings: TrainingLog;
  channels: Channel;
  messages: ChatMessage;
  posts: BoardPost;
  schedule_polls: SchedulePoll;
  partners: Partner;
  commission_rates: CommissionRate;
  maker_statements: MakerStatement;
  statement_lines: StatementLine;
  invoices: Invoice;
  invoice_payments: InvoicePayment;
  line_groups: LineGroup;
}

export type TableName = keyof TableMap;
