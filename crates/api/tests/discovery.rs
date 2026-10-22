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
async fn separate_url_field_is_rejected() {
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

#[tokio::test]
async fn unsupported_or_malformed_direct_urls_are_rejected_before_discovery() {
    let router = build_router_with_state(ApiState::for_tests(ReadinessStatus::Ready));
    for query in [
        "http://127.0.0.1/",
        "http://[::1]/",
        "https://cs.ustc.edu.cn.evil.example/",
        "https://nested.songzhuoran.github.io/",
        "https://user:password@cs.ustc.edu.cn/",
        "https://cs.ustc.edu.cn:9000/",
        "https:cs.ustc.edu.cn",
        "https:///cs.ustc.edu.cn",
        "http//cs.ustc.edu.cn",
        "https://cs.ustc.edu.cn\\@evil.example",
        "https://cs.ustc.edu.cn/ research",
        "//cs.ustc.edu.cn/",
        "www.cs.hku.hk/",
        "ftp://cs.ustc.edu.cn/",
        "file:/etc/passwd",
    ] {
        let response = router
            .clone()
            .oneshot(
                Request::post("/api/v1/discoveries")
                    .header("content-type", "application/json")
                    .header("x-request-id", "direct-url-validation")
                    .body(Body::from(
                        serde_json::json!({ "query": query }).to_string(),
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(
            response.status(),
            StatusCode::UNPROCESSABLE_ENTITY,
            "accepted {query}"
        );
        let body: Value =
            serde_json::from_slice(&to_bytes(response.into_body(), 4096).await.unwrap()).unwrap();
        assert_eq!(body["code"], "validation_failed");
        assert_eq!(body["requestId"], "direct-url-validation");
        assert!(body["sources"].is_null());
        assert!(body["provider"].is_null());
    }
}

#[test]
fn live_discovery_contract_preserves_scope_failures_and_separate_evidence() {
    let contract = campus_agora_api::openapi_document();
    let operation = &contract["paths"]["/api/v1/discoveries"]["post"];
    assert_eq!(operation["security"], serde_json::json!([]));
    assert_eq!(operation["operationId"], "discoverSources");
    assert!(operation["responses"]["422"].is_object());
    assert!(operation["responses"]["429"].is_object());
    assert!(
        contract["paths"]["/api/v1/discoveries"]["post"]["responses"]["200"]["content"]
            ["application/x-ndjson"]
            .is_object()
    );
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
    assert_eq!(
        schemas["DiscoveryResponse"]["properties"]["provider"]["enum"],
        serde_json::json!(["duckduckgo_html", "official_directory", "direct_url"])
    );
    let query_description = schemas["DiscoveryRequest"]["properties"]["query"]["description"]
        .as_str()
        .unwrap();
    assert!(query_description.contains("read directly without search or directory fallback"));
    assert_eq!(schemas["DiscoveryRequest"]["additionalProperties"], false);
    for property in ["searchSnippet", "relevanceEvidence"] {
        assert!(
            schemas["DiscoverySource"]["properties"][property]["description"]
                .as_str()
                .unwrap()
                .contains("direct URL reading")
        );
    }
}
