use axum::body::Body;
use axum::http::{header, Request, StatusCode};
use campus_agora_api::{build_router_with_state, ApiState, ReadinessStatus};
use serde_json::{json, Value};
use tower::ServiceExt;

fn app() -> axum::Router {
    build_router_with_state(ApiState::for_tests(ReadinessStatus::Ready))
}

/// The AI capability is off by default, matching `AI_ARCHIVE_ENABLED`.
fn app_with_ai() -> axum::Router {
    build_router_with_state(
        ApiState::for_tests(ReadinessStatus::Ready).with_ai_archive_enabled(true),
    )
}

async fn response_json(response: axum::response::Response) -> Value {
    let body = axum::body::to_bytes(response.into_body(), 1024 * 128)
        .await
        .unwrap();

    serde_json::from_slice(&body).unwrap()
}

async fn login(app: &axum::Router, persona: &str) -> String {
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/auth/mock-login")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(json!({ "persona": persona }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    response_json(response).await["token"]
        .as_str()
        .unwrap()
        .to_owned()
}

fn authed(method: &str, uri: &str, token: &str, body: Option<Value>) -> Request<Body> {
    Request::builder()
        .method(method)
        .uri(uri)
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(match body {
            Some(value) => Body::from(value.to_string()),
            None => Body::empty(),
        })
        .unwrap()
}

fn anonymous(method: &str, uri: &str, body: Option<Value>) -> Request<Body> {
    Request::builder()
        .method(method)
        .uri(uri)
        .header(header::CONTENT_TYPE, "application/json")
        .body(match body {
            Some(value) => Body::from(value.to_string()),
            None => Body::empty(),
        })
        .unwrap()
}

