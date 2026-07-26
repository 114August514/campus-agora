//! Knowledge archive HTTP resource. Handlers stay thin: they parse input,
//! resolve the caller, delegate to `ArchiveService`, and convert the result
//! into DTOs. Permission and visibility decisions live in the application and
//! domain layers.

use axum::extract::rejection::JsonRejection;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use campus_agora_application::archive::{
    CorrectionInput, ListArchiveQuery, NewArchiveEntryInput, UpdateArchiveInput,
};
use campus_agora_application::auth::{AuditContext, CurrentUser};
use campus_agora_application::ports::{ArchiveEntryRecord, CorrectionRecord, RevisionRecord};
use campus_agora_domain::{
    ApplicableAudience, ArchiveCategory, CorrectionId, ModerationStatus, PostId, SourceKind,
};
use chrono::{DateTime, SecondsFormat, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::auth::{application_error_response, bearer_token, unauthorized_response};
use crate::{api_error_response, request_id_from_headers, ApiState};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateEntryRequest {
    pub title: String,
    pub body: String,
    pub summary: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    pub category: String,
    pub applicable_audience: String,
    pub source_kind: String,
    pub source_reference: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateEntryRequest {
    pub title: Option<String>,
    pub body: Option<String>,
    pub summary: Option<String>,
    pub tags: Option<Vec<String>>,
    pub category: Option<String>,
    pub applicable_audience: Option<String>,
    pub source_kind: Option<String>,
    pub source_reference: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangeStatusRequest {
    pub status: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileCorrectionRequest {
    pub message: String,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListEntriesQuery {
    pub q: Option<String>,
    pub tag: Option<String>,
    pub category: Option<String>,
    pub page: Option<u32>,
    pub page_size: Option<u32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeEntryDto {
    pub id: String,
    pub author_id: String,
    pub title: String,
    pub body: String,
    pub summary: Option<String>,
    pub tags: Vec<String>,
    pub category: &'static str,
    pub applicable_audience: &'static str,
    pub source_kind: &'static str,
    pub source_reference: Option<String>,
    pub moderation_status: &'static str,
    pub current_revision: i32,
    pub created_at: String,
    pub updated_at: String,
}

impl From<ArchiveEntryRecord> for KnowledgeEntryDto {
    fn from(entry: ArchiveEntryRecord) -> Self {
        Self {
            id: entry.id.to_string(),
            author_id: entry.author_id.to_string(),
            title: entry.title,
            body: entry.body,
            summary: entry.summary,
            tags: entry.tags,
            category: entry.category.as_str(),
            applicable_audience: entry.applicable_audience.as_str(),
            source_kind: entry.source_kind.as_str(),
            source_reference: entry.source_reference,
            moderation_status: entry.moderation_status.as_str(),
            current_revision: entry.current_revision,
            created_at: timestamp(entry.created_at),
            updated_at: timestamp(entry.updated_at),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RevisionDto {
    pub id: String,
    pub revision: i32,
    pub editor_id: String,
    pub title: String,
    pub body: String,
    pub summary: Option<String>,
    pub tags: Vec<String>,
    pub created_at: String,
}

impl From<RevisionRecord> for RevisionDto {
    fn from(revision: RevisionRecord) -> Self {
        Self {
            id: revision.id.to_string(),
            revision: revision.revision,
            editor_id: revision.editor_id.to_string(),
            title: revision.title,
            body: revision.body,
            summary: revision.summary,
            tags: revision.tags,
            created_at: timestamp(revision.created_at),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CorrectionDto {
    pub id: String,
    pub post_id: String,
    pub reporter_id: String,
    pub message: String,
    pub created_at: String,
    pub resolved_at: Option<String>,
    pub resolved_by: Option<String>,
}

impl From<CorrectionRecord> for CorrectionDto {
    fn from(correction: CorrectionRecord) -> Self {
        Self {
            id: correction.id.to_string(),
            post_id: correction.post_id.to_string(),
            reporter_id: correction.reporter_id.to_string(),
            message: correction.message,
            created_at: timestamp(correction.created_at),
            resolved_at: correction.resolved_at.map(timestamp),
            resolved_by: correction.resolved_by.map(|id| id.to_string()),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaginatedEntriesDto {
    pub items: Vec<KnowledgeEntryDto>,
    pub page: u32,
    pub page_size: u32,
    pub total_items: u64,
    pub total_pages: u32,
}

/// Revisions and corrections are bounded per entry, so they return a simple
/// collection rather than the paginated envelope.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionDto<T> {
    pub items: Vec<T>,
}

pub(crate) async fn list_entries(
    State(state): State<ApiState>,
    headers: HeaderMap,
    query: Result<Query<ListEntriesQuery>, axum::extract::rejection::QueryRejection>,
) -> Response {
    let request_id = request_id_from_headers(&headers);

    let Ok(Query(query)) = query else {
        return bad_request("invalid_query", "Query parameters are invalid", request_id);
    };

    let user = match resolve_optional_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };

    let category = match optional_enum(query.category.as_deref(), ArchiveCategory::parse) {
        Ok(category) => category,
        Err(()) => return bad_request("invalid_query", "Unknown category", request_id),
    };

    let service_query = ListArchiveQuery {
        q: query.q,
        tag: query.tag,
        category,
        page: query.page.unwrap_or(1),
        page_size: query.page_size.unwrap_or(20),
    };

    match state
        .archive
        .list_entries(user.as_ref(), service_query)
        .await
    {
        Ok(page) => (
            StatusCode::OK,
            Json(PaginatedEntriesDto {
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

pub(crate) async fn get_entry(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Response {
    let request_id = request_id_from_headers(&headers);

    let Some(entry_id) = parse_post_id(&id) else {
        return bad_request("invalid_path", "Entry id must be a UUID", request_id);
    };

    let user = match resolve_optional_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };

    match state.archive.get_entry(user.as_ref(), entry_id).await {
        Ok(entry) => (StatusCode::OK, Json(KnowledgeEntryDto::from(entry))).into_response(),
        Err(error) => application_error_response(error, request_id),
    }
}

pub(crate) async fn create_entry(
    State(state): State<ApiState>,
    headers: HeaderMap,
    payload: Result<Json<CreateEntryRequest>, JsonRejection>,
) -> Response {
    let request_id = request_id_from_headers(&headers);

    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };

    let Ok(Json(request)) = payload else {
        return invalid_body(request_id);
    };

    let (category, audience, source_kind) = match parse_metadata(
        &request.category,
        &request.applicable_audience,
        &request.source_kind,
    ) {
        Ok(values) => values,
        Err(()) => return invalid_body(request_id),
    };

    let input = NewArchiveEntryInput {
        title: request.title,
        body: request.body,
        summary: request.summary,
        tags: request.tags,
        category,
        applicable_audience: audience,
        source_kind,
        source_reference: request.source_reference,
    };

    match state
        .archive
        .create_draft(&user, input, Utc::now(), &audit(&request_id))
        .await
    {
        Ok(entry) => (StatusCode::CREATED, Json(KnowledgeEntryDto::from(entry))).into_response(),
        Err(error) => application_error_response(error, request_id),
    }
}

pub(crate) async fn update_entry(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    payload: Result<Json<UpdateEntryRequest>, JsonRejection>,
) -> Response {
    let request_id = request_id_from_headers(&headers);

    let Some(entry_id) = parse_post_id(&id) else {
        return bad_request("invalid_path", "Entry id must be a UUID", request_id);
    };

    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };

    let Ok(Json(request)) = payload else {
        return invalid_body(request_id);
    };

    let category = match optional_enum(request.category.as_deref(), ArchiveCategory::parse) {
        Ok(value) => value,
        Err(()) => return invalid_body(request_id),
    };
    let audience = match optional_enum(
        request.applicable_audience.as_deref(),
        ApplicableAudience::parse,
    ) {
        Ok(value) => value,
        Err(()) => return invalid_body(request_id),
    };
    let source_kind = match optional_enum(request.source_kind.as_deref(), SourceKind::parse) {
        Ok(value) => value,
        Err(()) => return invalid_body(request_id),
    };

    let input = UpdateArchiveInput {
        title: request.title,
        body: request.body,
        summary: request.summary,
        tags: request.tags,
        category,
        applicable_audience: audience,
        source_kind,
        source_reference: request.source_reference,
    };

    match state
        .archive
        .update_entry(&user, entry_id, input, Utc::now(), &audit(&request_id))
        .await
    {
        Ok(entry) => (StatusCode::OK, Json(KnowledgeEntryDto::from(entry))).into_response(),
        Err(error) => application_error_response(error, request_id),
    }
}

pub(crate) async fn change_status(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    payload: Result<Json<ChangeStatusRequest>, JsonRejection>,
) -> Response {
    let request_id = request_id_from_headers(&headers);

    let Some(entry_id) = parse_post_id(&id) else {
        return bad_request("invalid_path", "Entry id must be a UUID", request_id);
    };

    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };

    let Ok(Json(request)) = payload else {
        return invalid_body(request_id);
    };

    let Some(status) = ModerationStatus::parse(&request.status) else {
        return invalid_body(request_id);
    };

    match state
        .archive
        .change_status(&user, entry_id, status, Utc::now(), &audit(&request_id))
        .await
    {
        Ok(entry) => (StatusCode::OK, Json(KnowledgeEntryDto::from(entry))).into_response(),
        Err(error) => application_error_response(error, request_id),
    }
}

pub(crate) async fn list_revisions(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Response {
    let request_id = request_id_from_headers(&headers);

    let Some(entry_id) = parse_post_id(&id) else {
        return bad_request("invalid_path", "Entry id must be a UUID", request_id);
    };

    let user = match resolve_optional_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };

    match state.archive.list_revisions(user.as_ref(), entry_id).await {
        Ok(revisions) => (
            StatusCode::OK,
            Json(CollectionDto {
                items: revisions
                    .into_iter()
                    .map(RevisionDto::from)
                    .collect::<Vec<_>>(),
            }),
        )
            .into_response(),
        Err(error) => application_error_response(error, request_id),
    }
}

pub(crate) async fn list_corrections(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Response {
    let request_id = request_id_from_headers(&headers);

    let Some(entry_id) = parse_post_id(&id) else {
        return bad_request("invalid_path", "Entry id must be a UUID", request_id);
    };

    let user = match resolve_optional_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };

    match state
        .archive
        .list_corrections(user.as_ref(), entry_id)
        .await
    {
        Ok(corrections) => (
            StatusCode::OK,
            Json(CollectionDto {
                items: corrections
                    .into_iter()
                    .map(CorrectionDto::from)
                    .collect::<Vec<_>>(),
            }),
        )
            .into_response(),
        Err(error) => application_error_response(error, request_id),
    }
}

pub(crate) async fn file_correction(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    payload: Result<Json<FileCorrectionRequest>, JsonRejection>,
) -> Response {
    let request_id = request_id_from_headers(&headers);

    let Some(entry_id) = parse_post_id(&id) else {
        return bad_request("invalid_path", "Entry id must be a UUID", request_id);
    };

    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };

    let Ok(Json(request)) = payload else {
        return invalid_body(request_id);
    };

    match state
        .archive
        .file_correction(
            &user,
            entry_id,
            CorrectionInput {
                message: request.message,
            },
            Utc::now(),
            &audit(&request_id),
        )
        .await
    {
        Ok(correction) => {
            (StatusCode::CREATED, Json(CorrectionDto::from(correction))).into_response()
        }
        Err(error) => application_error_response(error, request_id),
    }
}

pub(crate) async fn resolve_correction(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Path((id, correction_id)): Path<(String, String)>,
) -> Response {
    let request_id = request_id_from_headers(&headers);

    let (Some(entry_id), Some(correction)) = (
        parse_post_id(&id),
        Uuid::parse_str(&correction_id)
            .ok()
            .map(CorrectionId::from_uuid),
    ) else {
        return bad_request("invalid_path", "Path ids must be UUIDs", request_id);
    };

    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };

    match state
        .archive
        .resolve_correction(&user, entry_id, correction, Utc::now(), &audit(&request_id))
        .await
    {
        Ok(correction) => (StatusCode::OK, Json(CorrectionDto::from(correction))).into_response(),
        Err(error) => application_error_response(error, request_id),
    }
}

/// Resolves the bearer token when one is present. A missing token means guest
/// access, which read endpoints allow; an invalid token is still an error, so
/// an expired session does not silently downgrade a reader to a guest and hide
/// their own drafts.
async fn resolve_optional_user(
    state: &ApiState,
    headers: &HeaderMap,
) -> Result<Option<CurrentUser>, Response> {
    let Some(token) = bearer_token(headers) else {
        return Ok(None);
    };

    match state.auth.current_session(&token, Utc::now()).await {
        Ok(session) => Ok(Some(session.user)),
        Err(error) => Err(application_error_response(
            error,
            request_id_from_headers(headers),
        )),
    }
}

async fn require_user(state: &ApiState, headers: &HeaderMap) -> Result<CurrentUser, Response> {
    match resolve_optional_user(state, headers).await? {
        Some(user) => Ok(user),
        None => Err(unauthorized_response(request_id_from_headers(headers))),
    }
}

fn parse_metadata(
    category: &str,
    audience: &str,
    source_kind: &str,
) -> Result<(ArchiveCategory, ApplicableAudience, SourceKind), ()> {
    Ok((
        ArchiveCategory::parse(category).ok_or(())?,
        ApplicableAudience::parse(audience).ok_or(())?,
        SourceKind::parse(source_kind).ok_or(())?,
    ))
}

fn optional_enum<T>(value: Option<&str>, parse: fn(&str) -> Option<T>) -> Result<Option<T>, ()> {
    match value {
        None => Ok(None),
        Some(value) => parse(value).map(Some).ok_or(()),
    }
}

fn parse_post_id(value: &str) -> Option<PostId> {
    Uuid::parse_str(value).ok().map(PostId::from_uuid)
}

fn audit(request_id: &str) -> AuditContext {
    AuditContext {
        request_id: Some(request_id.to_owned()),
    }
}

fn bad_request(code: &'static str, message: &str, request_id: String) -> Response {
    api_error_response(
        StatusCode::BAD_REQUEST,
        code,
        message.to_owned(),
        request_id,
        None,
    )
    .into_response()
}

fn invalid_body(request_id: String) -> Response {
    bad_request(
        "invalid_request_body",
        "Request body is invalid",
        request_id,
    )
}

fn timestamp(value: DateTime<Utc>) -> String {
    value.to_rfc3339_opts(SecondsFormat::Secs, true)
}
