-- ─────────────────────────────────────────────────────────
-- ShareDrop — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────

-- Rooms table (stores room state + file metadata as JSONB)
create table if not exists public.rooms (
  code        varchar(6)  primary key,
  files       jsonb       not null default '[]',
  created_at  bigint      not null,  -- Unix ms timestamp
  expires_at  bigint      not null   -- Unix ms timestamp
);

-- Index to speed up expiry cleanup queries
create index if not exists idx_rooms_expires_at
  on public.rooms (expires_at);

-- Disable Row Level Security (we use SERVICE_ROLE_KEY server-side only)
alter table public.rooms disable row level security;
