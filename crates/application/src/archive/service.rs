//! Knowledge archive use cases.
//!
//! This is the first consumer of the domain permission policy: every write
//! resolves the caller into a `campus_agora_domain::Actor` carrying the
//! resource-context flags the matrix needs, then asks `is_allowed`. Visibility
//! is separate from permission — an entry the caller may not see resolves to
//! `NotFound`, never `Forbidden`, so private entries do not leak.

use std::sync::Arc;

use campus_agora_domain::{
    can_transition, is_allowed, normalize_tags, validate_body, validate_summary, validate_title,
    Action, Actor, ApplicableAudience, ArchiveCategory, AuthenticatedActor, CorrectionId,
    ModerationStatus, PostId, SourceKind, SystemRole, TagError, TextError,
};
use chrono::{DateTime, Utc};

use crate::auth::{AuditContext, CurrentUser};
use crate::errors::ApplicationError;
use crate::ports::{
    ArchiveEntryRecord, ArchiveEntryUpdate, ArchiveListQuery, ArchiveRepository,
    ArchiveSourceRecord, ArchiveSourceRepository, AuditEventRepository, CorrectionRecord,
    CorrectionRepository, NewArchiveEntry, NewAuditEvent, NewCorrection, NewRevision, Page,
    RevisionRecord, RevisionWrite, VisibilityScope,
};

pub const MAX_PAGE_SIZE: u32 = 100;
const DEFAULT_PAGE_SIZE: u32 = 20;
const CORRECTION_MESSAGE_MAX_CHARS: usize = 1000;
const SEARCH_QUERY_MAX_CHARS: usize = 100;
/// Revisions and corrections are returned whole rather than paged, so both
/// need a ceiling: an entry edited thousands of times must not turn a single
/// read into an unbounded response.
const MAX_COLLECTION_ITEMS: usize = 200;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NewArchiveEntryInput {
    pub title: String,
    pub body: String,
    pub summary: Option<String>,
    pub tags: Vec<String>,
    pub category: ArchiveCategory,
    pub applicable_audience: ApplicableAudience,
    pub source_kind: SourceKind,
    pub source_reference: Option<String>,
}

