-- M4: abuse reports, the moderation queue they feed, and the provenance that
-- distinguishes composed text from written text.

-- `pending_review` is content awaiting a decision. The CHECK was last widened
-- by M3, so it has to be rewritten again or the status would exist in Rust and
-- fail at the database.
alter table posts drop constraint if exists posts_moderation_status_check;
alter table posts
  add constraint posts_moderation_status_check
  check (moderation_status in (
    'draft', 'published', 'hidden', 'rejected', 'archived', 'pending_review'
  ));

-- Which drafting provider composed an entry, or NULL when a person wrote it.
-- The marker only means something because hand-written entries leave it empty.
alter table posts add column ai_provider text;

create table content_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  reporter_id uuid not null references users(id),
  category text not null,
  message text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references users(id),
  resolution text,
  deleted_at timestamptz,
  deleted_by uuid references users(id),
  check (category in (
    'spam', 'harassment', 'privacy_violation', 'misinformation', 'illegal', 'other'
  )),
  check (resolution is null or resolution in ('upheld', 'dismissed')),
  -- A resolution and its resolver arrive together or not at all, so a closed
  -- report can never be missing the person accountable for closing it.
  check ((resolved_at is null) = (resolved_by is null)),
  check ((resolved_at is null) = (resolution is null))
);

-- One *open* report per reporter and post. Partial rather than total: a report
-- control must not double as a flood button, but once a report is closed the
-- same person must be free to raise the content again if it recurs.
create unique index content_reports_one_open_per_reporter
  on content_reports(post_id, reporter_id)
  where resolved_at is null;

-- The queue scans open reports and groups them by content.
create index content_reports_open_idx
  on content_reports(created_at)
  where resolved_at is null and deleted_at is null;

create index content_reports_post_idx on content_reports(post_id);
