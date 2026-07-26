use std::sync::Arc;

use campus_agora_application::archive::{ArchiveService, NewArchiveEntryInput};
use campus_agora_application::auth::{AuditContext, CurrentUser};
use campus_agora_application::discussion::{DiscussionService, NewDiscussionInput};
use campus_agora_application::memory::InMemoryAuthStore;
use campus_agora_application::moderation::{ModerationService, ReportInput};
use campus_agora_application::ports::{NewUser, ReportResolution, UserRepository};
use campus_agora_application::ApplicationError;
use campus_agora_domain::{
    ApplicableAudience, ArchiveCategory, AuthProviderKind, ModerationStatus, PostId,
    ReportCategory, RiskLevel, SourceKind, SystemRole,
};
use chrono::{Duration, TimeZone, Utc};

fn now() -> chrono::DateTime<Utc> {
    Utc.with_ymd_and_hms(2026, 7, 27, 12, 0, 0).unwrap()
}

fn audit() -> AuditContext {
    AuditContext {
        request_id: Some("req-moderation-test".to_owned()),
    }
}

struct Fixture {
    moderation: ModerationService,
    archive: ArchiveService,
    discussions: DiscussionService,
    store: Arc<InMemoryAuthStore>,
}

impl Fixture {
    fn new() -> Self {
        let store = Arc::new(InMemoryAuthStore::default());

        Self {
            moderation: ModerationService::new(store.clone(), store.clone(), store.clone()),
            archive: ArchiveService::new(
                store.clone(),
                store.clone(),
                store.clone(),
                store.clone(),
            ),
            discussions: DiscussionService::new(
                store.clone(),
                store.clone(),
                store.clone(),
                store.clone(),
                store.clone(),
            ),
            store,
        }
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

    /// A published archive entry, the shape most reports target.
    async fn published_entry(&self, author: &CurrentUser, title: &str) -> PostId {
        let entry = self
            .archive
            .create_draft(
                author,
                NewArchiveEntryInput {
                    title: title.to_owned(),
                    body: "正文内容".to_owned(),
                    summary: None,
                    tags: Vec::new(),
                    category: ArchiveCategory::Other,
                    applicable_audience: ApplicableAudience::AllStudents,
                    source_kind: SourceKind::Unspecified,
                    source_reference: None,
                },
                now(),
                &audit(),
            )
            .await
            .expect("create draft");

        self.archive
            .change_status(
                author,
                entry.id,
                ModerationStatus::Published,
                now(),
                &audit(),
            )
            .await
            .expect("publish");

        entry.id
    }

    async fn published_discussion(&self, author: &CurrentUser, title: &str) -> PostId {
        let discussion = self
            .discussions
            .create(
                author,
                NewDiscussionInput {
                    title: title.to_owned(),
                    body: "讨论正文".to_owned(),
                    tags: Vec::new(),
                },
                now(),
                &audit(),
            )
            .await
            .expect("create discussion");

        self.discussions
            .change_status(
                author,
                discussion.id,
                ModerationStatus::Published,
                now(),
                &audit(),
            )
            .await
            .expect("publish");

        discussion.id
    }
}

fn report(category: ReportCategory, message: &str) -> ReportInput {
    ReportInput {
        category,
        message: message.to_owned(),
    }
}

#[tokio::test]
async fn a_guest_cannot_report() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;
    let id = fixture.published_entry(&author, "公开资料").await;

    assert!(matches!(
        fixture
            .moderation
            .report_as_guest(id, report(ReportCategory::Spam, "广告"), now(), &audit())
            .await,
        Err(ApplicationError::Forbidden)
    ));
}

/// The report endpoint must not become an existence oracle for drafts.
#[tokio::test]
async fn reporting_invisible_content_is_not_found() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;
    let stranger = fixture.user("stranger", SystemRole::Student).await;

    let draft = fixture
        .archive
        .create_draft(
            &author,
            NewArchiveEntryInput {
                title: "私密草稿".to_owned(),
                body: "正文".to_owned(),
                summary: None,
                tags: Vec::new(),
                category: ArchiveCategory::Other,
                applicable_audience: ApplicableAudience::AllStudents,
                source_kind: SourceKind::Unspecified,
                source_reference: None,
            },
            now(),
            &audit(),
        )
        .await
        .expect("draft");

    assert!(matches!(
        fixture
            .moderation
            .report(
                &stranger,
                draft.id,
                report(ReportCategory::Spam, "广告"),
                now(),
                &audit()
            )
            .await,
        Err(ApplicationError::NotFound(_))
    ));
}

