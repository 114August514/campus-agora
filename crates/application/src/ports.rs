//! Repository traits and data records owned by the application layer.
//! `crates/db` implements them for PostgreSQL; `memory` provides the
//! in-memory fallback for tests and database-less local development.

use async_trait::async_trait;
use campus_agora_domain::{AuthProviderKind, OrganizationId, SessionId, SystemRole, UserId};
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::errors::ApplicationError;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct UserRecord {
    pub id: UserId,
    pub auth_provider: AuthProviderKind,
    pub provider_subject_hash: String,
    pub display_name: String,
    pub system_role: SystemRole,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NewUser {
    pub auth_provider: AuthProviderKind,
    pub provider_subject_hash: String,
    pub display_name: String,
    pub system_role: SystemRole,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SessionRecord {
    pub id: SessionId,
    pub user_id: UserId,
    pub token_hash: String,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub revoked_at: Option<DateTime<Utc>>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NewSession {
    pub user_id: UserId,
    pub token_hash: String,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct OrganizationRecord {
    pub id: OrganizationId,
    pub slug: String,
    pub name: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct MembershipSummary {
    pub organization_id: OrganizationId,
    pub slug: String,
    pub name: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NewAuditEvent {
    pub actor_id: Option<UserId>,
    pub action: String,
    pub resource_type: String,
    pub resource_id: Option<Uuid>,
    pub metadata: serde_json::Value,
}

#[async_trait]
pub trait UserRepository: Send + Sync {
    /// Inserts the user or updates the existing row that matches
    /// `(auth_provider, provider_subject_hash)`, returning the stored record.
    async fn upsert(&self, user: NewUser) -> Result<UserRecord, ApplicationError>;

    async fn find_by_id(&self, id: UserId) -> Result<Option<UserRecord>, ApplicationError>;
}

#[async_trait]
pub trait SessionRepository: Send + Sync {
    async fn insert(&self, session: NewSession) -> Result<SessionRecord, ApplicationError>;

    /// Returns the session for a token hash regardless of expiry or
    /// revocation; the auth service applies the liveness rules.
    async fn find_by_token_hash(
        &self,
        token_hash: &str,
    ) -> Result<Option<SessionRecord>, ApplicationError>;

    async fn revoke(
        &self,
        session_id: SessionId,
        revoked_at: DateTime<Utc>,
    ) -> Result<(), ApplicationError>;
}

#[async_trait]
pub trait OrganizationRepository: Send + Sync {
    async fn upsert_organization(
        &self,
        slug: &str,
        name: &str,
    ) -> Result<OrganizationRecord, ApplicationError>;

    async fn ensure_membership(
        &self,
        organization_id: OrganizationId,
        user_id: UserId,
    ) -> Result<(), ApplicationError>;

    async fn list_memberships_for_user(
        &self,
        user_id: UserId,
    ) -> Result<Vec<MembershipSummary>, ApplicationError>;
}

#[async_trait]
pub trait AuditEventRepository: Send + Sync {
    async fn record(&self, event: NewAuditEvent) -> Result<(), ApplicationError>;
}
