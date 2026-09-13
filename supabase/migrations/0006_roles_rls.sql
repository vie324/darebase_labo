-- =============================================================
-- 0006: ロール／RLS 全面改訂（代理店へのアカウント配布に対応）
--
-- ■ 背景
-- 0001〜0005 の RLS は「認証済みなら全テーブル全権限」だった。
-- 代理店にアカウントを配る（＝社外ユーザーが入る）ため、
-- DB レベルでデータを分離する。UI 上の出し分けだけでは不十分。
--
-- ■ ロール（profiles.role_key）
--   executive      経営          … 全部
--   backoffice     管理部        … 請求・支払・マスタ・設定・全案件
--   manager        マネージャー  … 本部の案件/稼働/タスク全部
--   member         一般社員      … 本部の営業データ
--   partner_admin  代理店管理者  … 自社(organization)の案件・アポ・割当支店・自社報酬
--   partner_member 代理店メンバー… 上記のうち「自分が担当する」ものだけ
--
-- ■ 方針
-- - ロール判定は SECURITY DEFINER 関数に閉じ込める（profiles を参照する
--   ポリシーが profiles 自身の RLS で再帰するのを避けるため）。
-- - 個人単位のテーブル（予定・タスク・名刺・ロープレ・案件）は
--   owner_id を追加し `default auth.uid()` で自動的に入るようにした。
--   既存行は owner_id = null になり「本部だけが見える」安全側に倒れる。
-- - 代理店ユーザーは他代理店・本部の売上/粗利/報酬に一切到達できない。
-- - 新規サインアップは Supabase ダッシュボードで OFF（招待制）にすること。
--   招待は public.user_invites に登録 → 同じメールでアカウントが作られた
--   ときに role_key / organization_id が自動的に適用される。
--
-- ■ ロールバックはファイル末尾のコメントを参照。
-- =============================================================

-- =============================================================
-- 1. スキーマ拡張
-- =============================================================

-- ---------- profiles: ロールと所属組織 ----------
alter table public.profiles
  add column if not exists role_key text not null default 'member',
  add column if not exists organization_id uuid references public.organizations(id) on delete set null,
  add column if not exists is_active boolean not null default true;

create index if not exists idx_profiles_organization_id on public.profiles (organization_id);

-- ---------- organizations: 請求先(partners)との紐付け ----------
-- organizations = 営業実行組織 / partners(kind='agency') = 請求先。
-- 代理店ユーザーに「自社の報酬明細だけ」を見せるにはこの1対1が必要。
alter table public.organizations
  add column if not exists partner_id uuid references public.partners(id) on delete set null;

-- ---------- 個人スコープ用の owner_id ----------
-- default auth.uid() なので、アプリ側は何も渡さなくても正しい値が入る。
alter table public.events            add column if not exists owner_id uuid default auth.uid();
alter table public.tasks             add column if not exists owner_id uuid default auth.uid();
alter table public.contacts          add column if not exists owner_id uuid default auth.uid();
alter table public.roleplay_sessions add column if not exists owner_id uuid default auth.uid();
alter table public.deals             add column if not exists owner_id uuid default auth.uid();

create index if not exists idx_deals_owner_id on public.deals (owner_id);
create index if not exists idx_tasks_owner_id on public.tasks (owner_id);

-- ---------- 招待（サインアップは招待制にする） ----------
create table if not exists public.user_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role_key text not null default 'member',
  organization_id uuid references public.organizations(id) on delete set null,
  invited_by text not null default '',
  note text not null default '',
  accepted_at timestamptz,
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now()
);

-- 未使用の招待はメールごとに1件だけ
create unique index if not exists idx_user_invites_email_open
  on public.user_invites (lower(email)) where accepted_at is null;

-- =============================================================
-- 2. ロール判定ヘルパー（SECURITY DEFINER = profiles の RLS を迂回）
-- =============================================================

-- 現在ユーザーのロール。プロフィール未作成・停止中は 'disabled' を返し、
-- すべての is_* が false になる（＝何も見えない）安全側の既定。
create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select case when p.is_active then p.role_key else 'disabled' end
       from public.profiles p where p.id = auth.uid()),
    'disabled'
  );
$$;

-- 所属組織（本部社員は null）
create or replace function public.my_org()
returns uuid language sql stable security definer set search_path = public as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

-- 自組織に紐づく請求先（代理店の報酬明細の絞り込みに使う）
create or replace function public.my_partner()
returns uuid language sql stable security definer set search_path = public as $$
  select o.partner_id from public.organizations o
  where o.id = (select organization_id from public.profiles where id = auth.uid());
$$;