/// Content is content: a report works the same on a discussion as on an entry.
#[tokio::test]
async fn either_kind_of_content_can_be_reported() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;
    let reporter = fixture.user("reporter", SystemRole::Student).await;

    let entry = fixture.published_entry(&author, "资料").await;
    let discussion = fixture.published_discussion(&author, "讨论").await;

    for id in [entry, discussion] {
        assert!(fixture
            .moderation
            .report(
                &reporter,
                id,
                report(ReportCategory::Spam, "疑似广告"),
                now(),
                &audit()
            )
            .await
            .is_ok());
    }
}

/// A report button must not double as a way to flood the queue.
#[tokio::test]
async fn one_open_report_per_reporter_and_post() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;
    let reporter = fixture.user("reporter", SystemRole::Student).await;
    let other = fixture.user("other", SystemRole::Student).await;
    let id = fixture.published_entry(&author, "被举报的资料").await;

    assert!(fixture
        .moderation
        .report(
            &reporter,
            id,
            report(ReportCategory::Spam, "第一次"),
            now(),
            &audit()
        )
        .await
        .is_ok());

    assert!(matches!(
        fixture
            .moderation
            .report(
                &reporter,
                id,
                report(ReportCategory::Harassment, "第二次"),
                now(),
                &audit()
            )
            .await,
        Err(ApplicationError::Conflict(_))
    ));

    // A different person reporting the same content is not a duplicate.
    assert!(fixture
        .moderation
        .report(
            &other,
            id,
            report(ReportCategory::Harassment, "我也看到了"),
            now(),
            &audit()
        )
        .await
        .is_ok());
}

/// Reporting must not be a takedown button. If a report pulled content out of
/// view, any single authenticated student could hide the entire archive one
/// report at a time — and each hidden item would then be invisible to everyone
/// else who might corroborate or dispute it. The report queues the content; a
/// moderator decides what happens to it.
#[tokio::test]
async fn reporting_does_not_take_content_down() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;
    let reporter = fixture.user("reporter", SystemRole::Student).await;
    let moderator = fixture.user("moderator", SystemRole::Moderator).await;
    let id = fixture.published_entry(&author, "会被举报的资料").await;

    fixture
        .moderation
        .report(
            &reporter,
            id,
            report(ReportCategory::PrivacyViolation, "泄露了手机号"),
            now(),
            &audit(),
        )
        .await
        .expect("report");

    let entry = fixture
        .archive
        .get_entry(None, id)
        .await
        .expect("still readable by the campus");
    assert_eq!(entry.moderation_status, ModerationStatus::Published);

    // It is queued for a decision, and the decision is a separate act.
    let page = fixture
        .moderation
        .queue(&moderator, 1, 20)
        .await
        .expect("queue");
    assert_eq!(page.items[0].post_id, id);
    assert_eq!(page.items[0].moderation_status, ModerationStatus::Published);
}

/// The corollary: a second person must still be able to report the same
/// content. If the first report hid it, nobody else could reach it.
#[tokio::test]
async fn reported_content_stays_reachable_for_other_reporters() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;
    let first = fixture.user("first", SystemRole::Student).await;
    let second = fixture.user("second", SystemRole::Student).await;
    let moderator = fixture.user("moderator", SystemRole::Moderator).await;
    let id = fixture.published_entry(&author, "多人举报的资料").await;

    fixture
        .moderation
        .report(
            &first,
            id,
            report(ReportCategory::Spam, "像广告"),
            now(),
            &audit(),
        )
        .await
        .expect("first report");
    fixture
        .moderation
        .report(
            &second,
            id,
            report(ReportCategory::Illegal, "还涉及违法内容"),
            now(),
            &audit(),
        )
        .await
        .expect("second report");

    let page = fixture
        .moderation
        .queue(&moderator, 1, 20)
        .await
        .expect("queue");
    assert_eq!(page.items[0].open_report_count, 2);
    // Corroboration raises the risk, which is the point of allowing it.
    assert_eq!(page.items[0].risk, RiskLevel::High);
}

