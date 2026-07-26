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

/// Logs in through the real endpoint so the archive tests exercise the same
/// bearer path a client uses.
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

fn entry_payload(title: &str) -> Value {
    json!({
        "title": title,
        "body": "正文内容",
        "summary": "摘要",
        "tags": ["新生", "报到"],
        "category": "onboarding",
        "applicableAudience": "new_students",
        "sourceKind": "firsthand_experience",
        "sourceReference": "https://example.test/notice",
    })
}

fn authed(method: &str, uri: &str, token: &str, body: Option<Value>) -> Request<Body> {
    let builder = Request::builder()
        .method(method)
        .uri(uri)
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .header(header::CONTENT_TYPE, "application/json");

    builder
        .body(match body {
            Some(value) => Body::from(value.to_string()),
            None => Body::empty(),
        })
        .unwrap()
}

async fn create_entry(app: &axum::Router, token: &str, title: &str) -> Value {
    let response = app
        .clone()
        .oneshot(authed(
            "POST",
            "/api/v1/knowledge-entries",
            token,
            Some(entry_payload(title)),
        ))
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::CREATED);
    response_json(response).await
}

async fn publish(app: &axum::Router, token: &str, id: &str) -> axum::response::Response {
    app.clone()
        .oneshot(authed(
            "POST",
            &format!("/api/v1/knowledge-entries/{id}/status"),
            token,
            Some(json!({ "status": "published" })),
        ))
        .await
        .unwrap()
}

#[tokio::test]
async fn creating_an_entry_requires_authentication() {
    let app = app();

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/v1/knowledge-entries")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(entry_payload("匿名投稿").to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    assert_eq!(response_json(response).await["code"], "unauthorized");
}

#[tokio::test]
async fn creating_an_entry_returns_the_stored_draft() {
    let app = app();
    let token = login(&app, "student").await;

    let entry = create_entry(&app, &token, "新生报到清单").await;

    assert!(entry["id"].as_str().is_some());
    assert_eq!(entry["title"], "新生报到清单");
    assert_eq!(entry["moderationStatus"], "draft");
    assert_eq!(entry["currentRevision"], 1);
    assert_eq!(entry["category"], "onboarding");
    assert_eq!(entry["applicableAudience"], "new_students");
    assert_eq!(entry["sourceKind"], "firsthand_experience");
    assert_eq!(entry["tags"], json!(["新生", "报到"]));
}

#[tokio::test]
async fn invalid_entry_input_is_unprocessable() {
    let app = app();
    let token = login(&app, "student").await;

    let mut payload = entry_payload("x");
    payload["title"] = json!("   ");

    let response = app
        .oneshot(authed(
            "POST",
            "/api/v1/knowledge-entries",
            &token,
            Some(payload),
        ))
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(response_json(response).await["code"], "validation_failed");
}

#[tokio::test]
async fn an_unknown_enum_value_is_a_bad_request() {
    let app = app();
    let token = login(&app, "student").await;

    let mut payload = entry_payload("枚举错误");
    payload["category"] = json!("not_a_category");

    let response = app
        .oneshot(authed(
            "POST",
            "/api/v1/knowledge-entries",
            &token,
            Some(payload),
        ))
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    assert_eq!(
        response_json(response).await["code"],
        "invalid_request_body"
    );
}

