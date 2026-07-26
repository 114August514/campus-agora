//! Repository traits and data records owned by the application layer.
//! `crates/db` implements them for PostgreSQL; `memory` provides the
//! in-memory fallback for tests and database-less local development.

use async_trait::async_trait;
use campus_agora_domain::{
    ApplicableAudience, ArchiveCategory, AuthProviderKind, CorrectionId, ModerationStatus,
    OrganizationId, PostId, RevisionId, SessionId, SourceKind, SystemRole, UserId,
};
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

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ArchiveEntryRecord {
    pub id: PostId,
    pub author_id: UserId,
    pub title: String,
    pub body: String,
    pub summary: Option<String>,
    pub tags: Vec<String>,
    pub category: ArchiveCategory,
    pub applicable_audience: ApplicableAudience,
    pub source_kind: SourceKind,
    pub source_reference: Option<String>,
    pub moderation_status: ModerationStatus,
    pub current_revision: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NewArchiveEntry {
    pub author_id: UserId,
    pub title: String,
    pub body: String,
    pub summary: Option<String>,
    pub tags: Vec<String>,
    pub category: ArchiveCategory,
    pub applicable_audience: ApplicableAudience,
    pub source_kind: SourceKind,
    pub source_reference: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Fully resolved field values for an update. The service merges the caller's
/// partial input onto the stored entry before handing it here, so the
/// repository never has to reason about which fields were omitted.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ArchiveEntryUpdate {
    pub title: String,
    pub body: String,
    pub summary: Option<String>,
    pub tags: Vec<String>,
    pub category: ArchiveCategory,
    pub applicable_audience: ApplicableAudience,
    pub source_kind: SourceKind,
    pub source_reference: Option<String>,
    pub updated_at: DateTime<Utc>,
    /// When set, the update also writes this revision row and bumps
    /// `current_revision`, in the same transaction.
    pub new_revision: Option<NewRevision>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NewRevision {
    pub revision: i32,
    pub editor_id: UserId,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RevisionRecord {
    pub id: RevisionId,
    pub post_id: PostId,
    pub revision: i32,
    pub editor_id: UserId,
    pub title: String,
    pub body: String,
    pub summary: Option<String>,
    pub tags: Vec<String>,
    pub created_at: DateTime<Utc>,
}

/// Who is asking, expressed as the visibility scope the repository must apply.
/// `Public` sees published entries only; `Owner` additionally sees entries
/// authored or maintained by the given user; `Full` is moderation scope.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum VisibilityScope {
    Public,
    Owner(UserId),
    Full,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ArchiveListQuery {
    pub scope: VisibilityScope,
    pub q: Option<String>,
    pub tag: Option<String>,
    pub category: Option<ArchiveCategory>,
    pub page: u32,
    pub page_size: u32,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Page<T> {
    pub items: Vec<T>,
    pub page: u32,
    pub page_size: u32,
    pub total_items: u64,
    pub total_pages: u32,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CorrectionRecord {
    pub id: CorrectionId,
    pub post_id: PostId,
    pub reporter_id: UserId,
    pub message: String,
    pub created_at: DateTime<Utc>,
    pub resolved_at: Option<DateTime<Utc>>,
    pub resolved_by: Option<UserId>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NewCorrection {
    pub post_id: PostId,
    pub reporter_id: UserId,
    pub message: String,
    pub created_at: DateTime<Utc>,
}

#[async_trait]
pub trait ArchiveRepository: Send + Sync {
    async fn insert(&self, entry: NewArchiveEntry) -> Result<ArchiveEntryRecord, ApplicationError>;

    /// Returns the entry only when the scope may see it. Callers turn `None`
    /// into `NotFound`, so an entry the caller cannot see never leaks its
    /// existence through a different status.
    async fn find_visible(
        &self,
        id: PostId,
        scope: VisibilityScope,
    ) -> Result<Option<ArchiveEntryRecord>, ApplicationError>;

    async fn list(
        &self,
        query: ArchiveListQuery,
    ) -> Result<Page<ArchiveEntryRecord>, ApplicationError>;

    async fn update(
        &self,
        id: PostId,
        update: ArchiveEntryUpdate,
    ) -> Result<ArchiveEntryRecord, ApplicationError>;

    async fn set_status(
        &self,
        id: PostId,
        status: ModerationStatus,
        updated_at: DateTime<Utc>,
    ) -> Result<ArchiveEntryRecord, ApplicationError>;

    async fn list_revisions(&self, id: PostId) -> Result<Vec<RevisionRecord>, ApplicationError>;

    async fn is_maintainer(&self, id: PostId, user_id: UserId) -> Result<bool, ApplicationError>;
}

#[async_trait]
pub trait CorrectionRepository: Send + Sync {
    async fn insert(&self, correction: NewCorrection)
        -> Result<CorrectionRecord, ApplicationError>;

    async fn list_for_post(
        &self,
        post_id: PostId,
    ) -> Result<Vec<CorrectionRecord>, ApplicationError>;

    async fn resolve(
        &self,
        id: CorrectionId,
        resolved_by: UserId,
        resolved_at: DateTime<Utc>,
    ) -> Result<CorrectionRecord, ApplicationError>;
}
