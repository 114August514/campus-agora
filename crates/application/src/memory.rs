//! In-memory implementations of the auth repository traits. Used by
//! application tests, API integration tests, and the database-less local
//! development fallback. Never used in production deployments.

use std::sync::Mutex;

use async_trait::async_trait;
use campus_agora_domain::{
    CommentId, CorrectionId, ModerationStatus, OrganizationId, PostId, RevisionId, SessionId,
    UserId,
};
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::errors::ApplicationError;
use crate::ports::{
    ArchiveEntryRecord, ArchiveEntryUpdate, ArchiveListQuery, ArchiveRepository,
    ArchiveSourceRecord, ArchiveSourceRepository, AuditEventRepository, CommentRecord,
    CommentRepository, CorrectionRecord, CorrectionRepository, DerivedEntryRecord,
    DiscussionListQuery, DiscussionRecord, DiscussionRepository, MembershipSummary,
    NewArchiveEntry, NewArchiveSource, NewAuditEvent, NewComment, NewCorrection, NewDiscussion,
    NewSession, NewUser, OrganizationRecord, OrganizationRepository, Page, RevisionRecord,
    RevisionWrite, SessionRecord, SessionRepository, UserRecord, UserRepository, VisibilityScope,
};

#[derive(Default)]
struct StoreState {
    users: Vec<UserRecord>,
    sessions: Vec<SessionRecord>,
    organizations: Vec<OrganizationRecord>,
    memberships: Vec<(OrganizationId, UserId)>,
    audit_events: Vec<NewAuditEvent>,
    entries: Vec<ArchiveEntryRecord>,
    revisions: Vec<RevisionRecord>,
    maintainers: Vec<(PostId, UserId)>,
    corrections: Vec<CorrectionRecord>,
    discussions: Vec<DiscussionRecord>,
    comments: Vec<CommentRecord>,
    sources: Vec<ArchiveSourceRecord>,
}

#[derive(Default)]
pub struct InMemoryAuthStore {
    state: Mutex<StoreState>,
}

impl InMemoryAuthStore {
    pub fn user_count(&self) -> usize {
        self.state.lock().expect("store lock").users.len()
    }

    pub fn membership_count(&self) -> usize {
        self.state.lock().expect("store lock").memberships.len()
    }

    pub fn sessions_snapshot(&self) -> Vec<SessionRecord> {
        self.state.lock().expect("store lock").sessions.clone()
    }

    pub fn audit_events_snapshot(&self) -> Vec<NewAuditEvent> {
        self.state.lock().expect("store lock").audit_events.clone()
    }
}

#[async_trait]
impl UserRepository for InMemoryAuthStore {
    /// Mirrors `PgAuthStore::upsert`: the provider seeds `system_role` only on
    /// first sight, so a later login cannot undo a locally assigned role.
    async fn upsert(&self, user: NewUser) -> Result<UserRecord, ApplicationError> {
        let mut state = self.state.lock().expect("store lock");

        if let Some(existing) = state.users.iter_mut().find(|candidate| {
            candidate.auth_provider == user.auth_provider
                && candidate.provider_subject_hash == user.provider_subject_hash
        }) {
            existing.display_name = user.display_name;
            return Ok(existing.clone());
        }

        let record = UserRecord {
            id: UserId::from_uuid(Uuid::new_v4()),
            auth_provider: user.auth_provider,
            provider_subject_hash: user.provider_subject_hash,
            display_name: user.display_name,
            system_role: user.system_role,
        };
        state.users.push(record.clone());

        Ok(record)
    }

    async fn find_by_id(&self, id: UserId) -> Result<Option<UserRecord>, ApplicationError> {
        let state = self.state.lock().expect("store lock");

        Ok(state.users.iter().find(|user| user.id == id).cloned())
    }
}

#[async_trait]
impl SessionRepository for InMemoryAuthStore {
    async fn insert(&self, session: NewSession) -> Result<SessionRecord, ApplicationError> {
        let mut state = self.state.lock().expect("store lock");

        if state
            .sessions
            .iter()
            .any(|candidate| candidate.token_hash == session.token_hash)
        {
            return Err(ApplicationError::Conflict(
                "session token hash already exists".to_owned(),
            ));
        }

        let record = SessionRecord {
            id: SessionId::from_uuid(Uuid::new_v4()),
            user_id: session.user_id,
            token_hash: session.token_hash,
            created_at: session.created_at,
            expires_at: session.expires_at,
            revoked_at: None,
        };
        state.sessions.push(record.clone());

        Ok(record)
    }

