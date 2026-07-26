//! PostgreSQL implementations of the application auth repository traits.
//! Queries bind parameters only; no user input is interpolated into SQL.

use async_trait::async_trait;
use campus_agora_application::errors::ApplicationError;
use campus_agora_application::ports::{
    AuditEventRepository, MembershipSummary, NewAuditEvent, NewSession, NewUser,
    OrganizationRecord, OrganizationRepository, SessionRecord, SessionRepository, UserRecord,
    UserRepository,
};
use campus_agora_domain::{AuthProviderKind, OrganizationId, SessionId, SystemRole, UserId};
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
