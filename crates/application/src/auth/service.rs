use std::fmt;
use std::sync::Arc;

use campus_agora_domain::{validate_display_name, SessionId, SystemRole, UserId};
use chrono::{DateTime, Duration, Utc};
use rand::RngCore;
use sha2::{Digest, Sha256};

use crate::errors::ApplicationError;
use crate::ports::{
    AuditEventRepository, MembershipSummary, NewAuditEvent, NewSession, NewUser,
    OrganizationRepository, SessionRepository, UserRecord, UserRepository,
};

use super::provider::{AuthCredential, AuthProvider};

#[derive(Clone, Debug)]
pub struct AuthConfig {
    pub session_ttl: Duration,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CurrentUser {
    pub id: UserId,
    pub display_name: String,
    pub system_role: SystemRole,
    pub organizations: Vec<MembershipSummary>,
}

#[derive(Clone, PartialEq, Eq)]
pub struct LoginOutcome {
    /// The opaque session token, returned to the caller exactly once.
    pub token: String,
    pub expires_at: DateTime<Utc>,
    pub user: CurrentUser,
}

/// Hand-written so the one-time token cannot reach a log line or a panic
/// message through an accidental `{:?}`.
impl fmt::Debug for LoginOutcome {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("LoginOutcome")
            .field("token", &"[redacted]")
            .field("expires_at", &self.expires_at)
            .field("user", &self.user)
            .finish()
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AuthenticatedSession {
    pub user: CurrentUser,
    pub expires_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Default)]
pub struct AuditContext {
    pub request_id: Option<String>,
}

pub struct AuthService {
    provider: Arc<dyn AuthProvider>,
    users: Arc<dyn UserRepository>,
    sessions: Arc<dyn SessionRepository>,
    organizations: Arc<dyn OrganizationRepository>,
    audit_events: Arc<dyn AuditEventRepository>,
    config: AuthConfig,
}

impl AuthService {
    pub fn new(
        provider: Arc<dyn AuthProvider>,
        users: Arc<dyn UserRepository>,
        sessions: Arc<dyn SessionRepository>,
        organizations: Arc<dyn OrganizationRepository>,
        audit_events: Arc<dyn AuditEventRepository>,
        config: AuthConfig,
    ) -> Self {
        Self {
            provider,
            users,
            sessions,
            organizations,
            audit_events,
            config,
        }
    }

    pub async fn login(
        &self,
        credential: &AuthCredential,
        now: DateTime<Utc>,
        audit: &AuditContext,
    ) -> Result<LoginOutcome, ApplicationError> {
        let identity = self.provider.verify(credential).await?;
        let display_name = validate_display_name(&identity.display_name)
            .map_err(|_| ApplicationError::Validation("invalid display name".to_owned()))?;

        let user = self
            .users
            .upsert(NewUser {
                auth_provider: identity.provider,
                provider_subject_hash: hash_provider_subject(&identity.subject),
                display_name,
                system_role: identity.system_role,
            })
            .await?;

        if let Some(seed) = &identity.organization {
            let organization = self
                .organizations
                .upsert_organization(&seed.slug, &seed.name)
                .await?;
            self.organizations
                .ensure_membership(organization.id, user.id)
                .await?;
        }

        let token = generate_session_token();
        let expires_at = now + self.config.session_ttl;
        let session = self
            .sessions
            .insert(NewSession {
                user_id: user.id,
                token_hash: hash_opaque_token(&token),
                created_at: now,
                expires_at,
            })
            .await?;

        self.record_session_audit("auth.login", &user, session.id, identity.provider, audit)
            .await?;

        let organizations = self
            .organizations
            .list_memberships_for_user(user.id)
            .await?;

        Ok(LoginOutcome {
            token,
            expires_at,
            user: current_user(user, organizations),
        })
    }

    pub async fn current_session(
        &self,
        token: &str,
        now: DateTime<Utc>,
    ) -> Result<AuthenticatedSession, ApplicationError> {
        let (session, user) = self.resolve_active_session(token, now).await?;
        let organizations = self
            .organizations
            .list_memberships_for_user(user.id)
            .await?;

        Ok(AuthenticatedSession {
            user: current_user(user, organizations),
            expires_at: session.expires_at,
        })
    }

    pub async fn logout(
        &self,
        token: &str,
        now: DateTime<Utc>,
        audit: &AuditContext,
    ) -> Result<(), ApplicationError> {
        let (session, user) = self.resolve_active_session(token, now).await?;

        self.sessions.revoke(session.id, now).await?;
        self.record_session_audit("auth.logout", &user, session.id, user.auth_provider, audit)
            .await?;

        Ok(())
    }

    async fn resolve_active_session(
        &self,
        token: &str,
        now: DateTime<Utc>,
    ) -> Result<(crate::ports::SessionRecord, UserRecord), ApplicationError> {
        let session = self
            .sessions
            .find_by_token_hash(&hash_opaque_token(token))
            .await?
            .ok_or(ApplicationError::Unauthorized)?;

        if session.revoked_at.is_some() || session.expires_at <= now {
            return Err(ApplicationError::Unauthorized);
        }

        let user = self
            .users
            .find_by_id(session.user_id)
            .await?
            .ok_or(ApplicationError::Unauthorized)?;

        Ok((session, user))
    }

    async fn record_session_audit(
        &self,
        action: &str,
        user: &UserRecord,
        session_id: SessionId,
        provider: campus_agora_domain::AuthProviderKind,
        audit: &AuditContext,
    ) -> Result<(), ApplicationError> {
        self.audit_events
            .record(NewAuditEvent {
                actor_id: Some(user.id),
                action: action.to_owned(),
                resource_type: "session".to_owned(),
                resource_id: Some(session_id.into_uuid()),
                metadata: serde_json::json!({
                    "provider": provider.as_str(),
                    "requestId": audit.request_id,
                }),
            })
            .await
    }
}

fn current_user(user: UserRecord, organizations: Vec<MembershipSummary>) -> CurrentUser {
    CurrentUser {
        id: user.id,
        display_name: user.display_name,
        system_role: user.system_role,
        organizations,
    }
}

/// Generates a 256-bit opaque session token as lowercase hex.
fn generate_session_token() -> String {
    let mut bytes = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut bytes);
    encode_hex(&bytes)
}

/// SHA-256 hex digest used for session tokens at rest.
pub fn hash_opaque_token(token: &str) -> String {
    encode_hex(&Sha256::digest(token.as_bytes()))
}

/// SHA-256 hex digest used for provider subjects at rest.
pub fn hash_provider_subject(subject: &str) -> String {
    encode_hex(&Sha256::digest(subject.as_bytes()))
}

fn encode_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}
