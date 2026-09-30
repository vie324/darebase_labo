// =============================================================
// 販売協力 → 2次代理店（UI非依存の純粋ロジック・テスト付き）
//
// アライアンス営業で、商談の結果が「販売協力」になった会社は、原則として
// その案件を紹介してくれた1次代理店の下の 2次代理店になる。
// 案件の詳細から、案件の内容を引き継いで2次代理店を登録できるようにする。
//
// どの案件から生まれた2次代理店かは branches.source_deal_id で控える。
// 同じ案件から2つ作らないための目印であり、将来の自動化の足場でもある。
//
// 【ランタイム依存なし】node の型ストリップでテストできるよう、
// 値の import を持たない（型のみ）。
// =============================================================

import type { Branch, Deal } from "./types";

/** 名前の突き合わせ用。空白（全角含む）の有無だけの違いは同じ名前とみなす */
export function sameName(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/[\s　]/g, "");
  return norm(a) !== "" && norm(a) === norm(b);
}

/** この案件から登録した2次代理店（無ければ null） */
export function partnerBranchOf(branches: Branch[], dealId: string): Branch | null {
  return branches.find((b) => b.source_deal_id === dealId) ?? null;
}

/** 紹介元の下に、同じ名前の窓口がすでにあるか（二重登録の防止） */
export function sameNameBranch(branches: Branch[], bankId: string, name: string): Branch | null {
  return branches.find((b) => b.bank_id === bankId && sameName(b.name, name)) ?? null;
}

/** 2次代理店の登録フォームの値 */
export interface PartnerBranchValues {
  bank_id: string;
  name: string;
  code: string;
  /** 担当営業 profiles.id（"" = 未割当） */
  assigned_to: string;
  note: string;
}

/**
 * 案件から2次代理店の初期値を作る。
 * - 1次代理店は、この案件を紹介してくれた1次代理店（原則どおり）
 * - 名前は案件の会社名
 * - 担当はこの案件の担当者（プロフィールが見つかれば）
 */
export function partnerBranchDraft(deal: Deal, ownerProfileId: string | null): PartnerBranchValues {
  return {
    bank_id: deal.bank_id ?? "",
    name: deal.company.trim(),
    code: "",
    assigned_to: ownerProfileId ?? "",
    note: `販売協力の案件「${deal.name}」から登録`,
  };
}
