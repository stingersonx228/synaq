-- Synaq MVP schema. All access goes through server route handlers using the service-role key:
-- RLS is enabled on every table and no policies are created for anon/authenticated.

create extension if not exists pgcrypto;

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  name text not null check (char_length(name) between 1 and 60),
  teacher_token_hash text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 24),
  created_at timestamptz not null default now(),
  unique (class_id, nickname)
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students on delete cascade,
  case_id text not null,
  type_id text not null,
  outcome text not null check (outcome in ('solved', 'wrong_line', 'false_accusation', 'missed_clean', 'failed_proof')),
  score int not null check (score between 0 and 100),
  stars int not null check (stars between 0 and 3),
  hints_used int not null default 0 check (hints_used between 0 and 3),
  cause_ok boolean,
  refute_tries int not null default 0 check (refute_tries between 0 and 3),
  lives_lost int not null default 0 check (lives_lost between 0 and 3),
  created_at timestamptz not null default now()
);

create table if not exists public.judge_cache (
  key text primary key,
  verdict boolean not null,
  created_at timestamptz not null default now()
);

create table if not exists public.llm_calls (
  id bigserial primary key,
  student_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists attempts_student_id_idx on public.attempts (student_id);
create index if not exists attempts_created_at_idx on public.attempts (created_at);
create index if not exists students_class_id_idx on public.students (class_id);
create index if not exists llm_calls_student_created_idx on public.llm_calls (student_id, created_at);

alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.attempts enable row level security;
alter table public.judge_cache enable row level security;
alter table public.llm_calls enable row level security;

-- Defense in depth: the public API roles get no table privileges at all.
revoke all on public.classes, public.students, public.attempts, public.judge_cache, public.llm_calls
  from anon, authenticated;
revoke all on sequence public.llm_calls_id_seq from anon, authenticated;
