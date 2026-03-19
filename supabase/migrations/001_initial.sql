-- ============================================
-- 오늘부터 부자 - Supabase DB Schema
-- toss_user_key 기반 (Supabase Auth 미사용)
-- ============================================

create table if not exists profiles (
  toss_user_key  text primary key,
  nickname       text,
  goal           text,
  role_model     text,
  wakeup         text,
  sleep          text,
  xp             integer      default 0,
  premium        boolean      default false,
  premium_plan   text,
  premium_expires_at timestamptz,
  created_at     timestamptz  default now(),
  updated_at     timestamptz  default now()
);

create table if not exists habits (
  toss_user_key  text  references profiles(toss_user_key) on delete cascade,
  id             text  not null,
  name           text  not null,
  category       text,
  icon           text,
  enabled        boolean     default true,
  sort_order     integer     default 0,
  created_at     timestamptz default now(),
  primary key (toss_user_key, id)
);

create table if not exists records (
  toss_user_key  text  references profiles(toss_user_key) on delete cascade,
  date           text  not null,
  habit_id       text  not null,
  done           boolean     default false,
  done_at        timestamptz,
  primary key (toss_user_key, date, habit_id)
);

-- 인덱스
create index if not exists idx_habits_user   on habits(toss_user_key);
create index if not exists idx_records_user  on records(toss_user_key);
create index if not exists idx_records_date  on records(toss_user_key, date);
