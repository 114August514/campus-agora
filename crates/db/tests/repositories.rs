use std::path::Path;
use std::sync::Arc;

use campus_agora_application::ports::{
    AuditEventRepository, NewAuditEvent, NewSession, NewUser, OrganizationRepository,
    SessionRepository, UserRepository,
};
use campus_agora_db::{PgAuthStore, MIGRATIONS_DIR};
use campus_agora_domain::{AuthProviderKind, SystemRole};
use chrono::{Duration, Utc};
use uuid::Uuid;

/// Runs only when DATABASE_URL points at a disposable PostgreSQL instance.
/// CI provides one; locally use the dockerized PostgreSQL 16 from the docs.
#[tokio::test]
async fn pg_repositories_cover_the_m1_identity_lifecycle() {
    let Ok(database_url) = std::env::var("DATABASE_URL") else {
        eprintln!("skipping pg repository test: DATABASE_URL is not set");
        return;
    };

    let pool = sqlx::postgres::PgPoolOptions::new()
        .max_connections(2)
        .connect(&database_url)
        .await
        .expect("connect to test database");

    let migrations = Path::new(env!("CARGO_MANIFEST_DIR")).join(MIGRATIONS_DIR);
    sqlx::migrate::Migrator::new(migrations)
        .await
        .expect("load migrations")
        .run(&pool)
        .await
        .expect("run migrations");

    let store = Arc::new(PgAuthStore::new(pool.clone()));
    let unique = Uuid::new_v4().simple().to_string();
    let now = Utc::now();

    // Users upsert by provider subject and stay stable across logins.
    let subject_hash = format!("test-subject-{unique}");
    let first = store
        .upsert(NewUser {
            auth_provider: AuthProviderKind::MockCampus,
            provider_subject_hash: subject_hash.clone(),
            display_name: "测试用户".to_owned(),
            system_role: SystemRole::Student,
        })
        .await
        .expect("insert user");
    let second = store
        .upsert(NewUser {
            auth_provider: AuthProviderKind::MockCampus,
            provider_subject_hash: subject_hash.clone(),
            display_name: "测试用户改名".to_owned(),
            system_role: SystemRole::Student,
        })
        .await
        .expect("upsert user again");

    assert_eq!(first.id, second.id);
    assert_eq!(second.display_name, "测试用户改名");

    let loaded = store
        .find_by_id(first.id)
        .await
        .expect("load user")
        .expect("user exists");
    assert_eq!(loaded.system_role, SystemRole::Student);
    assert_eq!(loaded.auth_provider, AuthProviderKind::MockCampus);

    // Sessions store hashes with expiry and revocation.
    let token_hash = format!("test-token-hash-{unique}");
    let session = store
        .insert(NewSession {
            user_id: first.id,
            token_hash: token_hash.clone(),
            created_at: now,
            expires_at: now + Duration::hours(24),
        })
        .await
        .expect("insert session");

    let found = store
        .find_by_token_hash(&token_hash)
        .await
        .expect("find session")
        .expect("session exists");
    assert_eq!(found.id, session.id);
    assert_eq!(found.user_id, first.id);
    assert!(found.revoked_at.is_none());

    store
        .revoke(session.id, now + Duration::minutes(1))
        .await
        .expect("revoke session");

    let revoked = store
        .find_by_token_hash(&token_hash)
        .await
        .expect("find revoked session")
        .expect("session still readable");
    assert!(revoked.revoked_at.is_some());

    assert!(store
        .find_by_token_hash("missing-token-hash")
        .await
        .expect("query missing session")
        .is_none());

    // Organizations upsert by slug; memberships stay unique per user.
    let slug = format!("test-org-{unique}");
    let organization = store
        .upsert_organization(&slug, "测试组织")
        .await
        .expect("insert organization");
    let organization_again = store
        .upsert_organization(&slug, "测试组织")
        .await
        .expect("upsert organization again");
    assert_eq!(organization.id, organization_again.id);

    store
        .ensure_membership(organization.id, first.id)
        .await
        .expect("create membership");
    store
        .ensure_membership(organization.id, first.id)
        .await
        .expect("membership is idempotent");

    let memberships = store
        .list_memberships_for_user(first.id)
        .await
        .expect("list memberships");
    assert_eq!(memberships.len(), 1);
    assert_eq!(memberships[0].organization_id, organization.id);
    assert_eq!(memberships[0].slug, slug);
    assert_eq!(memberships[0].name, "测试组织");

    // Audit events persist without raw secret material.
    store
        .record(NewAuditEvent {
            actor_id: Some(first.id),
            action: format!("test.audit-{unique}"),
            resource_type: "session".to_owned(),
            resource_id: Some(session.id.into_uuid()),
            metadata: serde_json::json!({ "requestId": "req-db-test" }),
        })
        .await
        .expect("record audit event");

    let (count,): (i64,) = sqlx::query_as("select count(*) from audit_events where action = $1")
        .bind(format!("test.audit-{unique}"))
        .fetch_one(&pool)
        .await
        .expect("count audit events");
    assert_eq!(count, 1);
}
