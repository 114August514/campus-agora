use std::fmt;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;

use axum::body::{to_bytes, Body};
use axum::extract::State;
use axum::http::{header, header::HeaderName, HeaderMap, HeaderValue, Method, Request, StatusCode};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::{
    routing::{get, post},
    Json, Router,
};
use campus_agora_application::auth::{AuthConfig, AuthService, MockCampusAuthProvider};
use campus_agora_application::memory::InMemoryAuthStore;
use campus_agora_application::ports::{
    AuditEventRepository, OrganizationRepository, SessionRepository, UserRepository,
};
use serde::Serialize;
use serde_json::{json, Value};
use sqlx::postgres::PgPoolOptions;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;

mod auth;

pub const API_BOUNDARY: &str = "campus-agora-api";
const DEFAULT_REQUEST_BODY_LIMIT_BYTES: usize = 1024 * 1024;
const DEFAULT_SESSION_TTL_SECONDS: usize = 86400;
const DEFAULT_CORS_ALLOWED_ORIGINS: &[&str] = &["http://127.0.0.1:5173", "http://localhost:5173"];
const REQUEST_ID_HEADER: &str = "x-request-id";
static REQUEST_COUNTER: AtomicU64 = AtomicU64::new(1);

#[derive(Clone)]
pub struct ApiState {
    readiness: ReadinessProbe,
    pub(crate) capabilities: CapabilityFlags,
    pub(crate) auth: Arc<AuthService>,
}

impl fmt::Debug for ApiState {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("ApiState")
            .field("readiness", &self.readiness)
            .field("capabilities", &self.capabilities)
            .finish_non_exhaustive()
    }
}

impl ApiState {
    pub fn from_env() -> Self {
        let session_ttl_seconds = usize_env("SESSION_TTL_SECONDS", DEFAULT_SESSION_TTL_SECONDS);

        let (readiness, auth) = match std::env::var("DATABASE_URL") {
            Ok(database_url) if !database_url.trim().is_empty() => {
                let pool = campus_agora_db::connect_lazy(&database_url).unwrap_or_else(|_| {
                    panic!("DATABASE_URL is not a valid PostgreSQL connection string")
                });
                let store = Arc::new(campus_agora_db::PgAuthStore::new(pool));

                (
                    ReadinessProbe::Postgres { database_url },
                    auth_service_with_store(store, session_ttl_seconds),
                )
            }
            _ => {
                tracing::warn!(
                    "DATABASE_URL is not set; auth runtime uses a non-persistent in-memory store"
                );

                (
                    ReadinessProbe::Unavailable,
                    auth_service_with_store(
                        Arc::new(InMemoryAuthStore::default()),
                        session_ttl_seconds,
                    ),
                )
            }
        };

        Self {
            readiness,
            capabilities: CapabilityFlags {
                auth_mock_enabled: bool_env("AUTH_MOCK_ENABLED", true),
                desktop_enabled: bool_env("DESKTOP_ENABLED", true),
                ai_archive_enabled: bool_env("AI_ARCHIVE_ENABLED", false),
                attachments_enabled: bool_env("ATTACHMENTS_ENABLED", false),
            },
            auth,
        }
    }

    pub fn for_tests(readiness: ReadinessStatus) -> Self {
        Self {
            readiness: match readiness {
                ReadinessStatus::Ready => ReadinessProbe::Ready,
                ReadinessStatus::Unavailable => ReadinessProbe::Unavailable,
            },
            capabilities: CapabilityFlags {
                auth_mock_enabled: true,
                desktop_enabled: true,
                ai_archive_enabled: false,
                attachments_enabled: false,
            },
            auth: auth_service_with_store(
                Arc::new(InMemoryAuthStore::default()),
                DEFAULT_SESSION_TTL_SECONDS,
            ),
        }
    }

    pub fn with_auth_mock_enabled(mut self, enabled: bool) -> Self {
        self.capabilities.auth_mock_enabled = enabled;
        self
    }
}

fn auth_service_with_store<S>(store: Arc<S>, session_ttl_seconds: usize) -> Arc<AuthService>
where
    S: UserRepository + SessionRepository + OrganizationRepository + AuditEventRepository + 'static,
{
    Arc::new(AuthService::new(
        Arc::new(MockCampusAuthProvider),
        store.clone(),
        store.clone(),
        store.clone(),
        store,
        AuthConfig {
            session_ttl: chrono::Duration::seconds(session_ttl_seconds as i64),
        },
    ))
}

