-- =============================================================
-- 0002_scheduling — 日程調整の高度化
--   * schedule_polls に種別カラム kind を追加（顧客Web会議予約リンク用）
--   * 公開予約ページ /invite/[id] から匿名（anon）で候補を確認・予約できるよう
--     schedule_polls に限定して anon の SELECT / UPDATE を許可する
-- 既存データ・既存ポリシーには影響しない冪等なマイグレーション。
-- =============================================================

-- ---------- 種別カラム ----------
-- "group"（既定/未設定）= 通常のチーム内調整 / "customer" = 顧客予約リンク
alter table public.schedule_polls
  add column if not exists kind text not null default 'group';

-- ---------- 公開予約リンク用の匿名アクセス ----------
-- 顧客はログインせずに /invite/[id] から候補を閲覧し、1つ選んで予約（confirm）する。
-- そのため schedule_polls のみ anon ロールに閲覧・更新を許可する（他テーブルは従来どおり）。
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'schedule_polls'
      and policyname = 'anon_select_schedule_polls'
  ) then
    create policy "anon_select_schedule_polls"
      on public.schedule_polls for select to anon using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'schedule_polls'
      and policyname = 'anon_update_schedule_polls'
  ) then
    create policy "anon_update_schedule_polls"
      on public.schedule_polls for update to anon using (true) with check (true);
  end if;
end $$;
