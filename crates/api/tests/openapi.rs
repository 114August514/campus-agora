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
}
