//! PostgreSQL implementations of the application auth repository traits.
//! Queries bind parameters only; no user input is interpolated into SQL.

use async_trait::async_trait;
use campus_agora_application::errors::ApplicationError;
use campus_agora_application::ports::{
    ArchiveEntryRecord, ArchiveEntryUpdate, ArchiveListQuery, ArchiveRepository,
    ArchiveSourceRecord, ArchiveSourceRepository, AuditEventRepository, CommentRecord,
    CommentRepository, CorrectionRecord, CorrectionRepository, DerivedEntryRecord,
    DiscussionListQuery, DiscussionRecord, DiscussionRepository, MembershipSummary,
    NewArchiveEntry, NewArchiveSource, NewAuditEvent, NewComment, NewCorrection, NewDiscussion,
    NewSession, NewUser, OrganizationRecord, OrganizationRepository, Page, RevisionRecord,
    RevisionWrite, SessionRecord, SessionRepository, UserRecord, UserRepository, VisibilityScope,
};
use campus_agora_domain::{
    ApplicableAudience, ArchiveCategory, AuthProviderKind, CommentId, CorrectionId,
    ModerationStatus, OrganizationId, PostId, PostKind, RevisionId, SessionId, SourceKind,
    SystemRole, UserId,
};
use chrono::{DateTime, Utc};
use sqlx::postgres::PgRow;
use sqlx::{PgPool, Row};
use uuid::Uuid;

pub struct PgAuthStore {
    pool: PgPool,
}

impl PgAuthStore {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

fn internal(error: sqlx::Error) -> ApplicationError {
    ApplicationError::Internal(format!("database error: {error}"))
}

fn user_from_row(row: &PgRow) -> Result<UserRecord, ApplicationError> {
    let auth_provider: String = row.try_get("auth_provider").map_err(internal)?;
    let system_role: String = row.try_get("system_role").map_err(internal)?;

    Ok(UserRecord {
        id: UserId::from_uuid(row.try_get::<Uuid, _>("id").map_err(internal)?),
        auth_provider: AuthProviderKind::parse(&auth_provider).ok_or_else(|| {
            ApplicationError::Internal(format!("unknown auth provider: {auth_provider}"))
        })?,
        provider_subject_hash: row.try_get("provider_subject_hash").map_err(internal)?,
        display_name: row.try_get("display_name").map_err(internal)?,
        system_role: SystemRole::parse(&system_role).ok_or_else(|| {
            ApplicationError::Internal(format!("unknown system role: {system_role}"))
        })?,
    })
}

fn session_from_row(row: &PgRow) -> Result<SessionRecord, ApplicationError> {
    Ok(SessionRecord {
        id: SessionId::from_uuid(row.try_get::<Uuid, _>("id").map_err(internal)?),
        user_id: UserId::from_uuid(row.try_get::<Uuid, _>("user_id").map_err(internal)?),
        token_hash: row.try_get("token_hash").map_err(internal)?,
        created_at: row
            .try_get::<DateTime<Utc>, _>("created_at")
            .map_err(internal)?,
        expires_at: row
            .try_get::<DateTime<Utc>, _>("expires_at")
            .map_err(internal)?,
        revoked_at: row
            .try_get::<Option<DateTime<Utc>>, _>("revoked_at")
            .map_err(internal)?,
    })
}

#[async_trait]
impl UserRepository for PgAuthStore {
    /// The provider seeds `system_role` on first sight only. Roles are managed
    /// locally afterwards (the matrix gives Admin a `Change roles` action), so
    /// a later login must not undo an assignment. Soft-deleted accounts are
    /// excluded from the update, which surfaces as `Forbidden` rather than
    /// handing out a token whose every later request would 401.
    async fn upsert(&self, user: NewUser) -> Result<UserRecord, ApplicationError> {
        let row = sqlx::query(
            r#"
            insert into users (auth_provider, provider_subject_hash, display_name, system_role)
            values ($1, $2, $3, $4)
            on conflict (auth_provider, provider_subject_hash)
            do update set
                display_name = excluded.display_name,
                updated_at = now()
            where users.deleted_at is null
            returning id, auth_provider, provider_subject_hash, display_name, system_role
            "#,
        )
        .bind(user.auth_provider.as_str())
        .bind(&user.provider_subject_hash)
        .bind(&user.display_name)
        .bind(user.system_role.as_str())
        .fetch_one(&self.pool)
        .await
        .map_err(|error| match error {
            sqlx::Error::RowNotFound => ApplicationError::Forbidden,
            other => internal(other),
        })?;

        user_from_row(&row)
    }

    async fn find_by_id(&self, id: UserId) -> Result<Option<UserRecord>, ApplicationError> {
        let row = sqlx::query(
            r#"
            select id, auth_provider, provider_subject_hash, display_name, system_role
            from users
            where id = $1 and deleted_at is null
            "#,
        )
        .bind(id.into_uuid())
        .fetch_optional(&self.pool)
        .await
        .map_err(internal)?;

        row.as_ref().map(user_from_row).transpose()
    }
}

#[async_trait]
impl SessionRepository for PgAuthStore {
    async fn insert(&self, session: NewSession) -> Result<SessionRecord, ApplicationError> {
        let row = sqlx::query(
            r#"
            insert into sessions (user_id, token_hash, created_at, expires_at)
            values ($1, $2, $3, $4)
            returning id, user_id, token_hash, created_at, expires_at, revoked_at
            "#,
        )
        .bind(session.user_id.into_uuid())
        .bind(&session.token_hash)
        .bind(session.created_at)
        .bind(session.expires_at)
        .fetch_one(&self.pool)
        .await
        .map_err(|error| match &error {
            sqlx::Error::Database(db_error) if db_error.is_unique_violation() => {
                ApplicationError::Conflict("session token hash already exists".to_owned())
            }
            _ => internal(error),
        })?;

        session_from_row(&row)
    }

