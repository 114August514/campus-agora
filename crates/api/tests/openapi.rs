use serde_json::Value;

#[test]
fn openapi_document_contains_m0_1_endpoints_and_schemas() {
    let document = campus_agora_api::openapi_document();
    let json: Value = serde_json::to_value(document).unwrap();

    assert_eq!(json["openapi"], "3.1.0");
    assert_eq!(json["info"]["title"], "Campus Agora API");
    assert_eq!(json["paths"]["/healthz"]["get"]["operationId"], "getHealth");
    assert_eq!(
        json["paths"]["/readyz"]["get"]["operationId"],
        "getReadiness"
    );
    assert_eq!(
        json["paths"]["/api/v1/meta"]["get"]["operationId"],
        "getMeta"
    );
    assert!(json["components"]["schemas"]["MetaResponse"].is_object());
    assert!(json["components"]["schemas"]["CapabilityFlags"].is_object());
    assert!(json["components"]["schemas"]["ApiErrorResponse"].is_object());
    assert!(json["components"]["schemas"]["ApiErrorBody"].is_null());
    assert_eq!(
        json["components"]["schemas"]["ApiErrorResponse"]["required"],
        serde_json::json!(["code", "message", "requestId"])
    );
    assert!(json["components"]["schemas"]["ApiErrorResponse"]["properties"]["code"].is_object());
    assert!(json["components"]["schemas"]["ApiErrorResponse"]["properties"]["message"].is_object());
    assert!(
        json["components"]["schemas"]["ApiErrorResponse"]["properties"]["requestId"].is_object()
    );
    assert!(json["components"]["schemas"]["ApiErrorResponse"]["properties"]["details"].is_object());
}

#[test]
fn openapi_document_covers_m1_auth_endpoints_and_security() {
    let document = campus_agora_api::openapi_document();
    let json: Value = serde_json::to_value(document).unwrap();

    assert_eq!(
        json["components"]["securitySchemes"]["bearerAuth"]["type"],
        "http"
    );
    assert_eq!(
        json["components"]["securitySchemes"]["bearerAuth"]["scheme"],
        "bearer"
    );

    let mock_login = &json["paths"]["/api/v1/auth/mock-login"]["post"];
    assert_eq!(mock_login["operationId"], "mockLogin");
    assert_eq!(mock_login["security"], serde_json::json!([]));
    assert!(mock_login["responses"]["200"].is_object());
    assert!(mock_login["responses"]["403"].is_object());
    assert!(mock_login["responses"]["422"].is_object());

    let bearer_security = serde_json::json!([{ "bearerAuth": [] }]);

    let session = &json["paths"]["/api/v1/auth/session"]["get"];
    assert_eq!(session["operationId"], "getAuthSession");
    assert_eq!(session["security"], bearer_security);
    assert!(session["responses"]["200"].is_object());
    assert!(session["responses"]["401"].is_object());

    let logout = &json["paths"]["/api/v1/auth/logout"]["post"];
    assert_eq!(logout["operationId"], "logout");
    assert_eq!(logout["security"], bearer_security);
    assert!(logout["responses"]["204"].is_object());
    assert!(logout["responses"]["401"].is_object());

    let schemas = &json["components"]["schemas"];
    assert!(schemas["MockLoginRequest"].is_object());
    assert_eq!(
        schemas["MockLoginRequest"]["properties"]["persona"]["enum"],
        serde_json::json!(["student", "organization_member", "moderator", "admin"])
    );
    assert!(schemas["LoginResponse"].is_object());
    assert!(schemas["SessionResponse"].is_object());
    assert!(schemas["CurrentUser"].is_object());
    assert_eq!(
        schemas["CurrentUser"]["properties"]["systemRole"]["enum"],
        serde_json::json!(["student", "organization_member", "moderator", "admin"])
    );
    assert_eq!(
        schemas["CurrentUser"]["properties"]["organizations"]["type"],
        "array"
    );
    assert!(schemas["OrganizationMembership"].is_object());
}