/// A published discussion with one reply, the shape reports and drafts target.
async fn published_discussion(app: &axum::Router, token: &str, title: &str) -> String {
    let response = app
        .clone()
        .oneshot(authed(
            "POST",
            "/api/v1/discussions",
            token,
            Some(json!({ "title": title, "body": "讨论正文", "tags": [] })),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);
    let id = response_json(response).await["id"]
        .as_str()
        .unwrap()
        .to_owned();

    let response = app
        .clone()
        .oneshot(authed(
            "POST",
            &format!("/api/v1/discussions/{id}/status"),
            token,
            Some(json!({ "status": "published" })),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let response = app
        .clone()
        .oneshot(authed(
            "POST",
            &format!("/api/v1/discussions/{id}/replies"),
            token,
            Some(json!({ "body": "一条有用的回复。" })),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);

    id
}

async fn file_report(app: &axum::Router, token: &str, id: &str, category: &str) -> Value {
    let response = app
        .clone()
        .oneshot(authed(
            "POST",
            "/api/v1/reports",
            token,
            Some(json!({ "postId": id, "category": category, "message": "有问题" })),
        ))
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::CREATED);
    response_json(response).await
}

#[tokio::test]
async fn reporting_requires_a_session() {
    let app = app();
    let token = login(&app, "student").await;
    let id = published_discussion(&app, &token, "会被举报的讨论").await;

    let response = app
        .clone()
        .oneshot(anonymous(
            "POST",
            "/api/v1/reports",
            Some(json!({ "postId": id, "category": "spam", "message": "广告" })),
        ))
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn a_report_is_created_and_leaves_the_content_where_it_was() {
    let app = app();
    let token = login(&app, "student").await;
    let id = published_discussion(&app, &token, "仍然公开的讨论").await;

    let report = file_report(&app, &token, &id, "spam").await;
    assert_eq!(report["postId"], id);
    assert_eq!(report["category"], "spam");
    assert!(report["resolvedAt"].is_null());

    // Reporting is not a takedown: a guest can still read it.
    let response = app
        .clone()
        .oneshot(anonymous("GET", &format!("/api/v1/discussions/{id}"), None))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response_json(response).await["moderationStatus"],
        "published"
    );
}

#[tokio::test]
async fn a_duplicate_open_report_is_a_conflict() {
    let app = app();
    let token = login(&app, "student").await;
    let id = published_discussion(&app, &token, "重复举报").await;

    file_report(&app, &token, &id, "spam").await;

    let response = app
        .clone()
        .oneshot(authed(
            "POST",
            "/api/v1/reports",
            &token,
            Some(json!({ "postId": id, "category": "harassment", "message": "再来" })),
        ))
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::CONFLICT);
}

#[tokio::test]
async fn reporting_invisible_content_is_not_found() {
    let app = app();
    let author = login(&app, "student").await;
    let stranger = login(&app, "organization_member").await;

    let response = app
        .clone()
        .oneshot(authed(
            "POST",
            "/api/v1/discussions",
            &author,
            Some(json!({ "title": "私密草稿", "body": "正文", "tags": [] })),
        ))
        .await
        .unwrap();
    let id = response_json(response).await["id"]
        .as_str()
        .unwrap()
        .to_owned();

    let response = app
        .clone()
        .oneshot(authed(
            "POST",
            "/api/v1/reports",
            &stranger,
            Some(json!({ "postId": id, "category": "spam", "message": "广告" })),
        ))
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn the_queue_and_the_reports_on_an_item_are_moderator_only() {
    let app = app();
    let author = login(&app, "student").await;
    let moderator = login(&app, "moderator").await;
    let id = published_discussion(&app, &author, "队列里的讨论").await;

    file_report(&app, &author, &id, "illegal").await;

    // Not even the content's own author, who a report may be about.
    for uri in [
        "/api/v1/moderation/queue".to_owned(),
        format!("/api/v1/moderation/content/{id}/reports"),
    ] {
        let response = app
            .clone()
            .oneshot(authed("GET", &uri, &author, None))
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::FORBIDDEN, "{uri}");
    }

    let response = app
        .clone()
        .oneshot(authed("GET", "/api/v1/moderation/queue", &moderator, None))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let page = response_json(response).await;
    assert_eq!(page["totalItems"], 1);
    assert_eq!(page["items"][0]["postId"], id);
    assert_eq!(page["items"][0]["risk"], "high");
    assert_eq!(page["items"][0]["openReportCount"], 1);

    let response = app
        .clone()
        .oneshot(authed(
            "GET",
            &format!("/api/v1/moderation/content/{id}/reports"),
            &moderator,
            None,
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response_json(response).await["items"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
}

/// The M2 IDOR shape: authorization is against the item in the path, so the
/// report id must belong to it.
#[tokio::test]
async fn a_report_cannot_be_resolved_through_an_unrelated_item() {
    let app = app();
    let author = login(&app, "student").await;
    let moderator = login(&app, "moderator").await;

    let reported = published_discussion(&app, &author, "被举报的").await;
    let unrelated = published_discussion(&app, &author, "无关的").await;
    let report = file_report(&app, &author, &reported, "spam").await;
    let report_id = report["id"].as_str().unwrap();

    let response = app
        .clone()
        .oneshot(authed(
            "POST",
            &format!("/api/v1/moderation/content/{unrelated}/reports/{report_id}/resolve"),
            &moderator,
            Some(json!({ "resolution": "dismissed" })),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NOT_FOUND);

    let response = app
        .clone()
        .oneshot(authed(
            "POST",
            &format!("/api/v1/moderation/content/{reported}/reports/{report_id}/resolve"),
            &moderator,
            Some(json!({ "resolution": "dismissed" })),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response_json(response).await["resolution"], "dismissed");
}

#[tokio::test]
async fn ai_drafting_is_refused_unless_the_capability_is_on() {
    let app = app();
    let token = login(&app, "student").await;
    let id = published_discussion(&app, &token, "可起草的讨论").await;

    let response = app
        .clone()
        .oneshot(authed(
            "POST",
            &format!("/api/v1/discussions/{id}/ai-draft"),
            &token,
            None,
        ))
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}

/// The exit criterion, checked at the boundary: what comes back is a draft the
/// requester owns, with its sources, and never a published entry.
#[tokio::test]
async fn an_ai_draft_is_a_draft_with_recorded_sources() {
    let app = app_with_ai();
    let token = login(&app, "student").await;
    let id = published_discussion(&app, &token, "场地申请流程").await;

    let response = app
        .clone()
        .oneshot(authed(
            "POST",
            &format!("/api/v1/discussions/{id}/ai-draft"),
            &token,
            None,
        ))
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::CREATED);
    let body = response_json(response).await;

    assert_eq!(body["entry"]["moderationStatus"], "draft");
    assert_eq!(body["entry"]["aiProvider"], "deterministic-v1");
    assert_eq!(body["entry"]["sourceKind"], "discussion");
    // The opening post plus the reply.
    assert_eq!(body["sources"].as_array().unwrap().len(), 2);
    assert!(body["sources"]
        .as_array()
        .unwrap()
        .iter()
        .all(|source| source["sourcePostId"] == id));
}

#[tokio::test]
async fn ai_drafting_requires_a_session_and_a_public_source() {
    let app = app_with_ai();
    let token = login(&app, "student").await;

    let response = app
        .clone()
        .oneshot(authed(
            "POST",
            "/api/v1/discussions",
            &token,
            Some(json!({ "title": "私密草稿", "body": "正文", "tags": [] })),
        ))
        .await
        .unwrap();
    let draft_id = response_json(response).await["id"]
        .as_str()
        .unwrap()
        .to_owned();

    let response = app
        .clone()
        .oneshot(anonymous(
            "POST",
            &format!("/api/v1/discussions/{draft_id}/ai-draft"),
            None,
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

    let response = app
        .clone()
        .oneshot(authed(
            "POST",
            &format!("/api/v1/discussions/{draft_id}/ai-draft"),
            &token,
            None,
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CONFLICT);
}

#[tokio::test]
async fn malformed_ids_and_enums_are_rejected() {
    let app = app();
    let token = login(&app, "moderator").await;

    for (method, uri) in [
        ("GET", "/api/v1/moderation/content/not-a-uuid/reports"),
        ("POST", "/api/v1/discussions/not-a-uuid/ai-draft"),
    ] {
        let response = app
            .clone()
            .oneshot(authed(method, uri, &token, None))
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST, "{method} {uri}");
    }

    let id = published_discussion(&app, &token, "枚举校验").await;
    let response = app
        .clone()
        .oneshot(authed(
            "POST",
            "/api/v1/reports",
            &token,
            Some(json!({ "postId": id, "category": "made-up", "message": "x" })),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn a_report_message_is_validated() {
    let app = app();
    let token = login(&app, "student").await;
    let id = published_discussion(&app, &token, "文案校验").await;

    let response = app
        .clone()
        .oneshot(authed(
            "POST",
            "/api/v1/reports",
            &token,
            Some(json!({ "postId": id, "category": "spam", "message": "   " })),
        ))
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
}