    async fn find_by_token_hash(
        &self,
        token_hash: &str,
    ) -> Result<Option<SessionRecord>, ApplicationError> {
        let state = self.state.lock().expect("store lock");

        Ok(state
            .sessions
            .iter()
            .find(|session| session.token_hash == token_hash)
            .cloned())
    }

    /// Idempotent: concurrent logouts can both resolve the same session, and
    /// the loser must still succeed. The first revocation timestamp wins.
    async fn revoke(
        &self,
        session_id: SessionId,
        revoked_at: DateTime<Utc>,
    ) -> Result<(), ApplicationError> {
        let mut state = self.state.lock().expect("store lock");

        let session = state
            .sessions
            .iter_mut()
            .find(|session| session.id == session_id)
            .ok_or_else(|| ApplicationError::NotFound("session not found".to_owned()))?;
        session.revoked_at.get_or_insert(revoked_at);

        Ok(())
    }
}

#[async_trait]
impl OrganizationRepository for InMemoryAuthStore {
    async fn upsert_organization(
        &self,
        slug: &str,
        name: &str,
    ) -> Result<OrganizationRecord, ApplicationError> {
        let mut state = self.state.lock().expect("store lock");

        if let Some(existing) = state
            .organizations
            .iter()
            .find(|organization| organization.slug == slug)
        {
            return Ok(existing.clone());
        }

        let record = OrganizationRecord {
            id: OrganizationId::from_uuid(Uuid::new_v4()),
            slug: slug.to_owned(),
            name: name.to_owned(),
        };
        state.organizations.push(record.clone());

        Ok(record)
    }

    async fn ensure_membership(
        &self,
        organization_id: OrganizationId,
        user_id: UserId,
    ) -> Result<(), ApplicationError> {
        let mut state = self.state.lock().expect("store lock");

        let exists = state.memberships.contains(&(organization_id, user_id));

        if !exists {
            state.memberships.push((organization_id, user_id));
        }

        Ok(())
    }

    async fn list_memberships_for_user(
        &self,
        user_id: UserId,
    ) -> Result<Vec<MembershipSummary>, ApplicationError> {
        let state = self.state.lock().expect("store lock");

        Ok(state
            .memberships
            .iter()
            .filter(|(_, member)| *member == user_id)
            .filter_map(|(organization_id, _)| {
                state
                    .organizations
                    .iter()
                    .find(|organization| organization.id == *organization_id)
                    .map(|organization| MembershipSummary {
                        organization_id: organization.id,
                        slug: organization.slug.clone(),
                        name: organization.name.clone(),
                    })
            })
            .collect())
    }
}

#[async_trait]
impl AuditEventRepository for InMemoryAuthStore {
    async fn record(&self, event: NewAuditEvent) -> Result<(), ApplicationError> {
        let mut state = self.state.lock().expect("store lock");
        state.audit_events.push(event);

        Ok(())
    }
}

/// Whether `scope` may see an entry. Mirrors the SQL predicate in
/// `crates/db`; the M1 review showed that letting the two stores drift hides
/// real bugs from the integration suite.
fn scope_can_see(
    scope: VisibilityScope,
    entry: &ArchiveEntryRecord,
    maintainers: &[(PostId, UserId)],
) -> bool {
    if entry.moderation_status.is_publicly_visible() {
        return true;
    }

    match scope {
        VisibilityScope::Public => false,
        VisibilityScope::Full => true,
        VisibilityScope::Owner(user_id) => {
            entry.author_id == user_id
                || maintainers
                    .iter()
                    .any(|(post_id, maintainer)| *post_id == entry.id && *maintainer == user_id)
        }
    }
}

