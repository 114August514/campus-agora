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
