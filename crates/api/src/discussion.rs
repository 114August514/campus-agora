//! Discussion HTTP resource, plus the two endpoints that expose the link
//! between a discussion and the archive entries it produced. Handlers stay
//! thin for the same reason as the archive resource: every permission and
//! visibility decision belongs to the application and domain layers.

use axum::extract::rejection::JsonRejection;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use campus_agora_application::discussion::{
    ListDiscussionQuery, NewDiscussionInput, PromoteInput, PromotionOutcome, ReplyInput,
};
use campus_agora_application::ports::{
    ArchiveSourceRecord, CommentRecord, DerivedEntryRecord, DiscussionRecord,
};
use campus_agora_domain::{ApplicableAudience, ArchiveCategory, CommentId, ModerationStatus};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::archive::{
    audit, bad_request, invalid_body, parse_post_id, require_user, resolve_optional_user,
    timestamp, CollectionDto, KnowledgeEntryDto,
};
use crate::auth::application_error_response;
use crate::{request_id_from_headers, ApiState};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDiscussionRequest {
    pub title: String,
    pub body: String,
    #[serde(default)]
    pub tags: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplyRequest {
    pub body: String,
}

/// `commentId` is nullable: sending `null` clears the accepted answer, which
/// keeps setting and unsetting on one endpoint instead of inventing a DELETE
/// that means something subtly different.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AcceptAnswerRequest {
    #[serde(default)]
    pub comment_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PromoteRequest {
    pub comment_id: Option<String>,
    pub title: Option<String>,
    pub body: Option<String>,
    pub summary: Option<String>,
    pub tags: Option<Vec<String>>,
    pub category: Option<String>,
    pub applicable_audience: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListDiscussionsQuery {
    pub q: Option<String>,
    pub tag: Option<String>,
    pub page: Option<u32>,
    pub page_size: Option<u32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscussionDto {
    pub id: String,
    pub author_id: String,
    pub title: String,
    pub body: String,
    pub tags: Vec<String>,
    pub moderation_status: String,
    pub accepted_comment_id: Option<String>,
    pub reply_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

impl From<DiscussionRecord> for DiscussionDto {
    fn from(record: DiscussionRecord) -> Self {
        Self {
            id: record.id.to_string(),
            author_id: record.author_id.to_string(),
            title: record.title,
            body: record.body,
            tags: record.tags,
            moderation_status: record.moderation_status.as_str().to_owned(),
            accepted_comment_id: record.accepted_comment_id.map(|id| id.to_string()),
            reply_count: record.reply_count,
            created_at: timestamp(record.created_at),
            updated_at: timestamp(record.updated_at),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplyDto {
    pub id: String,
    pub post_id: String,
    pub author_id: String,
    pub body: String,
    pub created_at: String,
    pub updated_at: String,
}

impl From<CommentRecord> for ReplyDto {
    fn from(record: CommentRecord) -> Self {
        Self {
            id: record.id.to_string(),
            post_id: record.post_id.to_string(),
            author_id: record.author_id.to_string(),
            body: record.body,
            created_at: timestamp(record.created_at),
            updated_at: timestamp(record.updated_at),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveSourceDto {
    pub entry_id: String,
    pub source_post_id: String,
    pub source_comment_id: Option<String>,
    /// Who wrote the quoted text. Not the entry's author when a reply was
    /// promoted, which is exactly why it is carried through.
    pub source_author_id: String,
    pub source_title: String,
    pub created_at: String,
}

impl From<ArchiveSourceRecord> for ArchiveSourceDto {
    fn from(record: ArchiveSourceRecord) -> Self {
        Self {
            entry_id: record.entry_id.to_string(),
            source_post_id: record.source_post_id.to_string(),
            source_comment_id: record.source_comment_id.map(|id| id.to_string()),
            source_author_id: record.source_author_id.to_string(),
            source_title: record.source_title,
            created_at: timestamp(record.created_at),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DerivedEntryDto {
    pub entry_id: String,
    pub title: String,
    pub moderation_status: String,
    pub created_at: String,
}

impl From<DerivedEntryRecord> for DerivedEntryDto {
    fn from(record: DerivedEntryRecord) -> Self {
        Self {
            entry_id: record.entry_id.to_string(),
            title: record.title,
            moderation_status: record.moderation_status.as_str().to_owned(),
            created_at: timestamp(record.created_at),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PromotionDto {
    pub entry: KnowledgeEntryDto,
    pub source: ArchiveSourceDto,
}

impl From<PromotionOutcome> for PromotionDto {
    fn from(outcome: PromotionOutcome) -> Self {
        Self {
            entry: KnowledgeEntryDto::from(outcome.entry),
            source: ArchiveSourceDto::from(outcome.source),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaginatedDiscussionsDto {
    pub items: Vec<DiscussionDto>,
    pub page: u32,
    pub page_size: u32,
    pub total_items: u64,
    pub total_pages: u32,
}

pub(crate) async fn list_discussions(
    State(state): State<ApiState>,
    headers: HeaderMap,
    query: Result<Query<ListDiscussionsQuery>, axum::extract::rejection::QueryRejection>,
) -> Response {
    let request_id = request_id_from_headers(&headers);

    let Ok(Query(query)) = query else {
        return bad_request("invalid_query", "Query parameters are invalid", request_id);
    };

    let user = match resolve_optional_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };

    let service_query = ListDiscussionQuery {
        q: query.q,
        tag: query.tag,
        page: query.page.unwrap_or(1),
        page_size: query.page_size.unwrap_or(20),
    };

    match state.discussions.list(user.as_ref(), service_query).await {
        Ok(page) => (
            StatusCode::OK,
            Json(PaginatedDiscussionsDto {
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

pub(crate) async fn get_discussion(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Response {
    let request_id = request_id_from_headers(&headers);

    let Some(discussion_id) = parse_post_id(&id) else {
        return bad_request("invalid_path", "Discussion id must be a UUID", request_id);
    };

    let user = match resolve_optional_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };

    match state.discussions.get(user.as_ref(), discussion_id).await {
        Ok(discussion) => (StatusCode::OK, Json(DiscussionDto::from(discussion))).into_response(),
        Err(error) => application_error_response(error, request_id),
    }
}

pub(crate) async fn create_discussion(
    State(state): State<ApiState>,
    headers: HeaderMap,
    payload: Result<Json<CreateDiscussionRequest>, JsonRejection>,
) -> Response {
    let request_id = request_id_from_headers(&headers);

    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };

    let Ok(Json(request)) = payload else {
        return invalid_body(request_id);
    };

    match state
        .discussions
        .create(
            &user,
            NewDiscussionInput {
                title: request.title,
                body: request.body,
                tags: request.tags,
            },
            Utc::now(),
            &audit(&request_id),
        )
        .await
    {
        Ok(discussion) => {
            (StatusCode::CREATED, Json(DiscussionDto::from(discussion))).into_response()
        }
        Err(error) => application_error_response(error, request_id),
    }
}

pub(crate) async fn change_discussion_status(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    payload: Result<Json<crate::archive::ChangeStatusRequest>, JsonRejection>,
) -> Response {
    let request_id = request_id_from_headers(&headers);

    let Some(discussion_id) = parse_post_id(&id) else {
        return bad_request("invalid_path", "Discussion id must be a UUID", request_id);
    };

    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };

    let Ok(Json(request)) = payload else {
        return invalid_body(request_id);
    };

    let Some(target) = ModerationStatus::parse(&request.status) else {
        return invalid_body(request_id);
    };

    match state
        .discussions
        .change_status(
            &user,
            discussion_id,
            target,
            Utc::now(),
            &audit(&request_id),
        )
        .await
    {
        Ok(discussion) => (StatusCode::OK, Json(DiscussionDto::from(discussion))).into_response(),
        Err(error) => application_error_response(error, request_id),
    }
}

pub(crate) async fn list_replies(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Response {
    let request_id = request_id_from_headers(&headers);

    let Some(discussion_id) = parse_post_id(&id) else {
        return bad_request("invalid_path", "Discussion id must be a UUID", request_id);
    };

    let user = match resolve_optional_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };

    match state
        .discussions
        .list_replies(user.as_ref(), discussion_id)
        .await
    {
        Ok(replies) => (
            StatusCode::OK,
            Json(CollectionDto {
                items: replies.into_iter().map(ReplyDto::from).collect::<Vec<_>>(),
            }),
        )
            .into_response(),
        Err(error) => application_error_response(error, request_id),
    }
}

pub(crate) async fn create_reply(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    payload: Result<Json<ReplyRequest>, JsonRejection>,
) -> Response {
    let request_id = request_id_from_headers(&headers);

    let Some(discussion_id) = parse_post_id(&id) else {
        return bad_request("invalid_path", "Discussion id must be a UUID", request_id);
    };

    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };

    let Ok(Json(request)) = payload else {
        return invalid_body(request_id);
    };

    match state
        .discussions
        .reply(
            &user,
            discussion_id,
            ReplyInput { body: request.body },
            Utc::now(),
            &audit(&request_id),
        )
        .await
    {
        Ok(reply) => (StatusCode::CREATED, Json(ReplyDto::from(reply))).into_response(),
        Err(error) => application_error_response(error, request_id),
    }
}

pub(crate) async fn accept_answer(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    payload: Result<Json<AcceptAnswerRequest>, JsonRejection>,
) -> Response {
    let request_id = request_id_from_headers(&headers);

    let Some(discussion_id) = parse_post_id(&id) else {
        return bad_request("invalid_path", "Discussion id must be a UUID", request_id);
    };

    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };

    let Ok(Json(request)) = payload else {
        return invalid_body(request_id);
    };

    let comment_id = match parse_optional_comment_id(request.comment_id.as_deref()) {
        Ok(value) => value,
        Err(()) => return invalid_body(request_id),
    };

    match state
        .discussions
        .accept_answer(
            &user,
            discussion_id,
            comment_id,
            Utc::now(),
            &audit(&request_id),
        )
        .await
    {
        Ok(discussion) => (StatusCode::OK, Json(DiscussionDto::from(discussion))).into_response(),
        Err(error) => application_error_response(error, request_id),
    }
}

pub(crate) async fn promote(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    payload: Result<Json<PromoteRequest>, JsonRejection>,
) -> Response {
    let request_id = request_id_from_headers(&headers);

    let Some(discussion_id) = parse_post_id(&id) else {
        return bad_request("invalid_path", "Discussion id must be a UUID", request_id);
    };

    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };

    let Ok(Json(request)) = payload else {
        return invalid_body(request_id);
    };

    let comment_id = match parse_optional_comment_id(request.comment_id.as_deref()) {
        Ok(value) => value,
        Err(()) => return invalid_body(request_id),
    };

    let (category, audience) = match (
        optional_parse(request.category.as_deref(), ArchiveCategory::parse),
        optional_parse(
            request.applicable_audience.as_deref(),
            ApplicableAudience::parse,
        ),
    ) {
        (Ok(category), Ok(audience)) => (category, audience),
        _ => return invalid_body(request_id),
    };

    match state
        .discussions
        .promote(
            &user,
            discussion_id,
            PromoteInput {
                comment_id,
                title: request.title,
                body: request.body,
                summary: request.summary,
                tags: request.tags,
                category,
                applicable_audience: audience,
            },
            Utc::now(),
            &audit(&request_id),
        )
        .await
    {
        Ok(outcome) => (StatusCode::CREATED, Json(PromotionDto::from(outcome))).into_response(),
        Err(error) => application_error_response(error, request_id),
    }
}

pub(crate) async fn list_derived_entries(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Response {
    let request_id = request_id_from_headers(&headers);

    let Some(discussion_id) = parse_post_id(&id) else {
        return bad_request("invalid_path", "Discussion id must be a UUID", request_id);
    };

    let user = match resolve_optional_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };

    match state
        .discussions
        .list_derived_entries(user.as_ref(), discussion_id)
        .await
    {
        Ok(entries) => (
            StatusCode::OK,
            Json(CollectionDto {
                items: entries
                    .into_iter()
                    .map(DerivedEntryDto::from)
                    .collect::<Vec<_>>(),
            }),
        )
            .into_response(),
        Err(error) => application_error_response(error, request_id),
    }
}

pub(crate) async fn list_entry_sources(
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

    match state.archive.list_sources(user.as_ref(), entry_id).await {
        Ok(sources) => (
            StatusCode::OK,
            Json(CollectionDto {
                items: sources
                    .into_iter()
                    .map(ArchiveSourceDto::from)
                    .collect::<Vec<_>>(),
            }),
        )
            .into_response(),
        Err(error) => application_error_response(error, request_id),
    }
}

/// `None` means "clear it", a malformed string is a client error. Collapsing
/// the two would silently clear the accepted answer on a typo.
fn parse_optional_comment_id(value: Option<&str>) -> Result<Option<CommentId>, ()> {
    match value {
        None => Ok(None),
        Some(value) => Uuid::parse_str(value)
            .ok()
            .map(CommentId::from_uuid)
            .map(Some)
            .ok_or(()),
    }
}

fn optional_parse<T>(value: Option<&str>, parse: fn(&str) -> Option<T>) -> Result<Option<T>, ()> {
    match value {
        None => Ok(None),
        Some(value) => parse(value).map(Some).ok_or(()),
    }
}
