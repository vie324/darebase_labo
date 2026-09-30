// クライアント共有リンクのデモシード。
//
// デモモードでは公開ページ（/share/<token>）もこのブラウザの localStorage を読むので、
// 同じブラウザで開けば紹介元に見えるページをそのまま確認できる。
// トークンは本番では 32バイトの乱数（lib/client-share.ts の generateShareToken）。

import type { ClientShare } from "../types";
import { daysFromNow } from "../utils";

export const DEMO_CLIENT_SHARES: ClientShare[] = [
  {
    id: "share-bridge",
    token: "demo-bridge-partners-7Kq2Xw9LmP4sT8vY3nR6bZ",
    title: "株式会社ブリッジパートナーズ 様 ご紹介案件の進捗",
    bank_id: "al-1",
    branch_id: null,
    business_unit_id: "bu-alliance",
    expires_at: daysFromNow(150, 23, 59),
    is_active: true,
    note: "先方の営業企画部に共有。毎週月曜に確認いただいている",
    created_by: "佐藤 健太",
    owner_id: "member-sato",
    last_accessed_at: daysFromNow(-1, 10, 12),
    access_count: 14,
    updated_at: daysFromNow(-30),
    created_at: daysFromNow(-30),
  },
  {
    id: "share-mirai",
    token: "demo-mirai-bank-Hs5Wd2Qp8Lx3Vr7Nt4Ky9Ma",
    title: "みらい銀行 様 ご紹介案件の進捗",
    bank_id: "bank-mirai",
    branch_id: null,
    business_unit_id: "bu-banking",
    expires_at: daysFromNow(300, 23, 59),
    is_active: true,
    note: "法人営業部 ご担当者様あて",
    created_by: "佐藤 健太",
    owner_id: "member-sato",
    last_accessed_at: null,
    access_count: 0,
    updated_at: daysFromNow(-3),
    created_at: daysFromNow(-3),
  },
];