/// Partial update: `None` leaves the stored value untouched.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct UpdateArchiveInput {
    pub title: Option<String>,
    pub body: Option<String>,
    pub summary: Option<String>,
    pub tags: Option<Vec<String>>,
    pub category: Option<ArchiveCategory>,
    pub applicable_audience: Option<ApplicableAudience>,
    pub source_kind: Option<SourceKind>,
    pub source_reference: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CorrectionInput {
    pub message: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ListArchiveQuery {
    pub q: Option<String>,
    pub tag: Option<String>,
    pub category: Option<ArchiveCategory>,
    pub page: u32,
    pub page_size: u32,
}

impl Default for ListArchiveQuery {
    fn default() -> Self {
        Self {
            q: None,
            tag: None,
            category: None,
            page: 1,
            page_size: DEFAULT_PAGE_SIZE,
        }
    }
}

pub struct ArchiveService {
    entries: Arc<dyn ArchiveRepository>,
    corrections: Arc<dyn CorrectionRepository>,
    sources: Arc<dyn ArchiveSourceRepository>,
    audit_events: Arc<dyn AuditEventRepository>,
}

impl ArchiveService {
    pub fn new(
        entries: Arc<dyn ArchiveRepository>,
        corrections: Arc<dyn CorrectionRepository>,
        sources: Arc<dyn ArchiveSourceRepository>,
        audit_events: Arc<dyn AuditEventRepository>,
    ) -> Self {
        Self {
            entries,
            corrections,
            sources,
            audit_events,
        }
    }

    /// Creating a draft is not audited: it is private to its author and
    /// changes nothing the campus can see. Publishing it is what gets an audit
    /// event. The context is still taken so every write shares one signature.
    pub async fn create_draft(
        &self,
        user: &CurrentUser,
        input: NewArchiveEntryInput,
        now: DateTime<Utc>,
        _audit: &AuditContext,
    ) -> Result<ArchiveEntryRecord, ApplicationError> {
        require(Action::CreateOwnDraft, &actor_without_resource(user))?;

        let title = text(validate_title(&input.title), "title")?;
        let body = text(validate_body(&input.body), "body")?;
        let summary = text(validate_summary(input.summary.as_deref()), "summary")?;
        let tags = tags(&input.tags)?;

        self.entries
            .insert(NewArchiveEntry {
                author_id: user.id,
                title,
                body,
                summary,
                tags,
                category: input.category,
                applicable_audience: input.applicable_audience,
                source_kind: input.source_kind,
                source_reference: source_reference(input.source_reference)?,
                created_at: now,
            })
            .await
    }

    /// Explicit guest path so callers cannot accidentally skip the check by
    /// having no user to pass.
    pub async fn create_draft_as_guest(
        &self,
        _input: NewArchiveEntryInput,
        _now: DateTime<Utc>,
        _audit: &AuditContext,
    ) -> Result<ArchiveEntryRecord, ApplicationError> {
        require(Action::CreateOwnDraft, &Actor::Guest)?;

        unreachable!("guests are denied CreateOwnDraft by the permission matrix")
    }

    pub async fn get_entry(
        &self,
        user: Option<&CurrentUser>,
        id: PostId,
    ) -> Result<ArchiveEntryRecord, ApplicationError> {
        self.visible_entry(user, id).await
    }

    pub async fn list_entries(
        &self,
        user: Option<&CurrentUser>,
        query: ListArchiveQuery,
    ) -> Result<Page<ArchiveEntryRecord>, ApplicationError> {
        if query.page < 1 {
            return Err(ApplicationError::Validation(
                "page must start at 1".to_owned(),
            ));
        }

        if query.page_size < 1 || query.page_size > MAX_PAGE_SIZE {
            return Err(ApplicationError::Validation(format!(
                "pageSize must be between 1 and {MAX_PAGE_SIZE}"
            )));
        }

        self.entries
            .list(ArchiveListQuery {
                scope: scope_for(user),
                // Tags are stored normalized, so the filter must normalize too
                // or an uppercase query would never match.
                tag: query.tag.map(|tag| tag.trim().to_lowercase()),
                // Bounded and escaped: `%` and `_` are LIKE wildcards, and an
                // unbounded pattern on an unauthenticated endpoint is a cheap
                // way to force a scan over every visible row.
                q: normalized_query(query.q)?,
                category: query.category,
                page: query.page,
                page_size: query.page_size,
            })
            .await
    }

    pub async fn list_revisions(
        &self,
        user: Option<&CurrentUser>,
        id: PostId,
    ) -> Result<Vec<RevisionRecord>, ApplicationError> {
        self.visible_entry(user, id).await?;

        let mut revisions = self.entries.list_revisions(id).await?;
        // Newest history is the useful end, so an over-long list drops its
        // oldest entries rather than truncating what readers came for.
        if revisions.len() > MAX_COLLECTION_ITEMS {
            revisions.drain(..revisions.len() - MAX_COLLECTION_ITEMS);
        }

        Ok(revisions)
    }

    pub async fn update_entry(
        &self,
        user: &CurrentUser,
        id: PostId,
        input: UpdateArchiveInput,
        now: DateTime<Utc>,
        audit: &AuditContext,
    ) -> Result<ArchiveEntryRecord, ApplicationError> {
        let entry = self.visible_entry(Some(user), id).await?;
        let actor = self.actor_for(user, &entry).await?;
        require(Action::EditOwnDraft, &actor)?;

        let title = match input.title {
            Some(value) => text(validate_title(&value), "title")?,
            None => entry.title.clone(),
        };
        let body = match input.body {
            Some(value) => text(validate_body(&value), "body")?,
            None => entry.body.clone(),
        };
        let summary = match input.summary {
            Some(value) => text(validate_summary(Some(&value)), "summary")?,
            None => entry.summary.clone(),
        };
        let new_tags = match input.tags {
            Some(value) => tags(&value)?,
            None => entry.tags.clone(),
        };

        // Only a draft is private and unreviewed, so only a draft may be
        // rewritten in place. Once an entry has been published — including
        // while it is hidden or rejected pending review — every edit gets its
        // own revision, so a moderator can see what changed after they acted.
        let revision = if entry.moderation_status == ModerationStatus::Draft {
            RevisionWrite::RewriteCurrent { editor_id: user.id }
        } else {
            RevisionWrite::Append(NewRevision {
                revision: entry.current_revision + 1,
                editor_id: user.id,
            })
        };

        let updated = self
            .entries
            .update(
                id,
                ArchiveEntryUpdate {
                    title,
                    body,
                    summary,
                    tags: new_tags,
                    category: input.category.unwrap_or(entry.category),
                    applicable_audience: input
                        .applicable_audience
                        .unwrap_or(entry.applicable_audience),
                    source_kind: input.source_kind.unwrap_or(entry.source_kind),
                    source_reference: match input.source_reference {
                        Some(value) => source_reference(Some(value))?,
                        None => entry.source_reference.clone(),
                    },
                    updated_at: now,
                    revision,
                },
            )
            .await?;

        // A private draft changes nothing anyone else has seen. Anything else
        // has been visible or reviewed, so the edit is auditable — including an
        // edit made while the entry is hidden pending moderation.
        if entry.moderation_status != ModerationStatus::Draft {
            self.record_audit(
                "archive.revised",
                user,
                id,
                serde_json::json!({
                    "revision": updated.current_revision,
                    "status": updated.moderation_status.as_str(),
                    "requestId": audit.request_id,
                }),
            )
            .await?;
        }

        Ok(updated)
    }

    pub async fn change_status(
        &self,
        user: &CurrentUser,
        id: PostId,
        target: ModerationStatus,
        now: DateTime<Utc>,
        audit: &AuditContext,
    ) -> Result<ArchiveEntryRecord, ApplicationError> {
        let entry = self.visible_entry(Some(user), id).await?;
        let actor = self.actor_for(user, &entry).await?;

        // Publishing one's own draft, retiring content, and moderating someone
        // else's work are different privileges, so they check different
        // actions. Shared with the discussion service so both content kinds
        // answer the same question the same way.
        require(
            crate::discussion::action_for_transition(entry.moderation_status, target),
            &actor,
        )?;

        if !can_transition(entry.moderation_status, target) {
            return Err(ApplicationError::Conflict(format!(
                "cannot move an entry from {} to {}",
                entry.moderation_status.as_str(),
                target.as_str()
            )));
        }

        let updated = self
            .entries
            .set_status(id, entry.moderation_status, target, now)
            .await?;

        self.record_audit(
            "archive.status_changed",
            user,
            id,
            serde_json::json!({
                "from": entry.moderation_status.as_str(),
                "to": target.as_str(),
                "requestId": audit.request_id,
            }),
        )
        .await?;

        Ok(updated)
    }

    pub async fn file_correction(
        &self,
        user: &CurrentUser,
        id: PostId,
        input: CorrectionInput,
        now: DateTime<Utc>,
        audit: &AuditContext,
    ) -> Result<CorrectionRecord, ApplicationError> {
        let entry = self.visible_entry(Some(user), id).await?;
        require(Action::FileCorrection, &self.actor_for(user, &entry).await?)?;

        let message = input.message.trim();

        if message.is_empty() {
            return Err(ApplicationError::Validation(
                "correction message must not be empty".to_owned(),
            ));
        }

        if message.chars().count() > CORRECTION_MESSAGE_MAX_CHARS {
            return Err(ApplicationError::Validation(format!(
                "correction message must be at most {CORRECTION_MESSAGE_MAX_CHARS} characters"
            )));
        }

        let correction = self
            .corrections
            .insert(NewCorrection {
                post_id: id,
                reporter_id: user.id,
                message: message.to_owned(),
                created_at: now,
            })
            .await?;

        self.record_audit(
            "archive.correction_filed",
            user,
            id,
            serde_json::json!({
                "correctionId": correction.id.to_string(),
                "requestId": audit.request_id,
            }),
        )
        .await?;

        Ok(correction)
    }

    /// Restricted rather than public: a correction names its reporter and is
    /// inherently accusatory, so `docs/product/privacy.md` limits the listing
    /// to the entry author, its maintainers, moderators, and admins. Filing
    /// one stays open to any authenticated reader.
    pub async fn list_corrections(
        &self,
        user: Option<&CurrentUser>,
        id: PostId,
    ) -> Result<Vec<CorrectionRecord>, ApplicationError> {
        let Some(user) = user else {
            return Err(ApplicationError::Unauthorized);
        };

        let entry = self.visible_entry(Some(user), id).await?;
        require(
            Action::ResolveCorrection,
            &self.actor_for(user, &entry).await?,
        )?;

        let mut corrections = self.corrections.list_for_post(id).await?;
        if corrections.len() > MAX_COLLECTION_ITEMS {
            corrections.truncate(MAX_COLLECTION_ITEMS);
        }

        Ok(corrections)
    }

    pub async fn resolve_correction(
        &self,
        user: &CurrentUser,
        id: PostId,
        correction_id: CorrectionId,
        now: DateTime<Utc>,
        audit: &AuditContext,
    ) -> Result<CorrectionRecord, ApplicationError> {
        let entry = self.visible_entry(Some(user), id).await?;
        require(
            Action::ResolveCorrection,
            &self.actor_for(user, &entry).await?,
        )?;

        let correction = self
            .corrections
            .resolve(id, correction_id, user.id, now)
            .await?;

        self.record_audit(
            "archive.correction_resolved",
            user,
            id,
            serde_json::json!({
                "correctionId": correction_id.to_string(),
                "requestId": audit.request_id,
            }),
        )
        .await?;

        Ok(correction)
    }

    /// Where this entry's content came from. The listing is scoped to the
    /// reader, so a source pointing at a discussion they cannot see is omitted
    /// rather than leaking its title through the backlink.
    pub async fn list_sources(
        &self,
        user: Option<&CurrentUser>,
        id: PostId,
    ) -> Result<Vec<ArchiveSourceRecord>, ApplicationError> {
        self.visible_entry(user, id).await?;

        self.sources.list_for_entry(id, scope_for(user)).await
    }

    /// Loads an entry the caller is allowed to see, or `NotFound`. Every read
    /// and write path starts here so visibility cannot be forgotten.
    async fn visible_entry(
        &self,
        user: Option<&CurrentUser>,
        id: PostId,
    ) -> Result<ArchiveEntryRecord, ApplicationError> {
        self.entries
            .find_visible(id, scope_for(user))
            .await?
            .ok_or_else(|| ApplicationError::NotFound("archive entry not found".to_owned()))
    }

    /// Builds the domain `Actor` for this user against this entry. This is the
    /// seam the permission matrix needs: it resolves the resource-role flags
    /// the matrix columns depend on.
    async fn actor_for(
        &self,
        user: &CurrentUser,
        entry: &ArchiveEntryRecord,
    ) -> Result<Actor, ApplicationError> {
        let is_assigned_maintainer = self.entries.is_maintainer(entry.id, user.id).await?;

        Ok(Actor::Authenticated(AuthenticatedActor {
            system_role: user.system_role,
            is_resource_author: entry.author_id == user.id,
            is_assigned_maintainer,
            is_organization_member: !user.organizations.is_empty(),
            owns_exported_data: false,
        }))
    }

    async fn record_audit(
        &self,
        action: &str,
        user: &CurrentUser,
        id: PostId,
        metadata: serde_json::Value,
    ) -> Result<(), ApplicationError> {
        self.audit_events
            .record(NewAuditEvent {
                actor_id: Some(user.id),
                action: action.to_owned(),
                resource_type: "archive_entry".to_owned(),
                resource_id: Some(id.into_uuid()),
                metadata,
            })
            .await
    }
}

/// Trims, bounds, and escapes a search term. LIKE metacharacters are escaped
/// so `%` searches for a literal percent sign instead of matching every row.
fn normalized_query(input: Option<String>) -> Result<Option<String>, ApplicationError> {
    let Some(value) = input else {
        return Ok(None);
    };

    let trimmed = value.trim();

    if trimmed.is_empty() {
        return Ok(None);
    }

    if trimmed.chars().count() > SEARCH_QUERY_MAX_CHARS {
        return Err(ApplicationError::Validation(format!(
            "q must be at most {SEARCH_QUERY_MAX_CHARS} characters"
        )));
    }

    Ok(Some(
        trimmed
            .replace('\\', "\\\\")
            .replace('%', "\\%")
            .replace('_', "\\_"),
    ))
}

fn scope_for(user: Option<&CurrentUser>) -> VisibilityScope {
    match user {
        None => VisibilityScope::Public,
        Some(user) => match user.system_role {
            SystemRole::Moderator | SystemRole::Admin => VisibilityScope::Full,
            _ => VisibilityScope::Owner(user.id),
        },
    }
}

/// An actor with no resource context, for actions that do not target a
/// specific entry.
fn actor_without_resource(user: &CurrentUser) -> Actor {
    Actor::Authenticated(AuthenticatedActor {
        system_role: user.system_role,
        is_resource_author: false,
        is_assigned_maintainer: false,
        is_organization_member: !user.organizations.is_empty(),
        owns_exported_data: false,
    })
}

fn require(action: Action, actor: &Actor) -> Result<(), ApplicationError> {
    if is_allowed(action, actor) {
        Ok(())
    } else {
        Err(ApplicationError::Forbidden)
    }
}

fn text<T>(result: Result<T, TextError>, field: &str) -> Result<T, ApplicationError> {
    result.map_err(|error| {
        ApplicationError::Validation(match error {
            TextError::Empty => format!("{field} must not be empty"),
            TextError::TooLong => format!("{field} is too long"),
        })
    })
}

fn tags(input: &[String]) -> Result<Vec<String>, ApplicationError> {
    normalize_tags(input).map_err(|error| {
        ApplicationError::Validation(match error {
            TagError::TooMany => "too many tags".to_owned(),
            TagError::TagTooLong => "a tag is too long".to_owned(),
        })
    })
}

/// Source references are free-form because campus notices live in many places,
/// but they are bounded so the column cannot be used as free storage.
fn source_reference(input: Option<String>) -> Result<Option<String>, ApplicationError> {
    let Some(value) = input else {
        return Ok(None);
    };

    let trimmed = value.trim();

    if trimmed.is_empty() {
        return Ok(None);
    }

    if trimmed.chars().count() > 500 {
        return Err(ApplicationError::Validation(
            "source reference is too long".to_owned(),
        ));
    }

    Ok(Some(trimmed.to_owned()))
}
