use std::sync::Arc;

use campus_agora_application::archive::{
    ArchiveService, CorrectionInput, ListArchiveQuery, NewArchiveEntryInput, UpdateArchiveInput,
};
use campus_agora_application::auth::{AuditContext, CurrentUser};
use campus_agora_application::memory::InMemoryAuthStore;
use campus_agora_application::ports::{NewUser, UserRepository};
use campus_agora_application::ApplicationError;
use campus_agora_domain::{
    ApplicableAudience, ArchiveCategory, AuthProviderKind, ModerationStatus, SourceKind,
    SystemRole, UserId,
};
use chrono::{TimeZone, Utc};

fn now() -> chrono::DateTime<Utc> {
    Utc.with_ymd_and_hms(2026, 7, 26, 12, 0, 0).unwrap()
}

fn audit() -> AuditContext {
    AuditContext {
        request_id: Some("req-archive-test".to_owned()),
    }
}

struct Fixture {
    service: ArchiveService,
    store: Arc<InMemoryAuthStore>,
}

impl Fixture {
    async fn new() -> Self {
        let store = Arc::new(InMemoryAuthStore::default());
        let service =
            ArchiveService::new(store.clone(), store.clone(), store.clone(), store.clone());

        Self { service, store }
    }

    async fn user(&self, subject: &str, system_role: SystemRole) -> CurrentUser {
        let record = self
            .store
            .upsert(NewUser {
                auth_provider: AuthProviderKind::MockCampus,
                provider_subject_hash: subject.to_owned(),
                display_name: format!("用户-{subject}"),
                system_role,
            })
            .await
            .expect("create user");

        CurrentUser {
            id: record.id,
            display_name: record.display_name,
            system_role: record.system_role,
            organizations: Vec::new(),
        }
    }
}

fn draft_input(title: &str) -> NewArchiveEntryInput {
    NewArchiveEntryInput {
        title: title.to_owned(),
        body: "正文内容".to_owned(),
        summary: Some("摘要".to_owned()),
        tags: vec!["新生".to_owned(), "报到".to_owned()],
        category: ArchiveCategory::Onboarding,
        applicable_audience: ApplicableAudience::NewStudents,
        source_kind: SourceKind::FirsthandExperience,
        source_reference: Some("https://example.test/notice".to_owned()),
    }
}

#[tokio::test]
async fn creating_a_draft_starts_at_revision_one() {
    let fixture = Fixture::new().await;
    let author = fixture.user("author", SystemRole::Student).await;

    let entry = fixture
        .service
        .create_draft(&author, draft_input("新生报到清单"), now(), &audit())
        .await
        .expect("create draft");

    assert_eq!(entry.title, "新生报到清单");
    assert_eq!(entry.moderation_status, ModerationStatus::Draft);
    assert_eq!(entry.current_revision, 1);
    assert_eq!(entry.author_id, author.id);
    // Tags are normalized by the domain layer before they reach storage.
    assert_eq!(entry.tags, vec!["新生".to_owned(), "报到".to_owned()]);
}

#[tokio::test]
async fn guests_cannot_create_drafts() {
    let fixture = Fixture::new().await;

    let result = fixture
        .service
        .create_draft_as_guest(draft_input("匿名投稿"), now(), &audit())
        .await;

    assert!(matches!(result, Err(ApplicationError::Forbidden)));
}

#[tokio::test]
async fn invalid_input_is_rejected_before_storage() {
    let fixture = Fixture::new().await;
    let author = fixture.user("author", SystemRole::Student).await;

    let mut blank_title = draft_input("x");
    blank_title.title = "   ".to_owned();

    let result = fixture
        .service
        .create_draft(&author, blank_title, now(), &audit())
        .await;

    assert!(matches!(result, Err(ApplicationError::Validation(_))));
}

#[tokio::test]
async fn an_author_can_publish_their_own_draft() {
    let fixture = Fixture::new().await;
    let author = fixture.user("author", SystemRole::Student).await;

    let entry = fixture
        .service
        .create_draft(&author, draft_input("可发布"), now(), &audit())
        .await
        .unwrap();

    let published = fixture
        .service
        .change_status(
            &author,
            entry.id,
            ModerationStatus::Published,
            now(),
            &audit(),
        )
        .await
        .expect("author publishes own draft");

    assert_eq!(published.moderation_status, ModerationStatus::Published);
}

