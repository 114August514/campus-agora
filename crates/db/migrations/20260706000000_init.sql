create extension if not exists pgcrypto;

create table users (
  id uuid primary key default gen_random_uuid(),
  auth_provider text not null,
  provider_subject_hash text not null,
  display_name text not null,
  system_role text not null default 'student',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references users(id),
  unique (auth_provider, provider_subject_hash)
);

create table posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references users(id),
  post_type text not null,
  moderation_status text not null default 'draft',
  title text not null,
  body text not null,
  summary text,
  tags text[] not null default '{}',
  current_revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references users(id),
  check (post_type in ('discussion', 'knowledge')),
  check (moderation_status in ('draft', 'published', 'hidden', 'rejected'))
);

create table post_revisions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id),
  revision integer not null,
  editor_id uuid not null references users(id),
  title text not null,
  body text not null,
  summary text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (post_id, revision)
);

create table audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references users(id),
  action text not null,
  resource_type text not null,
  resource_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index users_active_idx on users(id) where deleted_at is null;
create index posts_active_idx on posts(id) where deleted_at is null;
create index posts_author_idx on posts(author_id);
create index audit_events_resource_idx on audit_events(resource_type, resource_id);
