//! The M4 half of the OpenAPI document: reports, the moderation queue, and
//! AI-assisted drafting. Split per milestone for the same reason the M3
//! fragment is — `serde_json::json!` cannot expand the whole document, and a
//! milestone's contract diff stays readable.

use serde_json::{json, Value};

pub(crate) fn paths() -> Value {
    let err = json!({ "$ref": "#/components/schemas/ApiErrorResponse" });
    let error_response = |description: &str| {
        json!({
            "description": description,
            "content": { "application/json": { "schema": err } }
        })
    };
    let ok = |description: &str, schema: &str| {
        json!({
            "description": description,
            "content": { "application/json": { "schema": { "$ref": schema } } }
        })
    };
    let id_param = json!([{
        "name": "id",
        "in": "path",
        "required": true,
        "schema": { "type": "string" }
    }]);
    let bearer = json!([{ "bearerAuth": [] }]);

    json!({
        "/api/v1/reports": {
            "post": {
                "operationId": "createReport",
                "summary": "Report content of any kind",
                "security": bearer,
                "requestBody": {
                    "required": true,
                    "content": {
                        "application/json": {
                            "schema": { "$ref": "#/components/schemas/CreateReportRequest" }
                        }
                    }
                },
                "responses": {
                    "201": ok("The filed report", "#/components/schemas/ContentReport"),
                    "400": error_response("Malformed body, or an unknown category"),
                    "401": error_response("Authentication required"),
                    "403": error_response("Guests cannot report"),
                    "404": error_response("Content missing or not visible to the caller"),
                    "409": error_response("You already have an open report on this content"),
                    "422": error_response("The report message failed validation"),
                    "500": error_response("Unexpected server error")
                }
            }
        },
        "/api/v1/moderation/queue": {
            "get": {
                "operationId": "listModerationQueue",
                "summary": "Content awaiting a moderation decision, worst first",
                "security": bearer,
                "parameters": [
                    { "name": "page", "in": "query", "required": false, "schema": { "type": "integer" } },
                    { "name": "pageSize", "in": "query", "required": false, "schema": { "type": "integer" } }
                ],
                "responses": {
                    "200": ok("A page of queued content", "#/components/schemas/PaginatedModerationQueue"),
                    "400": error_response("Query parameters are invalid"),
                    "401": error_response("Authentication required"),
                    "403": error_response("Only moderators and admins may review reports"),
                    "422": error_response("page or pageSize is out of range"),
                    "500": error_response("Unexpected server error")
                }
            }
        },
        "/api/v1/moderation/content/{id}/reports": {
            "parameters": id_param,
            "get": {
                "operationId": "listContentReports",
                "summary": "The reports filed against one piece of content",
                "security": bearer,
                "responses": {
                    "200": ok("The reports", "#/components/schemas/ContentReportCollection"),
                    "400": error_response("Malformed id"),
                    "401": error_response("Authentication required"),
                    "403": error_response("Reporter identities are restricted to moderation"),
                    "404": error_response("Content missing or not visible to the caller"),
                    "500": error_response("Unexpected server error")
                }
            }
        },
        "/api/v1/moderation/content/{id}/reports/{reportId}/resolve": {
            "parameters": [
                { "name": "id", "in": "path", "required": true, "schema": { "type": "string" } },
                { "name": "reportId", "in": "path", "required": true, "schema": { "type": "string" } }
            ],
            "post": {
                "operationId": "resolveContentReport",
                "summary": "Record a finding on one report",
                "security": bearer,
                "requestBody": {
                    "required": true,
                    "content": {
                        "application/json": {
                            "schema": { "$ref": "#/components/schemas/ResolveReportRequest" }
                        }
                    }
                },
                "responses": {
                    "200": ok("The resolved report", "#/components/schemas/ContentReport"),
                    "400": error_response("Malformed body or id, or an unknown resolution"),
                    "401": error_response("Authentication required"),
                    "403": error_response("Only moderators and admins may review reports"),
                    "404": error_response("The report does not belong to this content"),
                    "500": error_response("Unexpected server error")
                }
            }
        },
        "/api/v1/discussions/{id}/ai-draft": {
            "parameters": id_param,
            "post": {
                "operationId": "generateAiDraft",
                "summary": "Compose an archive draft from a public discussion",
                "description": "Always produces a draft owned by the caller. There is no path by which the result can publish itself; publishing runs the ordinary human flow.",
                "security": bearer,
                "responses": {
                    "201": ok("The drafted entry and its recorded sources", "#/components/schemas/AiDraft"),
                    "400": error_response("Malformed id"),
                    "401": error_response("Authentication required"),
                    "403": error_response("AI drafting is disabled, or guests cannot draft"),
                    "404": error_response("Discussion missing or not visible to the caller"),
                    "409": error_response("Only a publicly readable discussion can be drafted from"),
                    "422": error_response("The discussion has no usable source text"),
                    "500": error_response("Unexpected server error")
                }
            }
        }
    })
}

