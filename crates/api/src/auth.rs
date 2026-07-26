//! M1 auth endpoints: mock campus login, current session, logout.
//! Handlers stay thin; the auth use cases live in `campus_agora_application`.

use axum::extract::rejection::JsonRejection;
use axum::extract::State;
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use campus_agora_application::auth::{AuditContext, AuthCredential, AuthenticatedSession};
use campus_agora_application::ApplicationError;
use chrono::{DateTime, SecondsFormat, Utc};
use serde::{Deserialize, Serialize};

use crate::{api_error_response, request_id_from_headers, ApiState};

#[derive(Debug, Deserialize)]
pub struct MockLoginRequest {
    pub persona: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrganizationMembershipDto {
    pub organization_id: String,
    pub slug: String,
    pub name: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CurrentUserDto {
    pub id: String,
    pub display_name: String,
    pub system_role: &'static str,
    pub organizations: Vec<OrganizationMembershipDto>,
}

impl From<campus_agora_application::auth::CurrentUser> for CurrentUserDto {
    fn from(user: campus_agora_application::auth::CurrentUser) -> Self {
        Self {
            id: user.id.to_string(),
            display_name: user.display_name,
            system_role: user.system_role.as_str(),
            organizations: user
                .organizations
                .into_iter()
                .map(|membership| OrganizationMembershipDto {
                    organization_id: membership.organization_id.to_string(),
                    slug: membership.slug,
                    name: membership.name,
                })
                .collect(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginResponseDto {
    pub token: String,
    pub expires_at: String,
    pub user: CurrentUserDto,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionResponseDto {
    pub user: CurrentUserDto,
    pub expires_at: String,
}

impl From<AuthenticatedSession> for SessionResponseDto {
    fn from(session: AuthenticatedSession) -> Self {
        Self {
            user: session.user.into(),
            expires_at: format_timestamp(session.expires_at),
        }
    }
}

pub(crate) async fn mock_login(
    State(state): State<ApiState>,
    headers: HeaderMap,
    payload: Result<Json<MockLoginRequest>, JsonRejection>,
) -> Response {
    let request_id = request_id_from_headers(&headers);

    if !state.capabilities.auth_mock_enabled {
        return api_error_response(
            StatusCode::FORBIDDEN,
            "auth_mock_disabled",
            "Mock campus login is disabled".to_owned(),
            request_id,
            None,
        )
        .into_response();
    }

    let Json(request) = match payload {
        Ok(json) => json,
        Err(_) => {
            return api_error_response(
                StatusCode::BAD_REQUEST,
                "invalid_request_body",
                "Request body must be valid JSON".to_owned(),
                request_id,
                None,
            )
            .into_response();
        }
    };

    let audit = AuditContext {
        request_id: Some(request_id.clone()),
    };
    let credential = AuthCredential::MockPersona(request.persona);

    match state.auth.login(&credential, Utc::now(), &audit).await {
        Ok(outcome) => (
            StatusCode::OK,
            Json(LoginResponseDto {
                token: outcome.token,
                expires_at: format_timestamp(outcome.expires_at),
                user: outcome.user.into(),
            }),
        )
            .into_response(),
        Err(error) => application_error_response(error, request_id),
    }
}

pub(crate) async fn auth_session(State(state): State<ApiState>, headers: HeaderMap) -> Response {
    let request_id = request_id_from_headers(&headers);

    let Some(token) = bearer_token(&headers) else {
        return unauthorized_response(request_id);
    };

    match state.auth.current_session(&token, Utc::now()).await {
        Ok(session) => (StatusCode::OK, Json(SessionResponseDto::from(session))).into_response(),
        Err(error) => application_error_response(error, request_id),
    }
}

pub(crate) async fn logout(State(state): State<ApiState>, headers: HeaderMap) -> Response {
    let request_id = request_id_from_headers(&headers);

    let Some(token) = bearer_token(&headers) else {
        return unauthorized_response(request_id);
    };

    let audit = AuditContext {
        request_id: Some(request_id.clone()),
    };

    match state.auth.logout(&token, Utc::now(), &audit).await {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(error) => application_error_response(error, request_id),
    }
}

fn bearer_token(headers: &HeaderMap) -> Option<String> {
    let value = headers.get(header::AUTHORIZATION)?.to_str().ok()?;
    let token = value.strip_prefix("Bearer ")?.trim();

    if token.is_empty() {
        return None;
    }

    Some(token.to_owned())
}

fn unauthorized_response(request_id: String) -> Response {
    api_error_response(
        StatusCode::UNAUTHORIZED,
        "unauthorized",
        "Authentication is required".to_owned(),
        request_id,
        None,
    )
    .into_response()
}

fn application_error_response(error: ApplicationError, request_id: String) -> Response {
    let (status, code, message) = match error {
        ApplicationError::Unauthorized => (
            StatusCode::UNAUTHORIZED,
            "unauthorized",
            "Authentication is required".to_owned(),
        ),
        ApplicationError::Forbidden => (
            StatusCode::FORBIDDEN,
            "forbidden",
            "You do not have permission to perform this action".to_owned(),
        ),
        ApplicationError::Validation(message) => (
            StatusCode::UNPROCESSABLE_ENTITY,
            "validation_failed",
            message,
        ),
        ApplicationError::NotFound(_) => (
            StatusCode::NOT_FOUND,
            "not_found",
            "Resource not found".to_owned(),
        ),
        ApplicationError::Conflict(message) => (StatusCode::CONFLICT, "conflict", message),
        ApplicationError::Internal(detail) => {
            tracing::error!(%detail, "auth request failed with internal error");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "internal_error",
                "Unexpected server error".to_owned(),
            )
        }
    };

    api_error_response(status, code, message, request_id, None).into_response()
}

fn format_timestamp(timestamp: DateTime<Utc>) -> String {
    timestamp.to_rfc3339_opts(SecondsFormat::Secs, true)
}
