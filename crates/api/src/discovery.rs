use axum::extract::rejection::JsonRejection;
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use campus_agora_application::discovery::{
    self, DiscoveredSource, DiscoveryResult, DiscoveryWarning as Warning,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tokio::sync::Semaphore;

use crate::{api_error_response, request_id_from_headers};

static DISCOVERY_PERMITS: Semaphore = Semaphore::const_new(2);

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DiscoveryRequest {
    pub query: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveryResponse {
    pub query: String,
    pub provider: &'static str,
    pub scope: &'static str,
    pub status: &'static str,
    pub collected_at: String,
    pub sources: Vec<DiscoverySource>,
    pub warnings: Vec<DiscoveryWarning>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoverySource {
    pub url: String,
    pub title: String,
    pub institution: String,
    pub content: String,
    pub search_snippet: String,
    pub relevance_evidence: Vec<String>,
    pub collected_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub published_at: Option<String>,
    pub unknowns: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveryWarning {
    pub code: &'static str,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
}

pub(crate) async fn discover(
    headers: HeaderMap,
    input: Result<Json<DiscoveryRequest>, JsonRejection>,
) -> Response {
    let request_id = request_id_from_headers(&headers);
    let Ok(Json(input)) = input else {
        return api_error_response(
            StatusCode::UNPROCESSABLE_ENTITY,
            "validation_failed",
            "请求需要JSON对象和字符串query。",
            request_id,
            None,
        )
        .into_response();
    };
    let query = match discovery::validate_query(&input.query) {
        Ok(query) => query,
        Err(message) => {
            return api_error_response(
                StatusCode::UNPROCESSABLE_ENTITY,
                "validation_failed",
                message,
                request_id,
                None,
            )
            .into_response()
        }
    };
    let Ok(_permit) = DISCOVERY_PERMITS.try_acquire() else {
        return api_error_response(
            StatusCode::TOO_MANY_REQUESTS,
            "discovery_busy",
            "当前有其他检索正在进行，请稍后重试。",
            request_id,
            None,
        )
        .into_response();
    };
    Json(DiscoveryResponse::from(discovery::discover(query).await)).into_response()
}

impl From<DiscoveryResult> for DiscoveryResponse {
    fn from(result: DiscoveryResult) -> Self {
        Self {
            query: result.query,
            provider: result.provider,
            scope: result.scope,
            status: result.status,
            collected_at: result.collected_at,
            sources: result
                .sources
                .into_iter()
                .map(DiscoverySource::from)
                .collect(),
            warnings: result
                .warnings
                .into_iter()
                .map(DiscoveryWarning::from)
                .collect(),
        }
    }
}

impl From<DiscoveredSource> for DiscoverySource {
    fn from(source: DiscoveredSource) -> Self {
        Self {
            url: source.url,
            title: source.title,
            institution: source.institution,
            content: source.content,
            search_snippet: source.search_snippet,
            relevance_evidence: source.relevance_evidence,
            collected_at: source.collected_at,
            published_at: source.published_at,
            unknowns: source.unknowns,
        }
    }
}

impl From<Warning> for DiscoveryWarning {
    fn from(warning: Warning) -> Self {
        Self {
            code: warning.code,
            message: warning.message,
            url: warning.url,
        }
    }
}

pub(crate) fn extend_contract(document: &mut Value) {
    document["paths"]["/api/v1/discoveries"] = json!({
        "post": {
            "operationId": "discoverSources",
            "summary": "Live public-index search and bounded academic HTML reading",
            "description": discovery::DISCOVERY_SCOPE,
            "security": [],
            "requestBody": { "required": true, "content": { "application/json": { "schema": { "$ref": "#/components/schemas/DiscoveryRequest" } } } },
            "responses": {
                "200": { "description": "Live attempt, including explicit partial or failed results; never cached demo replacements", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/DiscoveryResponse" } } } },
                "422": { "description": "Invalid public query", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/ApiErrorResponse" } } } },
                "429": { "description": "Two discovery requests already running", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/ApiErrorResponse" } } } },
                "413": { "description": "Request body exceeds configured limit", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/ApiErrorResponse" } } } }
            }
        }
    });
    let schemas = &mut document["components"]["schemas"];
    schemas["DiscoveryRequest"] = json!({ "type": "object", "additionalProperties": false, "required": ["query"], "properties": { "query": { "type": "string", "minLength": 1, "maxLength": 200, "description": "Public interest terms; sent to DuckDuckGo. No private notes or identities." } } });
    schemas["DiscoveryResponse"] = json!({ "type": "object", "required": ["query", "provider", "scope", "status", "collectedAt", "sources", "warnings"], "properties": {
        "query": { "type": "string" }, "provider": { "type": "string", "enum": ["duckduckgo_html", "official_directory"] }, "scope": { "type": "string", "description": "Actual provider and bounded reading scope for this attempt." }, "status": { "type": "string", "enum": ["complete", "partial", "failed"] }, "collectedAt": { "type": "string", "format": "date-time" }, "sources": { "type": "array", "items": { "$ref": "#/components/schemas/DiscoverySource" } }, "warnings": { "type": "array", "items": { "$ref": "#/components/schemas/DiscoveryWarning" } }
    } });
    schemas["DiscoverySource"] = json!({ "type": "object", "required": ["url", "title", "institution", "content", "searchSnippet", "relevanceEvidence", "collectedAt", "unknowns"], "properties": {
        "url": { "type": "string", "format": "uri" }, "title": { "type": "string" }, "institution": { "type": "string", "description": "Source hostname, not a verified institutional affiliation." }, "content": { "type": "string", "description": "Fetched HTML text; maximum 16000 characters, not a generated summary." }, "searchSnippet": { "type": "string", "description": "Search-index snippet, kept separate from fetched body." }, "relevanceEvidence": { "type": "array", "items": { "type": "string" }, "description": "Up to three body passages matching query terms; no model judgment." }, "collectedAt": { "type": "string", "format": "date-time" }, "publishedAt": { "type": "string", "description": "Unverified original date metadata when present, never inferred from collection time." }, "unknowns": { "type": "array", "items": { "type": "string" } }
    } });
    schemas["DiscoveryWarning"] = json!({ "type": "object", "required": ["code", "message"], "properties": { "code": { "type": "string" }, "message": { "type": "string" }, "url": { "type": "string", "format": "uri" } } });
}