#[async_trait]
impl ArchiveRepository for InMemoryAuthStore {
    async fn insert(&self, entry: NewArchiveEntry) -> Result<ArchiveEntryRecord, ApplicationError> {
        let mut state = self.state.lock().expect("store lock");

        let record = ArchiveEntryRecord {
            id: PostId::from_uuid(Uuid::new_v4()),
            author_id: entry.author_id,
            title: entry.title.clone(),
            body: entry.body.clone(),
            summary: entry.summary.clone(),
            tags: entry.tags.clone(),
            category: entry.category,
            applicable_audience: entry.applicable_audience,
            source_kind: entry.source_kind,
            source_reference: entry.source_reference.clone(),
            moderation_status: ModerationStatus::Draft,
            current_revision: 1,
            created_at: entry.created_at,
            updated_at: entry.created_at,
        };

        state.revisions.push(RevisionRecord {
            id: RevisionId::from_uuid(Uuid::new_v4()),
            post_id: record.id,
            revision: 1,
            editor_id: entry.author_id,
            title: entry.title,
            body: entry.body,
            summary: entry.summary,
            tags: entry.tags,
            created_at: entry.created_at,
        });
        state.entries.push(record.clone());

        Ok(record)
    }

    async fn find_visible(
        &self,
        id: PostId,
        scope: VisibilityScope,
    ) -> Result<Option<ArchiveEntryRecord>, ApplicationError> {
        let state = self.state.lock().expect("store lock");

        Ok(state
            .entries
            .iter()
            .find(|entry| entry.id == id && scope_can_see(scope, entry, &state.maintainers))
            .cloned())
    }

    async fn list(
        &self,
        query: ArchiveListQuery,
    ) -> Result<Page<ArchiveEntryRecord>, ApplicationError> {
        let state = self.state.lock().expect("store lock");

        let mut matched: Vec<ArchiveEntryRecord> = state
            .entries
            .iter()
            .filter(|entry| scope_can_see(query.scope, entry, &state.maintainers))
            .filter(|entry| {
                query.q.as_ref().is_none_or(|needle| {
                    let needle = needle.to_lowercase();
                    entry.title.to_lowercase().contains(&needle)
                        || entry
                            .summary
                            .as_ref()
                            .is_some_and(|summary| summary.to_lowercase().contains(&needle))
                })
            })
            .filter(|entry| {
                query
                    .tag
                    .as_ref()
                    .is_none_or(|tag| entry.tags.contains(tag))
            })
            .filter(|entry| {
                query
                    .category
                    .is_none_or(|category| entry.category == category)
            })
            .cloned()
            .collect();

        matched.sort_by(|a, b| b.updated_at.cmp(&a.updated_at).then(b.id.cmp(&a.id)));

        let total_items = matched.len() as u64;
        let page_size = query.page_size.max(1);
        let total_pages = total_items.div_ceil(u64::from(page_size)) as u32;
        let offset = ((query.page - 1) as usize).saturating_mul(page_size as usize);

        Ok(Page {
            items: matched
                .into_iter()
                .skip(offset)
                .take(page_size as usize)
                .collect(),
            page: query.page,
            page_size,
            total_items,
            total_pages,
        })
    }

    async fn update(
        &self,
        id: PostId,
        update: ArchiveEntryUpdate,
    ) -> Result<ArchiveEntryRecord, ApplicationError> {
        let mut state = self.state.lock().expect("store lock");

        let entry = state
            .entries
            .iter_mut()
            .find(|entry| entry.id == id)
            .ok_or_else(|| ApplicationError::NotFound("archive entry not found".to_owned()))?;

        entry.title = update.title.clone();
        entry.body = update.body.clone();
        entry.summary = update.summary.clone();
        entry.tags = update.tags.clone();
        entry.category = update.category;
        entry.applicable_audience = update.applicable_audience;
        entry.source_kind = update.source_kind;
        entry.source_reference = update.source_reference;
        entry.updated_at = update.updated_at;

        match update.revision {
            RevisionWrite::Append(revision) => {
                entry.current_revision = revision.revision;
                let snapshot = RevisionRecord {
                    id: RevisionId::from_uuid(Uuid::new_v4()),
                    post_id: id,
                    revision: revision.revision,
                    editor_id: revision.editor_id,
                    title: update.title,
                    body: update.body,
                    summary: update.summary,
                    tags: update.tags,
                    created_at: update.updated_at,
                };
                let updated = entry.clone();
                state.revisions.push(snapshot);
                Ok(updated)
            }
            RevisionWrite::RewriteCurrent { editor_id } => {
                let current = entry.current_revision;
                let updated = entry.clone();

                if let Some(snapshot) = state
                    .revisions
                    .iter_mut()
                    .find(|snapshot| snapshot.post_id == id && snapshot.revision == current)
                {
                    snapshot.editor_id = editor_id;
                    snapshot.title = update.title;
                    snapshot.body = update.body;
                    snapshot.summary = update.summary;
                    snapshot.tags = update.tags;
                    snapshot.created_at = update.updated_at;
                }

                Ok(updated)
            }
        }
    }