    async fn find_by_token_hash(
        &self,
        token_hash: &str,
    ) -> Result<Option<SessionRecord>, ApplicationError> {
        let row = sqlx::query(
            r#"
            select id, user_id, token_hash, created_at, expires_at, revoked_at
            from sessions
            where token_hash = $1
            "#,
        )
        .bind(token_hash)
        .fetch_optional(&self.pool)
        .await
        .map_err(internal)?;

        row.as_ref().map(session_from_row).transpose()
    }

    /// Idempotent: concurrent logouts can both resolve the same session, and
    /// the loser must still succeed rather than turning a completed logout
    /// into a 404. The `revoked_at is null` guard keeps the first revocation
    /// timestamp, so a repeat call updates nothing and is treated as success.
    async fn revoke(
        &self,
        session_id: SessionId,
        revoked_at: DateTime<Utc>,
    ) -> Result<(), ApplicationError> {
        sqlx::query(
            r#"
            update sessions
            set revoked_at = $2
            where id = $1 and revoked_at is null
            "#,
        )
        .bind(session_id.into_uuid())
        .bind(revoked_at)
        .execute(&self.pool)
        .await
        .map_err(internal)?;

        Ok(())
    }
}

#[async_trait]
impl OrganizationRepository for PgAuthStore {
    async fn upsert_organization(
        &self,
        slug: &str,
        name: &str,
    ) -> Result<OrganizationRecord, ApplicationError> {
        let row = sqlx::query(
            r#"
            insert into organizations (slug, name)
            values ($1, $2)
            on conflict (slug)
            do update set updated_at = now()
            returning id, slug, name
            "#,
        )
        .bind(slug)
        .bind(name)
        .fetch_one(&self.pool)
        .await
        .map_err(internal)?;

        Ok(OrganizationRecord {
            id: OrganizationId::from_uuid(row.try_get::<Uuid, _>("id").map_err(internal)?),
            slug: row.try_get("slug").map_err(internal)?,
            name: row.try_get("name").map_err(internal)?,
        })
    }

    async fn ensure_membership(
        &self,
        organization_id: OrganizationId,
        user_id: UserId,
    ) -> Result<(), ApplicationError> {
        sqlx::query(
            r#"
            insert into organization_memberships (organization_id, user_id)
            values ($1, $2)
            on conflict (organization_id, user_id) do nothing
            "#,
        )
        .bind(organization_id.into_uuid())
        .bind(user_id.into_uuid())
        .execute(&self.pool)
        .await
        .map_err(internal)?;

        Ok(())
    }

