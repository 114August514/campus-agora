//! AI-assisted archive drafting.
//!
//! The whole use case is: read a public discussion, ask a provider to compose
//! a draft from it, write that draft as an ordinary archive entry owned by the
//! human who asked, and record every source it used. Publishing then runs the
//! existing human path with the existing permission checks — this module has
//! no publish call of its own.

use std::sync::Arc;

use campus_agora_domain::{
    is_allowed, Action, Actor, AuthenticatedActor, PostId, SourceKind, SystemRole,
};
use chrono::{DateTime, Utc};

use crate::ai::provider::{ArchiveDraftProvider, DraftRequest, DraftSource};
use crate::auth::{AuditContext, CurrentUser};
use crate::errors::ApplicationError;
use crate::ports::{
    ArchiveEntryRecord, ArchiveRepository, ArchiveSourceRepository, AuditEventRepository,
    CommentRepository, DiscussionRepository, NewArchiveEntry, NewArchiveSource, NewAuditEvent,
    VisibilityScope,
};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct AiDraftConfig {
    /// Mirrors `AI_ARCHIVE_ENABLED`. Off by default, so the feature cannot
    /// appear by accident in an environment nobody configured for it.
    pub enabled: bool,
}

/// The drafted entry and the sources recorded for it, returned together so a
/// caller never has to make the round trip that would let the two drift apart.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DraftOutcome {
    pub entry: ArchiveEntryRecord,
    pub sources: Vec<crate::ports::ArchiveSourceRecord>,
}

pub struct AiDraftService {
    discussions: Arc<dyn DiscussionRepository>,
    comments: Arc<dyn CommentRepository>,
    entries: Arc<dyn ArchiveRepository>,
    sources: Arc<dyn ArchiveSourceRepository>,
    audit_events: Arc<dyn AuditEventRepository>,
    provider: Arc<dyn ArchiveDraftProvider>,
    config: AiDraftConfig,
}

impl AiDraftService {
    pub fn new(
        discussions: Arc<dyn DiscussionRepository>,
        comments: Arc<dyn CommentRepository>,
        entries: Arc<dyn ArchiveRepository>,
        sources: Arc<dyn ArchiveSourceRepository>,
        audit_events: Arc<dyn AuditEventRepository>,
        provider: Arc<dyn ArchiveDraftProvider>,
        config: AiDraftConfig,
    ) -> Self {
        Self {
            discussions,
            comments,
            entries,
            sources,
            audit_events,
            provider,
            config,
        }
    }

    pub async fn draft_from_discussion(
        &self,
        user: &CurrentUser,
        id: PostId,
        now: DateTime<Utc>,
        audit: &AuditContext,
    ) -> Result<DraftOutcome, ApplicationError> {
        if !self.config.enabled {
            return Err(ApplicationError::Forbidden);
        }

        let discussion = self
            .discussions
            .find_visible(id, scope_for(user))
            .await?
            .ok_or_else(|| ApplicationError::NotFound("discussion not found".to_owned()))?;

        require(Action::PromoteToArchive, &actor_for(user))?;

        // The same rule hand promotion follows. Drafting copies text into an
        // artifact moderated separately, so a draft or hidden thread must not
        // be a route by which non-public text reaches a publishable entry —
        // being able to *see* it is not enough.
        if !discussion.moderation_status.is_publicly_visible() {
            return Err(ApplicationError::Conflict(format!(
                "only a publicly readable discussion can be drafted from, this one is {}",
                discussion.moderation_status.as_str()
            )));
        }

        let replies = self.comments.list_for_post(id).await?;

        let mut request_sources = vec![DraftSource {
            comment_id: None,
            body: discussion.body.clone(),
            accepted: false,
        }];
        request_sources.extend(replies.iter().map(|reply| DraftSource {
            comment_id: Some(reply.id),
            body: reply.body.clone(),
            accepted: discussion.accepted_comment_id == Some(reply.id),
        }));

        let suggestion = self
            .provider
            .draft(DraftRequest {
                title: discussion.title.clone(),
                tags: discussion.tags.clone(),
                sources: request_sources,
            })
            .await?;

        let entry = self
            .entries
            .insert(NewArchiveEntry {
                author_id: user.id,
                title: suggestion.title,
                body: suggestion.body,
                summary: suggestion.summary,
                tags: discussion.tags.clone(),
                category: campus_agora_domain::ArchiveCategory::Other,
                applicable_audience: campus_agora_domain::ApplicableAudience::AllStudents,
                source_kind: SourceKind::Discussion,
                source_reference: None,
                // Traceable: a reader can tell composed text from written text,
                // and which provider composed it.
                ai_provider: Some(self.provider.name().to_owned()),
                created_at: now,
            })
            .await?;

        // Every source the provider said it used, with the person who actually
        // wrote it. Recording only the discussion would make "source-backed" a
        // claim rather than something a reviewer can check.
        let mut recorded = Vec::new();
        for used in &suggestion.used_sources {
            let source_author_id = match used {
                None => discussion.author_id,
                Some(comment_id) => match replies.iter().find(|reply| reply.id == *comment_id) {
                    Some(reply) => reply.author_id,
                    // A provider that invented an id gets that source dropped
                    // rather than silently attributed to the wrong person.
                    None => continue,
                },
            };

            recorded.push(
                self.sources
                    .insert(NewArchiveSource {
                        entry_id: entry.id,
                        source_post_id: id,
                        source_comment_id: *used,
                        source_author_id,
                        created_at: now,
                    })
                    .await?,
            );
        }

        self.audit_events
            .record(NewAuditEvent {
                actor_id: Some(user.id),
                action: "ai.draft_generated".to_owned(),
                resource_type: "archive_entry".to_owned(),
                resource_id: Some(entry.id.into_uuid()),
                metadata: serde_json::json!({
                    "provider": self.provider.name(),
                    "discussionId": id.to_string(),
                    "sourceCount": recorded.len(),
                    "requestId": audit.request_id,
                }),
            })
            .await?;

        Ok(DraftOutcome {
            entry,
            sources: recorded,
        })
    }

    /// Explicit guest path, so a caller cannot skip the check by having no
    /// user to pass.
    pub async fn draft_from_discussion_as_guest(
        &self,
        _id: PostId,
        _now: DateTime<Utc>,
        _audit: &AuditContext,
    ) -> Result<DraftOutcome, ApplicationError> {
        require(Action::PromoteToArchive, &Actor::Guest)?;

        unreachable!("guests are denied PromoteToArchive by the permission matrix")
    }
}

fn scope_for(user: &CurrentUser) -> VisibilityScope {
    match user.system_role {
        SystemRole::Moderator | SystemRole::Admin => VisibilityScope::Full,
        _ => VisibilityScope::Owner(user.id),
    }
}

fn actor_for(user: &CurrentUser) -> Actor {
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
