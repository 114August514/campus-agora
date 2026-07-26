use axum::body::Body;
use axum::http::{header, HeaderName, Request, StatusCode};
use campus_agora_api::{build_router_with_state, ApiState, ReadinessStatus};
use serde_json::{json, Value};
use tower::ServiceExt;

const REQUEST_ID: &str = "x-request-id";

fn app() -> axum::Router {
    build_router_with_state(ApiState::for_tests(ReadinessStatus::Ready))
}

fn mock_login_request(persona: &str) -> Request<Body> {
    Request::builder()
        .method("POST")
        .uri("/api/v1/auth/mock-login")
        .header(header::CONTENT_TYPE, "application/json")
        .header(REQUEST_ID, "auth-test-request")
        .body(Body::from(json!({ "persona": persona }).to_string()))
        .unwrap()
}

async fn response_json(response: axum::response::Response) -> Value {
    let body = axum::body::to_bytes(response.into_body(), 1024 * 64)
        .await
        .unwrap();

    serde_json::from_slice(&body).unwrap()
}

async fn login(app: &axum::Router, persona: &str) -> Value {
    let response = app
        .clone()
        .oneshot(mock_login_request(persona))
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    response_json(response).await
}

#[tokio::test]
async fn mock_login_returns_token_expiry_and_user() {
    let app = app();
    let json = login(&app, "student").await;

    let token = json["token"].as_str().unwrap();
    assert_eq!(token.len(), 64);
    assert!(token.chars().all(|c| c.is_ascii_hexdigit()));

    let expires_at = json["expiresAt"].as_str().unwrap();
    assert!(chrono::DateTime::parse_from_rfc3339(expires_at).is_ok());

    assert!(json["user"]["id"].as_str().is_some());
    assert_eq!(json["user"]["displayName"], "示例学生");
    assert_eq!(json["user"]["systemRole"], "student");
    assert_eq!(json["user"]["organizations"], json!([]));
}

#[tokio::test]
async fn mock_login_provisions_demo_organization_for_member_persona() {
    let app = app();
    let json = login(&app, "organization_member").await;

    assert_eq!(json["user"]["systemRole"], "organization_member");

    let organizations = json["user"]["organizations"].as_array().unwrap();
    assert_eq!(organizations.len(), 1);
    assert_eq!(organizations[0]["slug"], "demo-student-union");
    assert!(organizations[0]["organizationId"].as_str().is_some());
    assert!(organizations[0]["name"].as_str().is_some());
}

#[tokio::test]
async fn mock_login_rejects_unknown_personas_with_validation_error() {
    let app = app();

    let response = app.oneshot(mock_login_request("professor")).await.unwrap();

    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);

    let json = response_json(response).await;
    assert_eq!(json["code"], "validation_failed");
    assert_eq!(json["requestId"], "auth-test-request");
}

#[tokio::test]
async fn mock_login_rejects_malformed_json_bodies() {
    let app = app();

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/auth/mock-login")
                .header(header::CONTENT_TYPE, "application/json")
                .header(REQUEST_ID, "auth-test-request")
                .body(Body::from("{not json"))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let json = response_json(response).await;
    assert_eq!(json["code"], "invalid_request_body");
    assert_eq!(json["requestId"], "auth-test-request");
}

#[tokio::test]
async fn mock_login_is_forbidden_when_the_capability_flag_is_off() {
    let app = build_router_with_state(
        ApiState::for_tests(ReadinessStatus::Ready).with_auth_mock_enabled(false),
    );

    let response = app.oneshot(mock_login_request("student")).await.unwrap();

    assert_eq!(response.status(), StatusCode::FORBIDDEN);

    let json = response_json(response).await;
    assert_eq!(json["code"], "auth_mock_disabled");
    assert_eq!(json["requestId"], "auth-test-request");
}

#[tokio::test]
async fn session_endpoint_returns_the_current_user_for_a_valid_token() {
    let app = app();
    let login_json = login(&app, "moderator").await;
    let token = login_json["token"].as_str().unwrap();

    let response = app
        .oneshot(
            Request::get("/api/v1/auth/session")
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let json = response_json(response).await;
    assert_eq!(json["user"]["id"], login_json["user"]["id"]);
    assert_eq!(json["user"]["systemRole"], "moderator");
    assert_eq!(json["expiresAt"], login_json["expiresAt"]);
}

#[tokio::test]
async fn session_endpoint_rejects_missing_or_invalid_bearer_tokens() {
    let app = app();

    for request in [
        Request::get("/api/v1/auth/session")
            .header(REQUEST_ID, "auth-test-request")
            .body(Body::empty())
            .unwrap(),
        Request::get("/api/v1/auth/session")
            .header(REQUEST_ID, "auth-test-request")
            .header(header::AUTHORIZATION, "Token abc")
            .body(Body::empty())
            .unwrap(),
        Request::get("/api/v1/auth/session")
            .header(REQUEST_ID, "auth-test-request")
            .header(header::AUTHORIZATION, "Bearer unknown-token")
            .body(Body::empty())
            .unwrap(),
    ] {
        let response = app.clone().oneshot(request).await.unwrap();

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
        assert_eq!(
            response
                .headers()
                .get(HeaderName::from_static(REQUEST_ID))
                .and_then(|value| value.to_str().ok()),
            Some("auth-test-request")
        );

        let json = response_json(response).await;
        assert_eq!(json["code"], "unauthorized");
        assert_eq!(json["requestId"], "auth-test-request");
    }
}

#[tokio::test]
async fn logout_revokes_the_session_token() {
    let app = app();
    let login_json = login(&app, "student").await;
    let token = login_json["token"].as_str().unwrap();

    let logout_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/auth/logout")
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(logout_response.status(), StatusCode::NO_CONTENT);

    let session_response = app
        .oneshot(
            Request::get("/api/v1/auth/session")
                .header(header::AUTHORIZATION, format!("Bearer {token}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(session_response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn logout_requires_a_valid_bearer_token() {
    let app = app();

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/auth/logout")
                .header(REQUEST_ID, "auth-test-request")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

    let json = response_json(response).await;
    assert_eq!(json["code"], "unauthorized");
}