    async fn list_memberships_for_user(
        &self,
        user_id: UserId,
    ) -> Result<Vec<MembershipSummary>, ApplicationError> {
        let rows = sqlx::query(
            r#"
            select o.id as organization_id, o.slug, o.name
            from organization_memberships m
            join organizations o on o.id = m.organization_id
            where m.user_id = $1 and o.deleted_at is null
            order by o.slug
            "#,
        )
        .bind(user_id.into_uuid())
        .fetch_all(&self.pool)
        .await
        .map_err(internal)?;

        rows.iter()
            .map(|row| {
                Ok(MembershipSummary {
                    organization_id: OrganizationId::from_uuid(
                        row.try_get::<Uuid, _>("organization_id")
                            .map_err(internal)?,
                    ),
                    slug: row.try_get("slug").map_err(internal)?,
                    name: row.try_get("name").map_err(internal)?,
                })
            })
            .collect()
    }
}

#[async_trait]
impl AuditEventRepository for PgAuthStore {
    async fn record(&self, event: NewAuditEvent) -> Result<(), ApplicationError> {
        sqlx::query(
            r#"
            insert into audit_events (actor_id, action, resource_type, resource_id, metadata)
            values ($1, $2, $3, $4, $5)
            "#,
        )
        .bind(event.actor_id.map(UserId::into_uuid))
        .bind(&event.action)
        .bind(&event.resource_type)
        .bind(event.resource_id)
        .bind(&event.metadata)
        .execute(&self.pool)
        .await
        .map_err(internal)?;

        Ok(())
    }
}

fn archive_from_row(row: &PgRow) -> Result<ArchiveEntryRecord, ApplicationError> {
    let category: String = row.try_get("category").map_err(internal)?;
    let audience: String = row.try_get("applicable_audience").map_err(internal)?;
    let source_kind: String = row.try_get("source_kind").map_err(internal)?;
    let status: String = row.try_get("moderation_status").map_err(internal)?;

    let enum_error =
        |field: &str, value: &str| ApplicationError::Internal(format!("unknown {field}: {value}"));

    Ok(ArchiveEntryRecord {
        id: PostId::from_uuid(row.try_get::<Uuid, _>("id").map_err(internal)?),
        author_id: UserId::from_uuid(row.try_get::<Uuid, _>("author_id").map_err(internal)?),
        title: row.try_get("title").map_err(internal)?,
        body: row.try_get("body").map_err(internal)?,
        summary: row.try_get("summary").map_err(internal)?,
        tags: row.try_get("tags").map_err(internal)?,
        category: ArchiveCategory::parse(&category)
            .ok_or_else(|| enum_error("archive category", &category))?,
        applicable_audience: ApplicableAudience::parse(&audience)
            .ok_or_else(|| enum_error("applicable audience", &audience))?,
        source_kind: SourceKind::parse(&source_kind)
            .ok_or_else(|| enum_error("source kind", &source_kind))?,
        source_reference: row.try_get("source_reference").map_err(internal)?,
        moderation_status: ModerationStatus::parse(&status)
            .ok_or_else(|| enum_error("moderation status", &status))?,
        current_revision: row.try_get("current_revision").map_err(internal)?,
        created_at: row
            .try_get::<DateTime<Utc>, _>("created_at")
            .map_err(internal)?,
        updated_at: row
            .try_get::<DateTime<Utc>, _>("updated_at")
            .map_err(internal)?,
    })
}

fn revision_from_row(row: &PgRow) -> Result<RevisionRecord, ApplicationError> {
    Ok(RevisionRecord {
        id: RevisionId::from_uuid(row.try_get::<Uuid, _>("id").map_err(internal)?),
        post_id: PostId::from_uuid(row.try_get::<Uuid, _>("post_id").map_err(internal)?),
        revision: row.try_get("revision").map_err(internal)?,
        editor_id: UserId::from_uuid(row.try_get::<Uuid, _>("editor_id").map_err(internal)?),
        title: row.try_get("title").map_err(internal)?,
        body: row.try_get("body").map_err(internal)?,
        summary: row.try_get("summary").map_err(internal)?,
        tags: row.try_get("tags").map_err(internal)?,
        created_at: row
            .try_get::<DateTime<Utc>, _>("created_at")
            .map_err(internal)?,
    })
}

fn correction_from_row(row: &PgRow) -> Result<CorrectionRecord, ApplicationError> {
    Ok(CorrectionRecord {
        id: CorrectionId::from_uuid(row.try_get::<Uuid, _>("id").map_err(internal)?),
        post_id: PostId::from_uuid(row.try_get::<Uuid, _>("post_id").map_err(internal)?),
        reporter_id: UserId::from_uuid(row.try_get::<Uuid, _>("reporter_id").map_err(internal)?),
        message: row.try_get("message").map_err(internal)?,
        created_at: row
            .try_get::<DateTime<Utc>, _>("created_at")
            .map_err(internal)?,
        resolved_at: row
            .try_get::<Option<DateTime<Utc>>, _>("resolved_at")
            .map_err(internal)?,
        resolved_by: row
            .try_get::<Option<Uuid>, _>("resolved_by")
            .map_err(internal)?
            .map(UserId::from_uuid),
    })
}

/// The visibility predicate, expressed once and reused by every post read.
/// `$1` is the viewer id and is NULL for public and moderation scopes; the
/// `full` flag short-circuits it for moderators. Keeping this in SQL rather
/// than filtering in Rust means an invisible post is never fetched at all.
///
/// The list of publicly readable statuses is derived from the domain rather
/// than written out here. Two hand-maintained copies of one rule is how a
/// status can become readable in one code path and not the other.
fn visibility_predicate(kind: PostKind) -> String {
    let public = ModerationStatus::ALL
        .iter()
        .filter(|status| status.is_publicly_visible())
        .map(|status| format!("'{}'", status.as_str()))
        .collect::<Vec<_>>()
        .join(", ");

    format!(
        "
    p.deleted_at is null
    and p.post_type = '{kind}'
    and (
        p.moderation_status in ({public})
        or $2
        or (
            $1::uuid is not null
            and (
                p.author_id = $1::uuid
                or exists (
                    select 1 from post_maintainers m
                    where m.post_id = p.id and m.user_id = $1::uuid
                )
            )
        )
    )
",
        kind = kind.as_str()
    )
}

/// The archive half of the predicate, which every M2 read already uses.
fn archive_visibility_predicate() -> String {
    visibility_predicate(PostKind::Knowledge)
}

fn scope_bindings(scope: VisibilityScope) -> (Option<Uuid>, bool) {
    match scope {
        VisibilityScope::Public => (None, false),
        VisibilityScope::Owner(user_id) => (Some(user_id.into_uuid()), false),
        VisibilityScope::Full => (None, true),
    }
}

const ARCHIVE_COLUMNS: &str = "p.id, p.author_id, p.title, p.body, p.summary, p.tags, \
     p.category, p.applicable_audience, p.source_kind, p.source_reference, \
     p.moderation_status, p.current_revision, p.created_at, p.updated_at";

#[async_trait]
impl ArchiveRepository for PgAuthStore {
    async fn insert(&self, entry: NewArchiveEntry) -> Result<ArchiveEntryRecord, ApplicationError> {
        let mut tx = self.pool.begin().await.map_err(internal)?;

        let row = sqlx::query(
            r#"
            insert into posts (
                author_id, post_type, moderation_status, title, body, summary, tags,
                category, applicable_audience, source_kind, source_reference,
                current_revision, created_at, updated_at
            )
            values ($1, 'knowledge', 'draft', $2, $3, $4, $5, $6, $7, $8, $9, 1, $10, $10)
            returning id, author_id, title, body, summary, tags, category,
                applicable_audience, source_kind, source_reference, moderation_status,
                current_revision, created_at, updated_at
            "#,
        )
        .bind(entry.author_id.into_uuid())
        .bind(&entry.title)
        .bind(&entry.body)
        .bind(&entry.summary)
        .bind(&entry.tags)
        .bind(entry.category.as_str())
        .bind(entry.applicable_audience.as_str())
        .bind(entry.source_kind.as_str())
        .bind(&entry.source_reference)
        .bind(entry.created_at)
        .fetch_one(&mut *tx)
        .await
        .map_err(internal)?;

        let record = archive_from_row(&row)?;

        // Revision 1 is written with the entry so history is never missing its
        // first state, even for an entry that is published without an edit.
        sqlx::query(
            r#"
            insert into post_revisions (post_id, revision, editor_id, title, body, summary, tags, created_at)
            values ($1, 1, $2, $3, $4, $5, $6, $7)
            "#,
        )
        .bind(record.id.into_uuid())
        .bind(entry.author_id.into_uuid())
        .bind(&entry.title)
        .bind(&entry.body)
        .bind(&entry.summary)
        .bind(&entry.tags)
        .bind(entry.created_at)
        .execute(&mut *tx)
        .await
        .map_err(internal)?;

        tx.commit().await.map_err(internal)?;

        Ok(record)
    }