/** 本部（自社）の社員か */
create or replace function public.is_hq()
returns boolean language sql stable as $$
  select public.my_role() in ('executive','backoffice','manager','member');
$$;

/** 代理店ユーザーか */
create or replace function public.is_partner_user()
returns boolean language sql stable as $$
  select public.my_role() in ('partner_admin','partner_member');
$$;

/** 代理店の中で自社全体が見えるか（false = 自分の担当分のみ） */
create or replace function public.partner_sees_org()
returns boolean language sql stable as $$
  select public.my_role() = 'partner_admin';
$$;

/** 経営 */
create or replace function public.is_executive()
returns boolean language sql stable as $$
  select public.my_role() = 'executive';
$$;

/** 請求・支払・設定を編集できる（経営 + 管理部） */
create or replace function public.can_backoffice()
returns boolean language sql stable as $$
  select public.my_role() in ('executive','backoffice');
$$;

-- ---------- 代理店ユーザーが作った行を自組織に紐づける ----------
-- 代理店ユーザーは organization_id = 自組織 の行しか書き込めない（下のポリシー）。
-- アプリが値を渡さなかった場合の保険として、既定値を「自分の組織」にしておく。
-- 本部社員は my_org() が null を返すため、これまでどおり null になる。
alter table public.deals        alter column organization_id set default public.my_org();
alter table public.appointments alter column organization_id set default public.my_org();

-- =============================================================
-- 3. 旧ポリシー（authenticated_all_*）を削除
-- =============================================================
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public' and policyname like 'authenticated_all_%'
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- 全テーブルで RLS を有効化（新規テーブル含む）
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles','events','deals','deal_activities','tasks','contacts',
    'knowledge','documents','scripts','roleplay_sessions','trainings',
    'channels','messages','posts','schedule_polls',
    'partners','commission_rates','maker_statements','statement_lines',
    'invoices','invoice_payments','line_groups',
    'business_units','organizations','banks','branches',
    'appointments','branch_activities','app_settings','user_invites'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- =============================================================
-- 4. ポリシー
-- =============================================================

-- ---------- 4-1. profiles ----------
-- 参照は全員に許可（担当者名・アバター表示に必要）。
-- 【注意】給与・評価など秘匿情報を profiles に足さないこと。専用テーブルに置く。
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated with check (id = auth.uid() or public.is_executive());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_executive())
  with check (id = auth.uid() or public.is_executive());

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles
  for delete to authenticated using (public.is_executive());

-- 昇格防止: 経営以外は role_key / organization_id / access_level / is_active を変更できない。
-- （エラーにせず黙って元の値に戻す。UI は経営にしかこの項目を出さない）
create or replace function public.profiles_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_executive() then
    new.role_key        := old.role_key;
    new.organization_id := old.organization_id;
    new.access_level    := old.access_level;
    new.is_active       := old.is_active;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_update on public.profiles;
create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.profiles_guard();

-- ---------- 4-2. 本部専用（代理店は一切アクセス不可） ----------
-- 社内コミュニケーション・日程調整
do $$
declare
  t text;
begin
  foreach t in array array['channels','messages','posts','schedule_polls']
  loop
    execute format('drop policy if exists %I on public.%I', 'hq_only_' || t, t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_hq()) with check (public.is_hq())',
      'hq_only_' || t, t
    );
  end loop;
end $$;

-- ---------- 4-2b. 経営・管理部のみ（お金のマスタ） ----------
-- マネージャー・一般社員も対象外。画面（/billing・/executive）の出し分けと揃える。
do $$
declare
  t text;
begin
  foreach t in array array[
    'partners','commission_rates','maker_statements','invoice_payments','line_groups'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', 'hq_only_' || t, t);
    execute format('drop policy if exists %I on public.%I', 'backoffice_only_' || t, t);
    execute format(
      'create policy %I on public.%I for all to authenticated '
      'using (public.can_backoffice()) with check (public.can_backoffice())',
      'backoffice_only_' || t, t
    );
  end loop;
end $$;

-- ---------- 4-3. 全員参照・本部のみ編集（営業資料・ナレッジ・研修） ----------
-- 代理店にも売るための材料（資料・スクリプト・勉強会）は見せる。
-- knowledge（いいね/閲覧数）と documents（DL数）は画面からカウントアップするため
-- update だけ全員に許可し、それ以外は本部のみに絞る（4-3b）。
do $$
declare
  t text;
begin
  foreach t in array array['knowledge','documents','scripts','trainings','business_units']
  loop
    execute format('drop policy if exists %I on public.%I', 'shared_read_' || t, t);
    execute format('drop policy if exists %I on public.%I', 'shared_write_' || t, t);
    execute format('drop policy if exists %I on public.%I', 'shared_update_' || t, t);
    execute format('drop policy if exists %I on public.%I', 'shared_delete_' || t, t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      'shared_read_' || t, t
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.is_hq())',
      'shared_write_' || t, t
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (true) with check (true)',
      'shared_update_' || t, t
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.is_hq())',
      'shared_delete_' || t, t
    );
  end loop;
