create table organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references users(id)
);

create table organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  user_id uuid not null references users(id),
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

-- Sessions hold hashed token material only; the plaintext token never
-- reaches persistence. Liveness rules (expiry, revocation) are applied by
-- the application layer.
create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index sessions_user_idx on sessions(user_id);
create index sessions_active_idx on sessions(token_hash) where revoked_at is null;
create index organization_memberships_user_idx on organization_memberships(user_id);
create index organization_memberships_org_idx on organization_memberships(organization_id);
