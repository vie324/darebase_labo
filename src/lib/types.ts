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
   * 0006 以降は role_key が正で、これは旧UIとの互換のために残している。
   */
  access_level?: "executive" | "member";
  /**
   * ロール（0006 で追加）。値の一覧は lib/roles.ts の RoleKey に集約。
   * DB のポリシー（RLS）もこのキーで判定するので、必ず roles.ts と揃えること。
   */
  role_key?: string;
  /** 所属組織。代理店ユーザーのみ設定される（本部社員は null） */
  organization_id?: string | null;
  /** 無効化されたアカウント（false のユーザーは RLS 上どのデータにも到達できない） */
  is_active?: boolean;
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
  /** 作成者（0006）。DB 側で default auth.uid() が入るためアプリからは省略可 */
  owner_id?: string | null;
}

// ---------- 案件管理 ----------
/**
 * 商談ステージ（1階）。
 * 「商談後追い C/B/A」は follow_up + confidence_rank の組み合わせで表す
 * （カンバンの列定義は constants.ts の PIPELINE_COLUMNS）。
 * 受注後の進捗は fulfillment_status（2階）で管理する。
 */
export type DealStage =
  | "appointment" // 商談予定
  | "follow_up" // 商談後追い（確度 A/B/C）
  | "po_wait" // 発注書待ち
  | "won" // 受注（発注書を受領）
  | "lost"; // 失注

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
  /** 担当者のユーザーID（0006）。代理店メンバーのスコープ判定に使う */
  owner_id?: string | null;

  // ---- 銀行営業の拡張（0005 で追加・すべて任意 / 後方互換） ----
  // Phase 1 では「アポイントの案件化」で bank_id / branch_id / appointment_id のみ設定する。
  // 受注後フェーズ・確度・金額内訳の画面は Phase 2 以降。
  bank_id?: string | null;
  branch_id?: string | null;
  appointment_id?: string | null;
  organization_id?: string | null;
  business_unit_id?: string | null;
  contract_amount?: number; // 契約金額（円）
  gross_profit?: number; // 粗利（円）
  visited_at?: string; // 訪問日 YYYY-MM-DD
  contracted_at?: string; // 契約日 YYYY-MM-DD
  /** 受注後フェーズ。値の一覧は constants.ts の FULFILLMENT_STAGES に集約（"" = 未設定） */
  fulfillment_status?: string;
  fulfillment_updated_at?: string; // 現フェーズに入った日 YYYY-MM-DD（停滞日数の計算に使用）
  confidence_rank?: string; // "A" | "B" | "C" | ""
  confidence_score?: number | null; // 0-100
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
  owner_id?: string | null; // 作成者（0006・RLSの個人スコープ用）
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
  owner_id?: string | null; // 登録者のユーザーID（0006・RLSの個人スコープ用）
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
  owner_id?: string | null; // 実施者のユーザーID（0006・RLSの個人スコープ用）
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

// ---------- 事業部（Phase 5 の事業部切替。Phase 1 から ID を持たせておく） ----------
export interface BusinessUnit extends BaseRow {
  name: string; // "銀行営業" | "AI" | "SALON1" | "人材" など
  slug: string;
  is_active: boolean;
}

// ---------- 銀行営業: 組織（自社 / 代理店） ----------
export type OrganizationType = "headquarters" | "agency";

/**
 * 営業を実行する組織。請求モジュールの partners(kind="agency") とは別軸で、
 * こちらは「誰がその支店・案件を担当しているか」を表す。
 */
export interface Organization extends BaseRow {
  name: string;
  type: OrganizationType;
  commission_rate: number; // % （Phase 3 の報酬計算で使用。Phase 1 では表示のみ）
  is_active: boolean;
  business_unit_id: string | null;
  /**
   * 請求先（partners.kind='agency'）への紐付け（0006）。
   * 代理店ユーザーに「自社宛の支払・自社取り分の明細」だけを見せるために使う。
   */
  partner_id?: string | null;
}

// ---------- 銀行営業: 銀行・支店マスタ ----------
export interface Bank extends BaseRow {
  name: string;
  code: string; // 金融機関コード（CSV取込の重複判定キー。"" = 未設定）
  is_active: boolean;
  business_unit_id: string | null;
}