end $$;

-- ---------- 4-3b. カウンタを持たないテーブルは update も本部のみ ----------
do $$
declare
  t text;
begin
  foreach t in array array['scripts','trainings','business_units']
  loop
    execute format('drop policy if exists %I on public.%I', 'shared_update_' || t, t);
    execute format(
      'create policy %I on public.%I for update to authenticated '
      'using (public.is_hq()) with check (public.is_hq())',
      'shared_update_' || t, t
    );
  end loop;
end $$;

-- ---------- 4-4. app_settings: 参照は全員 / 変更は経営・管理部 ----------
drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select on public.app_settings
  for select to authenticated using (true);

drop policy if exists app_settings_write on public.app_settings;
create policy app_settings_write on public.app_settings
  for all to authenticated
  using (public.can_backoffice()) with check (public.can_backoffice());

-- ---------- 4-5. 個人スコープ（予定・タスク・名刺・ロープレ） ----------
-- 本部は全件、代理店は自分の行だけ。
do $$
declare
  t text;
begin
  foreach t in array array['events','tasks','contacts','roleplay_sessions']
  loop
    execute format('drop policy if exists %I on public.%I', 'own_scope_' || t, t);
    execute format(
      'create policy %I on public.%I for all to authenticated '
      'using (public.is_hq() or (public.is_partner_user() and owner_id = auth.uid())) '
      'with check (public.is_hq() or (public.is_partner_user() and owner_id = auth.uid()))',
      'own_scope_' || t, t
    );
  end loop;
end $$;

-- ---------- 4-6. 組織 ----------
drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations
  for select to authenticated
  using (public.is_hq() or id = public.my_org());

drop policy if exists organizations_write on public.organizations;
create policy organizations_write on public.organizations
  for all to authenticated
  using (public.can_backoffice()) with check (public.can_backoffice());

-- ---------- 4-7. 銀行（自社に割当のある支店を持つ銀行だけ見える） ----------
drop policy if exists banks_select on public.banks;
create policy banks_select on public.banks
  for select to authenticated
  using (
    public.is_hq()
    or exists (
      select 1 from public.branches b
      where b.bank_id = banks.id and b.assigned_org_id = public.my_org()
    )
  );

drop policy if exists banks_write on public.banks;
create policy banks_write on public.banks
  for all to authenticated
  using (public.is_hq()) with check (public.is_hq());

-- ---------- 4-8. 支店（代理店は自社割当分のみ） ----------
drop policy if exists branches_select on public.branches;
create policy branches_select on public.branches
  for select to authenticated
  using (public.is_hq() or assigned_org_id = public.my_org());

drop policy if exists branches_update on public.branches;
create policy branches_update on public.branches
  for update to authenticated
  using (public.is_hq() or assigned_org_id = public.my_org())
  with check (public.is_hq() or assigned_org_id = public.my_org());

-- マスタの追加・削除・担当振り替えは本部のみ
drop policy if exists branches_insert on public.branches;
create policy branches_insert on public.branches
  for insert to authenticated with check (public.is_hq());

drop policy if exists branches_delete on public.branches;
create policy branches_delete on public.branches
  for delete to authenticated using (public.is_hq());

-- ---------- 4-9. アポイント ----------
drop policy if exists appointments_all on public.appointments;
create policy appointments_all on public.appointments
  for all to authenticated
  using (
    public.is_hq()
    or (organization_id = public.my_org()
        and (public.partner_sees_org() or assigned_to = auth.uid()))
  )
  with check (
    public.is_hq()
    or (organization_id = public.my_org()
        and (public.partner_sees_org() or assigned_to = auth.uid()))
  );

-- ---------- 4-10. 案件 ----------
drop policy if exists deals_all on public.deals;
create policy deals_all on public.deals
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

drop policy if exists deal_activities_all on public.deal_activities;
create policy deal_activities_all on public.deal_activities
  for all to authenticated
  using (
    public.is_hq()
    or exists (
      select 1 from public.deals d
      where d.id = deal_activities.deal_id
        and d.organization_id = public.my_org()
        and (public.partner_sees_org() or d.owner_id = auth.uid())
    )
  )
  with check (
    public.is_hq()
    or exists (
      select 1 from public.deals d
      where d.id = deal_activities.deal_id
        and d.organization_id = public.my_org()
        and (public.partner_sees_org() or d.owner_id = auth.uid())
    )
  );

