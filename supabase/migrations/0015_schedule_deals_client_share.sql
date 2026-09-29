-- =============================================================
-- 0015: スケジュールからの案件登録 / 販売協力 / クライアント共有リンク
--
-- ■ スケジュール → 案件
--   予定の入力画面から、そのまま案件を登録できるようにする。
--   予定と案件を events.deal_id で結ぶ（1案件に複数の予定がぶら下がる）。
--   案件の修正は案件管理で行う（予定の画面からはリンクで飛ぶだけ）。
--
-- ■ 販売協力（アライアンス営業の商談ステージ）
--   deals.stage は text のまま（値の一覧は src/lib/constants.ts の DEAL_STAGES）なので、
--   'partnership' を入れるのにスキーマ変更は要らない。
--   販売協力になった会社は原則 2次代理店になるため、どの案件から生まれた
--   2次代理店かを branches.source_deal_id で控える。
--
-- ■ クライアント共有リンク
--   紹介元（銀行 / 1次代理店・2次代理店）に、紹介いただいた顧客の進捗を
--   ログインなしの閲覧専用ページ（/share/[token]）で公開する。
--   0009 の公開予約リンクと同じ方式で、テーブルは匿名に一切開けない。
--   SECURITY DEFINER 関数 get_client_share が、トークンに対応する1件の
--   「公開してよい項目だけ」を返す。金額・メモ・確度・先方担当者などは返さない。
--   返す行の選び方は src/lib/client-share.ts の collectShareRows と1対1。
-- =============================================================

-- =============================================================
-- 1. スケジュール → 案件
-- =============================================================
alter table public.events
  add column if not exists deal_id uuid references public.deals(id) on delete set null;

create index if not exists idx_events_deal_id on public.events (deal_id);

-- 紹介アポから自動で作られた予定は、アポが案件化済みならその案件に紐づけておく
-- （画面側もアポ経由で解決できるが、データとして明示しておく）
update public.events e
   set deal_id = a.deal_id
  from public.appointments a
 where a.event_id = e.id
   and a.deal_id is not null
   and e.deal_id is null;

-- =============================================================
-- 2. 販売協力 → 2次代理店
-- =============================================================
alter table public.branches
  add column if not exists source_deal_id uuid references public.deals(id) on delete set null;

create index if not exists idx_branches_source_deal_id on public.branches (source_deal_id);

-- =============================================================
-- 3. クライアント共有リンク
-- =============================================================
create table if not exists public.client_shares (
  id uuid primary key default gen_random_uuid(),
  /** URL に入る推測不能な文字列（アプリが 32バイトの乱数から作る）。再発行で差し替える */
  token text not null unique
    default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  /** 公開ページの見出し */
  title text not null default '',
  /** 紹介元。この紹介元から来た紹介だけを公開する */
  bank_id uuid not null references public.banks(id) on delete cascade,
  /** 窓口で絞る場合のみ（null = 紹介元の全窓口） */
  branch_id uuid references public.branches(id) on delete cascade,
  business_unit_id uuid references public.business_units(id) on delete set null,
  /** 有効期限（null = 無期限） */
  expires_at timestamptz,
  /** false = 停止中 */
  is_active boolean not null default true,
  /** 社内向けメモ（公開ページには出さない） */
  note text not null default '',
  created_by text not null default '',
  owner_id uuid default auth.uid(),
  /** 閲覧の記録（スプレッドシートの自動取得も含む） */
  last_accessed_at timestamptz,
  access_count integer not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint client_shares_token_format check (token ~ '^[A-Za-z0-9_-]{32,128}$')
);

create index if not exists idx_client_shares_bank_id on public.client_shares (bank_id);

alter table public.client_shares enable row level security;

-- 一覧は本部社員だけ（代理店ユーザーには1行も返さない）。
-- 発行・編集・停止・削除は「社外に何を見せるか」の判断なので、
-- マネージャー以上（0013 の can_master = 経営・管理部・マネージャー）に絞る。
drop policy if exists client_shares_select on public.client_shares;
create policy client_shares_select on public.client_shares
  for select to authenticated using (public.is_hq());

drop policy if exists client_shares_insert on public.client_shares;
create policy client_shares_insert on public.client_shares
  for insert to authenticated with check (public.can_master());

drop policy if exists client_shares_update on public.client_shares;
create policy client_shares_update on public.client_shares
  for update to authenticated
  using (public.can_master()) with check (public.can_master());

drop policy if exists client_shares_delete on public.client_shares;
create policy client_shares_delete on public.client_shares
  for delete to authenticated using (public.can_master());

