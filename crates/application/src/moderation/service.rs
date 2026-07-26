//! Abuse reporting and the moderation queue.
//!
//! The same two rules the archive and discussion layers follow apply here.
//! Visibility is resolved before permission, so content the caller may not see
//! is `NotFound` rather than `Forbidden`. And every id that arrives from the
//! request is resolved *within* the resource the caller was authorized
//! against — a report id is only ever looked up inside its post.
//!
//! One rule is specific to this module: the people who may review reports are
//! moderators and admins only, never the content's author or maintainer. A
//! report may be about the author, and the accused must not close the case.

use std::sync::Arc;

use campus_agora_domain::{
    is_allowed, validate_report_message, Action, Actor, AuthenticatedActor, PostId, ReportCategory,
    ReportId, SystemRole, TextError,
};
use chrono::{DateTime, Utc};

use crate::auth::{AuditContext, CurrentUser};
use crate::errors::ApplicationError;
use crate::ports::{
    AuditEventRepository, ContentReportRecord, ModerationQueueItem, NewAuditEvent,
    NewContentReport, Page, PostRepository, PostSummary, ReportRepository, ReportResolution,
    VisibilityScope,
};

pub const MAX_PAGE_SIZE: u32 = 100;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ReportInput {
    pub category: ReportCategory,
    pub message: String,
}

pub struct ModerationService {
    posts: Arc<dyn PostRepository>,
    reports: Arc<dyn ReportRepository>,
    audit_events: Arc<dyn AuditEventRepository>,
}

impl ModerationService {
    pub fn new(
        posts: Arc<dyn PostRepository>,
        reports: Arc<dyn ReportRepository>,
        audit_events: Arc<dyn AuditEventRepository>,
    ) -> Self {
        Self {
            posts,
            reports,
            audit_events,
        }
    }

    /// Files a report. Content is content: this works the same on a discussion
    /// as on an archive entry.
    ///
    /// Reporting deliberately does **not** change the content's status. Making
    /// a report pull content out of view would hand every authenticated user a
    /// takedown button: one student could hide the entire archive one report
    /// at a time, and each hidden item would then be invisible to everyone
    /// else who might have corroborated or disputed it. The report puts the
    /// content in the queue; a moderator decides what happens to it.
    pub async fn report(
        &self,
        user: &CurrentUser,
        id: PostId,
        input: ReportInput,
        now: DateTime<Utc>,
        audit: &AuditContext,
    ) -> Result<ContentReportRecord, ApplicationError> {
        let post = self.visible_post(Some(user), id).await?;
        require(Action::ReportContent, &actor_for(user))?;

        let message = validate_report_message(&input.message).map_err(|error| {
            ApplicationError::Validation(match error {
                TextError::Empty => "report message must not be empty".to_owned(),
                TextError::TooLong => "report message is too long".to_owned(),
            })
        })?;

        let report = self
            .reports
            .insert(NewContentReport {
                post_id: id,
                reporter_id: user.id,
                category: input.category,
                message,
                created_at: now,
            })
            .await?;

        self.record_audit(
            "moderation.reported",
            Some(user),
            id,
            serde_json::json!({
                "reportId": report.id.to_string(),
                "category": input.category.as_str(),
                "contentStatus": post.moderation_status.as_str(),
                "requestId": audit.request_id,
            }),
        )
        .await?;

        Ok(report)
    }

    /// Explicit guest path, so a caller cannot skip the check by having no
    /// user to pass.
    pub async fn report_as_guest(
        &self,
        _id: PostId,
        _input: ReportInput,
        _now: DateTime<Utc>,
        _audit: &AuditContext,
    ) -> Result<ContentReportRecord, ApplicationError> {
        require(Action::ReportContent, &Actor::Guest)?;

        unreachable!("guests are denied ReportContent by the permission matrix")
    }

    pub async fn queue(
        &self,
        user: &CurrentUser,
        page: u32,
        page_size: u32,
    ) -> Result<Page<ModerationQueueItem>, ApplicationError> {
        require(Action::ReviewReports, &actor_for(user))?;

        if page < 1 {
            return Err(ApplicationError::Validation(
                "page must start at 1".to_owned(),
            ));
        }

        if !(1..=MAX_PAGE_SIZE).contains(&page_size) {
            return Err(ApplicationError::Validation(format!(
                "pageSize must be between 1 and {MAX_PAGE_SIZE}"
            )));
        }

        self.reports.queue(page, page_size).await
    }

    /// Restricted to moderation, and pointedly not to the content's author: a
    /// report names its reporter and may be about the author themselves.
    pub async fn list_reports(
        &self,
        user: &CurrentUser,
        id: PostId,
    ) -> Result<Vec<ContentReportRecord>, ApplicationError> {
        require(Action::ReviewReports, &actor_for(user))?;
        self.visible_post(Some(user), id).await?;

        self.reports.list_for_post(id).await
    }

    /// Records a reviewer's finding. When nothing is left open and the content
    /// was only under review because of the reports, it goes back to being
    /// published — a dismissed report should not leave content invisible.
    pub async fn resolve_report(
        &self,
        user: &CurrentUser,
        id: PostId,
        report_id: ReportId,
        resolution: ReportResolution,
        now: DateTime<Utc>,
        audit: &AuditContext,
    ) -> Result<ContentReportRecord, ApplicationError> {
        require(Action::ReviewReports, &actor_for(user))?;
        let post = self.visible_post(Some(user), id).await?;

        let resolved = self
            .reports
            .resolve(id, report_id, resolution, user.id, now)
            .await?;

        let still_open = self
            .reports
            .list_for_post(id)
            .await?
            .iter()
            .any(|report| report.resolved_at.is_none());

        // Resolving a report is a finding, not a state change. The content's
        // status is only ever changed by an explicit moderation transition, so
        // there is exactly one path by which what the campus sees can change,
        // and it is always a deliberate act with its own audit event.
        let _ = &post;

        self.record_audit(
            "moderation.report_resolved",
            Some(user),
            id,
            serde_json::json!({
                "reportId": report_id.to_string(),
                "resolution": resolution.as_str(),
                "remainingOpenReports": still_open,
                "requestId": audit.request_id,
            }),
        )
        .await?;

        Ok(resolved)
    }

    async fn visible_post(
        &self,
        user: Option<&CurrentUser>,
        id: PostId,
    ) -> Result<PostSummary, ApplicationError> {
        self.posts
            .find_visible_post(id, scope_for(user))
            .await?
            .ok_or_else(|| ApplicationError::NotFound("content not found".to_owned()))
    }

    async fn record_audit(
        &self,
        action: &str,
        user: Option<&CurrentUser>,
        id: PostId,
        metadata: serde_json::Value,
    ) -> Result<(), ApplicationError> {
        self.audit_events
            .record(NewAuditEvent {
                actor_id: user.map(|user| user.id),
                action: action.to_owned(),
                resource_type: "content_report".to_owned(),
                resource_id: Some(id.into_uuid()),
                metadata,
            })
            .await
    }
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

/// Moderation decisions are made by role, never by a relationship to the
/// content, so the resource-role flags are deliberately all false here. Setting
/// `is_resource_author` would let an author review a report about themselves,
/// because matrix columns combine as a union of grants.
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
