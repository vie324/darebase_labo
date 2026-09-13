-- =============================================================
-- 0012: バックオフィス（勤怠 / 経費精算 / 人事評価）
--
-- ■ 範囲
-- 本部社員の勤怠・経費・評価を扱う。代理店スタッフは対象外
-- （方針として「代理店スタッフの勤怠・経費・評価は管理しない」）。
-- そのため全ポリシーに public.is_hq() を掛け、代理店ユーザーからは
-- どのテーブルも1行も見えないようにする。
--
-- ■ 給与計算について（意図的に入れていない）
-- 社会保険料・源泉徴収などの控除計算はこの段階では作らない。
-- 雇用形態の内訳と人数が決まらないと、料率表の持ち方
-- （等級表を持つのか、被保険者区分をどう分けるのか）が決められないため。
-- ここで用意するのは、その計算に必要な「勤怠の実績値」までとする。
--
-- ■ お金の計算はDBとアプリの純粋関数で行う
-- 金額・時間の計算に LLM は使わない。料率や所定労働時間のような
-- 「先方が決める値」は app_settings に置き、画面から編集できるようにする。
-- =============================================================

-- ---------- 勤怠 ----------

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid default auth.uid(),
  owner_name text not null default '',
  work_date text not null default '', -- YYYY-MM-DD
  /** 値の一覧は src/lib/attendance.ts に集約 */
  kind text not null default 'office',
  start_at text not null default '', -- HH:MM（空 = 未打刻）
  end_at text not null default '', -- HH:MM
  break_minutes integer not null default 60,
  note text not null default '',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- 1人1日1行。打刻のやり直しは同じ行の更新にする
create unique index if not exists idx_attendance_owner_date
  on public.attendance_records (owner_id, work_date);

alter table public.attendance_records enable row level security;

-- 自分の勤怠は自分で。全員分の閲覧・修正は管理部（＋経営）だけ
drop policy if exists attendance_self_or_backoffice on public.attendance_records;
create policy attendance_self_or_backoffice on public.attendance_records
  for all to authenticated
  using (public.is_hq() and (owner_id = auth.uid() or public.can_backoffice()))
  with check (public.is_hq() and (owner_id = auth.uid() or public.can_backoffice()));

-- ---------- 経費精算 ----------

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid default auth.uid(),
  owner_name text not null default '',
  spent_on text not null default '', -- YYYY-MM-DD
  /** 勘定科目。値の一覧は src/lib/expenses.ts に集約 */
  category text not null default 'transport',
  amount bigint not null default 0,
  /** 何のための支出か（税務上、目的と相手先が要る） */
  purpose text not null default '',
  counterparty text not null default '',
  /** self（自己立替） | corporate（法人カード） */
  payment_method text not null default 'self',
  /** 領収書（非公開バケット attachments のパス。"" = 未添付） */
  receipt_file text not null default '',
  /** draft | submitted | approved | rejected | paid。遷移は src/lib/expenses.ts */
  status text not null default 'draft',
  submitted_at text not null default '', -- ISO
  approver_name text not null default '',
  approved_at text not null default '', -- ISO
  /** 差し戻しの理由。承認者が書く */
  reject_reason text not null default '',
  paid_on text not null default '', -- YYYY-MM-DD
  deal_id uuid references public.deals(id) on delete set null,
  note text not null default '',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_expenses_status on public.expenses (status);

alter table public.expenses enable row level security;

-- 申請者は自分の申請、管理部は全員分
drop policy if exists expenses_self_or_backoffice on public.expenses;
create policy expenses_self_or_backoffice on public.expenses
  for all to authenticated
  using (public.is_hq() and (owner_id = auth.uid() or public.can_backoffice()))
  with check (public.is_hq() and (owner_id = auth.uid() or public.can_backoffice()));

-- 承認後の書き換え防止。
-- 申請者は「下書き・差し戻し」の間だけ内容を直せる。承認・却下・支払は管理部のみ。
create or replace function public.expenses_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.can_backoffice() then
    return new;
  end if;
  -- 申請者本人の操作
  if old.status not in ('draft', 'rejected') then
    -- 提出済み・承認済み・支払済みの行は本人には変更させない
    return old;
  end if;
  -- 自分で承認済み・支払済みにはできない（提出までが本人の操作）
  if new.status not in ('draft', 'submitted') then
    new.status := old.status;
  end if;
  -- 承認者が書く欄は本人には触らせない
  new.approver_name := old.approver_name;
  new.approved_at   := old.approved_at;
  new.reject_reason := old.reject_reason;
  new.paid_on       := old.paid_on;
  return new;
end;
$$;

