-- =============================================================
-- 0008: 添付ファイルを非公開バケットへ
--
-- ■ 背景
-- 名刺画像・営業資料・ロープレ録音は公開バケット "files" に置かれ、
-- 公開URLをそのまま DB に保存していた。公開URLは**ログイン不要で誰でも読める**ため、
-- 代理店にアカウントを配る構成（0006）では許容できない。
--
-- ■ 変更
-- - 非公開バケット "attachments" を作成（請求書 "invoices" と同じ方式）
-- - DB には Storage のパスを保存し、表示時に署名URLを発行する
--   （src/lib/supabase.ts の storeFile / resolveFileUrl、src/lib/use-file-url.ts）
-- - 公開バケット "files" を非公開に切り替え、公開読み取りポリシーを削除
--
-- ■ 注意
-- すでに "files" にアップロード済みのファイルがある場合、DB に保存された
-- 公開URLは無効になる（該当ファイルは再アップロードが必要）。
-- 本番のデータ投入前に適用すること。
-- =============================================================

-- ---------- 非公開バケット ----------
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'authenticated_select_attachments'
  ) then
    create policy "authenticated_select_attachments"
      on storage.objects for select to authenticated
      using (bucket_id = 'attachments');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'authenticated_upload_attachments'
  ) then
    create policy "authenticated_upload_attachments"
      on storage.objects for insert to authenticated
      with check (bucket_id = 'attachments');
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'authenticated_update_attachments'
  ) then
    create policy "authenticated_update_attachments"
      on storage.objects for update to authenticated
      using (bucket_id = 'attachments');
  end if;
end $$;

-- ---------- 旧・公開バケットを閉じる ----------
-- 公開読み取りをやめ、ログイン済みユーザーだけが読めるようにする。
update storage.buckets set public = false where id = 'files';
drop policy if exists "public_read_files" on storage.objects;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'authenticated_select_files'
  ) then
    create policy "authenticated_select_files"
      on storage.objects for select to authenticated
      using (bucket_id = 'files');
  end if;
end $$;

-- =============================================================
-- ロールバック（必要な場合）
--
-- update storage.buckets set public = true where id = 'files';
-- create policy "public_read_files" on storage.objects for select using (bucket_id = 'files');
-- ※ その後 src/lib/supabase.ts を公開URL方式に戻す必要がある。
-- =============================================================