#[derive(Clone, Debug)]
pub struct ApiRuntimeConfig {
    cors_allowed_origins: CorsAllowedOrigins,
    request_body_limit_bytes: usize,
}

impl ApiRuntimeConfig {
    pub fn from_env() -> Self {
        Self {
            cors_allowed_origins: cors_allowed_origins_from_env(),
            request_body_limit_bytes: usize_env(
                "REQUEST_BODY_LIMIT_BYTES",
                DEFAULT_REQUEST_BODY_LIMIT_BYTES,
            ),
        }
    }

    pub fn for_tests() -> Self {
        Self {
            cors_allowed_origins: CorsAllowedOrigins::List(origin_values(
                DEFAULT_CORS_ALLOWED_ORIGINS,
            )),
            request_body_limit_bytes: DEFAULT_REQUEST_BODY_LIMIT_BYTES,
        }
    }

    pub fn with_cors_allowed_origins<I, S>(mut self, origins: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: AsRef<str>,
    {
        let origins = origins
            .into_iter()
            .map(|origin| origin_value(origin.as_ref()))
            .collect();

        self.cors_allowed_origins = CorsAllowedOrigins::List(origins);
        self
    }

    pub fn with_request_body_limit_bytes(mut self, limit: usize) -> Self {
        assert!(limit > 0, "request body limit must be a positive integer");
        self.request_body_limit_bytes = limit;
        self
    }
}

#[derive(Clone, Debug)]
enum CorsAllowedOrigins {
    Any,
    List(Vec<HeaderValue>),
}

#[derive(Clone, Debug)]
enum ReadinessProbe {
    Ready,
    Unavailable,
    Postgres { database_url: String },
}

#[derive(Clone, Copy, Debug)]
pub enum ReadinessStatus {
    Ready,
    Unavailable,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MetaResponse {
    pub app_name: &'static str,
    pub version: &'static str,
    pub capabilities: CapabilityFlags,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CapabilityFlags {
    pub auth_mock_enabled: bool,
    pub desktop_enabled: bool,
    pub ai_archive_enabled: bool,
    pub attachments_enabled: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadinessResponse {
    pub status: &'static str,
    pub checks: ReadinessChecks,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadinessChecks {
    pub postgres: &'static str,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiErrorResponse {
    pub code: &'static str,
    pub message: String,
    pub request_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<Value>,
}

pub fn build_router() -> Router {
    build_router_with_state_and_config(ApiState::from_env(), ApiRuntimeConfig::from_env())
}

pub fn build_router_with_state(state: ApiState) -> Router {
    build_router_with_state_and_config(state, ApiRuntimeConfig::for_tests())
}

pub fn build_router_with_state_and_config(state: ApiState, config: ApiRuntimeConfig) -> Router {
    let request_body_limit_bytes = config.request_body_limit_bytes;

    Router::new()
        .route("/healthz", get(healthz))
        .route("/readyz", get(readyz))
        .route("/api/v1/meta", get(meta))
        .route("/api/v1/auth/mock-login", post(auth::mock_login))
        .route("/api/v1/auth/session", get(auth::auth_session))
        .route("/api/v1/auth/logout", post(auth::logout))
        .fallback(not_found)
        .with_state(state)
        .layer(cors_layer(&config))
        .layer(TraceLayer::new_for_http())
        .layer(middleware::from_fn(move |request, next| {
            request_body_limit_middleware(request, next, request_body_limit_bytes)
        }))
        .layer(middleware::from_fn(request_id_middleware))
}

pub fn openapi_document() -> Value {
    json!({
        "openapi": "3.1.0",
        "info": {
            "title": "Campus Agora API",
            "version": env!("CARGO_PKG_VERSION")
        },
        "paths": {
            "/healthz": {
                "get": {
                    "operationId": "getHealth",
                    "summary": "Health check",
                    "security": [],
                    "responses": {
                        "200": {
                            "description": "API process is alive",
                            "content": {
                                "text/plain": {
                                    "schema": {
                                        "type": "string",
                                        "const": "ok"
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/readyz": {
                "get": {
                    "operationId": "getReadiness",
                    "summary": "Readiness check",
                    "security": [],
                    "responses": {
                        "200": {
                            "description": "API dependencies are ready",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "$ref": "#/components/schemas/ReadinessResponse"
                                    }
                                }
                            }
                        },
                        "503": {
                            "description": "API dependencies are not ready",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "$ref": "#/components/schemas/ReadinessResponse"
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/api/v1/meta": {
                "get": {
                    "operationId": "getMeta",
                    "summary": "Application metadata and capability flags",
                    "security": [],
                    "responses": {
                        "200": {
                            "description": "Application metadata",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "$ref": "#/components/schemas/MetaResponse"
                                    }
                                }
                            }
                        },
                        "500": {
                            "description": "Unexpected server error",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "$ref": "#/components/schemas/ApiErrorResponse"
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/api/v1/auth/mock-login": {
                "post": {
                    "operationId": "mockLogin",
                    "summary": "Mock campus login for development, CI, and demos",
                    "description": "Available only while the authMockEnabled capability flag is on.",
                    "security": [],
                    "requestBody": {
                        "required": true,
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/MockLoginRequest"
                                }
                            }
                        }
                    },
                    "responses": {
                        "200": {
                            "description": "Session created for the mock persona",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "$ref": "#/components/schemas/LoginResponse"
                                    }
                                }
                            }
                        },
                        "400": {
                            "description": "Malformed request body",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "$ref": "#/components/schemas/ApiErrorResponse"
                                    }
                                }
                            }
                        },
                        "403": {
                            "description": "Mock login is disabled",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "$ref": "#/components/schemas/ApiErrorResponse"
                                    }
                                }
                            }
                        },
                        "422": {
                            "description": "Unknown persona",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "$ref": "#/components/schemas/ApiErrorResponse"
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/api/v1/auth/session": {
                "get": {
                    "operationId": "getAuthSession",
                    "summary": "Current authenticated session",
                    "security": [{ "bearerAuth": [] }],
                    "responses": {
                        "200": {
                            "description": "The active session and its user",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "$ref": "#/components/schemas/SessionResponse"
                                    }
                                }
                            }
                        },
                        "401": {
                            "description": "Missing, invalid, expired, or revoked session token",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "$ref": "#/components/schemas/ApiErrorResponse"
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/api/v1/auth/logout": {
                "post": {
                    "operationId": "logout",
                    "summary": "Revoke the current session",
                    "security": [{ "bearerAuth": [] }],
                    "responses": {
                        "204": {
                            "description": "Session revoked"
                        },
                        "401": {
                            "description": "Missing, invalid, expired, or revoked session token",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "$ref": "#/components/schemas/ApiErrorResponse"
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        "components": {
            "securitySchemes": {
                "bearerAuth": {
                    "type": "http",
                    "scheme": "bearer",
                    "description": "Opaque session token issued by mock-login."
                }
            },
            "schemas": {
                "ApiErrorResponse": {
                    "type": "object",
                    "required": ["code", "message", "requestId"],
                    "properties": {
                        "code": {
                            "type": "string",
                            "description": "Stable snake_case application error code."
                        },
                        "message": {
                            "type": "string"
                        },
                        "requestId": {
                            "type": "string"
                        },
                        "details": {
                            "type": "object",
                            "description": "Optional structured error details."
                        }
                    }
                },
                "CapabilityFlags": {
                    "type": "object",
                    "required": [
                        "authMockEnabled",
                        "desktopEnabled",
                        "aiArchiveEnabled",
                        "attachmentsEnabled"
                    ],
                    "properties": {
                        "authMockEnabled": { "type": "boolean" },
                        "desktopEnabled": { "type": "boolean" },
                        "aiArchiveEnabled": { "type": "boolean" },
                        "attachmentsEnabled": { "type": "boolean" }
                    }
                },
                "MetaResponse": {
                    "type": "object",
                    "required": ["appName", "version", "capabilities"],
                    "properties": {
                        "appName": {
                            "type": "string",
                            "const": "Campus Agora"
                        },
                        "version": {
                            "type": "string"
                        },
                        "capabilities": {
                            "$ref": "#/components/schemas/CapabilityFlags"
                        }
                    }
                },
                "ReadinessChecks": {
                    "type": "object",
                    "required": ["postgres"],
                    "properties": {
                        "postgres": {
                            "type": "string",
                            "enum": ["ok", "unavailable"]
                        }
                    }
                },
                "ReadinessResponse": {
                    "type": "object",
                    "required": ["status", "checks"],
                    "properties": {
                        "status": {
                            "type": "string",
                            "enum": ["ready", "unready"]
                        },
                        "checks": {
                            "$ref": "#/components/schemas/ReadinessChecks"
                        }
                    }
                },
                "MockLoginRequest": {
                    "type": "object",
                    "required": ["persona"],
                    "properties": {
                        "persona": {
                            "type": "string",
                            "enum": ["student", "organization_member", "moderator", "admin"],
                            "description": "Deterministic mock campus persona."
                        }
                    }
                },
                "OrganizationMembership": {
                    "type": "object",
                    "required": ["organizationId", "slug", "name"],
                    "properties": {
                        "organizationId": { "type": "string" },
                        "slug": { "type": "string" },
                        "name": { "type": "string" }
                    }
                },
                "CurrentUser": {
                    "type": "object",
                    "required": ["id", "displayName", "systemRole", "organizations"],
                    "properties": {
                        "id": { "type": "string" },
                        "displayName": { "type": "string" },
                        "systemRole": {
                            "type": "string",
                            "enum": ["student", "organization_member", "moderator", "admin"]
                        },
                        "organizations": {
                            "type": "array",
                            "items": {
                                "$ref": "#/components/schemas/OrganizationMembership"
                            }
                        }
                    }
                },
                "LoginResponse": {
                    "type": "object",
                    "required": ["token", "expiresAt", "user"],
                    "properties": {
                        "token": {
                            "type": "string",
                            "description": "Opaque session token, returned exactly once."
                        },
                        "expiresAt": {
                            "type": "string",
                            "description": "UTC ISO 8601 session expiry."
                        },
                        "user": {
                            "$ref": "#/components/schemas/CurrentUser"
                        }
                    }
                },
                "SessionResponse": {
                    "type": "object",
                    "required": ["user", "expiresAt"],
                    "properties": {
                        "user": {
                            "$ref": "#/components/schemas/CurrentUser"
                        },
                        "expiresAt": {
                            "type": "string",
                            "description": "UTC ISO 8601 session expiry."
                        }
                    }
                }
            }
        }
    })
}

async fn healthz() -> &'static str {
    "ok"
}

async fn readyz(State(state): State<ApiState>) -> impl IntoResponse {
    let checks = state.readiness.check().await;
    let ready = checks.postgres == "ok";
    let status = if ready { "ready" } else { "unready" };
    let http_status = if ready {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };

    (http_status, Json(ReadinessResponse { status, checks }))
}

async fn meta(State(state): State<ApiState>) -> Json<MetaResponse> {
    Json(MetaResponse {
        app_name: "Campus Agora",
        version: env!("CARGO_PKG_VERSION"),
        capabilities: state.capabilities,
    })
}

async fn not_found(headers: HeaderMap) -> impl IntoResponse {
    let request_id = request_id_from_headers(&headers);

    api_error_response(
        StatusCode::NOT_FOUND,
        "not_found",
        "Route not found".to_owned(),
        request_id,
        None,
    )
}

async fn request_id_middleware(mut request: Request<Body>, next: Next) -> Response {
    let request_id = request
        .headers()
        .get(REQUEST_ID_HEADER)
        .filter(|value| value.to_str().is_ok())
        .cloned()
        .unwrap_or_else(next_request_id);

    request.headers_mut().insert(
        HeaderName::from_static(REQUEST_ID_HEADER),
        request_id.clone(),
    );

    let mut response = next.run(request).await;
    response
        .headers_mut()
        .insert(HeaderName::from_static(REQUEST_ID_HEADER), request_id);

    response
}

async fn request_body_limit_middleware(
    request: Request<Body>,
    next: Next,
    limit: usize,
) -> Response {
    if request
        .headers()
        .get(header::CONTENT_LENGTH)
        .and_then(|value| value.to_str().ok()?.parse::<usize>().ok())
        .is_some_and(|content_length| content_length > limit)
    {
        return payload_too_large_response(&request, limit);
    }

    let request_id = request_id_from_headers(request.headers());
    let (parts, body) = request.into_parts();
    let body = match to_bytes(body, limit).await {
        Ok(bytes) => Body::from(bytes),
        Err(_) => {
            return api_error_response(
                StatusCode::PAYLOAD_TOO_LARGE,
                "request_body_too_large",
                "Request body is too large".to_owned(),
                request_id,
                Some(json!({ "limitBytes": limit })),
            )
            .into_response();
        }
    };

    next.run(Request::from_parts(parts, body)).await
}

fn payload_too_large_response(request: &Request<Body>, limit: usize) -> Response {
    api_error_response(
        StatusCode::PAYLOAD_TOO_LARGE,
        "request_body_too_large",
        "Request body is too large".to_owned(),
        request_id_from_headers(request.headers()),
        Some(json!({ "limitBytes": limit })),
    )
    .into_response()
}

impl ReadinessProbe {
    async fn check(&self) -> ReadinessChecks {
        let postgres = match self {
            Self::Ready => "ok",
            Self::Unavailable => "unavailable",
            Self::Postgres { database_url } => {
                if postgres_ready(database_url).await {
                    "ok"
                } else {
                    "unavailable"
                }
            }
        };

        ReadinessChecks { postgres }
    }
}

async fn postgres_ready(database_url: &str) -> bool {
    let pool = PgPoolOptions::new()
        .max_connections(1)
        .acquire_timeout(Duration::from_secs(2))
        .connect(database_url)
        .await;

    let Ok(pool) = pool else {
        return false;
    };

    sqlx::query("select 1").execute(&pool).await.is_ok()
}

fn bool_env(name: &str, default: bool) -> bool {
    std::env::var(name)
        .ok()
        .and_then(|value| value.parse::<bool>().ok())
        .unwrap_or(default)
}

fn usize_env(name: &str, default: usize) -> usize {
    match std::env::var(name) {
        Ok(value) if value.trim().is_empty() => default,
        Ok(value) => {
            let parsed = value
                .parse::<usize>()
                .unwrap_or_else(|_| panic!("{name} must be a positive integer"));
            assert!(parsed > 0, "{name} must be a positive integer");
            parsed
        }
        Err(_) => default,
    }
}

fn cors_allowed_origins_from_env() -> CorsAllowedOrigins {
    let Ok(value) = std::env::var("CORS_ALLOWED_ORIGINS") else {
        return CorsAllowedOrigins::List(origin_values(DEFAULT_CORS_ALLOWED_ORIGINS));
    };

    let origins = value
        .split(',')
        .map(str::trim)
        .filter(|origin| !origin.is_empty())
        .collect::<Vec<_>>();

    if origins.is_empty() {
        return CorsAllowedOrigins::List(origin_values(DEFAULT_CORS_ALLOWED_ORIGINS));
    }

    if origins.len() == 1 && origins[0] == "*" {
        return CorsAllowedOrigins::Any;
    }

    CorsAllowedOrigins::List(origin_values(origins))
}

fn origin_values<I, S>(origins: I) -> Vec<HeaderValue>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    origins
        .into_iter()
        .map(|origin| origin_value(origin.as_ref()))
        .collect()
}

fn origin_value(origin: &str) -> HeaderValue {
    HeaderValue::from_str(origin)
        .unwrap_or_else(|_| panic!("invalid CORS_ALLOWED_ORIGINS origin: {origin}"))
}

fn cors_layer(config: &ApiRuntimeConfig) -> CorsLayer {
    let request_id_header = HeaderName::from_static(REQUEST_ID_HEADER);
    let layer = CorsLayer::new()
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([
            header::ACCEPT,
            header::AUTHORIZATION,
            header::CONTENT_TYPE,
            request_id_header.clone(),
        ])
        .expose_headers([request_id_header]);

    match &config.cors_allowed_origins {
        CorsAllowedOrigins::Any => layer.allow_origin(AllowOrigin::any()),
        CorsAllowedOrigins::List(origins) => layer.allow_origin(origins.clone()),
    }
}

pub(crate) fn request_id_from_headers(headers: &HeaderMap) -> String {
    headers
        .get(REQUEST_ID_HEADER)
        .and_then(|value| value.to_str().ok())
        .map(str::to_owned)
        .unwrap_or_else(next_request_id_string)
}

pub(crate) fn api_error_response(
    status: StatusCode,
    code: &'static str,
    message: String,
    request_id: String,
    details: Option<Value>,
) -> impl IntoResponse {
    (
        status,
        Json(ApiErrorResponse {
            code,
            message,
            request_id,
            details,
        }),
    )
}

fn next_request_id() -> HeaderValue {
    let value = REQUEST_COUNTER.fetch_add(1, Ordering::Relaxed);
    HeaderValue::from_str(&format!("campus-agora-{value}"))
        .expect("generated request id must be a valid header value")
}

fn next_request_id_string() -> String {
    next_request_id()
        .to_str()
        .expect("generated request id must be visible ASCII")
        .to_owned()
}
