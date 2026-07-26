//! In-memory implementations of the auth repository traits. Used by
//! application tests, API integration tests, and the database-less local
//! development fallback. Never used in production deployments.

use std::sync::Mutex;

use async_trait::async_trait;
use campus_agora_domain::{OrganizationId, SessionId, UserId};
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::errors::ApplicationError;
use crate::ports::{
    AuditEventRepository, MembershipSummary, NewAuditEvent, NewSession, NewUser,
    OrganizationRecord, OrganizationRepository, SessionRecord, SessionRepository, UserRecord,
    UserRepository,
};

#[derive(Default)]
struct StoreState {
    users: Vec<UserRecord>,
    sessions: Vec<SessionRecord>,
    organizations: Vec<OrganizationRecord>,
    memberships: Vec<(OrganizationId, UserId)>,
    audit_events: Vec<NewAuditEvent>,
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
    async fn upsert(&self, user: NewUser) -> Result<UserRecord, ApplicationError> {
        let mut state = self.state.lock().expect("store lock");

        if let Some(existing) = state.users.iter_mut().find(|candidate| {
            candidate.auth_provider == user.auth_provider
                && candidate.provider_subject_hash == user.provider_subject_hash
        }) {
            existing.display_name = user.display_name;
            existing.system_role = user.system_role;
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
        session.revoked_at = Some(revoked_at);

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
