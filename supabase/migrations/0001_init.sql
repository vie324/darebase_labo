-- =============================================================
-- DareBase — 初期スキーマ
-- Supabase ダッシュボードの SQL Editor でこのファイルを実行するか、
-- `supabase db push` で適用してください。
-- =============================================================

create extension if not exists "pgcrypto";

-- ---------- プロフィール ----------
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null default '',
  role text not null default 'メンバー',
  department text not null default '',
  color text not null default 'indigo',
  created_at timestamptz not null default now()
);

-- ---------- スケジュール ----------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean not null default false,
  category text not null default 'other',
  location text not null default '',
  owner_name text not null default '',
  created_at timestamptz not null default now()
);

-- ---------- 案件 ----------
create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text not null default '',
  contact_name text not null default '',
  stage text not null default 'lead',
  amount bigint not null default 0,
  probability int not null default 0,
  expected_close text not null default '',
  owner_name text not null default '',
  next_action text not null default '',
  memo text not null default '',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.deal_activities (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  type text not null default 'note',
  note text not null default '',
  author_name text not null default '',
  created_at timestamptz not null default now()
);

-- ---------- タスク ----------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  status text not null default 'todo',
  priority text not null default 'mid',
  due_date text not null default '',
  assignee_name text not null default '',
  related_deal text not null default '',
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- 名刺 ----------
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_kana text not null default '',
  company text not null default '',
  department text not null default '',
  title text not null default '',
  email text not null default '',
  phone text not null default '',
  mobile text not null default '',
  address text not null default '',
  website text not null default '',
  tags text[] not null default '{}',
  memo text not null default '',
  card_image_url text not null default '',
  exchanged_at text not null default '',
  owner_name text not null default '',
  created_at timestamptz not null default now()
);

-- ---------- ナレッジ ----------
create table if not exists public.knowledge (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null default '',
  category text not null default 'other',
  tags text[] not null default '{}',
  author_name text not null default '',
  likes int not null default 0,
  views int not null default 0,
  pinned boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ---------- 営業資料 ----------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'other',
  file_url text not null default '',
  file_type text not null default '',
  size_kb int not null default 0,
  description text not null default '',
  tags text[] not null default '{}',
  uploaded_by text not null default '',
  downloads int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- ロープレ ----------
create table if not exists public.scripts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  scenario text not null default '',
  content text not null default '',
  category text not null default '',
  author_name text not null default '',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.roleplay_sessions (
  id uuid primary key default gen_random_uuid(),
  script_id text not null default '',
  script_title text not null default '',
  user_name text not null default '',
  mode text not null default 'audio',
  duration_sec int not null default 0,
  transcript text not null default '',
  self_note text not null default '',
  feedbacks jsonb not null default '[]',
  media_url text not null default '',
  created_at timestamptz not null default now()
);

-- ---------- 勉強会 ----------
create table if not exists public.trainings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  tool_name text not null default '',
  category text not null default '',
  held_at text not null default '',
  presenter text not null default '',
  summary text not null default '',
  content text not null default '',
  video_url text not null default '',
  material_url text not null default '',
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------- チャット ----------
create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  emoji text not null default '💬',
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  author_name text not null default '',
  content text not null default '',
  created_at timestamptz not null default now()
);

-- ---------- 掲示板 ----------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null default '',
  category text not null default 'free',
  author_name text not null default '',
  pinned boolean not null default false,
  likes int not null default 0,
  comments jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- ---------- 日程調整 ----------
create table if not exists public.schedule_polls (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  organizer text not null default '',
  location text not null default '',
  duration_min int not null default 60,
  candidates jsonb not null default '[]',
  responses jsonb not null default '[]',
  status text not null default 'open',
  confirmed_index int,
  created_at timestamptz not null default now()
);

-- =============================================================
-- RLS: 認証済みユーザーにフルアクセスを付与（社内ツール前提）。
-- より細かい権限管理が必要になったらポリシーを絞ること。
-- =============================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles','events','deals','deal_activities','tasks','contacts',
    'knowledge','documents','scripts','roleplay_sessions','trainings',
    'channels','messages','posts','schedule_polls'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "authenticated_all_%s" on public.%I for all to authenticated using (true) with check (true)',
      t, t
    );
  end loop;
end $$;

-- チャット・掲示板は Realtime を有効化
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.channels;
alter publication supabase_realtime add table public.posts;

-- =============================================================
-- Storage: 添付ファイル用バケット
-- =============================================================
insert into storage.buckets (id, name, public)
values ('files', 'files', true)
on conflict (id) do nothing;

create policy "authenticated_upload_files"
on storage.objects for insert to authenticated
with check (bucket_id = 'files');

create policy "authenticated_update_files"
on storage.objects for update to authenticated
using (bucket_id = 'files');

create policy "public_read_files"
on storage.objects for select
using (bucket_id = 'files');
