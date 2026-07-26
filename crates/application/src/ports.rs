//! Repository traits and data records owned by the application layer.
//! `crates/db` implements them for PostgreSQL; `memory` provides the
//! in-memory fallback for tests and database-less local development.

use async_trait::async_trait;
use campus_agora_domain::{
    ApplicableAudience, ArchiveCategory, AuthProviderKind, CommentId, CorrectionId,
    ModerationStatus, OrganizationId, PostId, RevisionId, SessionId, SourceKind, SystemRole,
    UserId,
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
    pub revision: RevisionWrite,
}

/// How an update touches revision history.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum RevisionWrite {
    /// A published entry gains a new version and bumps `current_revision`.
    Append(NewRevision),
    /// A draft has no published history, so its single revision is rewritten
    /// in place. Leaving the original would publish text the author removed
    /// before the entry was ever visible.
    RewriteCurrent { editor_id: UserId },
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

    /// Compare-and-swap on `expected`: the caller authorized the transition
    /// against the status it read, so a concurrent change must make this fail
    /// rather than silently overwrite the newer decision.
    async fn set_status(
        &self,
        id: PostId,
        expected: ModerationStatus,
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

    /// Scoped to `post_id` on purpose: the caller is authorized against the
    /// entry in the request path, so resolving a correction that belongs to a
    /// different entry must fail rather than silently succeed.
    async fn resolve(
        &self,
        post_id: PostId,
        id: CorrectionId,
        resolved_by: UserId,
        resolved_at: DateTime<Utc>,
    ) -> Result<CorrectionRecord, ApplicationError>;
}

// ---------------------------------------------------------------------------
// M3: discussions, replies, and the link from a discussion to an archive entry.
// ---------------------------------------------------------------------------

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DiscussionRecord {
    pub id: PostId,
    pub author_id: UserId,
    pub title: String,
    pub body: String,
    pub tags: Vec<String>,
    pub moderation_status: ModerationStatus,
    pub accepted_comment_id: Option<CommentId>,
    pub reply_count: i64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NewDiscussion {
    pub author_id: UserId,
    pub title: String,
    pub body: String,
    pub tags: Vec<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DiscussionListQuery {
    pub scope: VisibilityScope,
    pub q: Option<String>,
    pub tag: Option<String>,
    pub page: u32,
    pub page_size: u32,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CommentRecord {
    pub id: CommentId,
    pub post_id: PostId,
    pub author_id: UserId,
    pub body: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NewComment {
    pub post_id: PostId,
    pub author_id: UserId,
    pub body: String,
    pub created_at: DateTime<Utc>,
}

/// One direction of the loop: where an archive entry's content came from.
/// `source_author_id` is the person who wrote the quoted text, which is not
/// the entry's author when a reply was promoted — the attribution would
/// otherwise be lost the moment the entry is saved.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ArchiveSourceRecord {
    pub entry_id: PostId,
    pub source_post_id: PostId,
    pub source_comment_id: Option<CommentId>,
    pub source_author_id: UserId,
    pub source_title: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NewArchiveSource {
    pub entry_id: PostId,
    pub source_post_id: PostId,
    pub source_comment_id: Option<CommentId>,
    pub source_author_id: UserId,
    pub created_at: DateTime<Utc>,
}

/// The other direction: what a discussion produced.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DerivedEntryRecord {
    pub entry_id: PostId,
    pub title: String,
    pub moderation_status: ModerationStatus,
    pub created_at: DateTime<Utc>,
}

#[async_trait]
pub trait DiscussionRepository: Send + Sync {
    async fn insert(&self, discussion: NewDiscussion)
        -> Result<DiscussionRecord, ApplicationError>;

    /// Same contract as `ArchiveRepository::find_visible`: `None` when the
    /// scope may not see it, so callers turn it into `NotFound` and a draft
    /// never leaks its existence.
    async fn find_visible(
        &self,
        id: PostId,
        scope: VisibilityScope,
    ) -> Result<Option<DiscussionRecord>, ApplicationError>;

    async fn list(
        &self,
        query: DiscussionListQuery,
    ) -> Result<Page<DiscussionRecord>, ApplicationError>;

    async fn set_status(
        &self,
        id: PostId,
        expected: ModerationStatus,
        status: ModerationStatus,
        updated_at: DateTime<Utc>,
    ) -> Result<DiscussionRecord, ApplicationError>;

    /// `comment_id` must belong to `id`; implementations enforce that in the
    /// same statement so a caller authorized against one discussion cannot
    /// mark an answer on another.
    async fn set_accepted_comment(
        &self,
        id: PostId,
        comment_id: Option<CommentId>,
        updated_at: DateTime<Utc>,
    ) -> Result<DiscussionRecord, ApplicationError>;

    async fn is_maintainer(&self, id: PostId, user_id: UserId) -> Result<bool, ApplicationError>;
}

#[async_trait]
pub trait CommentRepository: Send + Sync {
    async fn insert(&self, comment: NewComment) -> Result<CommentRecord, ApplicationError>;

    async fn list_for_post(&self, post_id: PostId) -> Result<Vec<CommentRecord>, ApplicationError>;

    /// Scoped to `post_id` rather than looking up by id alone: the caller was
    /// authorized against a discussion, so a comment from a different one must
    /// resolve to `None`.
    async fn find_in_post(
        &self,
        post_id: PostId,
        id: CommentId,
    ) -> Result<Option<CommentRecord>, ApplicationError>;
}

#[async_trait]
pub trait ArchiveSourceRepository: Send + Sync {
    async fn insert(
        &self,
        source: NewArchiveSource,
    ) -> Result<ArchiveSourceRecord, ApplicationError>;

    /// Scoped: a source pointing at a discussion the reader cannot see is
    /// omitted, so the backlink cannot be used to read hidden titles.
    async fn list_for_entry(
        &self,
        entry_id: PostId,
        scope: VisibilityScope,
    ) -> Result<Vec<ArchiveSourceRecord>, ApplicationError>;

    /// Scoped for the same reason in the other direction: an unpublished entry
    /// derived from a public discussion must not be listed to strangers.
    async fn list_derived_entries(
        &self,
        source_post_id: PostId,
        scope: VisibilityScope,
    ) -> Result<Vec<DerivedEntryRecord>, ApplicationError>;
}
