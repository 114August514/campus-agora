use axum::body::Body;
use axum::http::{header, Request, StatusCode};
use campus_agora_api::{build_router_with_state, ApiState, ReadinessStatus};
use serde_json::{json, Value};
use tower::ServiceExt;

fn app() -> axum::Router {
    build_router_with_state(ApiState::for_tests(ReadinessStatus::Ready))
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

async fn create_discussion(app: &axum::Router, token: &str, title: &str) -> Value {
    let response = app
        .clone()
        .oneshot(authed(
            "POST",
            "/api/v1/discussions",
            token,
            Some(json!({
                "title": title,
                "body": "有人知道场地申请流程吗？",
                "tags": ["办事流程"],
            })),
        ))
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::CREATED);
    response_json(response).await
}

async fn set_status(app: &axum::Router, token: &str, id: &str, status: &str) -> StatusCode {
    app.clone()
        .oneshot(authed(
            "POST",
            &format!("/api/v1/discussions/{id}/status"),
            token,
            Some(json!({ "status": status })),
        ))
        .await
        .unwrap()
        .status()
}

async fn published(app: &axum::Router, token: &str, title: &str) -> String {
    let discussion = create_discussion(app, token, title).await;
    let id = discussion["id"].as_str().unwrap().to_owned();

    assert_eq!(
        set_status(app, token, &id, "published").await,
        StatusCode::OK
    );

    id
}

async fn reply(app: &axum::Router, token: &str, id: &str, body: &str) -> Value {
    let response = app
        .clone()
        .oneshot(authed(
            "POST",
            &format!("/api/v1/discussions/{id}/replies"),
            token,
            Some(json!({ "body": body })),
        ))
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::CREATED);
    response_json(response).await
}

