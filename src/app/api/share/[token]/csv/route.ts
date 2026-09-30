// =============================================================
// 紹介状況の CSV（/api/share/[token]/csv）
//
// 共有ページ（/share/[token]）と同じ内容を CSV で返す。Google スプレッドシートの
//   =IMPORTDATA("https://<ドメイン>/api/share/<token>/csv")
// でシートに取り込め、以後は自動で更新される（Google 側がおおむね1時間ごとに取りに来る）。
//
// - 認証はトークンだけ（共有ページと同じ）。中身は RPC get_client_share が
//   「公開してよい項目だけ」を返し、ここはそれを CSV に並べ替えるだけ
// - 公開値の anon キーで呼ぶ。service_role キーは使わない（RLS を迂回する必要が無い）
// - スプレッドシートに読ませるため BOM は付けない（Excel 向けは共有ページのダウンロード）
// =============================================================

import { createClient } from "@supabase/supabase-js";
import { normalizeUnitSlug, UNIT_TERMS } from "@/lib/business-units";
import {
  isValidShareToken,
  parseSharePayload,
  shareCsvRows,
  toClientRows,
} from "@/lib/client-share";
import { toCsv } from "@/lib/csv";

const BASE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
};

function textResponse(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: { ...BASE_HEADERS, "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isValidShareToken(token)) return textResponse("このリンクは無効です", 404);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    // デモモードのデータは各ブラウザの中にしか無く、サーバーからは読めない
    return textResponse("デモモードでは CSV の自動取得は使えません（Supabase 接続時のみ）", 503);
  }

  const sb = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.rpc("get_client_share", { p_token: token });
  if (error) return textResponse("データを取得できませんでした", 502);

  const result = parseSharePayload(data);
  if (!result.ok) {
    return result.error === "expired"
      ? textResponse("このリンクは有効期限が切れています", 410)
      : textResponse("このリンクは無効です", 404);
  }

  const terms = UNIT_TERMS[normalizeUnitSlug(result.data.unit)];
  const { headers, body } = shareCsvRows(toClientRows(result.data.rows), terms.child);
  return new Response(toCsv(headers, body, { bom: false }), {
    headers: {
      ...BASE_HEADERS,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'inline; filename="referrals.csv"',
    },
  });
}