#[test]
fn openapi_document_covers_m2_archive_endpoints() {
    let document = campus_agora_api::openapi_document();
    let json: Value = serde_json::to_value(document).unwrap();
    let bearer = serde_json::json!([{ "bearerAuth": [] }]);

    let optional_auth = serde_json::json!([{}, { "bearerAuth": [] }]);
    let collection = &json["paths"]["/api/v1/knowledge-entries"];
    assert_eq!(collection["get"]["operationId"], "listKnowledgeEntries");
    // Optional auth rather than public: a guest may read, but a generated
    // client must still send the token so an authenticated reader sees their
    // own drafts.
    assert_eq!(collection["get"]["security"], optional_auth);
    assert_eq!(collection["post"]["operationId"], "createKnowledgeEntry");
    assert_eq!(collection["post"]["security"], bearer);
    assert!(collection["post"]["responses"]["201"].is_object());

    let item = &json["paths"]["/api/v1/knowledge-entries/{id}"];
    assert_eq!(item["get"]["operationId"], "getKnowledgeEntry");
    assert!(item["get"]["responses"]["404"].is_object());
    assert_eq!(item["patch"]["operationId"], "updateKnowledgeEntry");
    assert_eq!(item["patch"]["security"], bearer);
    assert!(item["patch"]["responses"]["403"].is_object());

    let status = &json["paths"]["/api/v1/knowledge-entries/{id}/status"]["post"];
    assert_eq!(status["operationId"], "changeKnowledgeEntryStatus");
    // The state machine rejects illegal transitions, so 409 must be declared.
    assert!(status["responses"]["409"].is_object());

    assert_eq!(
        json["paths"]["/api/v1/knowledge-entries/{id}/revisions"]["get"]["operationId"],
        "listKnowledgeEntryRevisions"
    );
    let corrections = &json["paths"]["/api/v1/knowledge-entries/{id}/corrections"];
    assert_eq!(
        corrections["post"]["operationId"],
        "fileKnowledgeEntryCorrection"
    );
    assert_eq!(corrections["post"]["security"], bearer);
    // Reporter identities are restricted, so the listing requires a session.
    assert_eq!(corrections["get"]["security"], bearer);
    assert!(corrections["get"]["responses"]["403"].is_object());
    assert_eq!(
        json["paths"]["/api/v1/knowledge-entries/{id}"]["get"]["security"],
        optional_auth
    );
    assert_eq!(
        json["paths"]["/api/v1/knowledge-entries/{id}/revisions"]["get"]["security"],
        optional_auth
    );
    assert_eq!(
        json["paths"]["/api/v1/knowledge-entries/{id}/corrections/{correctionId}/resolve"]["post"]
            ["operationId"],
        "resolveKnowledgeEntryCorrection"
    );

    // Every archive operation declares 500, because any database failure
    // surfaces through the shared internal-error mapping.
    for (path, method) in [
        ("/api/v1/knowledge-entries", "get"),
        ("/api/v1/knowledge-entries", "post"),
        ("/api/v1/knowledge-entries/{id}", "get"),
        ("/api/v1/knowledge-entries/{id}", "patch"),
        ("/api/v1/knowledge-entries/{id}/status", "post"),
        ("/api/v1/knowledge-entries/{id}/revisions", "get"),
        ("/api/v1/knowledge-entries/{id}/corrections", "get"),
        ("/api/v1/knowledge-entries/{id}/corrections", "post"),
    ] {
        assert!(
            json["paths"][path][method]["responses"]["500"].is_object(),
            "{method} {path} must document 500"
        );
    }

    let schemas = &json["components"]["schemas"];
    for name in [
        "KnowledgeEntry",
        "PaginatedKnowledgeEntries",
        "CreateKnowledgeEntryRequest",
        "UpdateKnowledgeEntryRequest",
        "ChangeStatusRequest",
        "Revision",
        "RevisionCollection",
        "Correction",
        "CorrectionCollection",
        "FileCorrectionRequest",
        "ArchiveCategory",
        "ApplicableAudience",
        "SourceKind",
        "ModerationStatus",
    ] {
        assert!(schemas[name].is_object(), "{name} schema must exist");
    }

    // The full enum, including M3's `archived`, is asserted below.
    assert_eq!(
        schemas["PaginatedKnowledgeEntries"]["required"],
        serde_json::json!(["items", "page", "pageSize", "totalItems", "totalPages"])
    );
}

