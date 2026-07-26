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
    assert!(normalized.contains("create index organization_memberships_user_idx"));
}