#[tokio::test]
async fn a_stranger_cannot_publish_someone_elses_draft() {
    let fixture = Fixture::new().await;
    let author = fixture.user("author", SystemRole::Student).await;
    let stranger = fixture.user("stranger", SystemRole::Student).await;

    let entry = fixture
        .service
        .create_draft(&author, draft_input("私有草稿"), now(), &audit())
        .await
        .unwrap();

    // The draft is invisible to the stranger, so existence must not leak:
    // 404 semantics rather than 403.
    let result = fixture
        .service
        .change_status(
            &stranger,
            entry.id,
            ModerationStatus::Published,
            now(),
            &audit(),
        )
        .await;

    assert!(matches!(result, Err(ApplicationError::NotFound(_))));
}

#[tokio::test]
async fn a_moderator_can_hide_a_published_entry() {
    let fixture = Fixture::new().await;
    let author = fixture.user("author", SystemRole::Student).await;
    let moderator = fixture.user("moderator", SystemRole::Moderator).await;

    let entry = fixture
        .service
        .create_draft(&author, draft_input("需下架"), now(), &audit())
        .await
        .unwrap();
    fixture
        .service
        .change_status(
            &author,
            entry.id,
            ModerationStatus::Published,
            now(),
            &audit(),
        )
        .await
        .unwrap();

    let hidden = fixture
        .service
        .change_status(
            &moderator,
            entry.id,
            ModerationStatus::Hidden,
            now(),
            &audit(),
        )
        .await
        .expect("moderator hides entry");

    assert_eq!(hidden.moderation_status, ModerationStatus::Hidden);
}

#[tokio::test]
async fn an_illegal_transition_is_a_conflict() {
    let fixture = Fixture::new().await;
    let admin = fixture.user("admin", SystemRole::Admin).await;

    let entry = fixture
        .service
        .create_draft(&admin, draft_input("状态机"), now(), &audit())
        .await
        .unwrap();

    // Draft -> Hidden is not in the state machine.
    let result = fixture
        .service
        .change_status(&admin, entry.id, ModerationStatus::Hidden, now(), &audit())
        .await;

    assert!(matches!(result, Err(ApplicationError::Conflict(_))));

    // Republishing an already published entry is a self-transition.
    fixture
        .service
        .change_status(
            &admin,
            entry.id,
            ModerationStatus::Published,
            now(),
            &audit(),
        )
        .await
        .unwrap();
    let repeat = fixture
        .service
        .change_status(
            &admin,
            entry.id,
            ModerationStatus::Published,
            now(),
            &audit(),
        )
        .await;

    assert!(matches!(repeat, Err(ApplicationError::Conflict(_))));
}

#[tokio::test]
async fn updating_a_published_entry_creates_a_revision() {
    let fixture = Fixture::new().await;
    let author = fixture.user("author", SystemRole::Student).await;

    let entry = fixture
        .service
        .create_draft(&author, draft_input("会更新"), now(), &audit())
        .await
        .unwrap();
    fixture
        .service
        .change_status(
            &author,
            entry.id,
            ModerationStatus::Published,
            now(),
            &audit(),
        )
        .await
        .unwrap();

    let updated = fixture
        .service
        .update_entry(
            &author,
            entry.id,
            UpdateArchiveInput {
                title: Some("会更新（2026 版）".to_owned()),
                body: None,
                summary: None,
                tags: None,
                category: None,
                applicable_audience: None,
                source_kind: None,
                source_reference: None,
            },
            now(),
            &audit(),
        )
        .await
        .expect("author updates own published entry");

    assert_eq!(updated.title, "会更新（2026 版）");
    assert_eq!(updated.current_revision, 2);

    let revisions = fixture
        .service
        .list_revisions(Some(&author), entry.id)
        .await
        .expect("list revisions");
    assert_eq!(revisions.len(), 2);
    assert_eq!(revisions[0].revision, 1);
    assert_eq!(revisions[0].title, "会更新");
    assert_eq!(revisions[1].revision, 2);
}

