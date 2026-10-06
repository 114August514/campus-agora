use axum::body::{to_bytes, Body};
use axum::http::{Request, StatusCode};
use campus_agora_api::{build_router_with_state, ApiState, ReadinessStatus};
use serde_json::Value;
use tower::ServiceExt;

#[tokio::test]
async fn invalid_discovery_query_returns_flat_error_and_request_id_without_searching() {
    let router = build_router_with_state(ApiState::for_tests(ReadinessStatus::Ready));
    let response = router
        .oneshot(
            Request::post("/api/v1/discoveries")
                .header("content-type", "application/json")
                .header("x-request-id", "discovery-validation")
                .body(Body::from(r#"{"query":"  "}"#))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
    let body: Value =
        serde_json::from_slice(&to_bytes(response.into_body(), 4096).await.unwrap()).unwrap();
    assert_eq!(body["code"], "validation_failed");
    assert_eq!(body["requestId"], "discovery-validation");
    assert!(body["sources"].is_null());
}

#[tokio::test]
async fn arbitrary_url_input_is_not_a_fetch_endpoint() {
    let router = build_router_with_state(ApiState::for_tests(ReadinessStatus::Ready));
    let response = router
        .oneshot(
            Request::post("/api/v1/discoveries")
                .header("content-type", "application/json")
                .body(Body::from(
                    r#"{"query":"research","url":"http://127.0.0.1/"}"#,
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
}

#[test]
fn live_discovery_contract_preserves_scope_failures_and_separate_evidence() {
    let contract = campus_agora_api::openapi_document();
    let operation = &contract["paths"]["/api/v1/discoveries"]["post"];
    assert_eq!(operation["security"], serde_json::json!([]));
    assert_eq!(operation["operationId"], "discoverSources");
    assert!(operation["responses"]["422"].is_object());
    assert!(operation["responses"]["429"].is_object());
    let schemas = &contract["components"]["schemas"];
    assert_eq!(
        schemas["DiscoveryResponse"]["properties"]["status"]["enum"],
        serde_json::json!(["complete", "partial", "failed"])
    );
    assert_eq!(
        schemas["DiscoveryResponse"]["properties"]["sources"]["items"]["$ref"],
        "#/components/schemas/DiscoverySource"
    );
    assert!(schemas["DiscoverySource"]["properties"]["searchSnippet"].is_object());
    assert!(schemas["DiscoverySource"]["properties"]["unknowns"].is_object());
}