    async fn find_visible(
        &self,
        id: PostId,
        scope: VisibilityScope,
    ) -> Result<Option<ArchiveEntryRecord>, ApplicationError> {
        let (viewer, full) = scope_bindings(scope);
        let visibility = archive_visibility_predicate();
        let sql = format!("select {ARCHIVE_COLUMNS} from posts p where p.id = $3 and {visibility}");

        let row = sqlx::query(&sql)
            .bind(viewer)
            .bind(full)
            .bind(id.into_uuid())
            .fetch_optional(&self.pool)
            .await
            .map_err(internal)?;

        row.as_ref().map(archive_from_row).transpose()
    }

    async fn list(
        &self,
        query: ArchiveListQuery,
    ) -> Result<Page<ArchiveEntryRecord>, ApplicationError> {
        let (viewer, full) = scope_bindings(query.scope);
        let visibility = archive_visibility_predicate();
        // $3 q, $4 tag, $5 category; NULL means "no filter" so one statement
        // serves every combination without string-building user input in.
        let filters = "
            and ($3::text is null
                 or p.title ilike '%' || $3 || '%' escape '\\'
                 or coalesce(p.summary, '') ilike '%' || $3 || '%' escape '\\')
            and ($4::text is null or $4 = any(p.tags))
            and ($5::text is null or p.category = $5)
        ";

        let count_sql = format!("select count(*) from posts p where {visibility} {filters}");
        let (total_items,): (i64,) = sqlx::query_as(&count_sql)
            .bind(viewer)
            .bind(full)
            .bind(&query.q)
            .bind(&query.tag)
            .bind(query.category.map(|category| category.as_str()))
            .fetch_one(&self.pool)
            .await
            .map_err(internal)?;

        let page_size = query.page_size.max(1);
        let offset = i64::from(query.page.saturating_sub(1)) * i64::from(page_size);
        let list_sql = format!(
            "select {ARCHIVE_COLUMNS} from posts p where {visibility} {filters} \
             order by p.updated_at desc, p.id desc limit $6 offset $7"
        );

        let rows = sqlx::query(&list_sql)
            .bind(viewer)
            .bind(full)
            .bind(&query.q)
            .bind(&query.tag)
            .bind(query.category.map(|category| category.as_str()))
            .bind(i64::from(page_size))
            .bind(offset)
            .fetch_all(&self.pool)
            .await
            .map_err(internal)?;

        let total_items = total_items.max(0) as u64;

        Ok(Page {
            items: rows
                .iter()
                .map(archive_from_row)
                .collect::<Result<Vec<_>, _>>()?,
            page: query.page,
            page_size,
            total_items,
            total_pages: total_items.div_ceil(u64::from(page_size)) as u32,
        })
    }

    /// Content update and revision write share one transaction, so history can
    /// never be missing a version that the entry claims to have.
    async fn update(
        &self,
        id: PostId,
        update: ArchiveEntryUpdate,
    ) -> Result<ArchiveEntryRecord, ApplicationError> {
        let mut tx = self.pool.begin().await.map_err(internal)?;

        let appended = match &update.revision {
            RevisionWrite::Append(revision) => Some(revision.revision),
            RevisionWrite::RewriteCurrent { .. } => None,
        };
        let row = sqlx::query(
            r#"
            update posts
            set title = $2, body = $3, summary = $4, tags = $5, category = $6,
                applicable_audience = $7, source_kind = $8, source_reference = $9,
                updated_at = $10,
                current_revision = coalesce($11, current_revision)
            where id = $1 and deleted_at is null
            returning id, author_id, title, body, summary, tags, category,
                applicable_audience, source_kind, source_reference, moderation_status,
                current_revision, created_at, updated_at
            "#,
        )
        .bind(id.into_uuid())
        .bind(&update.title)
        .bind(&update.body)
        .bind(&update.summary)
        .bind(&update.tags)
        .bind(update.category.as_str())
        .bind(update.applicable_audience.as_str())
        .bind(update.source_kind.as_str())
        .bind(&update.source_reference)
        .bind(update.updated_at)
        .bind(appended)
        .fetch_optional(&mut *tx)
        .await
        .map_err(internal)?
        .ok_or_else(|| ApplicationError::NotFound("archive entry not found".to_owned()))?;

        let record = archive_from_row(&row)?;

        match update.revision {
            RevisionWrite::Append(new_revision) => {
                sqlx::query(
                    r#"
                    insert into post_revisions (post_id, revision, editor_id, title, body, summary, tags, created_at)
                    values ($1, $2, $3, $4, $5, $6, $7, $8)
                    "#,
                )
                .bind(id.into_uuid())
                .bind(new_revision.revision)
                .bind(new_revision.editor_id.into_uuid())
                .bind(&update.title)
                .bind(&update.body)
                .bind(&update.summary)
                .bind(&update.tags)
                .bind(update.updated_at)
                .execute(&mut *tx)
                .await
                .map_err(|error| match &error {
                    sqlx::Error::Database(db_error) if db_error.is_unique_violation() => {
                        // Two concurrent edits computed the same next revision.
                        // That is a conflict for the loser, not a server fault.
                        ApplicationError::Conflict(
                            "the entry was revised concurrently; reload and retry".to_owned(),
                        )
                    }
                    _ => internal(error),
                })?;
            }
            RevisionWrite::RewriteCurrent { editor_id } => {
                sqlx::query(
                    r#"
                    update post_revisions
                    set editor_id = $3, title = $4, body = $5, summary = $6, tags = $7,
                        created_at = $8
                    where post_id = $1 and revision = $2
                    "#,
                )
                .bind(id.into_uuid())
                .bind(record.current_revision)
                .bind(editor_id.into_uuid())
                .bind(&update.title)
                .bind(&update.body)
                .bind(&update.summary)
                .bind(&update.tags)
                .bind(update.updated_at)
                .execute(&mut *tx)
                .await
                .map_err(internal)?;
            }
        }
        tx.commit().await.map_err(internal)?;

        Ok(record)
    }