#[tokio::test]
async fn updating_a_draft_does_not_create_a_revision() {
    let fixture = Fixture::new().await;
    let author = fixture.user("author", SystemRole::Student).await;

    let entry = fixture
        .service
        .create_draft(&author, draft_input("草稿"), now(), &audit())
        .await
        .unwrap();

    let updated = fixture
        .service
        .update_entry(
            &author,
            entry.id,
            UpdateArchiveInput {
                title: Some("草稿改名".to_owned()),
                body: None,
                summary: None,
                tags: None,
                category: None,
                applicable_audience: None,
                source_kind: None,
                source_reference: None,
            },
            now(),
            &audit(),
        )
        .await
        .unwrap();

    // A draft has no published history to preserve.
    assert_eq!(updated.current_revision, 1);
    assert_eq!(
        fixture
            .service
            .list_revisions(Some(&author), entry.id)
            .await
            .unwrap()
            .len(),
        1
    );
}

#[tokio::test]
async fn listing_hides_unpublished_entries_from_guests() {
    let fixture = Fixture::new().await;
    let author = fixture.user("author", SystemRole::Student).await;

    let published = fixture
        .service
        .create_draft(&author, draft_input("已发布"), now(), &audit())
        .await
        .unwrap();
    fixture
        .service
        .change_status(
            &author,
            published.id,
            ModerationStatus::Published,
            now(),
            &audit(),
        )
        .await
        .unwrap();
    fixture
        .service
        .create_draft(&author, draft_input("仍是草稿"), now(), &audit())
        .await
        .unwrap();

    let guest_page = fixture
        .service
        .list_entries(None, ListArchiveQuery::default())
        .await
        .unwrap();
    assert_eq!(guest_page.total_items, 1);
    assert_eq!(guest_page.items[0].title, "已发布");

    // The author sees their own draft alongside the published entry.
    let author_page = fixture
        .service
        .list_entries(Some(&author), ListArchiveQuery::default())
        .await
        .unwrap();
    assert_eq!(author_page.total_items, 2);

    // A different student sees only the published entry.
    let stranger = fixture.user("stranger", SystemRole::Student).await;
    let stranger_page = fixture
        .service
        .list_entries(Some(&stranger), ListArchiveQuery::default())
        .await
        .unwrap();
    assert_eq!(stranger_page.total_items, 1);
}

#[tokio::test]
async fn fetching_an_invisible_entry_returns_not_found() {
    let fixture = Fixture::new().await;
    let author = fixture.user("author", SystemRole::Student).await;
    let stranger = fixture.user("stranger", SystemRole::Student).await;

    let entry = fixture
        .service
        .create_draft(&author, draft_input("私有"), now(), &audit())
        .await
        .unwrap();

    assert!(matches!(
        fixture.service.get_entry(None, entry.id).await,
        Err(ApplicationError::NotFound(_))
    ));
    assert!(matches!(
        fixture.service.get_entry(Some(&stranger), entry.id).await,
        Err(ApplicationError::NotFound(_))
    ));
    assert!(fixture
        .service
        .get_entry(Some(&author), entry.id)
        .await
        .is_ok());
}

#[tokio::test]
async fn search_lite_filters_by_query_tag_and_category() {
    let fixture = Fixture::new().await;
    let author = fixture.user("author", SystemRole::Student).await;

    for (title, category) in [
        ("宿舍生活指南", ArchiveCategory::CampusLife),
        ("新生报到流程", ArchiveCategory::Onboarding),
    ] {
        let mut input = draft_input(title);
        input.category = category;
        let entry = fixture
            .service
            .create_draft(&author, input, now(), &audit())
            .await
            .unwrap();
        fixture
            .service
            .change_status(
                &author,
                entry.id,
                ModerationStatus::Published,
                now(),
                &audit(),
            )
            .await
            .unwrap();
    }

    let by_query = fixture
        .service
        .list_entries(
            None,
            ListArchiveQuery {
                q: Some("宿舍".to_owned()),
                ..ListArchiveQuery::default()
            },
        )
        .await
        .unwrap();
    assert_eq!(by_query.total_items, 1);
    assert_eq!(by_query.items[0].title, "宿舍生活指南");

    let by_category = fixture
        .service
        .list_entries(
            None,
            ListArchiveQuery {
                category: Some(ArchiveCategory::Onboarding),
                ..ListArchiveQuery::default()
            },
        )
        .await
        .unwrap();
    assert_eq!(by_category.total_items, 1);
    assert_eq!(by_category.items[0].title, "新生报到流程");

    let by_tag = fixture
        .service
        .list_entries(
            None,
            ListArchiveQuery {
                tag: Some("新生".to_owned()),
                ..ListArchiveQuery::default()
            },
        )
        .await
        .unwrap();
    assert_eq!(by_tag.total_items, 2);
}

