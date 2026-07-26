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
