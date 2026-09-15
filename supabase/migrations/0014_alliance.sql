-- =============================================================
-- 0014: アライアンス営業（事業部の2本立てと、商材マスタ）
--
-- ■ 背景
-- 金融機関紹介に加えて、顧客紹介契約を結んだアライアンス企業からの
-- 紹介営業を始める。入口は DDS だが、AI ほかのクロスセルを載せていく。
--
-- ■ 骨格は銀行営業と同じなので、テーブルは共有する
--   銀行営業:     銀行      → 支店      → アポ → 案件
--   アライアンス: 1次代理店 → 2次代理店 → アポ → 案件
-- banks / branches をそのまま使い、business_unit_id で事業部を分ける。
-- 画面に出す呼び名だけを切り替える（src/lib/business-units.ts）。
-- 稼働率・紹介数・成約率・休眠判定の計算（branch-metrics.ts）も、
-- アポの案件化も、まったく同じ経路を通る。
--
-- ■ 商材
-- 随時増える前提なので、コードに固定せずマスタにする。
-- 1案件に複数の商材が乗るため、案件と商材は明細で結ぶ。
-- 既存の銀行営業の案件は明細を持たないままでよい（deals.amount を使う）。
-- =============================================================

-- ---------- 事業部 ----------
-- 既存データはすべて銀行営業。まだ1件も無い環境のために両方を用意する。
insert into public.business_units (name, slug, is_active)
select '銀行営業', 'banking', true
where not exists (select 1 from public.business_units where slug = 'banking');

insert into public.business_units (name, slug, is_active)
select 'アライアンス営業', 'alliance', true
where not exists (select 1 from public.business_units where slug = 'alliance');

-- business_unit_id が空のまま入っている既存行を銀行営業に寄せる。
-- （これをやらないと、事業部で絞ったときに既存データが消えて見える）
update public.banks
   set business_unit_id = (select id from public.business_units where slug = 'banking')
 where business_unit_id is null;

update public.branches
   set business_unit_id = (select id from public.business_units where slug = 'banking')
 where business_unit_id is null;

update public.appointments
   set business_unit_id = (select id from public.business_units where slug = 'banking')
 where business_unit_id is null;

update public.deals
   set business_unit_id = (select id from public.business_units where slug = 'banking')
 where business_unit_id is null;

-- ---------- 商材マスタ ----------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  /** 英字の識別子。外部連携の突き合わせ用（"" 可） */
  slug text not null default '',
  /** バッジの配色。値の一覧は src/lib/products.ts */
  color text not null default 'slate',
  /** 標準単価（円）。0 = 都度見積 */
  unit_price bigint not null default 0,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  memo text not null default '',
  /** null = 全事業部で使える */
  business_unit_id uuid references public.business_units(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_products_sort on public.products (sort_order, name);

alter table public.products enable row level security;

-- 参照は本部社員と代理店（案件に載せる商材名を見せるため）。
-- 追加・編集はマスタを触れる人だけ（0013 の can_master）。
drop policy if exists products_select on public.products;
create policy products_select on public.products
  for select to authenticated using (true);

drop policy if exists products_write on public.products;
create policy products_write on public.products
  for insert to authenticated with check (public.can_master());

drop policy if exists products_update on public.products;
create policy products_update on public.products
  for update to authenticated
  using (public.can_master()) with check (public.can_master());

drop policy if exists products_delete on public.products;
create policy products_delete on public.products
  for delete to authenticated using (public.can_master());

-- 初期の商材。運用開始後は画面から足していく
insert into public.products (name, slug, color, sort_order)
select 'DDS', 'dds', 'cyan', 10
where not exists (select 1 from public.products where slug = 'dds');

insert into public.products (name, slug, color, sort_order)
select 'AI', 'ai', 'violet', 20
where not exists (select 1 from public.products where slug = 'ai');

-- ---------- 案件の商材明細 ----------
create table if not exists public.deal_products (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  product_id uuid references public.products(id) on delete restrict,
  /** マスタを改名しても当時の名前が残るようスナップショットする */
  product_name text not null default '',
  amount bigint not null default 0,
  quantity integer not null default 1,
  memo text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_deal_products_deal on public.deal_products (deal_id);

alter table public.deal_products enable row level security;

-- 明細は案件と運命を共にする。案件が見える人だけが明細も見える・書ける。
-- （deals のポリシーをそのまま参照するので、代理店のスコープも自動で揃う）
drop policy if exists deal_products_all on public.deal_products;
create policy deal_products_all on public.deal_products
  for all to authenticated
  using (
    exists (select 1 from public.deals d where d.id = deal_products.deal_id)
  )
  with check (
    exists (select 1 from public.deals d where d.id = deal_products.deal_id)
  );

-- =============================================================
-- ロールバック
-- drop table if exists public.deal_products;
-- drop table if exists public.products;
-- delete from public.business_units where slug = 'alliance';
-- =============================================================