    async fn set_status(
        &self,
        id: PostId,
        expected: ModerationStatus,
        status: ModerationStatus,
        updated_at: DateTime<Utc>,
    ) -> Result<ArchiveEntryRecord, ApplicationError> {
        let mut state = self.state.lock().expect("store lock");

        let entry = state
            .entries
            .iter_mut()
            .find(|entry| entry.id == id)
            .ok_or_else(|| ApplicationError::NotFound("archive entry not found".to_owned()))?;

        if entry.moderation_status != expected {
            return Err(ApplicationError::Conflict(
                "the entry changed state concurrently; reload and retry".to_owned(),
            ));
        }

        entry.moderation_status = status;
        entry.updated_at = updated_at;

        Ok(entry.clone())
    }

    async fn list_revisions(&self, id: PostId) -> Result<Vec<RevisionRecord>, ApplicationError> {
        let state = self.state.lock().expect("store lock");

        let mut revisions: Vec<RevisionRecord> = state
            .revisions
            .iter()
            .filter(|revision| revision.post_id == id)
            .cloned()
            .collect();
        revisions.sort_by_key(|revision| revision.revision);

        Ok(revisions)
    }

    async fn is_maintainer(&self, id: PostId, user_id: UserId) -> Result<bool, ApplicationError> {
        let state = self.state.lock().expect("store lock");

        Ok(state.maintainers.contains(&(id, user_id)))
    }
}

#[async_trait]
impl CorrectionRepository for InMemoryAuthStore {
    async fn insert(
        &self,
        correction: NewCorrection,
    ) -> Result<CorrectionRecord, ApplicationError> {
        let mut state = self.state.lock().expect("store lock");

        let record = CorrectionRecord {
            id: CorrectionId::from_uuid(Uuid::new_v4()),
            post_id: correction.post_id,
            reporter_id: correction.reporter_id,
            message: correction.message,
            created_at: correction.created_at,
            resolved_at: None,
            resolved_by: None,
        };
        state.corrections.push(record.clone());

        Ok(record)
    }

    async fn list_for_post(
        &self,
        post_id: PostId,
    ) -> Result<Vec<CorrectionRecord>, ApplicationError> {
        let state = self.state.lock().expect("store lock");

        Ok(state
            .corrections
            .iter()
            .filter(|correction| correction.post_id == post_id)
            .cloned()
            .collect())
    }

    /// Idempotent, like session revocation: the first resolution wins so a
    /// concurrent resolve cannot rewrite who closed the report.
    async fn resolve(
        &self,
        post_id: PostId,
        id: CorrectionId,
        resolved_by: UserId,
        resolved_at: DateTime<Utc>,
    ) -> Result<CorrectionRecord, ApplicationError> {
        let mut state = self.state.lock().expect("store lock");

        let correction = state
            .corrections
            .iter_mut()
            .find(|correction| correction.id == id && correction.post_id == post_id)
            .ok_or_else(|| ApplicationError::NotFound("correction not found".to_owned()))?;

        if correction.resolved_at.is_none() {
            correction.resolved_at = Some(resolved_at);
            correction.resolved_by = Some(resolved_by);
        }

        Ok(correction.clone())
    }
}

/// Whether `scope` may see a discussion. Deliberately identical in shape to
/// `scope_can_see` for entries, and to the SQL predicate: one rule with three
/// implementations is one rule that will eventually disagree with itself.
fn scope_can_see_discussion(
    scope: VisibilityScope,
    discussion: &DiscussionRecord,
    maintainers: &[(PostId, UserId)],
) -> bool {
    if discussion.moderation_status.is_publicly_visible() {
        return true;
    }

    match scope {
        VisibilityScope::Public => false,
        VisibilityScope::Full => true,
        VisibilityScope::Owner(user_id) => {
            discussion.author_id == user_id
                || maintainers.iter().any(|(post_id, maintainer)| {
                    *post_id == discussion.id && *maintainer == user_id
                })
        }
    }
}