    async fn set_status(
        &self,
        id: PostId,
        expected: ModerationStatus,
        status: ModerationStatus,
        updated_at: DateTime<Utc>,
    ) -> Result<ArchiveEntryRecord, ApplicationError> {
        // `moderation_status = $4` makes this a compare-and-swap. Without it an
        // author looping publish requests could overwrite a moderator's reject
        // that landed between the permission check and this write.
        let row = sqlx::query(
            r#"
            update posts
            set moderation_status = $2, updated_at = $3
            where id = $1 and deleted_at is null and moderation_status = $4
            returning id, author_id, title, body, summary, tags, category,
                applicable_audience, source_kind, source_reference, moderation_status,
                current_revision, created_at, updated_at
            "#,
        )
        .bind(id.into_uuid())
        .bind(status.as_str())
        .bind(updated_at)
        .bind(expected.as_str())
        .fetch_optional(&self.pool)
        .await
        .map_err(internal)?
        .ok_or_else(|| {
            ApplicationError::Conflict(
                "the entry changed state concurrently; reload and retry".to_owned(),
            )
        })?;

        archive_from_row(&row)
    }

    async fn list_revisions(&self, id: PostId) -> Result<Vec<RevisionRecord>, ApplicationError> {
        let rows = sqlx::query(
            r#"
            select id, post_id, revision, editor_id, title, body, summary, tags, created_at
            from post_revisions
            where post_id = $1
            order by revision
            "#,
        )
        .bind(id.into_uuid())
        .fetch_all(&self.pool)
        .await
        .map_err(internal)?;

        rows.iter().map(revision_from_row).collect()
    }

    async fn is_maintainer(&self, id: PostId, user_id: UserId) -> Result<bool, ApplicationError> {
        let (exists,): (bool,) = sqlx::query_as(
            "select exists (select 1 from post_maintainers where post_id = $1 and user_id = $2)",
        )
        .bind(id.into_uuid())
        .bind(user_id.into_uuid())
        .fetch_one(&self.pool)
        .await
        .map_err(internal)?;

        Ok(exists)
    }
}

#[async_trait]
impl CorrectionRepository for PgAuthStore {
    async fn insert(
        &self,
        correction: NewCorrection,
    ) -> Result<CorrectionRecord, ApplicationError> {
        let row = sqlx::query(
            r#"
            insert into post_corrections (post_id, reporter_id, message, created_at)
            values ($1, $2, $3, $4)
            returning id, post_id, reporter_id, message, created_at, resolved_at, resolved_by
            "#,
        )
        .bind(correction.post_id.into_uuid())
        .bind(correction.reporter_id.into_uuid())
        .bind(&correction.message)
        .bind(correction.created_at)
        .fetch_one(&self.pool)
        .await
        .map_err(internal)?;

        correction_from_row(&row)
    }

    async fn list_for_post(
        &self,
        post_id: PostId,
    ) -> Result<Vec<CorrectionRecord>, ApplicationError> {
        let rows = sqlx::query(
            r#"
            select id, post_id, reporter_id, message, created_at, resolved_at, resolved_by
            from post_corrections
            where post_id = $1
            order by created_at
            "#,
        )
        .bind(post_id.into_uuid())
        .fetch_all(&self.pool)
        .await
        .map_err(internal)?;

        rows.iter().map(correction_from_row).collect()
    }

