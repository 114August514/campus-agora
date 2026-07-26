//! Discussion use cases and the path from a discussion into the archive.
//!
//! The same two rules the archive layer follows apply here. Visibility is
//! resolved before permission, so content the caller may not see is `NotFound`
//! rather than `Forbidden`. And every id that arrives from the request is
//! resolved *within* the resource the caller was authorized against — a comment
//! id is only ever looked up inside its discussion.

use std::sync::Arc;

use campus_agora_domain::{
    can_transition, is_allowed, normalize_tags, validate_body, validate_comment_body,
    validate_title, Action, Actor, AuthenticatedActor, CommentId, ModerationStatus, PostId,
    SourceKind, SystemRole, TagError, TextError,
};
use chrono::{DateTime, Utc};

use crate::auth::{AuditContext, CurrentUser};
use crate::errors::ApplicationError;
use crate::ports::{
    ArchiveRepository, ArchiveSourceRecord, ArchiveSourceRepository, AuditEventRepository,
    CommentRecord, CommentRepository, DerivedEntryRecord, DiscussionListQuery, DiscussionRecord,
    DiscussionRepository, NewArchiveEntry, NewArchiveSource, NewAuditEvent, NewComment,
    NewDiscussion, Page, VisibilityScope,
};

pub const MAX_PAGE_SIZE: u32 = 100;
const DEFAULT_PAGE_SIZE: u32 = 20;
const SEARCH_QUERY_MAX_CHARS: usize = 100;
/// Replies are returned whole rather than paged, so the list needs a ceiling.
/// A busy thread must not turn one read into an unbounded response.
const MAX_REPLIES: usize = 200;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NewDiscussionInput {
    pub title: String,
    pub body: String,
    pub tags: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ReplyInput {
    pub body: String,
}

/// What to sediment and how to title it. With no `comment_id` the discussion's
/// own opening post is the source; with one, that reply is.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct PromoteInput {
    pub comment_id: Option<CommentId>,
    pub title: Option<String>,
    pub body: Option<String>,
    pub summary: Option<String>,
    pub tags: Option<Vec<String>>,
    pub category: Option<campus_agora_domain::ArchiveCategory>,
    pub applicable_audience: Option<campus_agora_domain::ApplicableAudience>,
}

/// The entry and the link that records where it came from, returned together
/// so a caller never has to make the two-request round trip that would let the
/// two drift apart.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PromotionOutcome {
    pub entry: crate::ports::ArchiveEntryRecord,
    pub source: ArchiveSourceRecord,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ListDiscussionQuery {
    pub q: Option<String>,
    pub tag: Option<String>,
    pub page: u32,
    pub page_size: u32,
}

impl Default for ListDiscussionQuery {
    fn default() -> Self {
        Self {
            q: None,
            tag: None,
            page: 1,
            page_size: DEFAULT_PAGE_SIZE,
        }
    }
}

pub struct DiscussionService {
    discussions: Arc<dyn DiscussionRepository>,
    comments: Arc<dyn CommentRepository>,
    entries: Arc<dyn ArchiveRepository>,
    sources: Arc<dyn ArchiveSourceRepository>,
    audit_events: Arc<dyn AuditEventRepository>,
}

impl DiscussionService {
    pub fn new(
        discussions: Arc<dyn DiscussionRepository>,
        comments: Arc<dyn CommentRepository>,
        entries: Arc<dyn ArchiveRepository>,
        sources: Arc<dyn ArchiveSourceRepository>,
        audit_events: Arc<dyn AuditEventRepository>,
    ) -> Self {
        Self {
            discussions,
            comments,
            entries,
            sources,
            audit_events,
        }
    }

    /// A new discussion starts private, like a draft entry, so its author can
    /// word the question before the campus sees it.
    pub async fn create(
        &self,
        user: &CurrentUser,
        input: NewDiscussionInput,
        now: DateTime<Utc>,
        _audit: &AuditContext,
    ) -> Result<DiscussionRecord, ApplicationError> {
        require(Action::CreateOwnDraft, &actor_without_resource(user))?;

        self.discussions
            .insert(NewDiscussion {
                author_id: user.id,
                title: text(validate_title(&input.title), "title")?,
                body: text(validate_body(&input.body), "body")?,
                tags: tags(&input.tags)?,
                created_at: now,
            })
            .await
    }

    pub async fn get(
        &self,
        user: Option<&CurrentUser>,
        id: PostId,
    ) -> Result<DiscussionRecord, ApplicationError> {
        self.visible(user, id).await
    }

    pub async fn list(
        &self,
        user: Option<&CurrentUser>,
        query: ListDiscussionQuery,
    ) -> Result<Page<DiscussionRecord>, ApplicationError> {
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

        self.discussions
            .list(DiscussionListQuery {
                scope: scope_for(user),
                q: normalized_query(query.q)?,
                tag: query.tag.map(|tag| tag.trim().to_lowercase()),
                page: query.page,
                page_size: query.page_size,
            })
            .await
    }

