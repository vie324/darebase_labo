-- =============================================================
-- 0005: 銀行営業（銀行・支店マスタ / アポイント / 支店稼働）
--
-- ■ 設計方針
-- - 既存テーブルは一切変更しない。deals へのカラム追加のみ（すべて NULL 許容 /
--   デフォルト付きなので既存行・既存コードに影響しない）。
-- - 事業部切替（Phase 5）を後付けにしないため、主要テーブルに
--   business_unit_id を最初から入れておく。
-- - 受注後フェーズ・休眠判定日数などの「先方未確定の値」はここに埋め込まず、
--   app_settings（設定テーブル）と src/lib/constants.ts の1箇所に集約する。
-- - RLS は 0001 / 0004 と同じ「認証済みユーザーに全権限」（社内ツール前提）。
--   ロール別スコープは Phase 2 でポリシーを絞る。
--
-- ■ ロールバックはファイル末尾のコメントを参照。
-- =============================================================

-- ---------- 事業部（銀行営業 / AI / SALON1 / 人材 …） ----------
create table if not exists public.business_units (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 初期事業部（銀行営業）。既にあれば何もしない。
insert into public.business_units (name, slug)
select '銀行営業', 'banking'
where not exists (select 1 from public.business_units where slug = 'banking');

-- ---------- 組織（自社 / 代理店） ----------
-- 請求モジュールの partners(kind='agency') とは別軸。
-- partners は「請求先としての取引先」、organizations は「営業実行組織」。
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'agency', -- headquarters | agency
  commission_rate numeric not null default 0,
  is_active boolean not null default true,
  business_unit_id uuid references public.business_units(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- 銀行 ----------
create table if not exists public.banks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null default '',
  is_active boolean not null default true,
  business_unit_id uuid references public.business_units(id) on delete set null,
  created_at timestamptz not null default now()
);

-- CSV取込の重複判定キー（銀行コード）。空文字は重複扱いにしない。
create unique index if not exists idx_banks_code
  on public.banks (code) where code <> '';

-- ---------- 支店 ----------
-- assigned_to は profiles.id を入れるが、FK は張らない：
-- プロフィール未整備の状態で取込が失敗するのを避けるため（表示名は
-- assigned_name にスナップショットしておき、解決できない場合はそちらを使う）。
create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  bank_id uuid not null references public.banks(id) on delete cascade,
  name text not null,
  code text not null default '',
  address text not null default '',
  prefecture text not null default '',
  assigned_to uuid,
  assigned_name text not null default '',
  assigned_org_id uuid references public.organizations(id) on delete set null,
  status text not null default 'active', -- active | dormant | suspended
  last_contact_at text not null default '', -- YYYY-MM-DD ('' = 接点なし)
  note text not null default '',
  business_unit_id uuid references public.business_units(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_branches_bank_id on public.branches (bank_id);
create index if not exists idx_branches_assigned_to on public.branches (assigned_to);

-- CSV取込の重複判定キー（銀行 × 支店コード）
create unique index if not exists idx_branches_bank_code
  on public.branches (bank_id, code) where code <> '';

-- ---------- アポイント（銀行支店からの紹介） ----------
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  bank_id uuid references public.banks(id) on delete set null,
  branch_id uuid references public.branches(id) on delete set null,
  assigned_to uuid,
  assigned_name text not null default '',
  organization_id uuid references public.organizations(id) on delete set null,
  received_at text not null default '', -- 銀行から連絡を受けた日 YYYY-MM-DD
  scheduled_at text not null default '', -- 商談予定日時 ISO ('' = 未定)
  company_name text not null default '', -- 紹介先企業名（顧客マスタは持たない）
  industry text not null default '',
  revenue_scale text not null default '',
  contact_role text not null default '', -- decision_maker | staff | unknown
  source_note text not null default '',
  status text not null default 'scheduled', -- scheduled | done | won | lost | cancelled
  deal_id uuid references public.deals(id) on delete set null,
  event_id uuid references public.events(id) on delete set null, -- 連動して作成したスケジュール
  business_unit_id uuid references public.business_units(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_appointments_branch_id on public.appointments (branch_id);
create index if not exists idx_appointments_status on public.appointments (status);
create index if not exists idx_appointments_received_at on public.appointments (received_at);

-- ---------- 支店への活動ログ（訪問・電話・勉強会など） ----------
-- 支店の最終接点日は appointments.received_at とこのテーブルから算出する
-- （branches.last_contact_at は表示・並べ替え用のキャッシュ）。
create table if not exists public.branch_activities (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  bank_id uuid references public.banks(id) on delete set null,
  user_id uuid,
  user_name text not null default '',
  type text not null default 'visit', -- visit | call | study | training | other
  occurred_at text not null default '', -- YYYY-MM-DD
  memo text not null default '',
  business_unit_id uuid references public.business_units(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_branch_activities_branch_id
  on public.branch_activities (branch_id);

-- ---------- アプリ設定（休眠判定日数・確度定義など） ----------
-- 「先方から追って共有される値」をコードに直書きしないための受け皿。
create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ---------- 案件の拡張（Phase 2 / Phase 5 の受け皿） ----------
-- すべて NULL 許容 or デフォルト付き。既存の案件管理画面は無変更で動く。
alter table public.deals
  add column if not exists bank_id uuid references public.banks(id) on delete set null,
  add column if not exists branch_id uuid references public.branches(id) on delete set null,
  add column if not exists appointment_id uuid references public.appointments(id) on delete set null,
  add column if not exists organization_id uuid references public.organizations(id) on delete set null,
  add column if not exists business_unit_id uuid references public.business_units(id) on delete set null,
  add column if not exists contract_amount bigint not null default 0,
  add column if not exists gross_profit bigint not null default 0,
  add column if not exists visited_at text not null default '',
  add column if not exists contracted_at text not null default '',
  -- 受注後フェーズ。値の一覧は src/lib/constants.ts の FULFILLMENT_STAGES に集約。
  add column if not exists fulfillment_status text not null default '',
  add column if not exists fulfillment_updated_at text not null default '',
  add column if not exists confidence_rank text not null default '', -- A | B | C
  add column if not exists confidence_score int;

create index if not exists idx_deals_branch_id on public.deals (branch_id);

-- ---------- RLS: 0001 / 0004 と同じ「認証済みユーザーに全権限」（冪等） ----------
do $$
declare
  t text;
begin
  foreach t in array array[
    'business_units','organizations','banks','branches',
    'appointments','branch_activities','app_settings'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t
        and policyname = 'authenticated_all_' || t
    ) then
      execute format(
        'create policy "authenticated_all_%s" on public.%I for all to authenticated using (true) with check (true)',
        t, t
      );
    end if;
  end loop;
end $$;

-- =============================================================
-- ロールバック（必要な場合は以下を実行）
--
-- alter table public.deals
--   drop column if exists bank_id,
--   drop column if exists branch_id,
--   drop column if exists appointment_id,
--   drop column if exists organization_id,
--   drop column if exists business_unit_id,
--   drop column if exists contract_amount,
--   drop column if exists gross_profit,
--   drop column if exists visited_at,
--   drop column if exists contracted_at,
--   drop column if exists fulfillment_status,
--   drop column if exists fulfillment_updated_at,
--   drop column if exists confidence_rank,
--   drop column if exists confidence_score;
--
-- drop table if exists public.app_settings;
-- drop table if exists public.branch_activities;
-- drop table if exists public.appointments;
-- drop table if exists public.branches;
-- drop table if exists public.banks;
-- drop table if exists public.organizations;
-- drop table if exists public.business_units;
-- =============================================================
