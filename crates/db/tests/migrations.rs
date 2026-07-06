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