/** 支店の運用ステータス。suspended（取引停止）は稼働率の母数から除外される */
export type BranchStatus = "active" | "dormant" | "suspended";

export interface Branch extends BaseRow {
  bank_id: string;
  name: string;
  code: string; // 支店コード（銀行内で一意。CSV取込の重複判定キー）
  address: string;
  prefecture: string;
  assigned_to: string | null; // profiles.id（null = 未割当）
  assigned_name: string; // 表示用スナップショット（プロフィール未解決時のフォールバック）
  assigned_org_id: string | null; // organizations.id（担当代理店）
  status: BranchStatus;
  /** 最終接点日 YYYY-MM-DD。アポ・活動ログから自動更新されるキャッシュ（"" = 接点なし） */
  last_contact_at: string;
  note: string;
  business_unit_id: string | null;
  updated_at: string;
}

// ---------- 銀行営業: アポイント ----------
export type AppointmentStatus = "scheduled" | "done" | "won" | "lost" | "cancelled";
/** 商談相手の役職区分 */
export type ContactRole = "decision_maker" | "staff" | "unknown";

export interface Appointment extends BaseRow {
  bank_id: string | null;
  branch_id: string | null;
  assigned_to: string | null; // profiles.id
  assigned_name: string;
  organization_id: string | null;
  received_at: string; // 銀行から連絡を受けた日 YYYY-MM-DD（＝支店との接点日）
  scheduled_at: string; // 商談予定日時 ISO（"" = 未定）
  company_name: string; // 紹介先企業名（顧客マスタは持たない）
  industry: string; // INDUSTRY_OPTIONS のいずれか（自由入力も許容）
  revenue_scale: string; // REVENUE_SCALE_OPTIONS のいずれか
  contact_role: ContactRole | "";
  source_note: string;
  status: AppointmentStatus;
  deal_id: string | null; // 案件化した場合の案件
  event_id: string | null; // 連動して作成したスケジュール予定
  business_unit_id: string | null;
  updated_at: string;
}

// ---------- 銀行営業: 支店への活動ログ ----------
export type BranchActivityType = "visit" | "call" | "study" | "training" | "other";

export interface BranchActivity extends BaseRow {
  branch_id: string;
  bank_id: string | null;
  user_id: string | null;
  user_name: string;
  type: BranchActivityType;
  occurred_at: string; // YYYY-MM-DD
  memo: string;
  business_unit_id: string | null;
}

// ---------- 商談ログ（AI解析。0010） ----------
/**
 * 1マイクで録った商談の文字起こしと、そのAI解析結果。
 * analysis の中身は lib/meeting-analysis.ts の MeetingAnalysis
 * （DBは jsonb で受けるため、ここでは unknown のまま持つ）。
 */
export interface MeetingLog extends BaseRow {
  title: string;
  held_at: string; // YYYY-MM-DD
  kind: string; // meeting | internal | study
  deal_id: string | null;
  appointment_id: string | null;
  bank_id: string | null;
  branch_id: string | null;
  company_name: string;
  /** 話者が混ざったままの文字起こし */
  transcript: string;
  /** 録音（非公開バケットのパス。"" = なし） */
  media_url: string;
  /** AI解析の結果（未解析は null） */
  analysis: unknown;
  analyzed_at: string; // ISO ("" = 未解析)
  analysis_model: string;
  owner_id?: string | null;
  owner_name: string;
  organization_id?: string | null;
  business_unit_id: string | null;
  updated_at: string;
}

// ---------- 商材（0014） ----------
/**
 * 商材マスタ。DDS を入口に AI などのクロスセルを載せていくため、
 * コードに固定せず画面から追加できるようにする。
 */
export interface Product extends BaseRow {
  name: string;
  /** 英字の識別子。並び替えや外部連携の突き合わせに使う（"" 可） */
  slug: string;
  /** バッジの配色。値の一覧は lib/products.ts の PRODUCT_COLORS */
  color: string;
  /** 標準単価（円）。0 = 都度見積 */
  unit_price: number;
  /** 表示順。小さいほど先 */
  sort_order: number;
  is_active: boolean;
  memo: string;
  /** null = 全事業部で使える商材 */
  business_unit_id: string | null;
  updated_at: string;
}

