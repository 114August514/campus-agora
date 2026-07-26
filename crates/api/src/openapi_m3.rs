//! The M3 half of the OpenAPI document.
//!
//! Split out because `serde_json::json!` hits its recursion limit when the
//! whole document is one literal. Keeping each milestone's paths in its own
//! function also means a reviewer can see what a milestone added to the
//! contract without diffing a two-thousand-line macro.

use serde_json::{json, Value};

/// Paths added by M3, merged into the document by `openapi_document`.
pub(crate) fn paths() -> Value {
    json!({
    "/api/v1/discussions": {
        "get": {
            "operationId": "listDiscussions",
            "summary": "List discussions visible to the caller",
            "security": [{}, { "bearerAuth": [] }],
            "parameters": [
                { "name": "q", "in": "query", "required": false, "schema": { "type": "string" } },
                { "name": "tag", "in": "query", "required": false, "schema": { "type": "string" } },
                { "name": "page", "in": "query", "required": false, "schema": { "type": "integer" } },
                { "name": "pageSize", "in": "query", "required": false, "schema": { "type": "integer" } }
            ],
            "responses": {
                "200": {
                    "description": "A page of discussions",
                    "content": {
                        "application/json": {
                            "schema": { "$ref": "#/components/schemas/PaginatedDiscussions" }
                        }
                    }
                },
                "400": {
                    "description": "Malformed body, query, or id",
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
                    "description": "page, pageSize, or q is out of range",
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
            "operationId": "createDiscussion",
            "summary": "Start a discussion as a private draft",
            "security": [{ "bearerAuth": [] }],
            "requestBody": {
                "required": true,
                "content": {
                    "application/json": {
                        "schema": { "$ref": "#/components/schemas/CreateDiscussionRequest" }
                    }
                }
            },
            "responses": {
                "201": {
                    "description": "The new draft discussion",
                    "content": {
                        "application/json": {
                            "schema": { "$ref": "#/components/schemas/Discussion" }
                        }
                    }
                },
                "400": {
                    "description": "Malformed body, query, or id",
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
                    "description": "Guests cannot create discussions",
                    "content": {
                        "application/json": {
                            "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                        }
                    }
                },
                "422": {
                    "description": "Title, body, or tags failed validation",
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
    "/api/v1/discussions/{id}": {
        "parameters": [{
                "name": "id",
                "in": "path",
                "required": true,
                "schema": { "type": "string" }
            }],
        "get": {
            "operationId": "getDiscussion",
            "summary": "Read one discussion",
            "security": [{}, { "bearerAuth": [] }],
            "responses": {
                "200": {
                    "description": "The discussion",
                    "content": {
                        "application/json": {
                            "schema": { "$ref": "#/components/schemas/Discussion" }
                        }
                    }
                },
                "400": {
                    "description": "Malformed body, query, or id",
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
                "404": {
                    "description": "Discussion missing or not visible to the caller",
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
    "/api/v1/discussions/{id}/status": {
        "parameters": [{
                "name": "id",
                "in": "path",
                "required": true,
                "schema": { "type": "string" }
            }],
        "post": {
            "operationId": "changeDiscussionStatus",
            "summary": "Publish, hide, archive, or restore a discussion",
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
                    "description": "The updated discussion",
                    "content": {
                        "application/json": {
                            "schema": { "$ref": "#/components/schemas/Discussion" }
                        }
                    }
                },
                "400": {
                    "description": "Malformed body, query, or id",
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
                    "description": "Not allowed to change this discussion's state",
                    "content": {
                        "application/json": {
                            "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                        }
                    }
                },
                "404": {
                    "description": "Discussion missing or not visible to the caller",
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
    "/api/v1/discussions/{id}/replies": {
        "parameters": [{
                "name": "id",
                "in": "path",
                "required": true,
                "schema": { "type": "string" }
            }],
        "get": {
            "operationId": "listDiscussionReplies",
            "summary": "List a discussion's replies, oldest first",
            "security": [{}, { "bearerAuth": [] }],
            "responses": {
                "200": {
                    "description": "The replies",
                    "content": {
                        "application/json": {
                            "schema": { "$ref": "#/components/schemas/DiscussionReplyCollection" }
                        }
                    }
                },
                "400": {
                    "description": "Malformed body, query, or id",
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
                "404": {
                    "description": "Discussion missing or not visible to the caller",
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
            "operationId": "replyToDiscussion",
            "summary": "Reply to an open discussion",
            "security": [{ "bearerAuth": [] }],
            "requestBody": {
                "required": true,
                "content": {
                    "application/json": {
                        "schema": { "$ref": "#/components/schemas/ReplyRequest" }
                    }
                }
            },
            "responses": {
                "201": {
                    "description": "The new reply",
                    "content": {
                        "application/json": {
                            "schema": { "$ref": "#/components/schemas/DiscussionReply" }
                        }
                    }
                },
                "400": {
                    "description": "Malformed body, query, or id",
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
                    "description": "Guests cannot reply",
                    "content": {
                        "application/json": {
                            "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                        }
                    }
                },
                "404": {
                    "description": "Discussion missing or not visible to the caller",
                    "content": {
                        "application/json": {
                            "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                        }
                    }
                },
                "409": {
                    "description": "A draft or archived discussion does not accept replies",
                    "content": {
                        "application/json": {
                            "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                        }
                    }
                },
                "422": {
                    "description": "Reply body failed validation",
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
    "/api/v1/discussions/{id}/accepted-answer": {
        "parameters": [{
                "name": "id",
                "in": "path",
                "required": true,
                "schema": { "type": "string" }
            }],
        "post": {
            "operationId": "acceptDiscussionAnswer",
            "summary": "Mark or clear the accepted answer",
            "security": [{ "bearerAuth": [] }],
            "requestBody": {
                "required": true,
                "content": {
                    "application/json": {
                        "schema": { "$ref": "#/components/schemas/AcceptAnswerRequest" }
                    }
                }
            },
            "responses": {
                "200": {
                    "description": "The updated discussion",
                    "content": {
                        "application/json": {
                            "schema": { "$ref": "#/components/schemas/Discussion" }
                        }
                    }
                },
                "400": {
                    "description": "Malformed body, query, or id",
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
                    "description": "Only the asker, a maintainer, or a moderator may accept",
                    "content": {
                        "application/json": {
                            "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                        }
                    }
                },
                "404": {
                    "description": "Discussion missing, or the reply does not belong to it",
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
    "/api/v1/discussions/{id}/promotions": {
        "parameters": [{
                "name": "id",
                "in": "path",
                "required": true,
                "schema": { "type": "string" }
            }],
        "post": {
            "operationId": "promoteDiscussion",
            "summary": "Sediment a discussion or one of its replies into a new archive draft",
            "security": [{ "bearerAuth": [] }],
            "requestBody": {
                "required": true,
                "content": {
                    "application/json": {
                        "schema": { "$ref": "#/components/schemas/PromoteRequest" }
                    }
                }
            },
            "responses": {
                "201": {
                    "description": "The new draft entry and its recorded source",
                    "content": {
                        "application/json": {
                            "schema": { "$ref": "#/components/schemas/Promotion" }
                        }
                    }
                },
                "400": {
                    "description": "Malformed body, query, or id",
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
                    "description": "Guests cannot promote",
                    "content": {
                        "application/json": {
                            "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                        }
                    }
                },
                "404": {
                    "description": "Discussion missing, or the reply does not belong to it",
                    "content": {
                        "application/json": {
                            "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                        }
                    }
                },
                "409": {
                    "description": "Only a publicly readable discussion can be promoted",
                    "content": {
                        "application/json": {
                            "schema": { "$ref": "#/components/schemas/ApiErrorResponse" }
                        }
                    }
                },
                "422": {
                    "description": "Overridden fields failed validation",
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
    "/api/v1/discussions/{id}/derived-entries": {
        "parameters": [{
                "name": "id",
                "in": "path",
                "required": true,
                "schema": { "type": "string" }
            }],
        "get": {
            "operationId": "listDiscussionDerivedEntries",
            "summary": "List the archive entries this discussion produced",
            "security": [{}, { "bearerAuth": [] }],
            "responses": {
                "200": {
                    "description": "The derived entries visible to the caller",
                    "content": {
                        "application/json": {
                            "schema": { "$ref": "#/components/schemas/DerivedEntryCollection" }
                        }
                    }
                },
                "400": {
                    "description": "Malformed body, query, or id",
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
                "404": {
                    "description": "Discussion missing or not visible to the caller",
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
    "/api/v1/knowledge-entries/{id}/sources": {
        "parameters": [{
                "name": "id",
                "in": "path",
                "required": true,
                "schema": { "type": "string" }
            }],
        "get": {
            "operationId": "listKnowledgeEntrySources",
            "summary": "List where this entry's content came from",
            "security": [{}, { "bearerAuth": [] }],
            "responses": {
                "200": {
                    "description": "The recorded sources visible to the caller",
                    "content": {
                        "application/json": {
                            "schema": { "$ref": "#/components/schemas/ArchiveSourceCollection" }
                        }
                    }
                },
                "400": {
                    "description": "Malformed body, query, or id",
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
    }
        })
}

/// Schemas added by M3.
pub(crate) fn schemas() -> Value {
    json!({
    "Discussion": {
        "type": "object",
        "required": [
            "id", "authorId", "title", "body", "tags", "moderationStatus",
            "replyCount", "createdAt", "updatedAt"
        ],
        "properties": {
            "id": { "type": "string" },
            "authorId": { "type": "string" },
            "title": { "type": "string" },
            "body": { "type": "string" },
            "tags": { "type": "array", "items": { "type": "string" } },
            "moderationStatus": { "$ref": "#/components/schemas/ModerationStatus" },
            "acceptedCommentId": { "type": ["string", "null"] },
            "replyCount": { "type": "integer" },
            "createdAt": { "type": "string" },
            "updatedAt": { "type": "string" }
        }
    },
    "PaginatedDiscussions": {
        "type": "object",
        "required": ["items", "page", "pageSize", "totalItems", "totalPages"],
        "properties": {
            "items": {
                "type": "array",
                "items": { "$ref": "#/components/schemas/Discussion" }
            },
            "page": { "type": "integer" },
            "pageSize": { "type": "integer" },
            "totalItems": { "type": "integer" },
            "totalPages": { "type": "integer" }
        }
    },
    "CreateDiscussionRequest": {
        "type": "object",
        "required": ["title", "body"],
        "properties": {
            "title": { "type": "string" },
            "body": { "type": "string" },
            "tags": { "type": "array", "items": { "type": "string" } }
        }
    },
    "DiscussionReply": {
        "type": "object",
        "required": ["id", "postId", "authorId", "body", "createdAt", "updatedAt"],
        "properties": {
            "id": { "type": "string" },
            "postId": { "type": "string" },
            "authorId": { "type": "string" },
            "body": { "type": "string" },
            "createdAt": { "type": "string" },
            "updatedAt": { "type": "string" }
        }
    },
    "DiscussionReplyCollection": {
        "type": "object",
        "required": ["items"],
        "properties": {
            "items": {
                "type": "array",
                "items": { "$ref": "#/components/schemas/DiscussionReply" }
            }
        }
    },
    "ReplyRequest": {
        "type": "object",
        "required": ["body"],
        "properties": { "body": { "type": "string" } }
    },
    "AcceptAnswerRequest": {
        "type": "object",
        "properties": { "commentId": { "type": ["string", "null"] } }
    },
    "PromoteRequest": {
        "type": "object",
        "properties": {
            "commentId": { "type": ["string", "null"] },
            "title": { "type": ["string", "null"] },
            "body": { "type": ["string", "null"] },
            "summary": { "type": ["string", "null"] },
            "tags": { "type": ["array", "null"], "items": { "type": "string" } },
            "category": { "type": ["string", "null"] },
            "applicableAudience": { "type": ["string", "null"] }
        }
    },
    "ArchiveSource": {
        "type": "object",
        "required": [
            "entryId", "sourcePostId", "sourceAuthorId", "sourceAuthorName",
            "sourceTitle", "createdAt"
        ],
        "properties": {
            "entryId": { "type": "string" },
            "sourcePostId": { "type": "string" },
            "sourceCommentId": { "type": ["string", "null"] },
            "sourceAuthorId": { "type": "string" },
            "sourceAuthorName": { "type": "string" },
            "sourceTitle": { "type": "string" },
            "createdAt": { "type": "string" }
        }
    },
    "ArchiveSourceCollection": {
        "type": "object",
        "required": ["items"],
        "properties": {
            "items": {
                "type": "array",
                "items": { "$ref": "#/components/schemas/ArchiveSource" }
            }
        }
    },
    "Promotion": {
        "type": "object",
        "required": ["entry", "source"],
        "properties": {
            "entry": { "$ref": "#/components/schemas/KnowledgeEntry" },
            "source": { "$ref": "#/components/schemas/ArchiveSource" }
        }
    },
    "DerivedEntry": {
        "type": "object",
        "required": ["entryId", "title", "moderationStatus", "createdAt"],
        "properties": {
            "entryId": { "type": "string" },
            "title": { "type": "string" },
            "moderationStatus": { "$ref": "#/components/schemas/ModerationStatus" },
            "createdAt": { "type": "string" }
        }
    },
    "DerivedEntryCollection": {
        "type": "object",
        "required": ["items"],
        "properties": {
            "items": {
                "type": "array",
                "items": { "$ref": "#/components/schemas/DerivedEntry" }
            }
        }
    },

        })
}
