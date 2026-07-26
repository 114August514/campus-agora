use std::sync::Arc;

use campus_agora_application::auth::{
    hash_opaque_token, AuditContext, AuthConfig, AuthCredential, AuthProvider, AuthService,
    MockCampusAuthProvider,
};
use campus_agora_application::memory::InMemoryAuthStore;
use campus_agora_application::ports::{NewSession, SessionRepository};
use campus_agora_application::ApplicationError;
use campus_agora_domain::{SystemRole, UserId};
use chrono::{Duration, TimeZone, Utc};

fn service_with_store() -> (AuthService, Arc<InMemoryAuthStore>) {
    let store = Arc::new(InMemoryAuthStore::default());
    let service = AuthService::new(
        Arc::new(MockCampusAuthProvider),
        store.clone(),
        store.clone(),
        store.clone(),
        store.clone(),
        AuthConfig {
            session_ttl: Duration::hours(24),
        },
    );

    (service, store)
}

fn now() -> chrono::DateTime<Utc> {
    Utc.with_ymd_and_hms(2026, 7, 26, 12, 0, 0).unwrap()
}

fn audit() -> AuditContext {
    AuditContext {
        request_id: Some("req-test-1".to_owned()),
    }
}

#[tokio::test]
async fn mock_provider_verifies_known_personas_and_rejects_unknown_ones() {
    let provider = MockCampusAuthProvider;

    let student = provider
        .verify(&AuthCredential::MockPersona("student".to_owned()))
        .await
        .unwrap();
    assert_eq!(student.system_role, SystemRole::Student);
    assert!(student.organization.is_none());

    let member = provider
        .verify(&AuthCredential::MockPersona(
            "organization_member".to_owned(),
        ))
        .await
        .unwrap();
    assert_eq!(member.system_role, SystemRole::OrganizationMember);
    assert!(member.organization.is_some());

    let moderator = provider
        .verify(&AuthCredential::MockPersona("moderator".to_owned()))
        .await
        .unwrap();
    assert_eq!(moderator.system_role, SystemRole::Moderator);

    let admin = provider
        .verify(&AuthCredential::MockPersona("admin".to_owned()))
        .await
        .unwrap();
    assert_eq!(admin.system_role, SystemRole::Admin);

    let unknown = provider
        .verify(&AuthCredential::MockPersona("professor".to_owned()))
        .await;
    assert!(matches!(unknown, Err(ApplicationError::Validation(_))));
}

#[tokio::test]
async fn login_returns_the_token_once_and_stores_only_its_hash() {
    let (service, store) = service_with_store();

    let outcome = service
        .login(
            &AuthCredential::MockPersona("student".to_owned()),
            now(),
            &audit(),
        )
        .await
        .unwrap();

    assert_eq!(outcome.token.len(), 64);
    assert!(outcome.token.chars().all(|c| c.is_ascii_hexdigit()));
    assert_eq!(outcome.expires_at, now() + Duration::hours(24));
    assert_eq!(outcome.user.system_role, SystemRole::Student);

    let sessions = store.sessions_snapshot();
    assert_eq!(sessions.len(), 1);
    assert_eq!(sessions[0].token_hash, hash_opaque_token(&outcome.token));
    assert_ne!(sessions[0].token_hash, outcome.token);
}

#[tokio::test]
async fn login_reuses_the_existing_user_for_the_same_persona() {
    let (service, store) = service_with_store();
    let credential = AuthCredential::MockPersona("student".to_owned());

    let first = service.login(&credential, now(), &audit()).await.unwrap();
    let second = service
        .login(&credential, now() + Duration::minutes(5), &audit())
        .await
        .unwrap();

    assert_eq!(first.user.id, second.user.id);
    assert_eq!(store.user_count(), 1);
    assert_eq!(store.sessions_snapshot().len(), 2);
}