#[async_trait]
impl DiscussionRepository for InMemoryAuthStore {
    async fn insert(
        &self,
        discussion: NewDiscussion,
    ) -> Result<DiscussionRecord, ApplicationError> {
        let mut state = self.state.lock().expect("store lock");

        let record = DiscussionRecord {
            id: PostId::from_uuid(Uuid::new_v4()),
            author_id: discussion.author_id,
            title: discussion.title,
            body: discussion.body,
            tags: discussion.tags,
            moderation_status: ModerationStatus::Draft,
            accepted_comment_id: None,
            reply_count: 0,
            created_at: discussion.created_at,
            updated_at: discussion.created_at,
        };

        state.discussions.push(record.clone());

        Ok(record)
    }

    async fn find_visible(
        &self,
        id: PostId,
        scope: VisibilityScope,
    ) -> Result<Option<DiscussionRecord>, ApplicationError> {
        let state = self.state.lock().expect("store lock");

        Ok(state
            .discussions
            .iter()
            .find(|discussion| discussion.id == id)
            .filter(|discussion| scope_can_see_discussion(scope, discussion, &state.maintainers))
            .map(|discussion| with_reply_count(discussion, &state.comments)))
    }

    async fn list(
        &self,
        query: DiscussionListQuery,
    ) -> Result<Page<DiscussionRecord>, ApplicationError> {
        let state = self.state.lock().expect("store lock");

        let mut matching: Vec<DiscussionRecord> = state
            .discussions
            .iter()
            .filter(|discussion| {
                scope_can_see_discussion(query.scope, discussion, &state.maintainers)
            })
            .filter(|discussion| match &query.q {
                None => true,
                Some(needle) => {
                    let needle = needle.to_lowercase();
                    discussion.title.to_lowercase().contains(&needle)
                        || discussion.body.to_lowercase().contains(&needle)
                }
            })
            .filter(|discussion| match &query.tag {
                None => true,
                Some(tag) => discussion.tags.iter().any(|value| value == tag),
            })
            .map(|discussion| with_reply_count(discussion, &state.comments))
            .collect();

        // Newest activity first, matching the SQL `order by`.
        matching.sort_by(|left, right| {
            right
                .updated_at
                .cmp(&left.updated_at)
                .then_with(|| right.id.cmp(&left.id))
        });

        let total_items = matching.len() as u64;
        let page_size = query.page_size.max(1);
        let total_pages = total_items.div_ceil(u64::from(page_size)) as u32;
        let offset = ((query.page.saturating_sub(1)) as usize).saturating_mul(page_size as usize);

        Ok(Page {
            items: matching
                .into_iter()
                .skip(offset)
                .take(page_size as usize)
                .collect(),
            page: query.page,
            page_size,
            total_items,
            total_pages,
        })
    }

    async fn set_status(
        &self,
        id: PostId,
        expected: ModerationStatus,
        status: ModerationStatus,
        updated_at: DateTime<Utc>,
    ) -> Result<DiscussionRecord, ApplicationError> {
        let mut state = self.state.lock().expect("store lock");
        let comments = state.comments.clone();

        let discussion = state
            .discussions
            .iter_mut()
            .find(|discussion| discussion.id == id)
            .ok_or_else(|| ApplicationError::NotFound("discussion not found".to_owned()))?;

        // Compare-and-swap, like the SQL store: the caller authorized the
        // transition against the status they read.
        if discussion.moderation_status != expected {
            return Err(ApplicationError::Conflict(
                "discussion changed since it was read".to_owned(),
            ));
        }

        discussion.moderation_status = status;
        discussion.updated_at = updated_at;

        Ok(with_reply_count(discussion, &comments))
    }

    async fn set_accepted_comment(
        &self,
        id: PostId,
        comment_id: Option<CommentId>,
        updated_at: DateTime<Utc>,
    ) -> Result<DiscussionRecord, ApplicationError> {
        let mut state = self.state.lock().expect("store lock");
        let comments = state.comments.clone();

        // The comment must belong to this discussion. The SQL store enforces
        // the same thing in its `where` clause, so a caller cannot mark an
        // answer on a discussion they were not authorized against.
        if let Some(comment_id) = comment_id {
            let belongs = comments
                .iter()
                .any(|comment| comment.id == comment_id && comment.post_id == id);

            if !belongs {
                return Err(ApplicationError::NotFound("reply not found".to_owned()));
            }
        }

        let discussion = state
            .discussions
            .iter_mut()
            .find(|discussion| discussion.id == id)
            .ok_or_else(|| ApplicationError::NotFound("discussion not found".to_owned()))?;

        discussion.accepted_comment_id = comment_id;
        discussion.updated_at = updated_at;

        Ok(with_reply_count(discussion, &comments))
    }

