-- Archive metadata extends the existing posts spine rather than forking a
-- second table, so discussion posts (M3) keep the same schema, revisions, and
-- moderation vocabulary.
alter table posts add column category text not null default 'other';
alter table posts add column applicable_audience text not null default 'all_students';
alter table posts add column source_kind text not null default 'unspecified';
alter table posts add column source_reference text;

alter table posts add constraint posts_category_check check (
  category in ('onboarding', 'campus_life', 'academics', 'organizations', 'procedures', 'other')
);
alter table posts add constraint posts_audience_check check (
  applicable_audience in ('all_students', 'new_students', 'undergraduate', 'graduate', 'organization_members')
);
alter table posts add constraint posts_source_kind_check check (
  source_kind in ('firsthand_experience', 'official_announcement', 'group_chat', 'discussion', 'unspecified')
);

-- Assigned maintainers carry the `Maintainer` resource role from the
-- permission matrix. Membership is per entry, not global.
create table post_maintainers (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id),
  user_id uuid not null references users(id),
  assigned_by uuid references users(id),
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

-- A correction is a report against a published entry, not an edit. Resolving
-- one stays an explicit maintainer action so content never changes silently.
create table post_corrections (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id),
  reporter_id uuid not null references users(id),
  message text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references users(id),
  check ((resolved_at is null) = (resolved_by is null))
);

create index posts_kind_status_idx on posts(post_type, moderation_status);
create index posts_tags_idx on posts using gin (tags);
create index posts_category_idx on posts(category);
create index posts_updated_at_idx on posts(updated_at desc);
create index post_maintainers_user_idx on post_maintainers(user_id);
create index post_corrections_post_idx on post_corrections(post_id);
create index post_corrections_open_idx on post_corrections(post_id) where resolved_at is null;