#[tokio::test]
async fn pagination_reports_totals_and_rejects_bad_page_size() {
    let fixture = Fixture::new().await;
    let author = fixture.user("author", SystemRole::Student).await;

    for index in 0..3 {
        let entry = fixture
            .service
            .create_draft(
                &author,
                draft_input(&format!("条目{index}")),
                now(),
                &audit(),
            )
            .await
            .unwrap();
        fixture
            .service
            .change_status(
                &author,
                entry.id,
                ModerationStatus::Published,
                now(),
                &audit(),
            )
            .await
            .unwrap();
    }

    let page = fixture
        .service
        .list_entries(
            None,
            ListArchiveQuery {
                page: 2,
                page_size: 2,
                ..ListArchiveQuery::default()
            },
        )
        .await
        .unwrap();

    assert_eq!(page.page, 2);
    assert_eq!(page.page_size, 2);
    assert_eq!(page.total_items, 3);
    assert_eq!(page.total_pages, 2);
    assert_eq!(page.items.len(), 1);

    for bad in [
        ListArchiveQuery {
            page: 0,
            ..ListArchiveQuery::default()
        },
        ListArchiveQuery {
            page_size: 0,
            ..ListArchiveQuery::default()
        },
        ListArchiveQuery {
            page_size: 101,
            ..ListArchiveQuery::default()
        },
    ] {
        assert!(matches!(
            fixture.service.list_entries(None, bad).await,
            Err(ApplicationError::Validation(_))
        ));
    }
}

#[tokio::test]
async fn corrections_require_auth_and_a_stake_to_resolve() {
    let fixture = Fixture::new().await;
    let author = fixture.user("author", SystemRole::Student).await;
    let reporter = fixture.user("reporter", SystemRole::Student).await;

    let entry = fixture
        .service
        .create_draft(&author, draft_input("需要纠错"), now(), &audit())
        .await
        .unwrap();
    fixture
        .service
        .change_status(
            &author,
            entry.id,
            ModerationStatus::Published,
            now(),
            &audit(),
        )
        .await
        .unwrap();

    let correction = fixture
        .service
        .file_correction(
            &reporter,
            entry.id,
            CorrectionInput {
                message: "报名时间已经变了".to_owned(),
            },
            now(),
            &audit(),
        )
        .await
        .expect("any authenticated user may file a correction");

    // The reporter has no stake in the entry, so they cannot close their own
    // report; that stays an explicit maintainer action.
    let reporter_resolve = fixture
        .service
        .resolve_correction(&reporter, entry.id, correction.id, now(), &audit())
        .await;
    assert!(matches!(reporter_resolve, Err(ApplicationError::Forbidden)));

    fixture
        .service
        .resolve_correction(&author, entry.id, correction.id, now(), &audit())
        .await
        .expect("the author may resolve a correction");

    let corrections = fixture
        .service
        .list_corrections(Some(&author), entry.id)
        .await
        .unwrap();
    assert_eq!(corrections.len(), 1);
    assert!(corrections[0].resolved_at.is_some());
    assert_eq!(corrections[0].resolved_by, Some(author.id));
}

#[tokio::test]
async fn corrections_cannot_be_filed_against_an_invisible_entry() {
    let fixture = Fixture::new().await;
    let author = fixture.user("author", SystemRole::Student).await;
    let reporter = fixture.user("reporter", SystemRole::Student).await;

    let draft = fixture
        .service
        .create_draft(&author, draft_input("未发布"), now(), &audit())
        .await
        .unwrap();

    let result = fixture
        .service
        .file_correction(
            &reporter,
            draft.id,
            CorrectionInput {
                message: "看不到也要报".to_owned(),
            },
            now(),
            &audit(),
        )
        .await;

    assert!(matches!(result, Err(ApplicationError::NotFound(_))));
}

