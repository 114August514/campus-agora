use axum::body::Body;
use axum::http::{header::HeaderName, HeaderValue, Request, StatusCode};
use campus_agora_api::{build_router_with_state, ApiState, ReadinessStatus};
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
    assert_eq!(json["error"]["code"], "not_found");
    assert_eq!(json["error"]["message"], "Route not found");
    assert_eq!(json["error"]["requestId"], "test-request-id");
}

async fn response_json(response: axum::response::Response) -> Value {
    let body = axum::body::to_bytes(response.into_body(), 1024 * 16)
        .await
        .unwrap();

    serde_json::from_slice(&body).unwrap()
}
