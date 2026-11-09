-- =============================================================
-- 0016: アライアンスの数値管理（事業計画・案件管理表の項目をシステムで持つ）
--
-- ■ 背景
-- アライアンス営業は 2026年9月〜2027年4月の8ヶ月を、2つのスプレッドシートに
-- 準拠して運用している。
--   ・アライアンス事業計画※確定版 … 月次計画（紹介総数・成約数・売上・代理店報酬）と月次実績
--   ・★案件管理表★               … 1紹介＝1行の案件一覧と、日報・月次集計・見込み分析
-- この2枚の記載項目を、システムの案件・商材・設定で管理できるようにする。
--
-- ■ 何をどこに持つか
--   案件管理表の1行        → deals（足りない列をここで足す）
--   プラン・機器の単価表   → products（自社利益・代理店報酬・数え方を足す）
--   案件ごとのプラン・機器 → deal_products（明細ごとの自社利益・代理店報酬を控える）
--   事業計画（月次の目標） → app_settings の key = 'alliance_plan'（本部のみ参照可）
-- 値の一覧（セールスフェーズ・販売協力フェーズなど）は src/lib/alliance.ts、
-- 集計の定義は src/lib/alliance-kpi.ts、計画の計算は src/lib/alliance-plan.ts。
--
-- 日付はこれまでの deals の列（visited_at / contracted_at）と同じく text（YYYY-MM-DD、"" = 未入力）。
-- 状態の値も enum を使わず text にする（運用中に選択肢が増えても DB を触らずに済むように）。
-- =============================================================

-- ---------- 1. 案件（案件管理表『全体管理』の列） ----------
alter table public.deals
  -- 紹介日。月次の「紹介数」はこの日で数える（未入力なら紹介アポの受付日 → 登録日）
  add column if not exists referred_at text not null default '',
  -- 商談種別: sales（セールス） | partnership（販売協力） | sales_partnership（セールス兼販売協力）
  add column if not exists deal_kind text not null default '',
  -- セールスフェーズ（シートのプルダウンそのまま。stage / confidence_rank / fulfillment_status はここから決まる）
  add column if not exists sales_phase text not null default '',
  -- 販売協力フェーズ（代理店開拓の進み具合）
  add column if not exists partnership_phase text not null default '',
  -- 契約締結日（販売協力で代理店契約を結んだ日）
  add column if not exists partnership_contracted_at text not null default '',
  -- ロスト日（成約日は既存の contracted_at を使う）
  add column if not exists lost_at text not null default '',
  -- 失注理由
  add column if not exists loss_reason text not null default '',
  -- 対応（いま誰のボールか）: ours（弊社） | alliance（アライアンス） | client（クライアント）
  add column if not exists ball text not null default '',
  -- 設置日・代理店支払日
  add column if not exists installed_at text not null default '',
  add column if not exists agency_paid_at text not null default '',
  -- 契約備考
  add column if not exists contract_note text not null default '',
  -- 代理店支払い分（1次代理店への報酬。商材明細の合計。直販は 0）
  add column if not exists agency_fee bigint not null default 0,
  -- 月額・工事費・ストック分（シートにある列。いまは集計に使わず記録だけ）
  add column if not exists monthly_fee bigint not null default 0,
  add column if not exists construction_fee bigint not null default 0,
  add column if not exists stock_amount bigint not null default 0;

create index if not exists idx_deals_referred_at on public.deals (referred_at);

-- ---------- 2. 商材（プラン単価表） ----------
alter table public.products
  -- 1単位あたりの自社利益（円）
  add column if not exists unit_profit bigint not null default 0,
  -- 1単位あたりの代理店報酬（円）。1次代理店に支払う額＝KGI『代理店をどれだけ儲けさせたか』の単価
  add column if not exists agency_fee bigint not null default 0,
  -- 件数の数え方: contract（契約数） | device（機器台数。契約数とは別に台数で数える）
  --              | none（件数に数えない。AI などのクロスセル。金額だけ集計に入る）
  add column if not exists count_unit text not null default 'contract';