#[test]
fn openapi_document_covers_m3_discussion_endpoints() {
    let document = campus_agora_api::openapi_document();
    let json: Value = serde_json::to_value(document).unwrap();
    let bearer = serde_json::json!([{ "bearerAuth": [] }]);
    let optional_auth = serde_json::json!([{}, { "bearerAuth": [] }]);

    let collection = &json["paths"]["/api/v1/discussions"];
    assert_eq!(collection["get"]["operationId"], "listDiscussions");
    assert_eq!(collection["get"]["security"], optional_auth);
    assert_eq!(collection["post"]["operationId"], "createDiscussion");
    assert_eq!(collection["post"]["security"], bearer);
    assert!(collection["post"]["responses"]["201"].is_object());

    let item = &json["paths"]["/api/v1/discussions/{id}"]["get"];
    assert_eq!(item["operationId"], "getDiscussion");
    assert_eq!(item["security"], optional_auth);
    assert!(item["responses"]["404"].is_object());

    let status = &json["paths"]["/api/v1/discussions/{id}/status"]["post"];
    assert_eq!(status["operationId"], "changeDiscussionStatus");
    assert!(status["responses"]["409"].is_object());
    assert!(status["responses"]["403"].is_object());

    let replies = &json["paths"]["/api/v1/discussions/{id}/replies"];
    assert_eq!(replies["get"]["operationId"], "listDiscussionReplies");
    assert_eq!(replies["get"]["security"], optional_auth);
    assert_eq!(replies["post"]["operationId"], "replyToDiscussion");
    assert_eq!(replies["post"]["security"], bearer);
    assert!(replies["post"]["responses"]["201"].is_object());
    // An archived discussion is readable but closed.
    assert!(replies["post"]["responses"]["409"].is_object());

    let accept = &json["paths"]["/api/v1/discussions/{id}/accepted-answer"]["post"];
    assert_eq!(accept["operationId"], "acceptDiscussionAnswer");
    assert_eq!(accept["security"], bearer);
    assert!(accept["responses"]["403"].is_object());
    // A comment from another discussion resolves to 404, not 403.
    assert!(accept["responses"]["404"].is_object());

    let promote = &json["paths"]["/api/v1/discussions/{id}/promotions"]["post"];
    assert_eq!(promote["operationId"], "promoteDiscussion");
    assert_eq!(promote["security"], bearer);
    assert!(promote["responses"]["201"].is_object());
    // Only a publicly readable discussion can be promoted.
    assert!(promote["responses"]["409"].is_object());

    let derived = &json["paths"]["/api/v1/discussions/{id}/derived-entries"]["get"];
    assert_eq!(derived["operationId"], "listDiscussionDerivedEntries");
    assert_eq!(derived["security"], optional_auth);

    let sources = &json["paths"]["/api/v1/knowledge-entries/{id}/sources"]["get"];
    assert_eq!(sources["operationId"], "listKnowledgeEntrySources");
    assert_eq!(sources["security"], optional_auth);

    for (path, method) in [
        ("/api/v1/discussions", "get"),
        ("/api/v1/discussions", "post"),
        ("/api/v1/discussions/{id}", "get"),
        ("/api/v1/discussions/{id}/status", "post"),
        ("/api/v1/discussions/{id}/replies", "get"),
        ("/api/v1/discussions/{id}/replies", "post"),
        ("/api/v1/discussions/{id}/accepted-answer", "post"),
        ("/api/v1/discussions/{id}/promotions", "post"),
        ("/api/v1/discussions/{id}/derived-entries", "get"),
        ("/api/v1/knowledge-entries/{id}/sources", "get"),
    ] {
        assert!(
            json["paths"][path][method]["responses"]["500"].is_object(),
            "{method} {path} must document 500"
        );
    }

    let schemas = &json["components"]["schemas"];
    for name in [
        "Discussion",
        "PaginatedDiscussions",
        "CreateDiscussionRequest",
        "DiscussionReply",
        "DiscussionReplyCollection",
        "ReplyRequest",
        "AcceptAnswerRequest",
        "PromoteRequest",
        "Promotion",
        "ArchiveSource",
        "ArchiveSourceCollection",
        "DerivedEntry",
        "DerivedEntryCollection",
    ] {
        assert!(schemas[name].is_object(), "{name} schema must exist");
    }
}

/// M3 adds `archived`. The generated client's union has to grow with it, or
/// the frontend cannot represent a state the server will send.
#[test]
fn moderation_status_enum_includes_archived() {
    let document = campus_agora_api::openapi_document();
    let json: Value = serde_json::to_value(document).unwrap();

    assert_eq!(
        json["components"]["schemas"]["ModerationStatus"]["enum"],
        serde_json::json!(["draft", "published", "hidden", "rejected", "archived"])
    );
}
