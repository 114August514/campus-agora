use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use axum::body::Body;
use axum::extract::State;
use axum::http::{header::HeaderName, HeaderMap, HeaderValue, Request, StatusCode};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::{routing::get, Json, Router};
use serde::Serialize;
use serde_json::{json, Value};
use sqlx::postgres::PgPoolOptions;
use tower_http::trace::TraceLayer;

pub const API_BOUNDARY: &str = "campus-agora-api";
const REQUEST_ID_HEADER: &str = "x-request-id";
static REQUEST_COUNTER: AtomicU64 = AtomicU64::new(1);

#[derive(Clone, Debug)]
pub struct ApiState {
    readiness: ReadinessProbe,
    capabilities: CapabilityFlags,
}

impl ApiState {
    pub fn from_env() -> Self {
        let readiness = match std::env::var("DATABASE_URL") {
            Ok(database_url) if !database_url.trim().is_empty() => {
                ReadinessProbe::Postgres { database_url }
            }
            _ => ReadinessProbe::Unavailable,
        };

        Self {
            readiness,
            capabilities: CapabilityFlags {
                auth_mock_enabled: bool_env("AUTH_MOCK_ENABLED", true),
                desktop_enabled: bool_env("DESKTOP_ENABLED", true),
                ai_archive_enabled: bool_env("AI_ARCHIVE_ENABLED", false),
                attachments_enabled: bool_env("ATTACHMENTS_ENABLED", false),
            },
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
        }
    }
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
    pub error: ApiErrorBody,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiErrorBody {
    pub code: &'static str,
    pub message: &'static str,
    pub request_id: Option<String>,
}

pub fn build_router() -> Router {
    build_router_with_state(ApiState::from_env())
}

pub fn build_router_with_state(state: ApiState) -> Router {
    Router::new()
        .route("/healthz", get(healthz))
        .route("/readyz", get(readyz))
        .route("/api/v1/meta", get(meta))
        .fallback(not_found)
        .with_state(state)
        .layer(middleware::from_fn(request_id_middleware))
        .layer(TraceLayer::new_for_http())
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
            }
        },
        "components": {
            "schemas": {
                "ApiErrorBody": {
                    "type": "object",
                    "required": ["code", "message"],
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
                        }
                    }
                },
                "ApiErrorResponse": {
                    "type": "object",
                    "required": ["error"],
                    "properties": {
                        "error": {
                            "$ref": "#/components/schemas/ApiErrorBody"
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
    let request_id = headers
        .get(REQUEST_ID_HEADER)
        .and_then(|value| value.to_str().ok())
        .map(str::to_owned);

    (
        StatusCode::NOT_FOUND,
        Json(ApiErrorResponse {
            error: ApiErrorBody {
                code: "not_found",
                message: "Route not found",
                request_id,
            },
        }),
    )
}

async fn request_id_middleware(mut request: Request<Body>, next: Next) -> Response {
    let request_id = request
        .headers()
        .get(REQUEST_ID_HEADER)
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

fn next_request_id() -> HeaderValue {
    let value = REQUEST_COUNTER.fetch_add(1, Ordering::Relaxed);
    HeaderValue::from_str(&format!("campus-agora-{value}"))
        .expect("generated request id must be a valid header value")
}