    /// Idempotent, mirroring the in-memory store: the `resolved_at is null`
    /// guard keeps the first resolution, and a repeat call returns the stored
    /// row instead of a 404.
    async fn resolve(
        &self,
        post_id: PostId,
        id: CorrectionId,
        resolved_by: UserId,
        resolved_at: DateTime<Utc>,
    ) -> Result<CorrectionRecord, ApplicationError> {
        sqlx::query(
            r#"
            update post_corrections
            set resolved_at = $3, resolved_by = $4
            where id = $1 and post_id = $2 and resolved_at is null
            "#,
        )
        .bind(id.into_uuid())
        .bind(post_id.into_uuid())
        .bind(resolved_at)
        .bind(resolved_by.into_uuid())
        .execute(&self.pool)
        .await
        .map_err(internal)?;

        // The read-back carries the same predicate, so a correction that
        // belongs to another entry is reported as missing rather than having
        // its contents disclosed.
        let row = sqlx::query(
            r#"
            select id, post_id, reporter_id, message, created_at, resolved_at, resolved_by
            from post_corrections
            where id = $1 and post_id = $2
            "#,
        )
        .bind(id.into_uuid())
        .bind(post_id.into_uuid())
        .fetch_optional(&self.pool)
        .await
        .map_err(internal)?
        .ok_or_else(|| ApplicationError::NotFound("correction not found".to_owned()))?;

        correction_from_row(&row)
    }
}

const DISCUSSION_COLUMNS: &str = "p.id, p.author_id, p.title, p.body, p.tags, \
     p.moderation_status, p.accepted_comment_id, p.created_at, p.updated_at, \
     (select count(*) from comments c where c.post_id = p.id and c.deleted_at is null) \
     as reply_count";

fn discussion_from_row(row: &PgRow) -> Result<DiscussionRecord, ApplicationError> {
    let moderation_status: String = row.try_get("moderation_status").map_err(internal)?;

    Ok(DiscussionRecord {
        id: PostId::from_uuid(row.try_get::<Uuid, _>("id").map_err(internal)?),
        author_id: UserId::from_uuid(row.try_get::<Uuid, _>("author_id").map_err(internal)?),
        title: row.try_get("title").map_err(internal)?,
        body: row.try_get("body").map_err(internal)?,
        tags: row.try_get("tags").map_err(internal)?,
        moderation_status: ModerationStatus::parse(&moderation_status).ok_or_else(|| {
            ApplicationError::Internal(format!("unknown moderation status: {moderation_status}"))
        })?,
        accepted_comment_id: row
            .try_get::<Option<Uuid>, _>("accepted_comment_id")
            .map_err(internal)?
            .map(CommentId::from_uuid),
        reply_count: row.try_get::<i64, _>("reply_count").map_err(internal)?,
        created_at: row.try_get("created_at").map_err(internal)?,
        updated_at: row.try_get("updated_at").map_err(internal)?,
    })
}

fn comment_from_row(row: &PgRow) -> Result<CommentRecord, ApplicationError> {
    Ok(CommentRecord {
        id: CommentId::from_uuid(row.try_get::<Uuid, _>("id").map_err(internal)?),
        post_id: PostId::from_uuid(row.try_get::<Uuid, _>("post_id").map_err(internal)?),
        author_id: UserId::from_uuid(row.try_get::<Uuid, _>("author_id").map_err(internal)?),
        body: row.try_get("body").map_err(internal)?,
        created_at: row.try_get("created_at").map_err(internal)?,
        updated_at: row.try_get("updated_at").map_err(internal)?,
    })
}

fn discussion_visibility_predicate() -> String {
    visibility_predicate(PostKind::Discussion)
}

#[async_trait]
impl DiscussionRepository for PgAuthStore {
    async fn insert(
        &self,
        discussion: NewDiscussion,
    ) -> Result<DiscussionRecord, ApplicationError> {
        let row = sqlx::query(
            r#"
            with inserted as (
                insert into posts (
                    author_id, post_type, moderation_status, title, body, tags,
                    created_at, updated_at
                )
                values ($1, 'discussion', 'draft', $2, $3, $4, $5, $5)
                returning id, author_id, title, body, tags, moderation_status,
                    accepted_comment_id, created_at, updated_at
            )
            select *, 0::bigint as reply_count from inserted
            "#,
        )
        .bind(discussion.author_id.into_uuid())
        .bind(&discussion.title)
        .bind(&discussion.body)
        .bind(&discussion.tags)
        .bind(discussion.created_at)
        .fetch_one(&self.pool)
        .await
        .map_err(internal)?;

        discussion_from_row(&row)
    }

    async fn find_visible(
        &self,
        id: PostId,
        scope: VisibilityScope,
    ) -> Result<Option<DiscussionRecord>, ApplicationError> {
        let (viewer, full) = scope_bindings(scope);
        let visibility = discussion_visibility_predicate();
        let sql =
            format!("select {DISCUSSION_COLUMNS} from posts p where p.id = $3 and {visibility}");

        let row = sqlx::query(&sql)
            .bind(viewer)
            .bind(full)
            .bind(id.into_uuid())
            .fetch_optional(&self.pool)
            .await
            .map_err(internal)?;

        row.as_ref().map(discussion_from_row).transpose()
    }

    async fn list(
        &self,
        query: DiscussionListQuery,
    ) -> Result<Page<DiscussionRecord>, ApplicationError> {
        let (viewer, full) = scope_bindings(query.scope);
        let visibility = discussion_visibility_predicate();
        let filters = "
            and ($3::text is null
                 or p.title ilike '%' || $3 || '%' escape '\\'
                 or p.body ilike '%' || $3 || '%' escape '\\')
            and ($4::text is null or $4 = any(p.tags))
        ";

        let count_sql = format!("select count(*) from posts p where {visibility} {filters}");
        let (total_items,): (i64,) = sqlx::query_as(&count_sql)
            .bind(viewer)
            .bind(full)
            .bind(&query.q)
            .bind(&query.tag)
            .fetch_one(&self.pool)
            .await
            .map_err(internal)?;

        let page_size = query.page_size.max(1);
        let offset = i64::from(query.page.saturating_sub(1)) * i64::from(page_size);
        let list_sql = format!(
            "select {DISCUSSION_COLUMNS} from posts p where {visibility} {filters} \
             order by p.updated_at desc, p.id desc limit $5 offset $6"
        );

        let rows = sqlx::query(&list_sql)
            .bind(viewer)
            .bind(full)
            .bind(&query.q)
            .bind(&query.tag)
            .bind(i64::from(page_size))
            .bind(offset)
            .fetch_all(&self.pool)
            .await
            .map_err(internal)?;

        let total_items = total_items.max(0) as u64;

        Ok(Page {
            items: rows
                .iter()
                .map(discussion_from_row)
                .collect::<Result<Vec<_>, _>>()?,
            page: query.page,
            page_size,
            total_items,
            total_pages: total_items.div_ceil(u64::from(page_size)) as u32,
        })
    }

