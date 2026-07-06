use axum::{routing::get, Json, Router};
use serde::Serialize;
use tower_http::trace::TraceLayer;

pub const API_BOUNDARY: &str = "campus-agora-api";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MetaResponse {
    pub app_name: &'static str,
    pub version: &'static str,
    pub capabilities: CapabilityFlags,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CapabilityFlags {
    pub auth_mock_enabled: bool,
    pub desktop_enabled: bool,
    pub ai_archive_enabled: bool,
    pub attachments_enabled: bool,
}

pub fn build_router() -> Router {
    Router::new()
        .route("/healthz", get(healthz))
        .route("/api/v1/meta", get(meta))
        .layer(TraceLayer::new_for_http())
}

async fn healthz() -> &'static str {
    "ok"
}

async fn meta() -> Json<MetaResponse> {
    Json(MetaResponse {
        app_name: "Campus Agora",
        version: env!("CARGO_PKG_VERSION"),
        capabilities: CapabilityFlags {
            auth_mock_enabled: false,
            desktop_enabled: true,
            ai_archive_enabled: false,
            attachments_enabled: false,
        },
    })
}
