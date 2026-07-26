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
use campus_agora_application::archive::ArchiveService;
use campus_agora_application::auth::{AuthConfig, AuthService, MockCampusAuthProvider};
use campus_agora_application::memory::InMemoryAuthStore;
use campus_agora_application::ports::{
    ArchiveRepository, AuditEventRepository, CorrectionRepository, OrganizationRepository,
    SessionRepository, UserRepository,
};
use serde::Serialize;
use serde_json::{json, Value};
use sqlx::postgres::PgPoolOptions;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;

mod archive;
mod auth;

pub const API_BOUNDARY: &str = "campus-agora-api";
const DEFAULT_REQUEST_BODY_LIMIT_BYTES: usize = 1024 * 1024;
const DEFAULT_SESSION_TTL_SECONDS: i64 = 86400;
const MAX_SESSION_TTL_SECONDS: i64 = 30 * 86400;
const MAX_REQUEST_ID_CHARS: usize = 64;
const DEFAULT_CORS_ALLOWED_ORIGINS: &[&str] = &["http://127.0.0.1:5173", "http://localhost:5173"];
const REQUEST_ID_HEADER: &str = "x-request-id";
static REQUEST_COUNTER: AtomicU64 = AtomicU64::new(1);

#[derive(Clone)]
pub struct ApiState {
    readiness: ReadinessProbe,
    pub(crate) capabilities: CapabilityFlags,
    pub(crate) auth: Arc<AuthService>,
    pub(crate) archive: Arc<ArchiveService>,
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
        let session_ttl_seconds = session_ttl_seconds_from_env();

        let (readiness, auth, archive) = match std::env::var("DATABASE_URL") {
            Ok(database_url) if !database_url.trim().is_empty() => {
                let pool = campus_agora_db::connect_lazy(&database_url).unwrap_or_else(|_| {
                    panic!("DATABASE_URL is not a valid PostgreSQL connection string")
                });
                let store = Arc::new(campus_agora_db::PgAuthStore::new(pool));

                (
                    ReadinessProbe::Postgres { database_url },
                    auth_service_with_store(store.clone(), session_ttl_seconds),
                    archive_service_with_store(store),
                )
            }
            // The in-memory store holds real sessions in volatile per-process
            // state, so reaching it by accident (a missing secret, a typo in
            // the variable name) would serve auth from a store that loses every
            // session on restart and disagrees between replicas. Require an
            // explicit opt-in instead of falling back silently.
            _ if bool_env("AUTH_STORE_MEMORY", false) => {
                tracing::warn!(
                    "AUTH_STORE_MEMORY is set; auth runtime uses a non-persistent in-memory \
                     store. This is for local development and tests only."
                );

                let store = Arc::new(InMemoryAuthStore::default());

                (
                    ReadinessProbe::Unavailable,
                    auth_service_with_store(store.clone(), session_ttl_seconds),
                    archive_service_with_store(store),
                )
            }
            _ => panic!(
                "DATABASE_URL must be set. To run without a database, set \
                 AUTH_STORE_MEMORY=true for local development only."
            ),
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
            archive,
        }
    }

    pub fn for_tests(readiness: ReadinessStatus) -> Self {
        // One store backs both services so a session created through the auth
        // endpoints can act on entries created through the archive endpoints.
        let store = Arc::new(InMemoryAuthStore::default());

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
            auth: auth_service_with_store(store.clone(), DEFAULT_SESSION_TTL_SECONDS),
            archive: archive_service_with_store(store),
        }
    }

    pub fn with_auth_mock_enabled(mut self, enabled: bool) -> Self {
        self.capabilities.auth_mock_enabled = enabled;
        self
    }
}

fn auth_service_with_store<S>(store: Arc<S>, session_ttl_seconds: i64) -> Arc<AuthService>
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
            session_ttl: chrono::Duration::seconds(session_ttl_seconds),
        },
    ))
}