    async fn set_status(
        &self,
        id: PostId,
        expected: ModerationStatus,
        status: ModerationStatus,
        updated_at: DateTime<Utc>,
    ) -> Result<DiscussionRecord, ApplicationError> {
        // Compare-and-swap for the same reason as the archive store: the
        // caller authorized the transition against the status they read.
        let row = sqlx::query(
            r#"
            with updated as (
                update posts p
                set moderation_status = $2, updated_at = $3
                where p.id = $1 and p.deleted_at is null and p.post_type = 'discussion'
                  and p.moderation_status = $4
                returning p.id, p.author_id, p.title, p.body, p.tags, p.moderation_status,
                    p.accepted_comment_id, p.created_at, p.updated_at
            )
            select u.*,
                (select count(*) from comments c
                 where c.post_id = u.id and c.deleted_at is null) as reply_count
            from updated u
            "#,
        )
        .bind(id.into_uuid())
        .bind(status.as_str())
        .bind(updated_at)
        .bind(expected.as_str())
        .fetch_optional(&self.pool)
        .await
        .map_err(internal)?
        .ok_or_else(|| {
            ApplicationError::Conflict(
                "the discussion changed state concurrently; reload and retry".to_owned(),
            )
        })?;

        discussion_from_row(&row)
    }

    async fn set_accepted_comment(
        &self,
        id: PostId,
        comment_id: Option<CommentId>,
        updated_at: DateTime<Utc>,
    ) -> Result<DiscussionRecord, ApplicationError> {
        // The `exists` guard ties the comment to this discussion inside the
        // same statement. A caller authorized against one discussion cannot
        // mark an answer on another, whatever the service layer did first.
        let row = sqlx::query(
            r#"
            with updated as (
                update posts p
                set accepted_comment_id = $2, updated_at = $3
                where p.id = $1 and p.deleted_at is null and p.post_type = 'discussion'
                  and (
                    $2::uuid is null
                    or exists (
                        select 1 from comments c
                        where c.id = $2 and c.post_id = $1 and c.deleted_at is null
                    )
                  )
                returning p.id, p.author_id, p.title, p.body, p.tags, p.moderation_status,
                    p.accepted_comment_id, p.created_at, p.updated_at
            )
            select u.*,
                (select count(*) from comments c
                 where c.post_id = u.id and c.deleted_at is null) as reply_count
            from updated u
            "#,
        )
        .bind(id.into_uuid())
        .bind(comment_id.map(|value| value.into_uuid()))
        .bind(updated_at)
        .fetch_optional(&self.pool)
        .await
        .map_err(internal)?
        .ok_or_else(|| ApplicationError::NotFound("reply not found".to_owned()))?;

        discussion_from_row(&row)
    }

    async fn is_maintainer(&self, id: PostId, user_id: UserId) -> Result<bool, ApplicationError> {
        let (exists,): (bool,) = sqlx::query_as(
            "select exists (select 1 from post_maintainers where post_id = $1 and user_id = $2)",
        )
        .bind(id.into_uuid())
        .bind(user_id.into_uuid())
        .fetch_one(&self.pool)
        .await
        .map_err(internal)?;

        Ok(exists)
    }
}

#[async_trait]
impl CommentRepository for PgAuthStore {
    async fn insert(&self, comment: NewComment) -> Result<CommentRecord, ApplicationError> {
        let row = sqlx::query(
            r#"
            insert into comments (post_id, author_id, body, created_at, updated_at)
            values ($1, $2, $3, $4, $4)
            returning id, post_id, author_id, body, created_at, updated_at
            "#,
        )
        .bind(comment.post_id.into_uuid())
        .bind(comment.author_id.into_uuid())
        .bind(&comment.body)
        .bind(comment.created_at)
        .fetch_one(&self.pool)
        .await
        .map_err(internal)?;

        comment_from_row(&row)
    }

    async fn list_for_post(&self, post_id: PostId) -> Result<Vec<CommentRecord>, ApplicationError> {
        let rows = sqlx::query(
            r#"
            select id, post_id, author_id, body, created_at, updated_at
            from comments
            where post_id = $1 and deleted_at is null
            order by created_at, id
            "#,
        )
        .bind(post_id.into_uuid())
        .fetch_all(&self.pool)
        .await
        .map_err(internal)?;

        rows.iter().map(comment_from_row).collect()
    }