    async fn is_maintainer(&self, id: PostId, user_id: UserId) -> Result<bool, ApplicationError> {
        let state = self.state.lock().expect("store lock");

        Ok(state
            .maintainers
            .iter()
            .any(|(post_id, maintainer)| *post_id == id && *maintainer == user_id))
    }
}

/// `reply_count` is derived rather than stored, so it cannot fall out of step
/// with the comments themselves.
fn with_reply_count(discussion: &DiscussionRecord, comments: &[CommentRecord]) -> DiscussionRecord {
    let mut record = discussion.clone();
    record.reply_count = comments
        .iter()
        .filter(|comment| comment.post_id == discussion.id)
        .count() as i64;

    record
}

#[async_trait]
impl CommentRepository for InMemoryAuthStore {
    async fn insert(&self, comment: NewComment) -> Result<CommentRecord, ApplicationError> {
        let mut state = self.state.lock().expect("store lock");

        let record = CommentRecord {
            id: CommentId::from_uuid(Uuid::new_v4()),
            post_id: comment.post_id,
            author_id: comment.author_id,
            body: comment.body,
            created_at: comment.created_at,
            updated_at: comment.created_at,
        };

        state.comments.push(record.clone());

        Ok(record)
    }

    /// Oldest first: a thread reads in the order it happened.
    async fn list_for_post(&self, post_id: PostId) -> Result<Vec<CommentRecord>, ApplicationError> {
        let state = self.state.lock().expect("store lock");

        Ok(state
            .comments
            .iter()
            .filter(|comment| comment.post_id == post_id)
            .cloned()
            .collect())
    }

    async fn find_in_post(
        &self,
        post_id: PostId,
        id: CommentId,
    ) -> Result<Option<CommentRecord>, ApplicationError> {
        let state = self.state.lock().expect("store lock");

        Ok(state
            .comments
            .iter()
            .find(|comment| comment.id == id && comment.post_id == post_id)
            .cloned())
    }
}

#[async_trait]
impl ArchiveSourceRepository for InMemoryAuthStore {
    async fn insert(
        &self,
        source: NewArchiveSource,
    ) -> Result<ArchiveSourceRecord, ApplicationError> {
        let mut state = self.state.lock().expect("store lock");

        let source_title = state
            .discussions
            .iter()
            .find(|discussion| discussion.id == source.source_post_id)
            .map(|discussion| discussion.title.clone())
            .ok_or_else(|| ApplicationError::NotFound("source discussion not found".to_owned()))?;

        let record = ArchiveSourceRecord {
            entry_id: source.entry_id,
            source_post_id: source.source_post_id,
            source_comment_id: source.source_comment_id,
            source_author_id: source.source_author_id,
            source_title,
            created_at: source.created_at,
        };

        state.sources.push(record.clone());

        Ok(record)
    }

    async fn list_for_entry(
        &self,
        entry_id: PostId,
        scope: VisibilityScope,
    ) -> Result<Vec<ArchiveSourceRecord>, ApplicationError> {
        let state = self.state.lock().expect("store lock");

        Ok(state
            .sources
            .iter()
            .filter(|source| source.entry_id == entry_id)
            // A source pointing at a discussion the reader cannot see is
            // omitted; otherwise the backlink would disclose its title.
            .filter(|source| {
                state
                    .discussions
                    .iter()
                    .find(|discussion| discussion.id == source.source_post_id)
                    .is_some_and(|discussion| {
                        scope_can_see_discussion(scope, discussion, &state.maintainers)
                    })
            })
            .cloned()
            .collect())
    }

    async fn list_derived_entries(
        &self,
        source_post_id: PostId,
        scope: VisibilityScope,
    ) -> Result<Vec<DerivedEntryRecord>, ApplicationError> {
        let state = self.state.lock().expect("store lock");

        Ok(state
            .sources
            .iter()
            .filter(|source| source.source_post_id == source_post_id)
            .filter_map(|source| {
                state
                    .entries
                    .iter()
                    .find(|entry| entry.id == source.entry_id)
                    .filter(|entry| scope_can_see(scope, entry, &state.maintainers))
                    .map(|entry| DerivedEntryRecord {
                        entry_id: entry.id,
                        title: entry.title.clone(),
                        moderation_status: entry.moderation_status,
                        created_at: source.created_at,
                    })
            })
            .collect())
    }
}
