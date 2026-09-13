-- =============================================================
-- 0010: 商談ログ（AI解析の受け皿）
--
-- 1マイクで録った商談の文字起こしを保存し、AI に
--   話者分離 / 議事録 / ToDo抽出 / 確度判定(A・B・C) / 失注リスク
-- を出させた結果をそのまま持つ。
--
-- ■ 方針
-- - 解析結果は jsonb 1カラム（analysis）に入れる。出力項目は
--   src/lib/meeting-analysis.ts のスキーマ1箇所で決め、DB は形を縛らない
--   （プロンプトを育てる段階でマイグレーションを重ねたくないため）。
-- - スコープは案件（deals）と同じ：本部は全件、代理店は自社分のみ、
--   代理店メンバーは自分の担当分のみ。
-- - 文字起こしは商談相手の発言を含むため、扱いは案件と同等以上に絞る。
-- =============================================================

create table if not exists public.meeting_logs (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  held_at text not null default '', -- YYYY-MM-DD
  kind text not null default 'meeting', -- meeting（商談） | internal（社内会議・DDS） | study（勉強会）
  deal_id uuid references public.deals(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  bank_id uuid references public.banks(id) on delete set null,
  branch_id uuid references public.branches(id) on delete set null,
  company_name text not null default '',
  /** 1マイクで録った文字起こし（話者混在のまま保存する） */
  transcript text not null default '',
  /** 録音ファイル（非公開バケット attachments のパス） */
  media_url text not null default '',
  /** AI解析の結果。項目は src/lib/meeting-analysis.ts に集約 */
  analysis jsonb,
  analyzed_at text not null default '', -- ISO
  analysis_model text not null default '',
  owner_id uuid default auth.uid(),
  owner_name text not null default '',
  organization_id uuid default public.my_org(),
  business_unit_id uuid references public.business_units(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_meeting_logs_deal_id on public.meeting_logs (deal_id);
create index if not exists idx_meeting_logs_held_at on public.meeting_logs (held_at);

alter table public.meeting_logs enable row level security;

-- 案件（deals_all）と同じスコープ
drop policy if exists meeting_logs_all on public.meeting_logs;
create policy meeting_logs_all on public.meeting_logs
  for all to authenticated
  using (
    public.is_hq()
    or (organization_id = public.my_org()
        and (public.partner_sees_org() or owner_id = auth.uid()))
  )
  with check (
    public.is_hq()
    or (organization_id = public.my_org()
        and (public.partner_sees_org() or owner_id = auth.uid()))
  );

-- =============================================================
-- ロールバック
-- drop table if exists public.meeting_logs;
-- =============================================================
