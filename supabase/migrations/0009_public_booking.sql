-- =============================================================
-- 0009: 公開予約リンク（/invite/[id]）の匿名アクセスを最小化
--
-- ■ 見つかった問題
-- 0002 が公開予約ページのために anon ロールへ
--   anon_select_schedule_polls : for select using (true)
--   anon_update_schedule_polls : for update using (true) with check (true)
-- を与えていた。これは「顧客用の1件」ではなく **schedule_polls 全行** が対象で、
-- Supabase の anon キー（クライアントに配布される公開値）だけで
--   - 社内の日程調整も含む全ポーリングの閲覧（タイトル・主催者・
--     回答者の氏名やコメントなど）
--   - 任意のポーリングの上書き（候補の改ざん・回答の消去・勝手な確定）
-- が誰でもできる状態だった。0006 で入れ替えたのは authenticated 向けの
-- ポリシーだけなので、この2つは残っていた。
--
-- ■ 対処
-- テーブルへの匿名アクセスを廃止し、公開ページに必要な操作だけを
-- SECURITY DEFINER 関数として公開する。
--   get_customer_poll  : 顧客用ポーリング1件の**公開してよい項目だけ**を返す
--                        （responses = 他の回答者の氏名・連絡先は返さない）
--   book_customer_slot : 候補を1つ選んで確定する。顧客用かつ募集中のものに限る
-- 予約リンクの URL は UUID なので、リンクを知っている人だけが到達できる
-- （Calendly 等と同じモデル）。
-- =============================================================

-- ---------- 1. 全開放の匿名ポリシーを削除 ----------
drop policy if exists "anon_select_schedule_polls" on public.schedule_polls;
drop policy if exists "anon_update_schedule_polls" on public.schedule_polls;

-- ---------- 2. 閲覧: 顧客用ポーリングの公開項目のみ ----------
create or replace function public.get_customer_poll(p_id uuid)
returns table (
  id uuid,
  title text,
  description text,
  organizer text,
  location text,
  duration_min int,
  candidates jsonb,
  status text,
  confirmed_index int
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.title, p.description, p.organizer, p.location,
         p.duration_min, p.candidates, p.status, p.confirmed_index
  from public.schedule_polls p
  where p.id = p_id
    and p.kind = 'customer';
$$;

-- ---------- 3. 予約: 候補を1つ選んで確定 ----------
-- 返り値: {"ok": true, "confirmed_index": n} / {"ok": false, "error": "..."}
create or replace function public.book_customer_slot(
  p_id uuid,
  p_name text,
  p_email text,
  p_index int
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  poll public.schedule_polls%rowtype;
  answers jsonb := '[]'::jsonb;
  slot_count int;
  i int;
  clean_name text := left(btrim(coalesce(p_name, '')), 100);
  clean_email text := left(btrim(coalesce(p_email, '')), 200);
begin
  if clean_name = '' then
    return jsonb_build_object('ok', false, 'error', 'name_required');
  end if;

  select * into poll
  from public.schedule_polls
  where id = p_id and kind = 'customer'
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if poll.status <> 'open' then
    return jsonb_build_object('ok', false, 'error', 'already_confirmed');
  end if;

  slot_count := jsonb_array_length(coalesce(poll.candidates, '[]'::jsonb));
  if p_index is null or p_index < 0 or p_index >= slot_count then
    return jsonb_build_object('ok', false, 'error', 'invalid_slot');
  end if;

  -- 選んだ候補だけ "ok"、他は "ng"（アプリの buildCustomerResponse と同じ形）
  for i in 0 .. slot_count - 1 loop
    answers := answers || to_jsonb(case when i = p_index then 'ok' else 'ng' end);
  end loop;

  update public.schedule_polls
     set status = 'confirmed',
         confirmed_index = p_index,
         responses = coalesce(responses, '[]'::jsonb) || jsonb_build_array(
           jsonb_build_object(
             'name', clean_name,
             'answers', answers,
             'comment', case when clean_email = '' then '' else '連絡先: ' || clean_email end,
             'created_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
           )
         )
   where id = p_id;

  return jsonb_build_object('ok', true, 'confirmed_index', p_index);
end;
$$;

-- ---------- 4. 実行権限 ----------
-- 関数の実行だけを許可する（テーブルへの直接アクセスは引き続き不可）。
revoke all on function public.get_customer_poll(uuid) from public;
revoke all on function public.book_customer_slot(uuid, text, text, int) from public;
grant execute on function public.get_customer_poll(uuid) to anon, authenticated;
grant execute on function public.book_customer_slot(uuid, text, text, int) to anon, authenticated;

-- =============================================================
-- ロールバック（必要な場合。※全開放に戻るため推奨しない）
--
-- drop function if exists public.book_customer_slot(uuid, text, text, int);
-- drop function if exists public.get_customer_poll(uuid);
-- create policy "anon_select_schedule_polls" on public.schedule_polls
--   for select to anon using (true);
-- create policy "anon_update_schedule_polls" on public.schedule_polls
--   for update to anon using (true) with check (true);
-- =============================================================