    pub async fn reply(
        &self,
        user: &CurrentUser,
        id: PostId,
        input: ReplyInput,
        now: DateTime<Utc>,
        _audit: &AuditContext,
    ) -> Result<CommentRecord, ApplicationError> {
        let discussion = self.visible(Some(user), id).await?;
        require(
            Action::ReplyToDiscussion,
            &self.actor_for(user, &discussion).await?,
        )?;

        // A draft is still being worded and an archived thread is closed;
        // neither should collect replies.
        if !discussion.moderation_status.accepts_replies() {
            return Err(ApplicationError::Conflict(format!(
                "a {} discussion does not accept replies",
                discussion.moderation_status.as_str()
            )));
        }

        self.comments
            .insert(NewComment {
                post_id: id,
                author_id: user.id,
                body: text(validate_comment_body(&input.body), "body")?,
                created_at: now,
            })
            .await
    }

    /// Explicit guest path, so a caller cannot skip the check by having no
    /// user to pass.
    pub async fn reply_as_guest(
        &self,
        _id: PostId,
        _input: ReplyInput,
        _now: DateTime<Utc>,
        _audit: &AuditContext,
    ) -> Result<CommentRecord, ApplicationError> {
        require(Action::ReplyToDiscussion, &Actor::Guest)?;

        unreachable!("guests are denied ReplyToDiscussion by the permission matrix")
    }

    pub async fn list_replies(
        &self,
        user: Option<&CurrentUser>,
        id: PostId,
    ) -> Result<Vec<CommentRecord>, ApplicationError> {
        self.visible(user, id).await?;

        let mut replies = self.comments.list_for_post(id).await?;
        replies.truncate(MAX_REPLIES);

        Ok(replies)
    }

    /// `comment_id` is `None` to clear the accepted answer.
    pub async fn accept_answer(
        &self,
        user: &CurrentUser,
        id: PostId,
        comment_id: Option<CommentId>,
        now: DateTime<Utc>,
        audit: &AuditContext,
    ) -> Result<DiscussionRecord, ApplicationError> {
        let discussion = self.visible(Some(user), id).await?;
        require(
            Action::AcceptAnswer,
            &self.actor_for(user, &discussion).await?,
        )?;

        // Resolved inside the discussion the caller was authorized against.
        // Looking the comment up by id alone is how an authorization check
        // against one resource ends up acting on another.
        if let Some(comment_id) = comment_id {
            self.comment_in(id, comment_id).await?;
        }

        let updated = self
            .discussions
            .set_accepted_comment(id, comment_id, now)
            .await?;

        self.record_audit(
            "discussion.answer_accepted",
            user,
            id,
            serde_json::json!({
                "commentId": comment_id.map(|value| value.to_string()),
                "requestId": audit.request_id,
            }),
        )
        .await?;

        Ok(updated)
    }

    pub async fn change_status(
        &self,
        user: &CurrentUser,
        id: PostId,
        target: ModerationStatus,
        now: DateTime<Utc>,
        audit: &AuditContext,
    ) -> Result<DiscussionRecord, ApplicationError> {
        let discussion = self.visible(Some(user), id).await?;
        let actor = self.actor_for(user, &discussion).await?;

        require(
            action_for_transition(discussion.moderation_status, target),
            &actor,
        )?;

        if !can_transition(discussion.moderation_status, target) {
            return Err(ApplicationError::Conflict(format!(
                "cannot move a discussion from {} to {}",
                discussion.moderation_status.as_str(),
                target.as_str()
            )));
        }

        let updated = self
            .discussions
            .set_status(id, discussion.moderation_status, target, now)
            .await?;

        self.record_audit(
            "discussion.status_changed",
            user,
            id,
            serde_json::json!({
                "from": discussion.moderation_status.as_str(),
                "to": target.as_str(),
                "requestId": audit.request_id,
            }),
        )
        .await?;

        Ok(updated)
    }

