-- =============================================================
-- 0013: 銀行・支店マスタの権限を「登録」と「削除」で分ける
--
-- これまで銀行・支店の書き込みは is_hq()（本部社員全員）で、
-- 追加も削除も同じ扱いだった。一方で画面は master_edit
-- （経営・管理部・マネージャー）でしか登録ボタンを出しておらず、
-- 「消せるのに足せない」というねじれた状態になっていた。
--
-- 現場が自分の回る支店を自分で登録できることを優先し、
--   追加・更新 … 本部社員全員（is_hq）
--   削除       … マネージャー以上（can_master）
-- に分ける。削除は取り返しがつかず、支店を消すと紐づくアポ・活動ログの
-- 参照も外れるため、ここだけ絞る。
--
-- ※ 担当者の振り替えは列単位の話なので RLS では表せない。
--   一括振り替えのUIはマネージャー以上にのみ出す（画面側の導線整理）。
-- =============================================================

/** 銀行・支店マスタを削除できる（経営・管理部・マネージャー） */
create or replace function public.can_master()
returns boolean language sql stable as $$
  select public.my_role() in ('executive','backoffice','manager');
$$;

-- ---------- 銀行 ----------
-- 旧: banks_write（for all / is_hq）を、追加・更新と削除に分ける
drop policy if exists banks_write on public.banks;

drop policy if exists banks_insert on public.banks;
create policy banks_insert on public.banks
  for insert to authenticated with check (public.is_hq());

drop policy if exists banks_update on public.banks;
create policy banks_update on public.banks
  for update to authenticated
  using (public.is_hq()) with check (public.is_hq());

drop policy if exists banks_delete on public.banks;
create policy banks_delete on public.banks
  for delete to authenticated using (public.can_master());

-- ---------- 支店 ----------
-- 追加・更新は 0006 のまま（is_hq）。削除だけ絞る。
drop policy if exists branches_delete on public.branches;
create policy branches_delete on public.branches
  for delete to authenticated using (public.can_master());

-- =============================================================
-- ロールバック
-- drop policy if exists banks_insert on public.banks;
-- drop policy if exists banks_update on public.banks;
-- drop policy if exists banks_delete on public.banks;
-- create policy banks_write on public.banks
--   for all to authenticated using (public.is_hq()) with check (public.is_hq());
-- drop policy if exists branches_delete on public.branches;
-- create policy branches_delete on public.branches
--   for delete to authenticated using (public.is_hq());
-- drop function if exists public.can_master();
-- =============================================================
