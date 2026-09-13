-- =============================================================
-- 0011: 採用（候補者・履歴書解析・面接）
--
-- ■ 扱う情報の性質
-- 履歴書・職務経歴書・面接ログは**応募者の個人情報**であり、
-- 社内の営業データより厳しく扱う。
--   - 閲覧・編集は経営と管理部（採用担当）のみ。営業メンバー・代理店は不可
--   - 添付ファイルは非公開バケット（attachments）にパスで保存する
--   - 採用目的以外に使わない。不採用者のデータは保存期間を決めて削除する
--     （削除は運用で行う。この段階では自動削除は入れない）
--
-- ■ AI の使い方
-- 履歴書の要約・質問の生成・面接ログとの矛盾抽出はあくまで**人の判断の補助**。
-- 合否をAIが決める設計にはしない（画面にもその旨を出す）。
-- =============================================================

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  name_kana text not null default '',
  email text not null default '',
  phone text not null default '',
  /** 応募職種 */
  position text not null default '',
  /** 選考ステータス。値の一覧は src/lib/recruiting.ts に集約 */
  status text not null default 'applied',
  source text not null default '', -- 応募経路（媒体・紹介など）
  applied_at text not null default '', -- YYYY-MM-DD
  /** 履歴書・職務経歴書の本文（貼り付け or 抽出したテキスト） */
  resume_text text not null default '',
  /** 添付ファイル（非公開バケット attachments のパス。"" = なし） */
  resume_file text not null default '',
  /** 履歴書のAI解析結果。項目は src/lib/recruiting.ts に集約 */
  resume_analysis jsonb,
  /** 生成した面接質問 */
  questions jsonb,
  /** 面接の文字起こし */
  interview_transcript text not null default '',
  /** 履歴書と面接の突き合わせ結果 */
  crosscheck jsonb,
  /** 面接メモ・評価（人が書く） */
  note text not null default '',
  owner_id uuid default auth.uid(),
  owner_name text not null default '',
  business_unit_id uuid references public.business_units(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_candidates_status on public.candidates (status);

alter table public.candidates enable row level security;

-- 経営・管理部のみ（営業メンバー・代理店からは1行も見えない）
drop policy if exists candidates_backoffice on public.candidates;
create policy candidates_backoffice on public.candidates
  for all to authenticated
  using (public.can_backoffice()) with check (public.can_backoffice());

-- =============================================================
-- ロールバック
-- drop table if exists public.candidates;
-- =============================================================