#[tokio::test]
async fn archive_writes_record_audit_events() {
    let fixture = Fixture::new().await;
    let author = fixture.user("author", SystemRole::Student).await;

    let entry = fixture
        .service
        .create_draft(&author, draft_input("审计"), now(), &audit())
        .await
        .unwrap();
    fixture
        .service
        .change_status(
            &author,
            entry.id,
            ModerationStatus::Published,
            now(),
            &audit(),
        )
        .await
        .unwrap();

    let events = fixture.store.audit_events_snapshot();
    let actions: Vec<&str> = events.iter().map(|event| event.action.as_str()).collect();

    // Publishing changes what the campus can see, so it is auditable; creating
    // a private draft is not.
    assert!(actions.contains(&"archive.status_changed"));
    for event in &events {
        if event.action == "archive.status_changed" {
            assert_eq!(event.resource_type, "archive_entry");
            assert_eq!(event.actor_id, Some(author.id));
            assert!(event.metadata.to_string().contains("published"));
        }
    }
}

#[tokio::test]
async fn unknown_entry_ids_are_not_found_rather_than_errors() {
    let fixture = Fixture::new().await;
    let author = fixture.user("author", SystemRole::Student).await;
    let missing = campus_agora_domain::PostId::from_uuid(uuid::Uuid::new_v4());

    assert!(matches!(
        fixture.service.get_entry(Some(&author), missing).await,
        Err(ApplicationError::NotFound(_))
    ));
    let _: UserId = author.id;
}

#[tokio::test]
async fn a_correction_cannot_be_resolved_through_an_unrelated_entry() {
    // Authorization is checked against the entry in the path, so a caller who
    // authors any entry must not be able to close a correction that belongs to
    // someone else's — doing so would also disclose the correction's contents
    // for an entry they cannot see.
    let fixture = Fixture::new().await;
    let victim = fixture.user("victim", SystemRole::Student).await;
    let attacker = fixture.user("attacker", SystemRole::Student).await;

    let victim_entry = fixture
        .service
        .create_draft(&victim, draft_input("受害条目"), now(), &audit())
        .await
        .unwrap();
    fixture
        .service
        .change_status(
            &victim,
            victim_entry.id,
            ModerationStatus::Published,
            now(),
            &audit(),
        )
        .await
        .unwrap();

    let correction = fixture
        .service
        .file_correction(
            &attacker,
            victim_entry.id,
            CorrectionInput {
                message: "内容已过期".to_owned(),
            },
            now(),
            &audit(),
        )
        .await
        .unwrap();

    // The attacker authors their own entry, which makes them its Author and so
    // permitted to resolve corrections *on that entry*.
    let attacker_entry = fixture
        .service
        .create_draft(&attacker, draft_input("攻击者条目"), now(), &audit())
        .await
        .unwrap();

    let result = fixture
        .service
        .resolve_correction(&attacker, attacker_entry.id, correction.id, now(), &audit())
        .await;

    assert!(
        matches!(result, Err(ApplicationError::NotFound(_))),
        "resolving a correction through an unrelated entry must not succeed, got: {result:?}"
    );

    let still_open = fixture
        .service
        .list_corrections(Some(&victim), victim_entry.id)
        .await
        .unwrap();
    assert!(
        still_open[0].resolved_at.is_none(),
        "the victim's correction must remain open"
    );
}

#[tokio::test]
async fn editing_a_draft_rewrites_its_revision_rather_than_leaving_the_original() {
    // Revision 1 is written at creation, and revision history is readable by
    // anyone who can see the entry. If a draft edit left revision 1 untouched,
    // text the author removed before publishing would become world-readable
    // the moment they publish.
    let fixture = Fixture::new().await;
    let author = fixture.user("author", SystemRole::Student).await;

    let mut input = draft_input("草稿");
    input.body = "同学电话 13800000000".to_owned();
    let entry = fixture
        .service
        .create_draft(&author, input, now(), &audit())
        .await
        .unwrap();

    fixture
        .service
        .update_entry(
            &author,
            entry.id,
            UpdateArchiveInput {
                body: Some("电话已删除".to_owned()),
                ..UpdateArchiveInput::default()
            },
            now(),
            &audit(),
        )
        .await
        .unwrap();

    fixture
        .service
        .change_status(
            &author,
            entry.id,
            ModerationStatus::Published,
            now(),
            &audit(),
        )
        .await
        .unwrap();

    let revisions = fixture
        .service
        .list_revisions(None, entry.id)
        .await
        .expect("published revisions are readable by guests");

    assert_eq!(revisions.len(), 1);
    assert_eq!(revisions[0].body, "电话已删除");
    assert!(
        !revisions[0].body.contains("13800000000"),
        "a draft edit must not leave the removed text in revision history"
    );
}