-- 0014 で入れた AI はクロスセル商材なので、DDHBOX の契約数には数えない
update public.products set count_unit = 'none' where slug = 'ai' and count_unit = 'contract';

-- ---------- 3. 案件の商材明細 ----------
alter table public.deal_products
  -- この明細の自社利益・代理店報酬（単価 × 数量）。単価表を直しても過去の案件が変わらないよう控える
  add column if not exists profit bigint not null default 0,
  add column if not exists agency_fee bigint not null default 0;

-- ---------- 4. プラン単価表の初期値（事業計画※確定版『前提条件』のプラン単価マスター） ----------
-- 運用開始後は 商材マスタ の画面から直す。
do $$
declare
  v_unit uuid := (select id from public.business_units where slug = 'alliance');
begin
  insert into public.products
    (name, slug, color, unit_price, unit_profit, agency_fee, count_unit, sort_order, memo, business_unit_id)
  select v.name, v.slug, v.color, v.price, v.profit, v.fee, v.count_unit, v.sort_order, v.memo, v_unit
    from (values
      ('プラン10',     'plan10',       'cyan',   811200::bigint,  311200::bigint,  500000::bigint,  'contract', 110, '共有プラン'),
      ('プラン20',     'plan20',       'cyan',   1012800,         312800,          700000,          'contract', 120, '共有プラン（事業計画の平均プラン）'),
      ('プラン30',     'plan30',       'cyan',   1432800,         532800,          900000,          'contract', 130, '共有プラン'),
      ('プラン50',     'plan50',       'cyan',   1852800,         652800,          1200000,         'contract', 140, '共有プラン'),
      ('プラン100',    'plan100',      'cyan',   2692800,         992800,          1700000,         'contract', 150, '共有プラン'),
      ('プラン300',    'plan300',      'cyan',   6209040,         3409040,         2800000,         'contract', 160, '共有プラン'),
      ('機器',         'device',       'amber',  282400,          162400,          0,               'device',   170, '1台あたり。契約数とは別に台数で数える'),
      ('直販・その他', 'direct_other', 'slate',  0,               0,               0,               'contract', 180, '単価手入力。売上＝利益で入力すれば代理店報酬はゼロ')
    ) as v(name, slug, color, price, profit, fee, count_unit, sort_order, memo)
   where not exists (select 1 from public.products p where p.slug = v.slug);
end $$;

-- ---------- 5. 事業計画は本部だけが読める ----------
-- app_settings は「参照は全員 / 変更は経営・管理部」（0006）。
-- 事業計画（売上・自社利益の目標）は代理店ユーザーに見せない。
-- 判定は src/lib/scope.ts の HQ_ONLY_SETTING_KEYS と1対1。
drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select on public.app_settings
  for select to authenticated
  using (key <> 'alliance_plan' or public.is_hq());

-- =============================================================
-- ロールバック
-- drop policy if exists app_settings_select on public.app_settings;
-- create policy app_settings_select on public.app_settings for select to authenticated using (true);
-- delete from public.products where slug in
--   ('plan10','plan20','plan30','plan50','plan100','plan300','device','direct_other')
--   and not exists (select 1 from public.deal_products l where l.product_id = products.id);
-- alter table public.deal_products drop column if exists profit, drop column if exists agency_fee;
-- alter table public.products
--   drop column if exists unit_profit, drop column if exists agency_fee, drop column if exists count_unit;
-- drop index if exists public.idx_deals_referred_at;
-- alter table public.deals
--   drop column if exists referred_at, drop column if exists deal_kind,
--   drop column if exists sales_phase, drop column if exists partnership_phase,
--   drop column if exists partnership_contracted_at, drop column if exists lost_at,
--   drop column if exists loss_reason, drop column if exists ball,
--   drop column if exists installed_at, drop column if exists agency_paid_at,
--   drop column if exists contract_note, drop column if exists agency_fee,
--   drop column if exists monthly_fee, drop column if exists construction_fee,
--   drop column if exists stock_amount;
-- =============================================================
