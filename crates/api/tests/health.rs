use axum::body::Body;
use axum::http::{header, header::HeaderName, HeaderValue, Method, Request, StatusCode};
use campus_agora_api::{
    build_router_with_state, build_router_with_state_and_config, ApiRuntimeConfig, ApiState,
    ReadinessStatus,
};
use serde_json::Value;
use tower::ServiceExt;

const REQUEST_ID: &str = "x-request-id";

#[tokio::test]
async fn health_endpoint_returns_ok() {
    let app = campus_agora_api::build_router();

    let response = app
        .oneshot(Request::get("/healthz").body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn ready_endpoint_returns_ok_when_dependencies_are_ready() {
    let app = build_router_with_state(ApiState::for_tests(ReadinessStatus::Ready));

    let response = app
        .oneshot(Request::get("/readyz").body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let json = response_json(response).await;
    assert_eq!(json["status"], "ready");
    assert_eq!(json["checks"]["postgres"], "ok");
}

#[tokio::test]
async fn ready_endpoint_returns_unavailable_when_dependencies_are_unready() {
    let app = build_router_with_state(ApiState::for_tests(ReadinessStatus::Unavailable));

    let response = app
        .oneshot(Request::get("/readyz").body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE);

    let json = response_json(response).await;
    assert_eq!(json["status"], "unready");
    assert_eq!(json["checks"]["postgres"], "unavailable");
}

#[tokio::test]
async fn meta_endpoint_returns_app_identity() {
    let app = build_router_with_state(ApiState::for_tests(ReadinessStatus::Ready));

    let response = app
        .oneshot(Request::get("/api/v1/meta").body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), 1024 * 16)
        .await
        .unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["appName"], "Campus Agora");
    assert_eq!(json["version"], env!("CARGO_PKG_VERSION"));
    assert_eq!(json["capabilities"]["authMockEnabled"], true);
    assert_eq!(json["capabilities"]["desktopEnabled"], true);
    assert_eq!(json["capabilities"]["aiArchiveEnabled"], false);
    assert_eq!(json["capabilities"]["attachmentsEnabled"], false);
}

#[tokio::test]
async fn missing_route_returns_json_error_with_request_id() {
    let app = build_router_with_state(ApiState::for_tests(ReadinessStatus::Ready));
    let request_id = HeaderValue::from_static("test-request-id");

    let response = app
        .oneshot(
            Request::get("/missing")
                .header(REQUEST_ID, request_id.clone())
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    assert_eq!(
        response.headers().get(HeaderName::from_static(REQUEST_ID)),
        Some(&request_id)
    );

    let json = response_json(response).await;
    assert_eq!(json["code"], "not_found");
    assert_eq!(json["message"], "Route not found");
    assert_eq!(json["requestId"], "test-request-id");
    assert!(json.get("details").is_none());
}

#[tokio::test]
async fn cors_preflight_allows_configured_origin() {
    let app = build_router_with_state_and_config(
        ApiState::for_tests(ReadinessStatus::Ready),
        ApiRuntimeConfig::for_tests().with_cors_allowed_origins(["https://web.example"]),
    );
    let allowed_origin = HeaderValue::from_static("https://web.example");

    let response = app
        .oneshot(
            Request::builder()
                .method(Method::OPTIONS)
                .uri("/api/v1/meta")
                .header(header::ORIGIN, allowed_origin.clone())
                .header(header::ACCESS_CONTROL_REQUEST_METHOD, "GET")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response.headers().get(header::ACCESS_CONTROL_ALLOW_ORIGIN),
        Some(&allowed_origin)
    );
    assert!(response
        .headers()
        .get(HeaderName::from_static(REQUEST_ID))
        .is_some());
}

#[tokio::test]
async fn request_body_limit_rejects_oversized_requests() {
    let app = build_router_with_state_and_config(
        ApiState::for_tests(ReadinessStatus::Ready),
        ApiRuntimeConfig::for_tests().with_request_body_limit_bytes(4),
    );

    let response = app
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/v1/meta")
                .header(REQUEST_ID, "oversized-request")
                .header(header::CONTENT_LENGTH, "5")
                .body(Body::from("12345"))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
    assert_eq!(
        response.headers().get(HeaderName::from_static(REQUEST_ID)),
        Some(&HeaderValue::from_static("oversized-request"))
    );
    assert!(response
        .headers()
        .get(header::CONTENT_TYPE)
        .is_some_and(|value| value
            .to_str()
            .unwrap_or_default()
            .starts_with("application/json")));

    let json = response_json(response).await;
    assert_eq!(json["code"], "request_body_too_large");
    assert_eq!(json["message"], "Request body is too large");
    assert_eq!(json["requestId"], "oversized-request");
    assert_eq!(json["details"]["limitBytes"], 4);
}

async fn response_json(response: axum::response::Response) -> Value {
    let body = axum::body::to_bytes(response.into_body(), 1024 * 16)
        .await
        .unwrap();

    serde_json::from_slice(&body).unwrap()
}
