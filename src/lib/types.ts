// =============================================================
// DareBase — 全モジュール共通の型定義
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
}

export type TableName = keyof TableMap;
