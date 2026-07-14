-- =============================================================
-- 0003_profiles_autocreate — 認証ユーザーを profiles に自動登録
--   Supabase Auth でサインアップした際に public.profiles へ行を作成し、
--   担当者/メンバー選択に実ユーザーが表示されるようにする。
--   ※ アプリ側（use-user.tsx）でもログイン時に upsert しているため、
--     このトリガーは「正攻法のサーバー側フォールバック」。任意で適用。
-- 冪等（何度実行してもOK）。
-- =============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'メンバー')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 既存の認証ユーザーを profiles へバックフィル（未登録分のみ）
insert into public.profiles (id, name, email, role)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  u.email,
  coalesce(u.raw_user_meta_data->>'role', 'メンバー')
from auth.users u
on conflict (id) do nothing;
