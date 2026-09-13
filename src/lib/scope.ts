// =============================================================
// 可視範囲の絞り込み（デモモード用のミラー実装）
//
// 本番（Supabase 接続時）のデータ分離は RLS が行う
// （supabase/migrations/0006_roles_rls.sql）。
// デモモードは DB を通らず localStorage を読むため、そのままだと
// 代理店ユーザーに全データが見えてしまい、動作確認の意味がなくなる。
// このファイルは RLS と同じ判定をクライアント側で再現する。
//
// 【重要】ここはセキュリティ境界ではない。RLS 側を変更したら
// 必ずこのファイルも同じ内容に更新すること（scope.test.ts が対応表）。
// =============================================================

import { isHqRole, type RoleKey } from "./roles.ts";
import type { TableName } from "./types";

export interface ScopeContext {
  role: RoleKey;
  /** profiles.id */
  userId: string;
  /** 所属組織（本部社員は null） */
  organizationId: string | null;
  /** 自組織に紐づく請求先 partners.id（報酬明細の絞り込み用） */
  partnerId: string | null;
}

/**
 * 代理店ユーザーには1行も見せないテーブル。
 * RLS の hq_only_*（社内向け）と backoffice_only_*（お金のマスタ）に対応。
 * ※ お金のマスタは本部でも経営・管理部だけが読めるが、デモの絞り込みは
 *   「代理店に見せない」までを再現する（画面側は capability で閉じている）。
 */
export const HQ_ONLY_TABLES: readonly TableName[] = [
  "channels",
  "messages",
  "posts",
  "schedule_polls",
  "partners",
  "commission_rates",
  "maker_statements",
  "invoice_payments",
  "line_groups",
  "user_invites",
  "candidates",
];

/**
 * 経営・管理部だけが読めるテーブル（RLS の can_backoffice() と対応）。
 * 応募者の個人情報は、本部社員であっても採用担当以外には見せない。
 * ※ お金のマスタも DB 側は同じ扱いだが、既存画面の挙動を変えないため
 *   デモの絞り込みは「代理店に見せない」までにとどめている（上の HQ_ONLY_TABLES）。
 */
export const BACKOFFICE_ONLY_TABLES: readonly TableName[] = ["candidates"];

/**
 * 本人の行だけが見え、管理部（＋経営）だけが全員分を見られるテーブル
 * （RLS の attendance_self_or_backoffice / expenses_self_or_backoffice と対応）。
 * 代理店ユーザーは対象外なので、どのロールでも1行も返さない。
 */
export const SELF_OR_BACKOFFICE_TABLES: readonly TableName[] = [
  "attendance_records",
  "expenses",
];

/** 本人の行だけが見えるテーブル（RLS の own_scope_* と対応） */
export const OWN_SCOPE_TABLES: readonly TableName[] = [
  "events",
  "tasks",
  "contacts",
  "roleplay_sessions",
];

/** 親テーブル側で先に絞り込んだ ID 集合（銀行・活動ログの判定に使う） */
export interface ScopeRelations {
  /** 見える支店が1つ以上ある銀行の ID 集合（banks の判定用） */
  visibleBankIds?: ReadonlySet<string>;
  /** 見える支店の ID 集合（branch_activities の判定用） */
  visibleBranchIds?: ReadonlySet<string>;
  /** 見える案件の ID 集合（deal_activities の判定用） */
  visibleDealIds?: ReadonlySet<string>;
}

/** 行の文字列フィールドを安全に読む（"" と欠損は null 扱い） */
function str(row: unknown, key: string): string | null {
  const v = (row as Record<string, unknown>)[key];
  return typeof v === "string" && v !== "" ? v : null;
}

/** 代理店ユーザーが自社の全案件を見られるか（false = 自分の担当分のみ） */
function seesWholeOrg(role: RoleKey): boolean {
  return role === "partner_admin";
}

/**
 * 1テーブル分の行を、そのユーザーに見える範囲へ絞り込む。
 * 本部ロール（executive / backoffice / manager / member）は常に全件。
 */