drop trigger if exists expenses_guard_trigger on public.expenses;
create trigger expenses_guard_trigger
  before update on public.expenses
  for each row execute function public.expenses_guard();

-- ---------- 人事評価 ----------

create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  /** 評価される人 */
  target_id uuid references public.profiles(id) on delete cascade,
  target_name text not null default '',
  /** 評価期間。例: 2026-H1 */
  period text not null default '',
  /** draft（準備中） | self（本人記入待ち） | review（評価者記入中） | finalized（確定） */
  status text not null default 'draft',
  /** 評価項目と点数。項目は src/lib/evaluation.ts のスキーマに集約 */
  items jsonb,
  /** 本人が書く欄。ここだけは本人にも書き換えられる */
  self_comment text not null default '',
  /** 評価者が書く欄 */
  reviewer_name text not null default '',
  reviewer_comment text not null default '',
  /** 100点換算の総合点。アプリ側の純粋関数で計算して入れる */
  total_score numeric not null default 0,
  finalized_at text not null default '', -- ISO
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists idx_evaluations_target_period
  on public.evaluations (target_id, period);

alter table public.evaluations enable row level security;

-- 本人は自分の評価だけ。作成・確定は管理部（＋経営）
drop policy if exists evaluations_self_read on public.evaluations;
create policy evaluations_self_read on public.evaluations
  for select to authenticated
  using (public.is_hq() and (target_id = auth.uid() or public.can_backoffice()));

drop policy if exists evaluations_self_update on public.evaluations;
create policy evaluations_self_update on public.evaluations
  for update to authenticated
  using (public.is_hq() and (target_id = auth.uid() or public.can_backoffice()))
  with check (public.is_hq() and (target_id = auth.uid() or public.can_backoffice()));

drop policy if exists evaluations_backoffice_write on public.evaluations;
create policy evaluations_backoffice_write on public.evaluations
  for insert to authenticated with check (public.can_backoffice());

drop policy if exists evaluations_backoffice_delete on public.evaluations;
create policy evaluations_backoffice_delete on public.evaluations
  for delete to authenticated using (public.can_backoffice());

/**
 * 自己採点だけを差し替える。
 * 項目の並び・キー・評価者の点数は old 側を正とし、new からは self_score と
 * self_note だけを取り込む。本人が項目そのものを増減できないようにするため。
 */
create or replace function public.merge_self_scores(old_items jsonb, new_items jsonb)
returns jsonb language sql immutable as $$
  select case
    when jsonb_typeof(old_items) <> 'array' then old_items
    when jsonb_typeof(new_items) <> 'array' then old_items
    else (
      select coalesce(jsonb_agg(
        o.item
        || jsonb_build_object(
             'self_score', coalesce(n.item -> 'self_score', o.item -> 'self_score'),
             'self_note',  coalesce(n.item -> 'self_note',  o.item -> 'self_note')
           )
        order by o.ord
      ), '[]'::jsonb)
      from jsonb_array_elements(old_items) with ordinality as o(item, ord)
      left join jsonb_array_elements(new_items) with ordinality as n(item, ord)
        on n.item ->> 'key' = o.item ->> 'key'
    )
  end;
$$;

-- 本人が書き換えてよいのは自己評価の欄だけ。
-- （列ごとの権限は RLS では表せないため、profiles_guard と同じくトリガーで戻す）
create or replace function public.evaluations_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.can_backoffice() then
    return new;
  end if;
  -- 確定後は本人も触れない
  if old.status = 'finalized' then
    return old;
  end if;
  new.target_id        := old.target_id;
  new.target_name      := old.target_name;
  new.period           := old.period;
  new.status           := old.status;
  new.reviewer_name    := old.reviewer_name;
  new.reviewer_comment := old.reviewer_comment;
  new.total_score      := old.total_score;
  new.finalized_at     := old.finalized_at;
  -- items は自己採点だけ本人が入れる。評価者の点数を消させないため、
  -- 評価者側の値は必ず元の行から復元する（差し替えは src/lib/evaluation.ts と対）
  new.items := public.merge_self_scores(old.items, new.items);
  return new;
end;
$$;

drop trigger if exists evaluations_guard_trigger on public.evaluations;
create trigger evaluations_guard_trigger
  before update on public.evaluations
  for each row execute function public.evaluations_guard();

-- =============================================================
-- ロールバック
-- drop table if exists public.evaluations;
-- drop table if exists public.expenses;
-- drop table if exists public.attendance_records;
-- drop function if exists public.evaluations_guard();
-- drop function if exists public.merge_self_scores(jsonb, jsonb);
-- drop function if exists public.expenses_guard();
-- =============================================================