#[tokio::test]
async fn the_queue_is_moderator_only() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;
    let reporter = fixture.user("reporter", SystemRole::Student).await;
    let moderator = fixture.user("moderator", SystemRole::Moderator).await;
    let id = fixture.published_entry(&author, "队列里的资料").await;

    fixture
        .moderation
        .report(
            &reporter,
            id,
            report(ReportCategory::Spam, "广告"),
            now(),
            &audit(),
        )
        .await
        .expect("report");

    for viewer in [&author, &reporter] {
        assert!(matches!(
            fixture.moderation.queue(viewer, 1, 20).await,
            Err(ApplicationError::Forbidden)
        ));
    }

    let page = fixture
        .moderation
        .queue(&moderator, 1, 20)
        .await
        .expect("moderator sees the queue");
    assert_eq!(page.total_items, 1);
    assert_eq!(page.items[0].post_id, id);
    assert_eq!(page.items[0].open_report_count, 1);
    assert_eq!(page.items[0].risk, RiskLevel::Low);
}

/// The queue exists so the worst thing is looked at first.
#[tokio::test]
async fn the_queue_orders_by_risk_then_by_age() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;
    let reporter = fixture.user("reporter", SystemRole::Student).await;
    let moderator = fixture.user("moderator", SystemRole::Moderator).await;

    let low = fixture.published_entry(&author, "低风险").await;
    let high = fixture.published_entry(&author, "高风险").await;

    fixture
        .moderation
        .report(
            &reporter,
            low,
            report(ReportCategory::Spam, "广告"),
            now(),
            &audit(),
        )
        .await
        .expect("low report");
    fixture
        .moderation
        .report(
            &reporter,
            high,
            report(ReportCategory::Illegal, "违法内容"),
            now() + Duration::minutes(5),
            &audit(),
        )
        .await
        .expect("high report");

    let page = fixture
        .moderation
        .queue(&moderator, 1, 20)
        .await
        .expect("queue");

    // The newer high-risk item outranks the older low-risk one.
    assert_eq!(page.items[0].post_id, high);
    assert_eq!(page.items[0].risk, RiskLevel::High);
    assert_eq!(page.items[1].post_id, low);
}

/// Reporter identities are restricted for the same reason correction reporters
/// are: a report is accusatory, and may be about the content's own author.
#[tokio::test]
async fn only_a_moderator_can_read_the_reports_on_an_item() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;
    let reporter = fixture.user("reporter", SystemRole::Student).await;
    let moderator = fixture.user("moderator", SystemRole::Moderator).await;
    let id = fixture.published_entry(&author, "资料").await;

    fixture
        .moderation
        .report(
            &reporter,
            id,
            report(ReportCategory::Harassment, "人身攻击"),
            now(),
            &audit(),
        )
        .await
        .expect("report");

    // Not even the content's author, who is the person a report may be about.
    assert!(matches!(
        fixture.moderation.list_reports(&author, id).await,
        Err(ApplicationError::Forbidden)
    ));

    let reports = fixture
        .moderation
        .list_reports(&moderator, id)
        .await
        .expect("moderator reads them");
    assert_eq!(reports.len(), 1);
    assert_eq!(reports[0].reporter_id, reporter.id);
}

/// The M2 IDOR shape: authorization is against the item in the path, so the
/// report id must belong to it.
#[tokio::test]
async fn a_report_cannot_be_resolved_through_an_unrelated_item() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;
    let reporter = fixture.user("reporter", SystemRole::Student).await;
    let moderator = fixture.user("moderator", SystemRole::Moderator).await;

    let reported = fixture.published_entry(&author, "被举报的").await;
    let unrelated = fixture.published_entry(&author, "无关的").await;

    let filed = fixture
        .moderation
        .report(
            &reporter,
            reported,
            report(ReportCategory::Spam, "广告"),
            now(),
            &audit(),
        )
        .await
        .expect("report");

    assert!(matches!(
        fixture
            .moderation
            .resolve_report(
                &moderator,
                unrelated,
                filed.id,
                ReportResolution::Dismissed,
                now(),
                &audit()
            )
            .await,
        Err(ApplicationError::NotFound(_))
    ));
}

