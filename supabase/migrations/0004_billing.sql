-- =============================================================
-- 0004: 経営管理（請求・支払 / 経営ダッシュボード / LINE連携）
--
-- ■ セキュリティ境界について（重要）
-- 本アプリは全テーブルで「認証済みユーザーに全権限」のRLS方針（0001参照）。
-- profiles.access_level による経営層限定は **UI上のゲート** であり、
-- APIレベルのデータ分離ではない（access_level自体も全員が更新可能）。
-- 社内の信頼モデル前提の設計。厳密な分離が必要になったら、
-- 集計をビュー+専用ロールに移し、財務テーブルのポリシーを絞ること。
-- =============================================================

-- 経営層区分（'executive' | 'member'）
alter table public.profiles
  add column if not exists access_level text not null default 'member';

-- ---------- 取引先マスタ（メーカー / 代理店 / 顧客） ----------
create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'client',
  contact_name text not null default '',
  email text not null default '',
  phone text not null default '',
  address text not null default '',
  payment_rule text not null default '',
  default_due_days int not null default 30,
  memo text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- 手数料率マスタ（代理店×メーカー×商材） ----------
create table if not exists public.commission_rates (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.partners(id) on delete cascade,
  maker_id uuid not null references public.partners(id) on delete cascade,
  product_name text not null default '',
  rate_type text not null default 'percent',
  rate_percent numeric not null default 0,
  fixed_fee bigint not null default 0,
  effective_from text not null default '',
  effective_to text not null default '',
  memo text not null default '',
  created_at timestamptz not null default now()
);

-- ---------- メーカー明細（ヘッダ） ----------
create table if not exists public.maker_statements (
  id uuid primary key default gen_random_uuid(),
  maker_id uuid references public.partners(id) on delete set null,
  title text not null,
  statement_month text not null default '',
  status text not null default 'draft',
  total_amount bigint not null default 0,
  source text not null default 'manual',
  approved_by text not null default '',
  approved_at text not null default '',
  memo text not null default '',
  created_at timestamptz not null default now()
);

-- ---------- 明細行 ----------
create table if not exists public.statement_lines (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references public.maker_statements(id) on delete cascade,
  agency_id uuid references public.partners(id) on delete set null,
  product_name text not null default '',
  customer_name text not null default '',
  amount bigint not null default 0,
  rate_percent numeric,
  agency_amount bigint not null default 0,
  company_amount bigint not null default 0,
  rate_source text not null default '',
  memo text not null default '',
  created_at timestamptz not null default now()
);

-- ---------- 請求書（受領・発行の両方向） ----------
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  direction text not null default 'receivable',
  partner_id uuid references public.partners(id) on delete set null,
  partner_name text not null default '',
  invoice_number text not null default '',
  title text not null default '',
  subtotal bigint not null default 0,
  tax bigint not null default 0,
  withholding bigint not null default 0,
  total bigint not null default 0,
  issue_date text not null default '',
  due_date text not null default '',
  status text not null default 'draft',
  paid_amount bigint not null default 0,
  paid_date text not null default '',
  source text not null default 'manual',
  statement_id uuid references public.maker_statements(id) on delete set null,
  line_group_id text not null default '',
  line_message_id text not null default '',
  file_url text not null default '',
  file_type text not null default '',
  ocr_text text not null default '',
  memo text not null default '',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ---------- 入金・支払の消込履歴 ----------
create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount bigint not null default 0,
  paid_on text not null default '',
  method text not null default '振込',
  recorded_by text not null default '',
  memo text not null default '',
  created_at timestamptz not null default now()
);

-- ---------- LINEグループ ↔ 取引先の紐付け ----------
create table if not exists public.line_groups (
  id uuid primary key default gen_random_uuid(),
  group_id text not null unique,
  group_name text not null default '',
  partner_id uuid references public.partners(id) on delete set null,
  status text not null default 'unmapped',
  joined_at text not null default '',
  memo text not null default '',
  created_at timestamptz not null default now()
);

-- LINE Webhook（service role）が取り込む請求書の重複防止に使用
create index if not exists idx_invoices_line_message_id
  on public.invoices (line_message_id) where line_message_id <> '';

-- ---------- RLS: 0001と同じ「認証済みユーザーに全権限」（冪等） ----------
do $$
declare
  t text;
begin
  foreach t in array array[
    'partners','commission_rates','maker_statements','statement_lines',
    'invoices','invoice_payments','line_groups'
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

-- ---------- Realtime: 受領ボックス・LINEグループ登録の即時反映 ----------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'invoices'
  ) then
    alter publication supabase_realtime add table public.invoices;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'line_groups'
  ) then
    alter publication supabase_realtime add table public.line_groups;
  end if;
end $$;

-- ---------- Storage: 請求書ファイルは非公開バケット ----------
-- 既存の 'files' バケット（公開）とは分離し、閲覧は署名URL経由に限定する。
insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'authenticated_select_invoices'
  ) then
    create policy "authenticated_select_invoices"
      on storage.objects for select to authenticated
      using (bucket_id = 'invoices');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'authenticated_upload_invoices'
  ) then
    create policy "authenticated_upload_invoices"
      on storage.objects for insert to authenticated
      with check (bucket_id = 'invoices');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'authenticated_update_invoices'
  ) then
    create policy "authenticated_update_invoices"
      on storage.objects for update to authenticated
      using (bucket_id = 'invoices');
  end if;
end $$;