-- ---------- 4-11. 支店活動ログ ----------
drop policy if exists branch_activities_all on public.branch_activities;
create policy branch_activities_all on public.branch_activities
  for all to authenticated
  using (
    public.is_hq()
    or exists (
      select 1 from public.branches b
      where b.id = branch_activities.branch_id and b.assigned_org_id = public.my_org()
    )
  )
  with check (
    public.is_hq()
    or exists (
      select 1 from public.branches b
      where b.id = branch_activities.branch_id and b.assigned_org_id = public.my_org()
    )
  );

-- ---------- 4-12. 請求書（経営・管理部 / 代理店は「自社宛の支払」だけ） ----------
drop policy if exists invoices_select on public.invoices;
create policy invoices_select on public.invoices
  for select to authenticated
  using (
    public.can_backoffice()
    or (direction = 'payable' and partner_id is not null and partner_id = public.my_partner())
  );

drop policy if exists invoices_write on public.invoices;
create policy invoices_write on public.invoices
  for all to authenticated
  using (public.can_backoffice()) with check (public.can_backoffice());

-- ---------- 4-13. 明細行（経営・管理部 / 代理店は自社取り分の行だけ） ----------
drop policy if exists statement_lines_select on public.statement_lines;
create policy statement_lines_select on public.statement_lines
  for select to authenticated
  using (
    public.can_backoffice()
    or (agency_id is not null and agency_id = public.my_partner())
  );

drop policy if exists statement_lines_write on public.statement_lines;
create policy statement_lines_write on public.statement_lines
  for all to authenticated
  using (public.can_backoffice()) with check (public.can_backoffice());

-- ---------- 4-14. 招待（経営・管理部のみ） ----------
drop policy if exists user_invites_all on public.user_invites;
create policy user_invites_all on public.user_invites
  for all to authenticated
  using (public.can_backoffice()) with check (public.can_backoffice());

-- =============================================================
-- 5. サインアップ時のロール割当（招待ベース）
-- =============================================================
-- Supabase ダッシュボード > Authentication > Providers で
-- 「Allow new users to sign up」を OFF にすること（招待制）。
-- 招待 (user_invites) があればその role_key / organization_id を適用し、
-- 無ければ member。ただし最初の1人だけは executive（初期セットアップ用）。
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  inv public.user_invites%rowtype;
  first_user boolean;
  resolved_role text;
  resolved_org uuid;
begin
  select * into inv
  from public.user_invites
  where lower(email) = lower(new.email)
    and accepted_at is null
    and expires_at > now()
  order by created_at desc
  limit 1;

  select not exists (select 1 from public.profiles) into first_user;

  if inv.id is not null then
    resolved_role := inv.role_key;
    resolved_org  := inv.organization_id;
    update public.user_invites set accepted_at = now() where id = inv.id;
  elsif first_user then
    resolved_role := 'executive';
    resolved_org  := null;
  else
    resolved_role := 'member';
    resolved_org  := null;
  end if;

  insert into public.profiles (id, name, email, role, role_key, organization_id, access_level)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'メンバー'),
    resolved_role,
    resolved_org,
    case when resolved_role = 'executive' then 'executive' else 'member' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================
-- 6. 既存データの移行
-- =============================================================
-- これまで access_level='executive' だった人を経営ロールにする。
update public.profiles set role_key = 'executive'
where access_level = 'executive' and role_key = 'member';

-- 経営が1人もいないと誰もロールを変更できなくなるため、
-- その場合は最古のプロフィールを経営に昇格させる。
do $$
begin
  if not exists (select 1 from public.profiles where role_key = 'executive') then
    update public.profiles set role_key = 'executive', access_level = 'executive'
    where id = (select id from public.profiles order by created_at asc limit 1);
  end if;
end $$;

-- =============================================================
-- ロールバック（必要な場合）
--
-- drop trigger if exists profiles_guard_update on public.profiles;
-- drop function if exists public.profiles_guard();
-- drop table if exists public.user_invites;
-- alter table public.profiles drop column if exists role_key,
--   drop column if exists organization_id, drop column if exists is_active;
-- alter table public.organizations drop column if exists partner_id;
-- alter table public.events drop column if exists owner_id;
-- alter table public.tasks drop column if exists owner_id;
-- alter table public.contacts drop column if exists owner_id;
-- alter table public.roleplay_sessions drop column if exists owner_id;
-- alter table public.deals drop column if exists owner_id;
-- → その後 0001 / 0004 / 0005 の authenticated_all_* ポリシーを再作成する。
-- =============================================================