#[tokio::test]
async fn listing_returns_the_pagination_envelope_and_hides_drafts_from_guests() {
    let app = app();
    let token = login(&app, "student").await;

    let published = create_entry(&app, &token, "已发布条目").await;
    create_entry(&app, &token, "仍是草稿").await;
    assert_eq!(
        publish(&app, &token, published["id"].as_str().unwrap())
            .await
            .status(),
        StatusCode::OK
    );

    let guest = app
        .clone()
        .oneshot(
            Request::get("/api/v1/knowledge-entries")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(guest.status(), StatusCode::OK);
    let page = response_json(guest).await;
    assert_eq!(page["page"], 1);
    assert_eq!(page["pageSize"], 20);
    assert_eq!(page["totalItems"], 1);
    assert_eq!(page["totalPages"], 1);
    assert_eq!(page["items"].as_array().unwrap().len(), 1);
    assert_eq!(page["items"][0]["title"], "已发布条目");

    // The author additionally sees their own draft.
    let owner = app
        .oneshot(authed("GET", "/api/v1/knowledge-entries", &token, None))
        .await
        .unwrap();
    assert_eq!(response_json(owner).await["totalItems"], 2);
}

#[tokio::test]
async fn listing_rejects_an_out_of_range_page_size() {
    let app = app();

    let response = app
        .oneshot(
            Request::get("/api/v1/knowledge-entries?pageSize=101")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(response_json(response).await["code"], "validation_failed");
}

#[tokio::test]
async fn listing_rejects_a_malformed_page_parameter() {
    let app = app();

    let response = app
        .oneshot(
            Request::get("/api/v1/knowledge-entries?page=abc")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    assert_eq!(response_json(response).await["code"], "invalid_query");
}

#[tokio::test]
async fn search_lite_filters_by_query_tag_and_category() {
    let app = app();
    let token = login(&app, "student").await;

    for title in ["宿舍生活指南", "社团招新流程"] {
        let entry = create_entry(&app, &token, title).await;
        publish(&app, &token, entry["id"].as_str().unwrap()).await;
    }

    let by_query = app
        .clone()
        .oneshot(
            Request::get("/api/v1/knowledge-entries?q=%E5%AE%BF%E8%88%8D")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response_json(by_query).await["totalItems"], 1);

    let by_category = app
        .clone()
        .oneshot(
            Request::get("/api/v1/knowledge-entries?category=onboarding")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response_json(by_category).await["totalItems"], 2);

    let no_match = app
        .oneshot(
            Request::get("/api/v1/knowledge-entries?category=academics")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response_json(no_match).await["totalItems"], 0);
}

#[tokio::test]
async fn an_invisible_entry_is_not_found_rather_than_forbidden() {
    let app = app();
    let author = login(&app, "student").await;
    let stranger = login(&app, "moderator").await;

    let draft = create_entry(&app, &author, "私有草稿").await;
    let id = draft["id"].as_str().unwrap();

    // A guest cannot see it at all.
    let guest = app
        .clone()
        .oneshot(
            Request::get(format!("/api/v1/knowledge-entries/{id}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(guest.status(), StatusCode::NOT_FOUND);
    assert_eq!(response_json(guest).await["code"], "not_found");

    // The author does.
    let owner = app
        .clone()
        .oneshot(authed(
            "GET",
            &format!("/api/v1/knowledge-entries/{id}"),
            &author,
            None,
        ))
        .await
        .unwrap();
    assert_eq!(owner.status(), StatusCode::OK);

    // A moderator has full scope, so they see it too.
    let moderator = app
        .oneshot(authed(
            "GET",
            &format!("/api/v1/knowledge-entries/{id}"),
            &stranger,
            None,
        ))
        .await
        .unwrap();
    assert_eq!(moderator.status(), StatusCode::OK);
}

#[tokio::test]
async fn a_malformed_entry_id_is_a_bad_request() {
    let app = app();

    let response = app
        .oneshot(
            Request::get("/api/v1/knowledge-entries/not-a-uuid")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    assert_eq!(response_json(response).await["code"], "invalid_path");
}

#[tokio::test]
async fn updating_a_published_entry_creates_a_revision() {
    let app = app();
    let token = login(&app, "student").await;

    let entry = create_entry(&app, &token, "会更新").await;
    let id = entry["id"].as_str().unwrap().to_owned();
    publish(&app, &token, &id).await;

    let response = app
        .clone()
        .oneshot(authed(
            "PATCH",
            &format!("/api/v1/knowledge-entries/{id}"),
            &token,
            Some(json!({ "title": "会更新（2026 版）" })),
        ))
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let updated = response_json(response).await;
    assert_eq!(updated["title"], "会更新（2026 版）");
    assert_eq!(updated["currentRevision"], 2);

    let revisions = app
        .oneshot(authed(
            "GET",
            &format!("/api/v1/knowledge-entries/{id}/revisions"),
            &token,
            None,
        ))
        .await
        .unwrap();
    assert_eq!(revisions.status(), StatusCode::OK);
    let history = response_json(revisions).await;
    assert_eq!(history["items"].as_array().unwrap().len(), 2);
    assert_eq!(history["items"][0]["revision"], 1);
    assert_eq!(history["items"][0]["title"], "会更新");
    assert_eq!(history["items"][1]["revision"], 2);
}

#[tokio::test]
async fn an_illegal_status_transition_is_a_conflict() {
    let app = app();
    let token = login(&app, "admin").await;

    let entry = create_entry(&app, &token, "状态机").await;
    let id = entry["id"].as_str().unwrap();

    let response = app
        .oneshot(authed(
            "POST",
            &format!("/api/v1/knowledge-entries/{id}/status"),
            &token,
            Some(json!({ "status": "hidden" })),
        ))
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::CONFLICT);
    assert_eq!(response_json(response).await["code"], "conflict");
}

#[tokio::test]
async fn corrections_are_filed_by_readers_and_resolved_by_the_author() {
    let app = app();
    let author = login(&app, "student").await;
    let reporter = login(&app, "organization_member").await;

    let entry = create_entry(&app, &author, "需要纠错").await;
    let id = entry["id"].as_str().unwrap().to_owned();
    publish(&app, &author, &id).await;

    let filed = app
        .clone()
        .oneshot(authed(
            "POST",
            &format!("/api/v1/knowledge-entries/{id}/corrections"),
            &reporter,
            Some(json!({ "message": "报名时间已经变了" })),
        ))
        .await
        .unwrap();

    assert_eq!(filed.status(), StatusCode::CREATED);
    let correction = response_json(filed).await;
    let correction_id = correction["id"].as_str().unwrap().to_owned();
    assert_eq!(correction["message"], "报名时间已经变了");
    assert!(correction["resolvedAt"].is_null());

    // The reporter has no stake in the entry, so closing it is not theirs.
    let reporter_resolve = app
        .clone()
        .oneshot(authed(
            "POST",
            &format!("/api/v1/knowledge-entries/{id}/corrections/{correction_id}/resolve"),
            &reporter,
            None,
        ))
        .await
        .unwrap();
    assert_eq!(reporter_resolve.status(), StatusCode::FORBIDDEN);
    assert_eq!(response_json(reporter_resolve).await["code"], "forbidden");

    let author_resolve = app
        .clone()
        .oneshot(authed(
            "POST",
            &format!("/api/v1/knowledge-entries/{id}/corrections/{correction_id}/resolve"),
            &author,
            None,
        ))
        .await
        .unwrap();
    assert_eq!(author_resolve.status(), StatusCode::OK);
    assert!(!response_json(author_resolve).await["resolvedAt"].is_null());

    let listed = app
        .oneshot(authed(
            "GET",
            &format!("/api/v1/knowledge-entries/{id}/corrections"),
            &author,
            None,
        ))
        .await
        .unwrap();
    assert_eq!(listed.status(), StatusCode::OK);
    assert_eq!(
        response_json(listed).await["items"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
}

#[tokio::test]
async fn correction_listing_requires_a_stake_in_the_entry() {
    // A correction names its reporter, so docs/product/privacy.md limits the
    // listing to the entry author, maintainers, moderators, and admins.
    let app = app();
    let author = login(&app, "student").await;
    let bystander = login(&app, "organization_member").await;

    let entry = create_entry(&app, &author, "受关注条目").await;
    let id = entry["id"].as_str().unwrap().to_owned();
    publish(&app, &author, &id).await;

    let anonymous = app
        .clone()
        .oneshot(
            Request::get(format!("/api/v1/knowledge-entries/{id}/corrections"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(anonymous.status(), StatusCode::UNAUTHORIZED);

    let unrelated = app
        .clone()
        .oneshot(authed(
            "GET",
            &format!("/api/v1/knowledge-entries/{id}/corrections"),
            &bystander,
            None,
        ))
        .await
        .unwrap();
    assert_eq!(unrelated.status(), StatusCode::FORBIDDEN);

    let owner = app
        .oneshot(authed(
            "GET",
            &format!("/api/v1/knowledge-entries/{id}/corrections"),
            &author,
            None,
        ))
        .await
        .unwrap();
    assert_eq!(owner.status(), StatusCode::OK);
}

#[tokio::test]
async fn a_correction_cannot_be_resolved_through_an_unrelated_entry() {
    // The caller is authorized against the entry in the path, so a correction
    // that belongs elsewhere must not be reachable — resolving it would also
    // disclose its contents.
    let app = app();
    let victim = login(&app, "student").await;
    let attacker = login(&app, "organization_member").await;

    let victim_entry = create_entry(&app, &victim, "受害条目").await;
    let victim_id = victim_entry["id"].as_str().unwrap().to_owned();
    publish(&app, &victim, &victim_id).await;

    let filed = app
        .clone()
        .oneshot(authed(
            "POST",
            &format!("/api/v1/knowledge-entries/{victim_id}/corrections"),
            &attacker,
            Some(json!({ "message": "内容已过期" })),
        ))
        .await
        .unwrap();
    let correction_id = response_json(filed).await["id"]
        .as_str()
        .unwrap()
        .to_owned();

    let attacker_entry = create_entry(&app, &attacker, "攻击者条目").await;
    let attacker_id = attacker_entry["id"].as_str().unwrap();

    let response = app
        .oneshot(authed(
            "POST",
            &format!("/api/v1/knowledge-entries/{attacker_id}/corrections/{correction_id}/resolve"),
            &attacker,
            None,
        ))
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn filing_a_correction_requires_authentication() {
    let app = app();
    let author = login(&app, "student").await;

    let entry = create_entry(&app, &author, "公开条目").await;
    let id = entry["id"].as_str().unwrap().to_owned();
    publish(&app, &author, &id).await;

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/v1/knowledge-entries/{id}/corrections"))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(json!({ "message": "匿名报错" }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}