#[tokio::test]
async fn login_provisions_the_demo_organization_membership_once() {
    let (service, store) = service_with_store();
    let credential = AuthCredential::MockPersona("organization_member".to_owned());

    let first = service.login(&credential, now(), &audit()).await.unwrap();
    let second = service
        .login(&credential, now() + Duration::minutes(5), &audit())
        .await
        .unwrap();

    assert_eq!(first.user.organizations.len(), 1);
    assert_eq!(first.user.organizations[0].slug, "demo-student-union");
    assert_eq!(second.user.organizations.len(), 1);
    assert_eq!(store.membership_count(), 1);

    let student = service
        .login(
            &AuthCredential::MockPersona("student".to_owned()),
            now(),
            &audit(),
        )
        .await
        .unwrap();
    assert!(student.user.organizations.is_empty());
}

#[tokio::test]
async fn current_session_resolves_active_tokens_only() {
    let (service, _store) = service_with_store();

    let outcome = service
        .login(
            &AuthCredential::MockPersona("moderator".to_owned()),
            now(),
            &audit(),
        )
        .await
        .unwrap();

    let session = service
        .current_session(&outcome.token, now() + Duration::hours(1))
        .await
        .unwrap();
    assert_eq!(session.user.id, outcome.user.id);
    assert_eq!(session.user.system_role, SystemRole::Moderator);
    assert_eq!(session.expires_at, outcome.expires_at);

    let unknown = service.current_session("not-a-real-token", now()).await;
    assert!(matches!(unknown, Err(ApplicationError::Unauthorized)));

    let expired = service
        .current_session(&outcome.token, now() + Duration::hours(25))
        .await;
    assert!(matches!(expired, Err(ApplicationError::Unauthorized)));
}

#[tokio::test]
async fn logout_revokes_the_session() {
    let (service, _store) = service_with_store();

    let outcome = service
        .login(
            &AuthCredential::MockPersona("student".to_owned()),
            now(),
            &audit(),
        )
        .await
        .unwrap();

    service
        .logout(&outcome.token, now() + Duration::minutes(1), &audit())
        .await
        .unwrap();

    let after_logout = service
        .current_session(&outcome.token, now() + Duration::minutes(2))
        .await;
    assert!(matches!(after_logout, Err(ApplicationError::Unauthorized)));

    let second_logout = service
        .logout(&outcome.token, now() + Duration::minutes(3), &audit())
        .await;
    assert!(matches!(second_logout, Err(ApplicationError::Unauthorized)));
}

#[tokio::test]
async fn revoking_an_already_revoked_session_succeeds_and_keeps_the_first_timestamp() {
    // Two concurrent logout requests can both resolve the session before
    // either revokes it. The loser must not turn a successful logout into an
    // error, and must not overwrite when the session was actually revoked.
    let store = InMemoryAuthStore::default();
    let session = SessionRepository::insert(
        &store,
        NewSession {
            user_id: UserId::from_uuid(uuid::Uuid::new_v4()),
            token_hash: "hash-for-double-revoke".to_owned(),
            created_at: now(),
            expires_at: now() + Duration::hours(24),
        },
    )
    .await
    .unwrap();

    let first_revocation = now() + Duration::minutes(1);
    SessionRepository::revoke(&store, session.id, first_revocation)
        .await
        .unwrap();
    SessionRepository::revoke(&store, session.id, now() + Duration::minutes(2))
        .await
        .expect("revoking twice must stay successful");

    let stored = SessionRepository::find_by_token_hash(&store, "hash-for-double-revoke")
        .await
        .unwrap()
        .unwrap();
    assert_eq!(stored.revoked_at, Some(first_revocation));
}

#[tokio::test]
async fn login_and_logout_record_audit_events_without_raw_tokens() {
    let (service, store) = service_with_store();

    let outcome = service
        .login(
            &AuthCredential::MockPersona("admin".to_owned()),
            now(),
            &audit(),
        )
        .await
        .unwrap();
    service
        .logout(&outcome.token, now() + Duration::minutes(1), &audit())
        .await
        .unwrap();

    let events = store.audit_events_snapshot();
    let actions: Vec<&str> = events.iter().map(|event| event.action.as_str()).collect();
    assert_eq!(actions, vec!["auth.login", "auth.logout"]);

    for event in &events {
        assert_eq!(event.resource_type, "session");
        assert!(event.actor_id.is_some());
        assert!(event.resource_id.is_some());

        let metadata = event.metadata.to_string();
        assert!(!metadata.contains(&outcome.token));
        assert!(metadata.contains("req-test-1"));
        assert!(metadata.contains("mock_campus"));
    }
}