/**
 * 案件に載せた商材（明細）。1案件に複数の商材が乗る。
 * 商材名はマスタ改名の影響を受けないよう、登録時点の名前を控えておく。
 */
export interface DealProduct extends BaseRow {
  deal_id: string;
  product_id: string;
  product_name: string;
  amount: number; // 円
  quantity: number;
  memo: string;
}

// ---------- 採用（0011） ----------
/**
 * 応募者。履歴書・面接ログは個人情報のため、RLS で経営・管理部のみに絞っている。
 * AI の解析結果（resume_analysis / questions / crosscheck）は jsonb で受け、
 * 形は lib/recruiting.ts が持つ。
 */
export interface Candidate extends BaseRow {
  name: string;
  name_kana: string;
  email: string;
  phone: string;
  position: string;
  /** 値の一覧は lib/recruiting.ts の CandidateStatus に集約 */
  status: string;
  source: string;
  applied_at: string; // YYYY-MM-DD
  /** 履歴書・職務経歴書の本文 */
  resume_text: string;
  /** 添付（非公開バケット attachments のパス。"" = なし） */
  resume_file: string;
  resume_analysis: unknown;
  questions: unknown;
  interview_transcript: string;
  crosscheck: unknown;
  note: string;
  owner_id?: string | null;
  owner_name: string;
  business_unit_id: string | null;
  updated_at: string;
}

// ---------- バックオフィス（0012） ----------
/** 勤怠。1人1日1行（owner_id + work_date で一意） */
export interface AttendanceRecord extends BaseRow {
  owner_id?: string | null;
  owner_name: string;
  work_date: string; // YYYY-MM-DD
  /** 値の一覧は lib/attendance.ts の AttendanceKind に集約 */
  kind: string;
  start_at: string; // HH:MM（"" = 未打刻）
  end_at: string; // HH:MM
  break_minutes: number;
  note: string;
  updated_at: string;
}

/** 経費申請。ワークフローは lib/expenses.ts に集約 */
export interface Expense extends BaseRow {
  owner_id?: string | null;
  owner_name: string;
  spent_on: string; // YYYY-MM-DD
  category: string;
  amount: number;
  purpose: string;
  counterparty: string;
  payment_method: string; // self（自己立替） | corporate（法人カード）
  /** 領収書（非公開バケット attachments のパス） */
  receipt_file: string;
  status: string;
  submitted_at: string; // ISO
  approver_name: string;
  approved_at: string; // ISO
  reject_reason: string;
  paid_on: string; // YYYY-MM-DD
  deal_id: string | null;
  note: string;
  updated_at: string;
}

/** 人事評価。評価項目は jsonb（形は lib/evaluation.ts の EvaluationItem） */
export interface Evaluation extends BaseRow {
  target_id: string | null;
  target_name: string;
  period: string; // 例: 2026-H1
  status: string;
  items: unknown;
  self_comment: string;
  reviewer_name: string;
  reviewer_comment: string;
  total_score: number;
  finalized_at: string; // ISO
  updated_at: string;
}

// ---------- 招待（サインアップは招待制。0006） ----------
/**
 * 招待レコード。同じメールで Supabase Auth のアカウントが作られたときに
 * handle_new_user トリガーが role_key / organization_id を profiles へ適用する。
 */
export interface UserInvite extends BaseRow {
  email: string;
  role_key: string; // lib/roles.ts の RoleKey
  organization_id: string | null; // 代理店を招待する場合のみ
  invited_by: string; // 招待者の表示名
  note: string;
  accepted_at: string | null; // ISO（null = 未使用）
  expires_at: string; // ISO
}

// ---------- アプリ設定（休眠判定日数など「先方未確定の値」の受け皿） ----------
export interface AppSetting extends BaseRow {
  key: string; // 例: "branch_activity"
  value: Record<string, unknown>; // jsonb
  updated_at: string;
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
  business_units: BusinessUnit;
  organizations: Organization;
  banks: Bank;
  branches: Branch;
  appointments: Appointment;
  branch_activities: BranchActivity;
  app_settings: AppSetting;
  user_invites: UserInvite;
  meeting_logs: MeetingLog;
  candidates: Candidate;
  attendance_records: AttendanceRecord;
  expenses: Expense;
  evaluations: Evaluation;
  products: Product;
  deal_products: DealProduct;
}

export type TableName = keyof TableMap;