    /// Copies a discussion or one of its replies into a new archive draft owned
    /// by the promoter, and records where it came from. The source is never
    /// modified: a thread can seed several entries, and the reply's author
    /// keeps their attribution through `source_author_id`.
    pub async fn promote(
        &self,
        user: &CurrentUser,
        id: PostId,
        input: PromoteInput,
        now: DateTime<Utc>,
        audit: &AuditContext,
    ) -> Result<PromotionOutcome, ApplicationError> {
        let discussion = self.visible(Some(user), id).await?;
        require(Action::PromoteToArchive, &actor_without_resource(user))?;

        // Promotion copies text verbatim into an artifact that is moderated
        // separately. If a draft or hidden thread could be promoted, publishing
        // the entry would republish content that was deliberately not public.
        // Being *able to see* the source is not enough — it must be public.
        if !discussion.moderation_status.is_publicly_visible() {
            return Err(ApplicationError::Conflict(format!(
                "only a publicly readable discussion can be promoted, this one is {}",
                discussion.moderation_status.as_str()
            )));
        }

        let comment = match input.comment_id {
            Some(comment_id) => Some(self.comment_in(id, comment_id).await?),
            None => None,
        };

        let (source_body, source_author_id) = match &comment {
            Some(comment) => (comment.body.clone(), comment.author_id),
            None => (discussion.body.clone(), discussion.author_id),
        };

        let entry = self
            .entries
            .insert(NewArchiveEntry {
                author_id: user.id,
                title: match input.title {
                    Some(value) => text(validate_title(&value), "title")?,
                    None => discussion.title.clone(),
                },
                body: match input.body {
                    Some(value) => text(validate_body(&value), "body")?,
                    None => source_body,
                },
                summary: match input.summary {
                    Some(value) => text(
                        campus_agora_domain::validate_summary(Some(&value)),
                        "summary",
                    )?,
                    None => None,
                },
                tags: match input.tags {
                    Some(value) => tags(&value)?,
                    None => discussion.tags.clone(),
                },
                category: input
                    .category
                    .unwrap_or(campus_agora_domain::ArchiveCategory::Other),
                applicable_audience: input
                    .applicable_audience
                    .unwrap_or(campus_agora_domain::ApplicableAudience::AllStudents),
                // The structured link below is the provenance record; the
                // free-text reference stays empty so there is one source of
                // truth about where this came from.
                source_kind: SourceKind::Discussion,
                source_reference: None,
                created_at: now,
            })
            .await?;

        let source = self
            .sources
            .insert(NewArchiveSource {
                entry_id: entry.id,
                source_post_id: id,
                source_comment_id: input.comment_id,
                source_author_id,
                created_at: now,
            })
            .await?;

        self.record_audit(
            "discussion.promoted",
            user,
            id,
            serde_json::json!({
                "entryId": entry.id.to_string(),
                "commentId": input.comment_id.map(|value| value.to_string()),
                "requestId": audit.request_id,
            }),
        )
        .await?;

        Ok(PromotionOutcome { entry, source })
    }

    pub async fn promote_as_guest(
        &self,
        _id: PostId,
        _input: PromoteInput,
        _now: DateTime<Utc>,
        _audit: &AuditContext,
    ) -> Result<PromotionOutcome, ApplicationError> {
        require(Action::PromoteToArchive, &Actor::Guest)?;

        unreachable!("guests are denied PromoteToArchive by the permission matrix")
    }

    /// What this discussion produced. Scoped to the reader, so an entry still
    /// in draft is listed to its author and to nobody else.
    pub async fn list_derived_entries(
        &self,
        user: Option<&CurrentUser>,
        id: PostId,
    ) -> Result<Vec<DerivedEntryRecord>, ApplicationError> {
        self.visible(user, id).await?;

        self.sources.list_derived_entries(id, scope_for(user)).await
    }

    async fn visible(
        &self,
        user: Option<&CurrentUser>,
        id: PostId,
    ) -> Result<DiscussionRecord, ApplicationError> {
        self.discussions
            .find_visible(id, scope_for(user))
            .await?
            .ok_or_else(|| ApplicationError::NotFound("discussion not found".to_owned()))
    }

    async fn comment_in(
        &self,
        post_id: PostId,
        id: CommentId,
    ) -> Result<CommentRecord, ApplicationError> {
        self.comments
            .find_in_post(post_id, id)
            .await?
            .ok_or_else(|| ApplicationError::NotFound("reply not found".to_owned()))
    }

    async fn actor_for(
        &self,
        user: &CurrentUser,
        discussion: &DiscussionRecord,
    ) -> Result<Actor, ApplicationError> {
        let is_assigned_maintainer = self
            .discussions
            .is_maintainer(discussion.id, user.id)
            .await?;

        Ok(Actor::Authenticated(AuthenticatedActor {
            system_role: user.system_role,
            is_resource_author: discussion.author_id == user.id,
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
                resource_type: "discussion".to_owned(),
                resource_id: Some(id.into_uuid()),
                metadata,
            })
            .await
    }
}

/// Publishing your own draft, retiring your own thread, and moderating someone
/// else's content are three different privileges, so they check three actions.
pub(crate) fn action_for_transition(from: ModerationStatus, to: ModerationStatus) -> Action {
    match (from, to) {
        (ModerationStatus::Draft, ModerationStatus::Published) => Action::PublishArchiveEntry,
        (ModerationStatus::Published, ModerationStatus::Archived)
        | (ModerationStatus::Archived, ModerationStatus::Published) => Action::ArchiveContent,
        _ => Action::ChangeModerationState,
    }
}

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