    async fn find_in_post(
        &self,
        post_id: PostId,
        id: CommentId,
    ) -> Result<Option<CommentRecord>, ApplicationError> {
        let row = sqlx::query(
            r#"
            select id, post_id, author_id, body, created_at, updated_at
            from comments
            where id = $1 and post_id = $2 and deleted_at is null
            "#,
        )
        .bind(id.into_uuid())
        .bind(post_id.into_uuid())
        .fetch_optional(&self.pool)
        .await
        .map_err(internal)?;

        row.as_ref().map(comment_from_row).transpose()
    }
}

fn archive_source_from_row(row: &PgRow) -> Result<ArchiveSourceRecord, ApplicationError> {
    Ok(ArchiveSourceRecord {
        entry_id: PostId::from_uuid(row.try_get::<Uuid, _>("entry_id").map_err(internal)?),
        source_post_id: PostId::from_uuid(
            row.try_get::<Uuid, _>("source_post_id").map_err(internal)?,
        ),
        source_comment_id: row
            .try_get::<Option<Uuid>, _>("source_comment_id")
            .map_err(internal)?
            .map(CommentId::from_uuid),
        source_author_id: UserId::from_uuid(
            row.try_get::<Uuid, _>("source_author_id")
                .map_err(internal)?,
        ),
        source_title: row.try_get("source_title").map_err(internal)?,
        created_at: row.try_get("created_at").map_err(internal)?,
    })
}

#[async_trait]
impl ArchiveSourceRepository for PgAuthStore {
    async fn insert(
        &self,
        source: NewArchiveSource,
    ) -> Result<ArchiveSourceRecord, ApplicationError> {
        let row = sqlx::query(
            r#"
            with inserted as (
                insert into archive_sources (
                    entry_id, source_post_id, source_comment_id, source_author_id, created_at
                )
                values ($1, $2, $3, $4, $5)
                returning entry_id, source_post_id, source_comment_id, source_author_id, created_at
            )
            select i.*, p.title as source_title
            from inserted i
            join posts p on p.id = i.source_post_id
            "#,
        )
        .bind(source.entry_id.into_uuid())
        .bind(source.source_post_id.into_uuid())
        .bind(source.source_comment_id.map(|value| value.into_uuid()))
        .bind(source.source_author_id.into_uuid())
        .bind(source.created_at)
        .fetch_one(&self.pool)
        .await
        .map_err(|error| match &error {
            sqlx::Error::Database(db_error) if db_error.is_unique_violation() => {
                ApplicationError::Conflict(
                    "this source is already recorded for the entry".to_owned(),
                )
            }
            _ => internal(error),
        })?;

        archive_source_from_row(&row)
    }

    async fn list_for_entry(
        &self,
        entry_id: PostId,
        scope: VisibilityScope,
    ) -> Result<Vec<ArchiveSourceRecord>, ApplicationError> {
        let (viewer, full) = scope_bindings(scope);
        // The join carries the discussion visibility predicate, so a source
        // pointing at content the reader cannot see is dropped by the query
        // rather than filtered afterwards.
        let visibility = discussion_visibility_predicate();
        let sql = format!(
            "select s.entry_id, s.source_post_id, s.source_comment_id, s.source_author_id, \
             s.created_at, p.title as source_title \
             from archive_sources s join posts p on p.id = s.source_post_id \
             where s.entry_id = $3 and {visibility} order by s.created_at, s.source_post_id"
        );

        let rows = sqlx::query(&sql)
            .bind(viewer)
            .bind(full)
            .bind(entry_id.into_uuid())
            .fetch_all(&self.pool)
            .await
            .map_err(internal)?;

        rows.iter().map(archive_source_from_row).collect()
    }

    async fn list_derived_entries(
        &self,
        source_post_id: PostId,
        scope: VisibilityScope,
    ) -> Result<Vec<DerivedEntryRecord>, ApplicationError> {
        let (viewer, full) = scope_bindings(scope);
        // Mirror of the above: an entry the reader cannot see is not listed,
        // so the backlink cannot be used to enumerate other people's drafts.
        let visibility = archive_visibility_predicate();
        let sql = format!(
            "select p.id as entry_id, p.title, p.moderation_status, s.created_at \
             from archive_sources s join posts p on p.id = s.entry_id \
             where s.source_post_id = $3 and {visibility} order by s.created_at, p.id"
        );

        let rows = sqlx::query(&sql)
            .bind(viewer)
            .bind(full)
            .bind(source_post_id.into_uuid())
            .fetch_all(&self.pool)
            .await
            .map_err(internal)?;

        rows.iter()
            .map(|row| {
                let moderation_status: String =
                    row.try_get("moderation_status").map_err(internal)?;

                Ok(DerivedEntryRecord {
                    entry_id: PostId::from_uuid(
                        row.try_get::<Uuid, _>("entry_id").map_err(internal)?,
                    ),
                    title: row.try_get("title").map_err(internal)?,
                    moderation_status: ModerationStatus::parse(&moderation_status).ok_or_else(
                        || {
                            ApplicationError::Internal(format!(
                                "unknown moderation status: {moderation_status}"
                            ))
                        },
                    )?,
                    created_at: row.try_get("created_at").map_err(internal)?,
                })
            })
            .collect()
    }
}

#[cfg(test)]
mod visibility_tests {
    use super::*;

    /// The predicate is the single gate every read passes through, and it is
    /// built by string formatting, so nothing else would catch it drifting from
    /// the domain rule it is supposed to express.
    #[test]
    fn predicate_admits_exactly_the_publicly_visible_statuses() {
        let sql = archive_visibility_predicate();

        for status in ModerationStatus::ALL {
            let listed = sql.contains(&format!("'{}'", status.as_str()));

            assert_eq!(
                listed,
                status.is_publicly_visible(),
                "{} is publicly visible = {} but {} in the predicate",
                status.as_str(),
                status.is_publicly_visible(),
                if listed { "listed" } else { "absent" }
            );
        }
    }

    #[test]
    fn predicate_scopes_to_the_requested_post_kind() {
        assert!(archive_visibility_predicate().contains("p.post_type = 'knowledge'"));
        assert!(visibility_predicate(PostKind::Discussion).contains("p.post_type = 'discussion'"));
    }

    /// Soft-deleted rows must never surface, whatever the viewer's scope.
    #[test]
    fn predicate_always_excludes_soft_deleted_rows() {
        for kind in [PostKind::Knowledge, PostKind::Discussion] {
            assert!(visibility_predicate(kind).contains("p.deleted_at is null"));
        }
    }
}
