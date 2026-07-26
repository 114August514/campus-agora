use std::fs;
use std::path::Path;

#[test]
fn initial_migration_defines_audit_events_and_soft_delete_fields() {
    let migration = fs::read_to_string(
        Path::new(env!("CARGO_MANIFEST_DIR")).join("migrations/20260706000000_init.sql"),
    )
    .expect("initial migration must exist");
    let normalized = migration.to_lowercase();

    assert!(normalized.contains("create table audit_events"));
    assert!(normalized.contains("create table users"));
    assert!(normalized.contains("create table posts"));
    assert!(normalized.contains("deleted_at timestamptz"));
    assert!(normalized.contains("deleted_by uuid"));
    assert!(!normalized.contains("identity_card"));
    assert!(!normalized.contains("plain_password"));
}

#[test]
fn m1_migration_defines_identity_and_session_tables() {
    let migration = fs::read_to_string(
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("migrations/20260726000000_m1_identity_sessions.sql"),
    )
    .expect("m1 identity migration must exist");
    let normalized = migration.to_lowercase();

    assert!(normalized.contains("create table organizations"));
    assert!(normalized.contains("create table organization_memberships"));
    assert!(normalized.contains("create table sessions"));

    // Organizations stay soft-deletable and addressable by a stable slug.
    assert!(normalized.contains("slug text not null"));
    assert!(normalized.contains("unique (organization_id, user_id)"));

    // Sessions store hashed token material only, with expiry and revocation.
    assert!(normalized.contains("token_hash text not null"));
    assert!(normalized.contains("expires_at timestamptz not null"));
    assert!(normalized.contains("revoked_at timestamptz"));
    assert!(normalized.contains("unique") && normalized.contains("token_hash"));
    assert!(!normalized.contains("token text"));
    assert!(!normalized.contains("plain_token"));

    assert!(normalized.contains("create index sessions_user_idx"));
    assert!(normalized.contains("create index sessions_expires_at_idx"));
    assert!(normalized.contains("create index organization_memberships_user_idx"));
}

#[test]
fn m2_migration_defines_archive_metadata_maintainers_and_corrections() {
    let migration = fs::read_to_string(
        Path::new(env!("CARGO_MANIFEST_DIR")).join("migrations/20260727000000_m2_archive_core.sql"),
    )
    .expect("m2 archive migration must exist");
    let normalized = migration.to_lowercase();

    // Archive metadata extends the existing posts spine rather than forking a
    // second table, so discussion (M3) stays on the same schema.
    for column in [
        "category",
        "applicable_audience",
        "source_kind",
        "source_reference",
    ] {
        assert!(
            normalized.contains(&format!("add column {column}")),
            "posts must gain a {column} column"
        );
    }

    assert!(normalized.contains("create table post_maintainers"));
    assert!(normalized.contains("unique (post_id, user_id)"));

    assert!(normalized.contains("create table post_corrections"));
    assert!(normalized.contains("resolved_at timestamptz"));
    assert!(normalized.contains("resolved_by uuid references users(id)"));

    // Listing filters on kind plus status, on tags, and on category, so each
    // needs an index rather than a sequential scan over every post.
    assert!(normalized.contains("create index posts_kind_status_idx"));
    assert!(normalized.contains("create index posts_tags_idx"));
    assert!(normalized.contains("using gin"));
    assert!(normalized.contains("create index post_corrections_post_idx"));
}

#[test]
fn m3_migration_defines_the_discussion_loop() {
    let migration = fs::read_to_string(
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("migrations/20260728000000_m3_discussion_loop.sql"),
    )
    .expect("m3 discussion migration must exist");
    let normalized = migration.to_lowercase();

    assert!(normalized.contains("create table comments"));
    assert!(normalized.contains("create table archive_sources"));

    // Replies are soft-deletable like every other piece of user content, so a
    // removed reply stays recoverable and auditable.
    assert!(normalized.contains("deleted_at timestamptz"));
    assert!(normalized.contains("deleted_by uuid"));

    // The accepted answer is a column on the discussion, so "exactly one" is a
    // property of the schema rather than something the service has to maintain.
    assert!(normalized.contains("accepted_comment_id"));

    // The link is what makes the loop traceable, and it is queried from both
    // ends, so both ends are indexed.
    assert!(normalized.contains("archive_sources_entry_idx"));
    assert!(normalized.contains("archive_sources_source_idx"));
    assert!(normalized.contains("comments_post_idx"));

    // One source may be recorded once per entry; promoting the same reply
    // twice into one entry is a duplicate, not a second provenance record.
    assert!(normalized.contains("unique"));
}

/// `archived` is rejected by the initial CHECK constraint, so the migration has
/// to widen it. Without this the status exists in Rust and fails at the
/// database — the sort of split-brain that only shows up in production.
#[test]
fn m3_migration_admits_the_archived_status() {
    let migration = fs::read_to_string(
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("migrations/20260728000000_m3_discussion_loop.sql"),
    )
    .expect("m3 discussion migration must exist");
    let normalized = migration.to_lowercase();

    assert!(normalized.contains("drop constraint"));
    assert!(normalized.contains("'archived'"));
}

#[test]
fn m4_migration_defines_reports_and_ai_provenance() {
    let migration = fs::read_to_string(
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("migrations/20260729000000_m4_moderation_reports.sql"),
    )
    .expect("m4 moderation migration must exist");
    let normalized = migration.to_lowercase();

    assert!(normalized.contains("create table content_reports"));

    // Reports are user content and stay recoverable like every other kind.
    assert!(normalized.contains("deleted_at timestamptz"));
    assert!(normalized.contains("deleted_by uuid"));

    // A report control must not double as a flood button, but a reporter must
    // be free to file again once the first one is closed — so the uniqueness
    // is partial, over open reports only.
    assert!(normalized.contains("create unique index"));
    assert!(normalized.contains("where resolved_at is null"));

    // The queue reads by risk and age across all open reports.
    assert!(normalized.contains("content_reports_open_idx"));
    assert!(normalized.contains("content_reports_post_idx"));

    // Composed text has to be distinguishable from written text.
    assert!(normalized.contains("ai_provider"));
}

/// `pending_review` is rejected by the CHECK constraint M3 last widened, so
/// this migration has to widen it again. Without it the status exists in Rust
/// and fails at the database.
#[test]
fn m4_migration_admits_the_pending_review_status() {
    let migration = fs::read_to_string(
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("migrations/20260729000000_m4_moderation_reports.sql"),
    )
    .expect("m4 moderation migration must exist");
    let normalized = migration.to_lowercase();

    assert!(normalized.contains("drop constraint"));
    assert!(normalized.contains("'pending_review'"));
    // Every earlier status has to survive the rewrite.
    for status in [
        "'draft'",
        "'published'",
        "'hidden'",
        "'rejected'",
        "'archived'",
    ] {
        assert!(
            normalized.contains(status),
            "the widened constraint must keep {status}"
        );
    }
}