fn archive_service_with_store<S>(store: Arc<S>) -> Arc<ArchiveService>
where
    S: ArchiveRepository + CorrectionRepository + AuditEventRepository + 'static,
{
    Arc::new(ArchiveService::new(store.clone(), store.clone(), store))
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

#[derive(Clone)]
enum ReadinessProbe {
    Ready,
    Unavailable,
    Postgres { database_url: String },
}

/// Hand-written so the connection string, which carries the database
/// password, can never reach a log line or a panic message.
impl fmt::Debug for ReadinessProbe {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Ready => f.write_str("Ready"),
            Self::Unavailable => f.write_str("Unavailable"),
            Self::Postgres { .. } => f.write_str("Postgres { database_url: [redacted] }"),
        }
    }
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
        .route(
            "/api/v1/knowledge-entries",
            get(archive::list_entries).post(archive::create_entry),
        )
        .route(
            "/api/v1/knowledge-entries/:id",
            get(archive::get_entry).patch(archive::update_entry),
        )
        .route(
            "/api/v1/knowledge-entries/:id/status",
            post(archive::change_status),
        )
        .route(
            "/api/v1/knowledge-entries/:id/revisions",
            get(archive::list_revisions),
        )
        .route(
            "/api/v1/knowledge-entries/:id/corrections",
            get(archive::list_corrections).post(archive::file_correction),
        )
        .route(
            "/api/v1/knowledge-entries/:id/corrections/:correction_id/resolve",
            post(archive::resolve_correction),
        )
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
            }
            ,
            "/api/v1/knowledge-entries": {
                "get": {
                    "operationId": "listKnowledgeEntries",
                    "summary": "List visible knowledge entries",
                    "description": "Optional auth: guests see published entries, an authenticated caller also sees entries they authored or maintain, and moderators and admins see all. A token that is present but unusable is still 401.",
                    "security": [{}, { "bearerAuth": [] }],
                    "parameters": [
                        { "name": "q", "in": "query", "required": false, "schema": { "type": "string" }, "description": "Case-insensitive match over title and summary." },
                        { "name": "tag", "in": "query", "required": false, "schema": { "type": "string" } },
                        { "name": "category", "in": "query", "required": false, "schema": { "$ref": "#/components/schemas/ArchiveCategory" } },
                        { "name": "page", "in": "query", "required": false, "schema": { "type": "integer" }, "description": "1-based page number." },
                        { "name": "pageSize", "in": "query", "required": false, "schema": { "type": "integer" }, "description": "Defaults to 20, maximum 100." }
                    ],
                    "responses": {
                        "200": {
                            "description": "A page of knowledge entries",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/PaginatedKnowledgeEntries" }
                                }
                            }
                        },
                        "400": {
                            "description": "Malformed query parameters",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                                }
                            }
                        },
                        "401": {
                            "description": "Invalid or expired session token",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                                }
                            }
                        },
                        "422": {
                            "description": "Page or pageSize out of range",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                                }
                            }
                        },
                        "500": {
                            "description": "Unexpected server error",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                                }
                            }
                        }
                    }
                },
                "post": {
                    "operationId": "createKnowledgeEntry",
                    "summary": "Create a knowledge entry draft",
                    "security": [{ "bearerAuth": [] }],
                    "requestBody": {
                        "required": true,
                        "content": {
                            "application/json": {
                                "schema": { "$ref": "#/components/schemas/CreateKnowledgeEntryRequest" }
                            }
                        }
                    },
                    "responses": {
                        "201": {
                            "description": "The knowledge entry",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/KnowledgeEntry" }
                                }
                            }
                        },
                        "400": {
                            "description": "Malformed body or unknown enum value",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                                }
                            }
                        },
                        "401": {
                            "description": "Authentication required",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                                }
                            }
                        },
                        "422": {
                            "description": "Field validation failed",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                                }
                            }
                        },
                        "500": {
                            "description": "Unexpected server error",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                                }
                            }
                        }
                    }
                }
            },
            "/api/v1/knowledge-entries/{id}": {
                "parameters": [{
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": { "type": "string" },
                        "description": "Knowledge entry id (UUID)."
                    }],
                "get": {
                    "operationId": "getKnowledgeEntry",
                    "summary": "Read one knowledge entry",
                    "description": "Optional auth; the token widens what is visible. An entry the caller may not see returns 404 rather than 403, so a private draft does not leak its existence.",
                    "security": [{}, { "bearerAuth": [] }],
                    "responses": {
                        "200": {
                            "description": "The knowledge entry",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/KnowledgeEntry" }
                                }
                            }
                        },
                        "400": {
                            "description": "Entry id is not a UUID",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                                }
                            }
                        },
                        "401": {
                            "description": "Invalid or expired session token",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                                }
                            }
                        },
                        "404": {
                            "description": "Entry missing or not visible to the caller",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                                }
                            }
                        },
                        "500": {
                            "description": "Unexpected server error",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                                }
                            }
                        }
                    }
                },
                "patch": {
                    "operationId": "updateKnowledgeEntry",
                    "summary": "Update a knowledge entry",
                    "description": "Editing a published entry writes a new revision and bumps currentRevision. Editing a draft updates in place.",
                    "security": [{ "bearerAuth": [] }],
                    "requestBody": {
                        "required": true,
                        "content": {
                            "application/json": {
                                "schema": { "$ref": "#/components/schemas/UpdateKnowledgeEntryRequest" }
                            }
                        }
                    },
                    "responses": {
                        "200": {
                            "description": "The knowledge entry",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/KnowledgeEntry" }
                                }
                            }
                        },
                        "400": {
                            "description": "Malformed body, unknown enum value, or bad id",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                                }
                            }
                        },
                        "401": {
                            "description": "Authentication required",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                                }
                            }
                        },
                        "403": {
                            "description": "Not allowed to edit this entry",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                                }
                            }
                        },
                        "404": {
                            "description": "Entry missing or not visible to the caller",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                                }
                            }
                        },
                        "422": {
                            "description": "Field validation failed",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                                }
                            }
                        },
                        "500": {
                            "description": "Unexpected server error",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                                }
                            }
                        }
                    }
                }
            },
            "/api/v1/knowledge-entries/{id}/status": {
                "parameters": [{
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": { "type": "string" },
                        "description": "Knowledge entry id (UUID)."
                    }],
                "post": {
                    "operationId": "changeKnowledgeEntryStatus",
                    "summary": "Move a knowledge entry through the moderation state machine",
                    "security": [{ "bearerAuth": [] }],
                    "requestBody": {
                        "required": true,
                        "content": {
                            "application/json": {
                                "schema": { "$ref": "#/components/schemas/ChangeStatusRequest" }
                            }
                        }
                    },
                    "responses": {
                        "200": {
                            "description": "The knowledge entry",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/KnowledgeEntry" }
                                }
                            }
                        },
                        "400": {
                            "description": "Malformed body or bad id",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                                }
                            }
                        },
                        "401": {
                            "description": "Authentication required",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                                }
                            }
                        },
                        "403": {
                            "description": "Not allowed to change this entry's state",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                                }
                            }
                        },
                        "404": {
                            "description": "Entry missing or not visible to the caller",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                                }
                            }
                        },
                        "409": {
                            "description": "Transition is not allowed from the current status",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                                }
                            }
                        },
                        "500": {
                            "description": "Unexpected server error",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                                }
                            }
                        }
                    }
                }
            },
            "/api/v1/knowledge-entries/{id}/revisions": {
                "parameters": [{
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": { "type": "string" },
                        "description": "Knowledge entry id (UUID)."
                    }],
                "get": {
                    "operationId": "listKnowledgeEntryRevisions",
                    "summary": "Read the version history of an entry",
                    "description": "Optional auth; the token widens what is visible.",
                    "security": [{}, { "bearerAuth": [] }],
                    "responses": {
                        "200": {
                            "description": "Revisions ordered oldest first",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/RevisionCollection" }
                                }
                            }
                        },
                        "400": {
                            "description": "Entry id is not a UUID",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                                }
                            }
                        },
                        "401": {
                            "description": "Invalid or expired session token",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                                }
                            }
                        },
                        "404": {
                            "description": "Entry missing or not visible to the caller",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                                }
                            }
                        },
                        "500": {
                            "description": "Unexpected server error",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                                }
                            }
                        }
                    }
                }
            },
            "/api/v1/knowledge-entries/{id}/corrections": {
                "parameters": [{
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": { "type": "string" },
                        "description": "Knowledge entry id (UUID)."
                    }],
                "get": {
                    "operationId": "listKnowledgeEntryCorrections",
                    "summary": "List corrections filed against an entry",
                    "description": "Restricted to the entry author, its maintainers, moderators, and admins, because a correction names its reporter.",
                    "security": [{ "bearerAuth": [] }],
                    "responses": {
                        "200": {
                            "description": "Corrections ordered oldest first",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/CorrectionCollection" }
                                }
                            }
                        },
                        "400": {
                            "description": "Entry id is not a UUID",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                                }
                            }
                        },
                        "401": {
                            "description": "Authentication required",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                                }
                            }
                        },
                        "403": {
                            "description": "No stake in this entry",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                                }
                            }
                        },
                        "404": {
                            "description": "Entry missing or not visible to the caller",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                                }
                            }
                        },
                        "500": {
                            "description": "Unexpected server error",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                                }
                            }
                        }
                    }
                },
                "post": {
                    "operationId": "fileKnowledgeEntryCorrection",
                    "summary": "Report that an entry is out of date or wrong",
                    "description": "A correction is a report, not an edit; resolving it stays an explicit maintainer action.",
                    "security": [{ "bearerAuth": [] }],
                    "requestBody": {
                        "required": true,
                        "content": {
                            "application/json": {
                                "schema": { "$ref": "#/components/schemas/FileCorrectionRequest" }
                            }
                        }
                    },
                    "responses": {
                        "201": {
                            "description": "The filed correction",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/Correction" }
                                }
                            }
                        },
                        "400": {
                            "description": "Malformed body or bad id",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                                }
                            }
                        },
                        "401": {
                            "description": "Authentication required",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                                }
                            }
                        },
                        "403": {
                            "description": "Not allowed to file corrections",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                                }
                            }
                        },
                        "404": {
                            "description": "Entry missing or not visible to the caller",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                                }
                            }
                        },
                        "422": {
                            "description": "Message empty or too long",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                                }
                            }
                        },
                        "500": {
                            "description": "Unexpected server error",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                                }
                            }
                        }
                    }
                }
            },
            "/api/v1/knowledge-entries/{id}/corrections/{correctionId}/resolve": {
                "parameters": [
                    {
                        "name": "id",
                        "in": "path",
                        "required": true,
                        "schema": { "type": "string" },
                        "description": "Knowledge entry id (UUID)."
                    },
                    {
                        "name": "correctionId",
                        "in": "path",
                        "required": true,
                        "schema": { "type": "string" },
                        "description": "Correction id (UUID)."
                    }
                ],
                "post": {
                    "operationId": "resolveKnowledgeEntryCorrection",
                    "summary": "Close a correction",
                    "description": "Idempotent: the first resolution wins, so a repeat call returns the stored record.",
                    "security": [{ "bearerAuth": [] }],
                    "responses": {
                        "200": {
                            "description": "The resolved correction",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/Correction" }
                                }
                            }
                        },
                        "400": {
                            "description": "Path ids are not UUIDs",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                                }
                            }
                        },
                        "401": {
                            "description": "Authentication required",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                                }
                            }
                        },
                        "403": {
                            "description": "Not allowed to resolve corrections on this entry",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                                }
                            }
                        },
                        "404": {
                            "description": "Entry or correction missing",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                                }
                            }
                        },
                        "500": {
                            "description": "Unexpected server error",
                            "content": {
                                "application/json": {
                                    "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
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
                },
                "ArchiveCategory": {
                    "type": "string",
                    "enum": ["onboarding", "campus_life", "academics", "organizations", "procedures", "other"]
                },
                "ApplicableAudience": {
                    "type": "string",
                    "enum": ["all_students", "new_students", "undergraduate", "graduate", "organization_members"]
                },
                "SourceKind": {
                    "type": "string",
                    "enum": ["firsthand_experience", "official_announcement", "group_chat", "discussion", "unspecified"]
                },
                "ModerationStatus": {
                    "type": "string",
                    "enum": ["draft", "published", "hidden", "rejected"]
                },
                "KnowledgeEntry": {
                    "type": "object",
                    "required": [
                        "id", "authorId", "title", "body", "tags", "category",
                        "applicableAudience", "sourceKind", "moderationStatus",
                        "currentRevision", "createdAt", "updatedAt"
                    ],
                    "properties": {
                        "id": { "type": "string" },
                        "authorId": { "type": "string" },
                        "title": { "type": "string" },
                        "body": { "type": "string" },
                        "summary": { "type": "string" },
                        "tags": { "type": "array", "items": { "type": "string" } },
                        "category": { "$ref": "#/components/schemas/ArchiveCategory" },
                        "applicableAudience": { "$ref": "#/components/schemas/ApplicableAudience" },
                        "sourceKind": { "$ref": "#/components/schemas/SourceKind" },
                        "sourceReference": { "type": "string" },
                        "moderationStatus": { "$ref": "#/components/schemas/ModerationStatus" },
                        "currentRevision": { "type": "integer" },
                        "createdAt": { "type": "string" },
                        "updatedAt": { "type": "string" }
                    }
                },
                "PaginatedKnowledgeEntries": {
                    "type": "object",
                    "required": ["items", "page", "pageSize", "totalItems", "totalPages"],
                    "properties": {
                        "items": {
                            "type": "array",
                            "items": { "$ref": "#/components/schemas/KnowledgeEntry" }
                        },
                        "page": { "type": "integer" },
                        "pageSize": { "type": "integer" },
                        "totalItems": { "type": "integer" },
                        "totalPages": { "type": "integer" }
                    }
                },
                "CreateKnowledgeEntryRequest": {
                    "type": "object",
                    "required": ["title", "body", "category", "applicableAudience", "sourceKind"],
                    "properties": {
                        "title": { "type": "string" },
                        "body": { "type": "string" },
                        "summary": { "type": "string" },
                        "tags": { "type": "array", "items": { "type": "string" } },
                        "category": { "$ref": "#/components/schemas/ArchiveCategory" },
                        "applicableAudience": { "$ref": "#/components/schemas/ApplicableAudience" },
                        "sourceKind": { "$ref": "#/components/schemas/SourceKind" },
                        "sourceReference": { "type": "string" }
                    }
                },
                "UpdateKnowledgeEntryRequest": {
                    "type": "object",
                    "description": "Every field is optional; omitted fields keep their stored value.",
                    "properties": {
                        "title": { "type": "string" },
                        "body": { "type": "string" },
                        "summary": { "type": "string" },
                        "tags": { "type": "array", "items": { "type": "string" } },
                        "category": { "$ref": "#/components/schemas/ArchiveCategory" },
                        "applicableAudience": { "$ref": "#/components/schemas/ApplicableAudience" },
                        "sourceKind": { "$ref": "#/components/schemas/SourceKind" },
                        "sourceReference": { "type": "string" }
                    }
                },
                "ChangeStatusRequest": {
                    "type": "object",
                    "required": ["status"],
                    "properties": {
                        "status": { "$ref": "#/components/schemas/ModerationStatus" }
                    }
                },
                "Revision": {
                    "type": "object",
                    "required": ["id", "revision", "editorId", "title", "body", "tags", "createdAt"],
                    "properties": {
                        "id": { "type": "string" },
                        "revision": { "type": "integer" },
                        "editorId": { "type": "string" },
                        "title": { "type": "string" },
                        "body": { "type": "string" },
                        "summary": { "type": "string" },
                        "tags": { "type": "array", "items": { "type": "string" } },
                        "createdAt": { "type": "string" }
                    }
                },
                "RevisionCollection": {
                    "type": "object",
                    "required": ["items"],
                    "properties": {
                        "items": {
                            "type": "array",
                            "items": { "$ref": "#/components/schemas/Revision" }
                        }
                    }
                },
                "Correction": {
                    "type": "object",
                    "required": ["id", "postId", "reporterId", "message", "createdAt"],
                    "properties": {
                        "id": { "type": "string" },
                        "postId": { "type": "string" },
                        "reporterId": { "type": "string" },
                        "message": { "type": "string" },
                        "createdAt": { "type": "string" },
                        "resolvedAt": { "type": "string" },
                        "resolvedBy": { "type": "string" }
                    }
                },
                "CorrectionCollection": {
                    "type": "object",
                    "required": ["items"],
                    "properties": {
                        "items": {
                            "type": "array",
                            "items": { "$ref": "#/components/schemas/Correction" }
                        }
                    }
                },
                "FileCorrectionRequest": {
                    "type": "object",
                    "required": ["message"],
                    "properties": {
                        "message": { "type": "string" }
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
        .and_then(|value| value.to_str().ok())
        .and_then(sanitized_request_id)
        .and_then(|value| HeaderValue::from_str(&value).ok())
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

/// Reads a boolean setting. A value that is present but unrecognized is a
/// configuration error, not a reason to fall back: `AUTH_MOCK_ENABLED` is the
/// kill switch for mock login, so `AUTH_MOCK_ENABLED=0` silently meaning
/// "enabled" would leave an unauthenticated admin login exposed.
fn bool_env(name: &str, default: bool) -> bool {
    match std::env::var(name) {
        Ok(value) if value.trim().is_empty() => default,
        Ok(value) => parse_bool_setting(&value).unwrap_or_else(|| {
            panic!("{name} must be one of true/false/1/0/yes/no/on/off, got: {value}")
        }),
        Err(_) => default,
    }
}

fn parse_bool_setting(value: &str) -> Option<bool> {
    match value.trim().to_ascii_lowercase().as_str() {
        "true" | "1" | "yes" | "on" => Some(true),
        "false" | "0" | "no" | "off" => Some(false),
        _ => None,
    }
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

fn session_ttl_seconds_from_env() -> i64 {
    match std::env::var("SESSION_TTL_SECONDS") {
        Ok(value) if value.trim().is_empty() => DEFAULT_SESSION_TTL_SECONDS,
        Ok(value) => parse_session_ttl_seconds(&value).unwrap_or_else(|| {
            panic!(
                "SESSION_TTL_SECONDS must be an integer between 1 and \
                 {MAX_SESSION_TTL_SECONDS}, got: {value}"
            )
        }),
        Err(_) => DEFAULT_SESSION_TTL_SECONDS,
    }
}

/// Bounded so a fat-fingered extra zero cannot mint multi-year sessions, and
/// so an oversized value cannot wrap negative and expire every session at
/// birth.
fn parse_session_ttl_seconds(value: &str) -> Option<i64> {
    let parsed = value.trim().parse::<i64>().ok()?;

    (1..=MAX_SESSION_TTL_SECONDS)
        .contains(&parsed)
        .then_some(parsed)
}

/// Accepts an inbound `X-Request-Id` only when it is short and printable.
/// The value is persisted into audit metadata, so an unbounded client-supplied
/// string would let callers pad or forge the audit trail.
fn sanitized_request_id(value: &str) -> Option<String> {
    let is_allowed = |c: char| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.' | ':');

    (!value.is_empty() && value.len() <= MAX_REQUEST_ID_CHARS && value.chars().all(is_allowed))
        .then(|| value.to_owned())
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
        .and_then(sanitized_request_id)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn boolean_settings_accept_common_spellings() {
        for value in ["true", "TRUE", "True", " true ", "1", "yes", "on"] {
            assert_eq!(parse_bool_setting(value), Some(true), "value: {value}");
        }

        for value in ["false", "FALSE", "False", " false ", "0", "no", "off"] {
            assert_eq!(parse_bool_setting(value), Some(false), "value: {value}");
        }
    }

    #[test]
    fn boolean_settings_reject_anything_else() {
        // A rejected value must never silently fall back to the default:
        // AUTH_MOCK_ENABLED is a security kill switch, so an operator typo
        // has to fail loudly instead of leaving mock login enabled.
        for value in ["maybe", "2", "-1", "enabled", "null", "t", "f"] {
            assert_eq!(parse_bool_setting(value), None, "value: {value}");
        }
    }

    #[test]
    fn request_ids_from_clients_must_be_short_and_printable() {
        assert_eq!(
            sanitized_request_id("req_abc-123.4"),
            Some("req_abc-123.4".to_owned())
        );

        assert_eq!(sanitized_request_id(""), None);
        assert_eq!(sanitized_request_id("has space"), None);
        assert_eq!(sanitized_request_id("emoji-🎓"), None);
        assert_eq!(sanitized_request_id(&"a".repeat(65)), None);
        assert_eq!(sanitized_request_id(&"a".repeat(64)), Some("a".repeat(64)));
    }

    #[test]
    fn session_ttl_is_bounded() {
        assert_eq!(parse_session_ttl_seconds("3600"), Some(3600));
        assert_eq!(parse_session_ttl_seconds("1"), Some(1));
        assert_eq!(
            parse_session_ttl_seconds(&MAX_SESSION_TTL_SECONDS.to_string()),
            Some(MAX_SESSION_TTL_SECONDS)
        );

        assert_eq!(parse_session_ttl_seconds("0"), None);
        assert_eq!(
            parse_session_ttl_seconds(&(MAX_SESSION_TTL_SECONDS + 1).to_string()),
            None
        );
        // Would wrap negative through `as i64` and expire every session at birth.
        assert_eq!(parse_session_ttl_seconds("9223372036854775808"), None);
        assert_eq!(parse_session_ttl_seconds("abc"), None);
    }

    #[test]
    fn api_state_debug_does_not_expose_the_database_password() {
        let probe = ReadinessProbe::Postgres {
            database_url: "postgres://user:sup3rs3cret@db.internal:5432/campus".to_owned(),
        };

        let rendered = format!("{probe:?}");
        assert!(!rendered.contains("sup3rs3cret"), "rendered: {rendered}");
        assert!(!rendered.contains("db.internal"), "rendered: {rendered}");
    }
}