pub(crate) fn schemas() -> Value {
    json!({
        "ReportCategory": {
            "type": "string",
            "enum": [
                "spam", "harassment", "privacy_violation",
                "misinformation", "illegal", "other"
            ]
        },
        "RiskLevel": {
            "type": "string",
            "enum": ["none", "low", "medium", "high"]
        },
        "ReportResolution": {
            "type": "string",
            "enum": ["upheld", "dismissed"]
        },
        "CreateReportRequest": {
            "type": "object",
            "required": ["postId", "category", "message"],
            "properties": {
                "postId": { "type": "string" },
                "category": { "$ref": "#/components/schemas/ReportCategory" },
                "message": { "type": "string" }
            }
        },
        "ResolveReportRequest": {
            "type": "object",
            "required": ["resolution"],
            "properties": {
                "resolution": { "$ref": "#/components/schemas/ReportResolution" }
            }
        },
        "ContentReport": {
            "type": "object",
            "required": ["id", "postId", "reporterId", "category", "message", "createdAt"],
            "properties": {
                "id": { "type": "string" },
                "postId": { "type": "string" },
                "reporterId": { "type": "string" },
                "category": { "$ref": "#/components/schemas/ReportCategory" },
                "message": { "type": "string" },
                "createdAt": { "type": "string" },
                "resolvedAt": { "type": ["string", "null"] },
                "resolvedBy": { "type": ["string", "null"] },
                "resolution": { "type": ["string", "null"] }
            }
        },
        "ContentReportCollection": {
            "type": "object",
            "required": ["items"],
            "properties": {
                "items": {
                    "type": "array",
                    "items": { "$ref": "#/components/schemas/ContentReport" }
                }
            }
        },
        "ModerationQueueItem": {
            "type": "object",
            "required": [
                "postId", "postKind", "title", "authorId",
                "moderationStatus", "risk", "openReportCount", "queuedAt"
            ],
            "properties": {
                "postId": { "type": "string" },
                "postKind": { "type": "string", "enum": ["knowledge", "discussion"] },
                "title": { "type": "string" },
                "authorId": { "type": "string" },
                "moderationStatus": { "$ref": "#/components/schemas/ModerationStatus" },
                "risk": { "$ref": "#/components/schemas/RiskLevel" },
                "openReportCount": { "type": "integer" },
                "queuedAt": { "type": "string" }
            }
        },
        "PaginatedModerationQueue": {
            "type": "object",
            "required": ["items", "page", "pageSize", "totalItems", "totalPages"],
            "properties": {
                "items": {
                    "type": "array",
                    "items": { "$ref": "#/components/schemas/ModerationQueueItem" }
                },
                "page": { "type": "integer" },
                "pageSize": { "type": "integer" },
                "totalItems": { "type": "integer" },
                "totalPages": { "type": "integer" }
            }
        },
        "AiDraft": {
            "type": "object",
            "required": ["entry", "sources"],
            "properties": {
                "entry": { "$ref": "#/components/schemas/KnowledgeEntry" },
                "sources": {
                    "type": "array",
                    "items": { "$ref": "#/components/schemas/ArchiveSource" }
                }
            }
        }
    })
}