-- ---------- 公開ページ用の関数 ----------
-- 返り値:
--   {"ok": true, "title", "source"(紹介元名), "channel"(窓口名 or null),
--    "unit"('banking' | 'alliance'), "expires_at", "generated_at", "rows": [...]}
--   {"ok": false, "error": "not_found" | "expired"}
-- rows の1要素（src/lib/client-share.ts の ShareSourceRow と同じ形）:
--   referred_on, company, channel, meeting_at, appointment_status, deal_stage,
--   fulfillment_status, products, owner, updated_at
-- ここに無い列（金額・メモ・確度・先方担当者・業種・売上規模など）は返さない。
create or replace function public.get_client_share(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  s public.client_shares%rowtype;
  v_source text;
  v_unit text;
  v_channel text;
  v_rows jsonb;
  iso constant text := 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"';
begin
  -- 形の合わないトークンは探しもしない
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{32,128}$' then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select * into s from public.client_shares where token = p_token;
  -- 停止中は「無い」と同じ扱い（止めたリンクの存在を明かさない）
  if not found or not s.is_active then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if s.expires_at is not null and s.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  -- 閲覧の記録（相手が見てくれているかを発行側で確認できるように）
  update public.client_shares
     set last_accessed_at = now(),
         access_count = access_count + 1
   where id = s.id;

  select b.name, coalesce(u.slug, 'banking')
    into v_source, v_unit
    from public.banks b
    left join public.business_units u on u.id = b.business_unit_id
   where b.id = s.bank_id;

  if s.branch_id is not null then
    select name into v_channel from public.branches where id = s.branch_id;
  end if;

  with appointment_rows as (
    -- 1. その紹介元（と窓口）から来たアポ。案件化していれば案件の状態も付ける
    select
      coalesce(nullif(a.received_at, ''),
               to_char(a.created_at at time zone 'Asia/Tokyo', 'YYYY-MM-DD')) as referred_on,
      a.company_name as company,
      coalesce(br.name, '') as channel,
      a.scheduled_at as meeting_at,
      a.status as appointment_status,
      coalesce(d.stage, '') as deal_stage,
      coalesce(d.fulfillment_status, '') as fulfillment_status,
      coalesce((select string_agg(l.product_name, ' / ' order by l.created_at)
                  from public.deal_products l
                 where l.deal_id = d.id), '') as products,
      coalesce(nullif(a.assigned_name, ''), d.owner_name, '') as owner,
      greatest(a.updated_at, d.updated_at) as updated_at
    from public.appointments a
    left join public.deals d on d.id = a.deal_id
    left join public.branches br on br.id = a.branch_id
    where a.bank_id = s.bank_id
      and (s.branch_id is null or a.branch_id = s.branch_id)
  ),
  direct_deal_rows as (
    -- 2. アポを経ずに紹介元を付けて登録した案件（スケジュール・案件管理から登録したもの）
    select
      to_char(d.created_at at time zone 'Asia/Tokyo', 'YYYY-MM-DD') as referred_on,
      d.company as company,
      coalesce(br.name, '') as channel,
      -- 商談日は、紐づく予定のうち次に来るもの（無ければ最後のもの）
      coalesce(
        (select to_char(min(e.start_at) at time zone 'UTC', iso)
           from public.events e
          where e.deal_id = d.id and e.start_at >= now()),
        (select to_char(max(e.start_at) at time zone 'UTC', iso)
           from public.events e
          where e.deal_id = d.id),
        ''
      ) as meeting_at,
      ''::text as appointment_status,
      d.stage as deal_stage,
      coalesce(d.fulfillment_status, '') as fulfillment_status,
      coalesce((select string_agg(l.product_name, ' / ' order by l.created_at)
                  from public.deal_products l
                 where l.deal_id = d.id), '') as products,
      d.owner_name as owner,
      d.updated_at as updated_at
    from public.deals d
    left join public.branches br on br.id = d.branch_id
    where d.bank_id = s.bank_id
      and (s.branch_id is null or d.branch_id = s.branch_id)
      and not exists (select 1 from public.appointments a2 where a2.deal_id = d.id)
  ),
  all_rows as (
    select * from appointment_rows
    union all
    select * from direct_deal_rows
  )
  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'referred_on', r.referred_on,
               'company', r.company,
               'channel', r.channel,
               'meeting_at', r.meeting_at,
               'appointment_status', r.appointment_status,
               'deal_stage', r.deal_stage,
               'fulfillment_status', r.fulfillment_status,
               'products', r.products,
               'owner', r.owner,
               'updated_at', to_char(r.updated_at at time zone 'UTC', iso)
             )
             order by r.referred_on desc, r.company
           ),
           '[]'::jsonb
         )
    into v_rows
    from all_rows r;

  return jsonb_build_object(
    'ok', true,
    'title', s.title,
    'source', coalesce(v_source, ''),
    'channel', v_channel,
    'unit', v_unit,
    'expires_at', case when s.expires_at is null then null
                       else to_char(s.expires_at at time zone 'UTC', iso) end,
    'generated_at', to_char(now() at time zone 'UTC', iso),
    'rows', v_rows
  );
end;
$$;

-- 関数の実行だけを許可する（テーブルへの直接アクセスは引き続き不可）
revoke all on function public.get_client_share(text) from public;
grant execute on function public.get_client_share(text) to anon, authenticated;

-- =============================================================
-- ロールバック
-- drop function if exists public.get_client_share(text);
-- drop table if exists public.client_shares;
-- drop index if exists public.idx_branches_source_deal_id;
-- alter table public.branches drop column if exists source_deal_id;
-- drop index if exists public.idx_events_deal_id;
-- alter table public.events drop column if exists deal_id;
-- update public.deals set stage = 'follow_up' where stage = 'partnership';
-- =============================================================