export function scopeRows<T>(
  table: TableName,
  rows: T[],
  ctx: ScopeContext | null,
  relations: ScopeRelations = {}
): T[] {
  // ユーザー未確定のときは絞らない（デモの初期表示。RLS 側は逆に全遮断）
  if (!ctx) return rows;

  const canBackoffice = ctx.role === "executive" || ctx.role === "backoffice";

  // 本部ロールでも、採用担当以外には応募者データを見せない
  if (BACKOFFICE_ONLY_TABLES.includes(table)) {
    return canBackoffice ? rows : [];
  }

  // 勤怠・経費は本人と管理部だけ。代理店スタッフは対象外なので0行
  if (SELF_OR_BACKOFFICE_TABLES.includes(table)) {
    if (!isHqRole(ctx.role)) return [];
    return canBackoffice ? rows : rows.filter((r) => str(r, "owner_id") === ctx.userId);
  }

  // 人事評価は本人と管理部だけ（本人の行は target_id で判定する）
  if (table === "evaluations") {
    if (!isHqRole(ctx.role)) return [];
    return canBackoffice ? rows : rows.filter((r) => str(r, "target_id") === ctx.userId);
  }

  if (isHqRole(ctx.role)) return rows;

  if (HQ_ONLY_TABLES.includes(table)) return [];

  const org = ctx.organizationId;
  // 所属組織が未設定の代理店ユーザーは、組織スコープの行を1件も見られない
  const wholeOrg = seesWholeOrg(ctx.role);

  switch (table) {
    case "branches":
      return rows.filter((r) => org !== null && str(r, "assigned_org_id") === org);

    case "banks": {
      const ids = relations.visibleBankIds;
      if (!ids) return [];
      return rows.filter((r) => {
        const id = str(r, "id");
        return id !== null && ids.has(id);
      });
    }

    case "appointments":
      return rows.filter(
        (r) =>
          org !== null &&
          str(r, "organization_id") === org &&
          (wholeOrg || str(r, "assigned_to") === ctx.userId)
      );

    case "deals":
    // 商談ログは文字起こしに相手の発言が入るため、案件と同じスコープで扱う
    case "meeting_logs":
      return rows.filter(
        (r) =>
          org !== null &&
          str(r, "organization_id") === org &&
          (wholeOrg || str(r, "owner_id") === ctx.userId)
      );

    case "deal_activities": {
      const ids = relations.visibleDealIds ?? new Set<string>();
      return rows.filter((r) => {
        const dealId = str(r, "deal_id");
        return dealId !== null && ids.has(dealId);
      });
    }

    case "branch_activities": {
      const ids = relations.visibleBranchIds ?? new Set<string>();
      return rows.filter((r) => {
        const branchId = str(r, "branch_id");
        return branchId !== null && ids.has(branchId);
      });
    }

    case "organizations":
      return rows.filter((r) => org !== null && str(r, "id") === org);

    case "profiles":
      // 担当者名・アバター表示に必要なので参照は許可（RLS も select は全員）
      return rows;

    case "invoices":
      return rows.filter(
        (r) =>
          ctx.partnerId !== null &&
          str(r, "direction") === "payable" &&
          str(r, "partner_id") === ctx.partnerId
      );

    case "statement_lines":
      return rows.filter(
        (r) => ctx.partnerId !== null && str(r, "agency_id") === ctx.partnerId
      );

    default:
      if (OWN_SCOPE_TABLES.includes(table)) {
        return rows.filter((r) => str(r, "owner_id") === ctx.userId);
      }
      // 資料・ナレッジ・スクリプト・勉強会・事業部・設定は代理店にも見せる
      return rows;
  }
}

/** 親テーブルの絞り込み結果から ID 集合を作る */
export function idSet<T>(rows: T[], key = "id"): Set<string> {
  const out = new Set<string>();
  for (const r of rows) {
    const v = str(r, key);
    if (v !== null) out.add(v);
  }
  return out;
}
