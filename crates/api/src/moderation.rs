//! Abuse reporting, the moderation queue, and AI-assisted drafting over HTTP.
//! Handlers stay thin for the same reason as every other resource: permission
//! and visibility decisions belong to the application and domain layers.

use axum::extract::rejection::JsonRejection;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use campus_agora_application::ai::DraftOutcome;
use campus_agora_application::moderation::ReportInput;
use campus_agora_application::ports::{ContentReportRecord, ModerationQueueItem, ReportResolution};
use campus_agora_domain::{ReportCategory, ReportId};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::archive::{
    audit, bad_request, invalid_body, parse_post_id, require_user, timestamp, CollectionDto,
    KnowledgeEntryDto,
};
use crate::auth::application_error_response;
use crate::discussion::ArchiveSourceDto;
use crate::{request_id_from_headers, ApiState};

/// The target is in the body rather than the path because a report applies to
/// any content, and inventing a URL for the union of two resources would be
/// less honest than naming what it points at.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateReportRequest {
    pub post_id: String,
    pub category: String,
    pub message: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveReportRequest {
    pub resolution: String,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueueQuery {
    pub page: Option<u32>,
    pub page_size: Option<u32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportDto {
    pub id: String,
    pub post_id: String,
    /// Only ever serialized on the moderator-only listing and to the reporter
    /// themselves, for the same reason correction reporters are restricted.
    pub reporter_id: String,
    pub category: String,
    pub message: String,
    pub created_at: String,
    pub resolved_at: Option<String>,
    pub resolved_by: Option<String>,
    pub resolution: Option<String>,
}

impl From<ContentReportRecord> for ReportDto {
    fn from(record: ContentReportRecord) -> Self {
        Self {
            id: record.id.to_string(),
            post_id: record.post_id.to_string(),
            reporter_id: record.reporter_id.to_string(),
            category: record.category.as_str().to_owned(),
            message: record.message,
            created_at: timestamp(record.created_at),
            resolved_at: record.resolved_at.map(timestamp),
            resolved_by: record.resolved_by.map(|id| id.to_string()),
            resolution: record.resolution.map(|value| value.as_str().to_owned()),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueueItemDto {
    pub post_id: String,
    pub post_kind: String,
    pub title: String,
    pub author_id: String,
    pub moderation_status: String,
    pub risk: String,
    pub open_report_count: i64,
    pub queued_at: String,
}

impl From<ModerationQueueItem> for QueueItemDto {
    fn from(item: ModerationQueueItem) -> Self {
        Self {
            post_id: item.post_id.to_string(),
            post_kind: item.post_kind.as_str().to_owned(),
            title: item.title,
            author_id: item.author_id.to_string(),
            moderation_status: item.moderation_status.as_str().to_owned(),
            risk: item.risk.as_str().to_owned(),
            open_report_count: item.open_report_count,
            queued_at: timestamp(item.queued_at),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaginatedQueueDto {
    pub items: Vec<QueueItemDto>,
    pub page: u32,
    pub page_size: u32,
    pub total_items: u64,
    pub total_pages: u32,
}

/// The drafted entry and the sources recorded for it. There is deliberately no
/// field by which a caller could ask for it to be published.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiDraftDto {
    pub entry: KnowledgeEntryDto,
    pub sources: Vec<ArchiveSourceDto>,
}

impl From<DraftOutcome> for AiDraftDto {
    fn from(outcome: DraftOutcome) -> Self {
        Self {
            entry: KnowledgeEntryDto::from(outcome.entry),
            sources: outcome
                .sources
                .into_iter()
                .map(ArchiveSourceDto::from)
                .collect(),
        }
    }
}

pub(crate) async fn create_report(
    State(state): State<ApiState>,
    headers: HeaderMap,
    payload: Result<Json<CreateReportRequest>, JsonRejection>,
) -> Response {
    let request_id = request_id_from_headers(&headers);

    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };

    let Ok(Json(request)) = payload else {
        return invalid_body(request_id);
    };

    let (Some(post_id), Some(category)) = (
        parse_post_id(&request.post_id),
        ReportCategory::parse(&request.category),
    ) else {
        return invalid_body(request_id);
    };

    match state
        .moderation
        .report(
            &user,
            post_id,
            ReportInput {
                category,
                message: request.message,
            },
            Utc::now(),
            &audit(&request_id),
        )
        .await
    {
        Ok(report) => (StatusCode::CREATED, Json(ReportDto::from(report))).into_response(),
        Err(error) => application_error_response(error, request_id),
    }
}

pub(crate) async fn moderation_queue(
    State(state): State<ApiState>,
    headers: HeaderMap,
    query: Result<Query<QueueQuery>, axum::extract::rejection::QueryRejection>,
) -> Response {
    let request_id = request_id_from_headers(&headers);

    let Ok(Query(query)) = query else {
        return bad_request("invalid_query", "Query parameters are invalid", request_id);
    };

    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };

    match state
        .moderation
        .queue(
            &user,
            query.page.unwrap_or(1),
            query.page_size.unwrap_or(20),
        )
        .await
    {
        Ok(page) => (
            StatusCode::OK,
            Json(PaginatedQueueDto {
                items: page.items.into_iter().map(Into::into).collect(),
                page: page.page,
                page_size: page.page_size,
                total_items: page.total_items,
                total_pages: page.total_pages,
            }),
        )
            .into_response(),
        Err(error) => application_error_response(error, request_id),
    }
}

pub(crate) async fn list_reports(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Response {
    let request_id = request_id_from_headers(&headers);

    let Some(post_id) = parse_post_id(&id) else {
        return bad_request("invalid_path", "Content id must be a UUID", request_id);
    };

    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };

    match state.moderation.list_reports(&user, post_id).await {
        Ok(reports) => (
            StatusCode::OK,
            Json(CollectionDto {
                items: reports.into_iter().map(ReportDto::from).collect::<Vec<_>>(),
            }),
        )
            .into_response(),
        Err(error) => application_error_response(error, request_id),
    }
}

pub(crate) async fn resolve_report(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Path((id, report_id)): Path<(String, String)>,
    payload: Result<Json<ResolveReportRequest>, JsonRejection>,
) -> Response {
    let request_id = request_id_from_headers(&headers);

    let (Some(post_id), Some(report)) = (
        parse_post_id(&id),
        Uuid::parse_str(&report_id).ok().map(ReportId::from_uuid),
    ) else {
        return bad_request("invalid_path", "Path ids must be UUIDs", request_id);
    };

    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };

    let Ok(Json(request)) = payload else {
        return invalid_body(request_id);
    };

    let Some(resolution) = ReportResolution::parse(&request.resolution) else {
        return invalid_body(request_id);
    };

    match state
        .moderation
        .resolve_report(
            &user,
            post_id,
            report,
            resolution,
            Utc::now(),
            &audit(&request_id),
        )
        .await
    {
        Ok(resolved) => (StatusCode::OK, Json(ReportDto::from(resolved))).into_response(),
        Err(error) => application_error_response(error, request_id),
    }
}

pub(crate) async fn ai_draft(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Response {
    let request_id = request_id_from_headers(&headers);

    let Some(discussion_id) = parse_post_id(&id) else {
        return bad_request("invalid_path", "Discussion id must be a UUID", request_id);
    };

    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };

    match state
        .ai
        .draft_from_discussion(&user, discussion_id, Utc::now(), &audit(&request_id))
        .await
    {
        Ok(outcome) => (StatusCode::CREATED, Json(AiDraftDto::from(outcome))).into_response(),
        Err(error) => application_error_response(error, request_id),
    }
}
