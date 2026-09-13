// =============================================================
// ロール定義 — 権限の「唯一の正」
//
// DB 側のポリシー（supabase/migrations/0006_roles_rls.sql）と
// 画面側の出し分けは、必ずこのファイルのロールキーで揃える。
// 画面の出し分けはあくまで導線の整理であり、実際のデータ分離は RLS が行う。
// =============================================================

export type RoleKey =
  | "executive" // 経営
  | "backoffice" // 管理部（請求・支払・勤怠・経費・評価）
  | "manager" // マネージャー
  | "member" // 一般社員
  | "partner_admin" // 代理店管理者
  | "partner_member"; // 代理店メンバー

export const DEFAULT_ROLE_KEY: RoleKey = "member";

export interface RoleMeta {
  label: string;
  /** 所属区分。partner は社外（代理店）ユーザー */
  scope: "hq" | "partner";
  description: string;
  color: string;
}

export const ROLES: Record<RoleKey, RoleMeta> = {
  executive: {
    label: "経営",
    scope: "hq",
    description: "すべてのデータ。ロール・招待の管理もここだけ。",
    color: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  },
  backoffice: {
    label: "管理部",
    scope: "hq",
    description: "請求・支払・各種マスタ・設定。案件は全社閲覧。",
    color: "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300",
  },
  manager: {
    label: "マネージャー",
    scope: "hq",
    description: "本部の案件・稼働・タスクをすべて閲覧・編集。",
    color: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  },
  member: {
    label: "一般社員",
    scope: "hq",
    description: "本部の営業データ。請求・経営数値は見えない。",
    color: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
  partner_admin: {
    label: "代理店管理者",
    scope: "partner",
    description: "自社に割り当てられた支店・アポ・案件と、自社の報酬のみ。",
    color: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  partner_member: {
    label: "代理店メンバー",
    scope: "partner",
    description: "自分が担当するアポ・案件のみ。",
    color: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
  },
};

export const ROLE_KEYS = Object.keys(ROLES) as RoleKey[];

/**
 * 画面・導線の単位で切る権限。
 * データそのものの遮断は RLS 側なので、ここは「見せる/見せない」の判断のみ。
 */
export type Capability =
  | "executive_dashboard" // 経営ダッシュボード
  | "billing" // 請求・支払
  | "internal_comms" // チャット・掲示板（社内向け）
  | "scheduling_poll" // 日程調整
  | "content_edit" // ナレッジ・営業資料・トークスクリプト・勉強会の作成/編集
  | "master_edit" // 銀行・支店マスタの編集／CSV取込／担当振り替え
  | "settings_admin" // 判定基準などの設定変更
  | "role_admin" // ロール付与・招待の発行
  | "recruiting" // 採用（履歴書・面接ログ＝応募者の個人情報）
  | "hr_self" // 自分の勤怠・経費・評価（本部社員のみ。代理店スタッフは対象外）
  | "hr_admin" // 全員分の勤怠・経費の承認と、評価の作成・確定
  | "all_sales_data"; // 本部の営業データを全件見られる

// 本部ロール共通。content_edit は DB 側の shared_write_*（is_hq）と対応する
// ＝代理店は閲覧のみで、作成ボタンを出しても保存できないため画面からも隠す。
const HQ_BASE: Capability[] = [
  "internal_comms",
  "scheduling_poll",
  "content_edit",
  "all_sales_data",
  // 勤怠・経費・自分の評価は本部社員全員が使う。
  // 代理店スタッフの勤怠・経費・評価は管理しない方針なので partner_* には付けない。
  "hr_self",
];

export const ROLE_CAPABILITIES: Record<RoleKey, Capability[]> = {
  executive: [
    ...HQ_BASE,
    "executive_dashboard",
    "billing",
    "master_edit",
    "settings_admin",
    "role_admin",
    "recruiting",
    "hr_admin",
  ],
  backoffice: [
    ...HQ_BASE,
    "billing",
    "master_edit",
    "settings_admin",
    "recruiting",
    "hr_admin",
  ],
  manager: [...HQ_BASE, "master_edit"],
  member: [...HQ_BASE],
  partner_admin: [],
  partner_member: [],
};

export function can(role: RoleKey | null | undefined, cap: Capability): boolean {
  if (!role) return false;
  return ROLE_CAPABILITIES[role]?.includes(cap) ?? false;
}

export function isPartnerRole(role: RoleKey | null | undefined): boolean {
  return role ? ROLES[role]?.scope === "partner" : false;
}

export function isHqRole(role: RoleKey | null | undefined): boolean {
  return role ? ROLES[role]?.scope === "hq" : false;
}

/** DB から来た未知の文字列を安全にロールへ変換する */
export function normalizeRole(value: unknown): RoleKey {
  return typeof value === "string" && value in ROLES ? (value as RoleKey) : DEFAULT_ROLE_KEY;
}

export function roleLabel(role: RoleKey | null | undefined): string {
  return role ? (ROLES[role]?.label ?? role) : "—";
}