/// A dismissal leaves the content exactly where it was, because a report never
/// moved it in the first place.
#[tokio::test]
async fn dismissing_a_report_clears_it_from_the_queue() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;
    let reporter = fixture.user("reporter", SystemRole::Student).await;
    let moderator = fixture.user("moderator", SystemRole::Moderator).await;
    let id = fixture.published_entry(&author, "误报的资料").await;

    let filed = fixture
        .moderation
        .report(
            &reporter,
            id,
            report(ReportCategory::Spam, "我看错了"),
            now(),
            &audit(),
        )
        .await
        .expect("report");

    fixture
        .moderation
        .resolve_report(
            &moderator,
            id,
            filed.id,
            ReportResolution::Dismissed,
            now(),
            &audit(),
        )
        .await
        .expect("dismiss");

    let entry = fixture
        .archive
        .get_entry(None, id)
        .await
        .expect("never left");
    assert_eq!(entry.moderation_status, ModerationStatus::Published);
    assert!(fixture
        .moderation
        .queue(&moderator, 1, 20)
        .await
        .unwrap()
        .items
        .is_empty());
}

/// Resolving is a finding, not a state change: the content's status is only
/// ever changed by an explicit moderation transition, so there is exactly one
/// path by which what the campus sees can change, and it is always deliberate
/// and separately audited.
#[tokio::test]
async fn resolving_a_report_leaves_the_decision_to_the_moderator_and_audits_both() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;
    let reporter = fixture.user("reporter", SystemRole::Student).await;
    let moderator = fixture.user("moderator", SystemRole::Moderator).await;
    let id = fixture.published_entry(&author, "确有问题的资料").await;

    let filed = fixture
        .moderation
        .report(
            &reporter,
            id,
            report(ReportCategory::PrivacyViolation, "泄露手机号"),
            now(),
            &audit(),
        )
        .await
        .expect("report");

    fixture
        .moderation
        .resolve_report(
            &moderator,
            id,
            filed.id,
            ReportResolution::Upheld,
            now(),
            &audit(),
        )
        .await
        .expect("uphold");

    let entry = fixture
        .archive
        .get_entry(Some(&moderator), id)
        .await
        .expect("still visible to moderation");
    assert_eq!(entry.moderation_status, ModerationStatus::Published);

    // Taking it down is a separate, explicit act.
    fixture
        .archive
        .change_status(&moderator, id, ModerationStatus::Hidden, now(), &audit())
        .await
        .expect("moderator hides it");

    let actions: Vec<String> = fixture
        .store
        .audit_events_snapshot()
        .into_iter()
        .map(|event| event.action)
        .collect();
    assert!(actions.iter().any(|a| a == "moderation.reported"));
    assert!(actions.iter().any(|a| a == "moderation.report_resolved"));
}

#[tokio::test]
async fn an_author_can_submit_their_own_draft_for_review() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;
    let moderator = fixture.user("moderator", SystemRole::Moderator).await;

    let draft = fixture
        .archive
        .create_draft(
            &author,
            NewArchiveEntryInput {
                title: "拿不准的资料".to_owned(),
                body: "正文".to_owned(),
                summary: None,
                tags: Vec::new(),
                category: ArchiveCategory::Other,
                applicable_audience: ApplicableAudience::AllStudents,
                source_kind: SourceKind::Unspecified,
                source_reference: None,
            },
            now(),
            &audit(),
        )
        .await
        .expect("draft");

    let submitted = fixture
        .archive
        .change_status(
            &author,
            draft.id,
            ModerationStatus::PendingReview,
            now(),
            &audit(),
        )
        .await
        .expect("submit for review");
    assert_eq!(submitted.moderation_status, ModerationStatus::PendingReview);

    // It reaches the queue with no report behind it, at no risk.
    let page = fixture
        .moderation
        .queue(&moderator, 1, 20)
        .await
        .expect("queue");
    assert_eq!(page.total_items, 1);
    assert_eq!(page.items[0].post_id, draft.id);
    assert_eq!(page.items[0].open_report_count, 0);
    assert_eq!(page.items[0].risk, RiskLevel::None);
}

#[tokio::test]
async fn report_messages_are_validated() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;
    let reporter = fixture.user("reporter", SystemRole::Student).await;
    let id = fixture.published_entry(&author, "资料").await;

    assert!(matches!(
        fixture
            .moderation
            .report(
                &reporter,
                id,
                report(ReportCategory::Spam, "   "),
                now(),
                &audit()
            )
            .await,
        Err(ApplicationError::Validation(_))
    ));

    let too_long = "x".repeat(campus_agora_domain::REPORT_MESSAGE_MAX_CHARS + 1);
    assert!(matches!(
        fixture
            .moderation
            .report(
                &reporter,
                id,
                report(ReportCategory::Spam, &too_long),
                now(),
                &audit()
            )
            .await,
        Err(ApplicationError::Validation(_))
    ));
}