#[tokio::test]
async fn creating_a_discussion_requires_a_session() {
    let app = app();

    let response = app
        .clone()
        .oneshot(anonymous(
            "POST",
            "/api/v1/discussions",
            Some(json!({ "title": "标题", "body": "正文", "tags": [] })),
        ))
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn a_new_discussion_is_a_draft_and_invisible_to_guests() {
    let app = app();
    let token = login(&app, "student").await;

    let discussion = create_discussion(&app, &token, "草稿讨论").await;
    assert_eq!(discussion["moderationStatus"], "draft");
    assert_eq!(discussion["replyCount"], 0);
    assert!(discussion["acceptedCommentId"].is_null());

    let id = discussion["id"].as_str().unwrap();
    let response = app
        .clone()
        .oneshot(anonymous("GET", &format!("/api/v1/discussions/{id}"), None))
        .await
        .unwrap();

    // 404 rather than 403: an invisible discussion does not admit it exists.
    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn a_published_discussion_is_readable_and_listed() {
    let app = app();
    let token = login(&app, "student").await;
    let id = published(&app, &token, "公开讨论").await;

    let response = app
        .clone()
        .oneshot(anonymous("GET", &format!("/api/v1/discussions/{id}"), None))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let response = app
        .clone()
        .oneshot(anonymous("GET", "/api/v1/discussions", None))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let page = response_json(response).await;
    assert_eq!(page["totalItems"], 1);
    assert_eq!(page["items"][0]["id"], id);
}

#[tokio::test]
async fn replying_requires_a_session_and_returns_the_reply() {
    let app = app();
    let token = login(&app, "student").await;
    let id = published(&app, &token, "可回复").await;

    let response = app
        .clone()
        .oneshot(anonymous(
            "POST",
            &format!("/api/v1/discussions/{id}/replies"),
            Some(json!({ "body": "我也想知道" })),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

    let created = reply(&app, &token, &id, "先去团委登记").await;
    assert_eq!(created["body"], "先去团委登记");
    assert_eq!(created["postId"], id);

    let response = app
        .clone()
        .oneshot(anonymous(
            "GET",
            &format!("/api/v1/discussions/{id}/replies"),
            None,
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response_json(response).await["items"][0]["body"],
        "先去团委登记"
    );
}

#[tokio::test]
async fn an_archived_discussion_is_readable_but_closed() {
    let app = app();
    let token = login(&app, "student").await;
    let id = published(&app, &token, "已归档").await;

    assert_eq!(
        set_status(&app, &token, &id, "archived").await,
        StatusCode::OK
    );

    let response = app
        .clone()
        .oneshot(anonymous("GET", &format!("/api/v1/discussions/{id}"), None))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response_json(response).await["moderationStatus"],
        "archived"
    );

    let response = app
        .clone()
        .oneshot(authed(
            "POST",
            &format!("/api/v1/discussions/{id}/replies"),
            &token,
            Some(json!({ "body": "还能回吗" })),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CONFLICT);
}

/// Permission is checked before the state machine, so an unauthorized caller
/// gets 403 and learns nothing about which transitions exist. Only a caller
/// who *could* perform the transition is told it is illegal.
#[tokio::test]
async fn an_illegal_transition_is_a_conflict_for_whoever_could_have_made_it() {
    let app = app();
    let author = login(&app, "student").await;
    let moderator = login(&app, "moderator").await;

    let discussion = create_discussion(&app, &author, "草稿").await;
    let id = discussion["id"].as_str().unwrap();

    // A student author holds neither ArchiveContent (that is for published
    // content) nor ChangeModerationState.
    assert_eq!(
        set_status(&app, &author, id, "archived").await,
        StatusCode::FORBIDDEN
    );

    // A moderator may change moderation state, so the state machine is what
    // stops them: there is nothing to retire in a draft.
    assert_eq!(
        set_status(&app, &moderator, id, "archived").await,
        StatusCode::CONFLICT
    );
}

#[tokio::test]
async fn accepting_an_answer_is_restricted_and_scoped() {
    let app = app();
    let author = login(&app, "student").await;
    let stranger = login(&app, "organization_member").await;

    let id = published(&app, &author, "接受回答").await;
    let comment = reply(&app, &author, &id, "自答").await;
    let comment_id = comment["id"].as_str().unwrap();

    let response = app
        .clone()
        .oneshot(authed(
            "POST",
            &format!("/api/v1/discussions/{id}/accepted-answer"),
            &stranger,
            Some(json!({ "commentId": comment_id })),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::FORBIDDEN);

    let response = app
        .clone()
        .oneshot(authed(
            "POST",
            &format!("/api/v1/discussions/{id}/accepted-answer"),
            &author,
            Some(json!({ "commentId": comment_id })),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response_json(response).await["acceptedCommentId"],
        comment_id
    );

    // Clearing is the same endpoint with a null id.
    let response = app
        .clone()
        .oneshot(authed(
            "POST",
            &format!("/api/v1/discussions/{id}/accepted-answer"),
            &author,
            Some(json!({ "commentId": null })),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert!(response_json(response).await["acceptedCommentId"].is_null());
}

/// The authorization is against the discussion in the path, so the comment in
/// the body must belong to it. Otherwise the check and the action target
/// different resources — the defect the M2 review found in corrections.
#[tokio::test]
async fn accepting_a_comment_from_another_discussion_is_not_found() {
    let app = app();
    let author = login(&app, "student").await;
    let other = login(&app, "organization_member").await;

    let mine = published(&app, &author, "我的讨论").await;
    let theirs = published(&app, &other, "别人的讨论").await;
    let their_comment = reply(&app, &other, &theirs, "别人的回复").await;

    let response = app
        .clone()
        .oneshot(authed(
            "POST",
            &format!("/api/v1/discussions/{mine}/accepted-answer"),
            &author,
            Some(json!({ "commentId": their_comment["id"] })),
        ))
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn promoting_creates_a_draft_entry_and_records_the_source() {
    let app = app();
    let author = login(&app, "student").await;
    let curator = login(&app, "organization_member").await;

    let id = published(&app, &author, "场地申请流程").await;
    let comment = reply(&app, &author, &id, "先去团委登记，再到场馆办公室盖章。").await;

    let response = app
        .clone()
        .oneshot(authed(
            "POST",
            &format!("/api/v1/discussions/{id}/promotions"),
            &curator,
            Some(json!({
                "commentId": comment["id"],
                "title": "场地申请流程指南",
                "category": "procedures",
            })),
        ))
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::CREATED);
    let body = response_json(response).await;

    assert_eq!(body["entry"]["moderationStatus"], "draft");
    assert_eq!(body["entry"]["title"], "场地申请流程指南");
    assert_eq!(body["entry"]["sourceKind"], "discussion");
    assert_eq!(body["source"]["sourcePostId"], id);
    assert_eq!(body["source"]["sourceCommentId"], comment["id"]);

    // The entry's own backlink resolves for its owner.
    let entry_id = body["entry"]["id"].as_str().unwrap();
    let response = app
        .clone()
        .oneshot(authed(
            "GET",
            &format!("/api/v1/knowledge-entries/{entry_id}/sources"),
            &curator,
            None,
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let sources = response_json(response).await;
    assert_eq!(sources["items"][0]["sourceTitle"], "场地申请流程");
    // Attribution survives: the reply's author, not the promoter.
    assert_eq!(sources["items"][0]["sourceAuthorId"], comment["authorId"]);
}

#[tokio::test]
async fn promoting_requires_a_session_and_a_public_source() {
    let app = app();
    let author = login(&app, "student").await;

    let draft = create_discussion(&app, &author, "私密草稿").await;
    let draft_id = draft["id"].as_str().unwrap();

    let response = app
        .clone()
        .oneshot(anonymous(
            "POST",
            &format!("/api/v1/discussions/{draft_id}/promotions"),
            Some(json!({})),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

    // Its own author can see it but still cannot sediment it while private.
    let response = app
        .clone()
        .oneshot(authed(
            "POST",
            &format!("/api/v1/discussions/{draft_id}/promotions"),
            &author,
            Some(json!({})),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CONFLICT);
}

#[tokio::test]
async fn derived_entries_are_listed_once_published() {
    let app = app();
    let author = login(&app, "student").await;
    let curator = login(&app, "organization_member").await;
    let id = published(&app, &author, "来源讨论").await;

    let response = app
        .clone()
        .oneshot(authed(
            "POST",
            &format!("/api/v1/discussions/{id}/promotions"),
            &curator,
            Some(json!({})),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);
    let entry_id = response_json(response).await["entry"]["id"]
        .as_str()
        .unwrap()
        .to_owned();

    // A guest sees nothing while the entry is a draft.
    let response = app
        .clone()
        .oneshot(anonymous(
            "GET",
            &format!("/api/v1/discussions/{id}/derived-entries"),
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
        0
    );

    let response = app
        .clone()
        .oneshot(authed(
            "POST",
            &format!("/api/v1/knowledge-entries/{entry_id}/status"),
            &curator,
            Some(json!({ "status": "published" })),
        ))
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let response = app
        .clone()
        .oneshot(anonymous(
            "GET",
            &format!("/api/v1/discussions/{id}/derived-entries"),
            None,
        ))
        .await
        .unwrap();
    let items = response_json(response).await;
    assert_eq!(items["items"].as_array().unwrap().len(), 1);
    assert_eq!(items["items"][0]["entryId"], entry_id);
}

#[tokio::test]
async fn malformed_ids_are_rejected_before_any_lookup() {
    let app = app();
    let token = login(&app, "student").await;

    for (method, uri) in [
        ("GET", "/api/v1/discussions/not-a-uuid"),
        ("GET", "/api/v1/discussions/not-a-uuid/replies"),
        ("GET", "/api/v1/discussions/not-a-uuid/derived-entries"),
        ("GET", "/api/v1/knowledge-entries/not-a-uuid/sources"),
    ] {
        let response = app
            .clone()
            .oneshot(authed(method, uri, &token, None))
            .await
            .unwrap();

        assert_eq!(
            response.status(),
            StatusCode::BAD_REQUEST,
            "{method} {uri} must reject a malformed id"
        );
    }
}

#[tokio::test]
async fn an_unknown_status_is_rejected_as_invalid_input() {
    let app = app();
    let token = login(&app, "student").await;
    let id = published(&app, &token, "状态校验").await;

    assert_eq!(
        set_status(&app, &token, &id, "deleted").await,
        StatusCode::BAD_REQUEST
    );
}