#[tokio::test]
async fn correction_listing_is_restricted_to_people_with_a_stake_in_the_entry() {
    // docs/product/privacy.md lists corrections as readable by the entry
    // author, maintainers, moderators, and admins. A correction names its
    // reporter and is inherently accusatory, so a public listing would publish
    // who reported what.
    let fixture = Fixture::new().await;
    let author = fixture.user("author", SystemRole::Student).await;
    let reporter = fixture.user("reporter", SystemRole::Student).await;
    let bystander = fixture.user("bystander", SystemRole::Student).await;
    let moderator = fixture.user("moderator", SystemRole::Moderator).await;

    let entry = fixture
        .service
        .create_draft(&author, draft_input("公开条目"), now(), &audit())
        .await
        .unwrap();
    fixture
        .service
        .change_status(
            &author,
            entry.id,
            ModerationStatus::Published,
            now(),
            &audit(),
        )
        .await
        .unwrap();
    fixture
        .service
        .file_correction(
            &reporter,
            entry.id,
            CorrectionInput {
                message: "流程已变更".to_owned(),
            },
            now(),
            &audit(),
        )
        .await
        .unwrap();

    assert!(
        matches!(
            fixture.service.list_corrections(None, entry.id).await,
            Err(ApplicationError::Unauthorized)
        ),
        "a guest must not read reporter identities"
    );
    assert!(
        matches!(
            fixture
                .service
                .list_corrections(Some(&bystander), entry.id)
                .await,
            Err(ApplicationError::Forbidden)
        ),
        "an unrelated reader must not read reporter identities"
    );

    assert_eq!(
        fixture
            .service
            .list_corrections(Some(&author), entry.id)
            .await
            .unwrap()
            .len(),
        1
    );
    assert_eq!(
        fixture
            .service
            .list_corrections(Some(&moderator), entry.id)
            .await
            .unwrap()
            .len(),
        1
    );
}

#[tokio::test]
async fn editing_a_hidden_entry_is_versioned_and_audited() {
    // An author keeps edit rights while an entry is hidden pending review. If
    // those edits left no revision and no audit event, a moderator could
    // restore an entry that no longer matches what they reviewed.
    let fixture = Fixture::new().await;
    let author = fixture.user("author", SystemRole::Student).await;
    let moderator = fixture.user("moderator", SystemRole::Moderator).await;

    let entry = fixture
        .service
        .create_draft(&author, draft_input("待复核"), now(), &audit())
        .await
        .unwrap();
    fixture
        .service
        .change_status(
            &author,
            entry.id,
            ModerationStatus::Published,
            now(),
            &audit(),
        )
        .await
        .unwrap();
    fixture
        .service
        .change_status(
            &moderator,
            entry.id,
            ModerationStatus::Hidden,
            now(),
            &audit(),
        )
        .await
        .unwrap();

    let updated = fixture
        .service
        .update_entry(
            &author,
            entry.id,
            UpdateArchiveInput {
                body: Some("被隐藏后重写的正文".to_owned()),
                ..UpdateArchiveInput::default()
            },
            now(),
            &audit(),
        )
        .await
        .unwrap();

    assert_eq!(updated.current_revision, 2);

    let revisions = fixture
        .service
        .list_revisions(Some(&moderator), entry.id)
        .await
        .unwrap();
    assert_eq!(revisions.len(), 2);
    assert_eq!(revisions[1].body, "被隐藏后重写的正文");

    let revised: Vec<_> = fixture
        .store
        .audit_events_snapshot()
        .into_iter()
        .filter(|event| event.action == "archive.revised")
        .collect();
    assert_eq!(revised.len(), 1);
    assert!(revised[0].metadata.to_string().contains("hidden"));
}
