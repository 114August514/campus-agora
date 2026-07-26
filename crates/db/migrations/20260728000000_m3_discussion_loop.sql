-- M3: discussions, replies, and the traceable link from a discussion into the
-- archive. Discussions reuse the `posts` spine (`post_type = 'discussion'`), so
-- moderation, soft delete, and the visibility predicate carry over unchanged.

-- `archived` is a new terminal-but-readable state. The initial CHECK predates
-- it, so it has to be widened or every archive write would fail at the
-- database while succeeding in Rust.
alter table posts drop constraint if exists posts_moderation_status_check;
alter table posts
  add constraint posts_moderation_status_check
  check (moderation_status in ('draft', 'published', 'hidden', 'rejected', 'archived'));

create table comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  author_id uuid not null references users(id),
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references users(id)
);

-- Every read of a thread filters by its discussion and orders by time.
create index comments_post_idx on comments(post_id, created_at);

-- The accepted answer is a column rather than a flag on the reply, so "at most
-- one per discussion" is guaranteed by the schema instead of by convention.
alter table posts add column accepted_comment_id uuid references comments(id) on delete set null;

-- Provenance: which discussion (and optionally which reply) an archive entry
-- was drawn from. `source_author_id` records who wrote the quoted text, which
-- is not the entry's author when a reply was promoted.
create table archive_sources (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references posts(id) on delete cascade,
  source_post_id uuid not null references posts(id) on delete cascade,
  source_comment_id uuid references comments(id) on delete set null,
  source_author_id uuid not null references users(id),
  created_at timestamptz not null default now(),
  -- One provenance record per (entry, source). Promoting the same reply into
  -- the same entry twice is a duplicate, not a second source.
  unique (entry_id, source_post_id, source_comment_id)
);

-- Queried from both ends: an entry lists where it came from, a discussion
-- lists what it produced.
create index archive_sources_entry_idx on archive_sources(entry_id);
create index archive_sources_source_idx on archive_sources(source_post_id);
