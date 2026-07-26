use std::sync::Arc;

use campus_agora_application::ai::{AiDraftConfig, AiDraftService, DeterministicDraftProvider};
use campus_agora_application::auth::{AuditContext, CurrentUser};
use campus_agora_application::discussion::{DiscussionService, NewDiscussionInput, ReplyInput};
use campus_agora_application::memory::InMemoryAuthStore;
use campus_agora_application::ports::{
    ArchiveSourceRepository, NewUser, UserRepository, VisibilityScope,
};
use campus_agora_application::ApplicationError;
use campus_agora_domain::{AuthProviderKind, CommentId, ModerationStatus, PostId, SystemRole};
use chrono::{TimeZone, Utc};

fn now() -> chrono::DateTime<Utc> {
    Utc.with_ymd_and_hms(2026, 7, 27, 12, 0, 0).unwrap()
}

fn audit() -> AuditContext {
    AuditContext {
        request_id: Some("req-ai-test".to_owned()),
    }
}

struct Fixture {
    ai: AiDraftService,
    discussions: DiscussionService,
    store: Arc<InMemoryAuthStore>,
}

impl Fixture {
    fn with_ai_enabled(enabled: bool) -> Self {
        let store = Arc::new(InMemoryAuthStore::default());

        Self {
            ai: AiDraftService::new(
                store.clone(),
                store.clone(),
                store.clone(),
                store.clone(),
                store.clone(),
                Arc::new(DeterministicDraftProvider),
                AiDraftConfig { enabled },
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

    fn new() -> Self {
        Self::with_ai_enabled(true)
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

    async fn thread(&self, author: &CurrentUser, helper: &CurrentUser) -> (PostId, CommentId) {
        let discussion = self
            .discussions
            .create(
                author,
                NewDiscussionInput {
                    title: "场地申请流程".to_owned(),
                    body: "有人知道场地申请怎么走吗？".to_owned(),
                    tags: vec!["办事流程".to_owned()],
                },
                now(),
                &audit(),
            )
            .await
            .expect("create");

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

        self.discussions
            .reply(
                helper,
                discussion.id,
                ReplyInput {
                    body: "先去团委登记。".to_owned(),
                },
                now(),
                &audit(),
            )
            .await
            .expect("first reply");

        let best = self
            .discussions
            .reply(
                helper,
                discussion.id,
                ReplyInput {
                    body: "完整流程：团委登记，场馆办公室盖章，提前三天提交。".to_owned(),
                },
                now(),
                &audit(),
            )
            .await
            .expect("second reply");

        (discussion.id, best.id)
    }
}

#[tokio::test]
async fn the_provider_is_deterministic() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;
    let helper = fixture.user("helper", SystemRole::Student).await;
    let (id, _) = fixture.thread(&author, &helper).await;

    let first = fixture
        .ai
        .draft_from_discussion(&author, id, now(), &audit())
        .await
        .expect("first draft");
    let second = fixture
        .ai
        .draft_from_discussion(&author, id, now(), &audit())
        .await
        .expect("second draft");

    assert_eq!(first.entry.title, second.entry.title);
    assert_eq!(first.entry.body, second.entry.body);
    assert_eq!(first.entry.summary, second.entry.summary);
    // Two separate drafts, though: drafting twice must not overwrite the first.
    assert_ne!(first.entry.id, second.entry.id);
}

/// The exit criterion. The provider is handed text and returns text; it holds
/// no repository, so there is no code path by which it could publish. What it
/// produces is an ordinary draft owned by the human who asked for it.
#[tokio::test]
async fn ai_output_is_a_draft_owned_by_the_requester() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;
    let helper = fixture.user("helper", SystemRole::Student).await;
    let curator = fixture
        .user("curator", SystemRole::OrganizationMember)
        .await;
    let (id, _) = fixture.thread(&author, &helper).await;

    let drafted = fixture
        .ai
        .draft_from_discussion(&curator, id, now(), &audit())
        .await
        .expect("draft");

    assert_eq!(drafted.entry.moderation_status, ModerationStatus::Draft);
    assert_eq!(drafted.entry.author_id, curator.id);
}

/// Source-backed: every reply the provider drew from is recorded, with the
/// person who actually wrote it, so a reader can check the draft against what
/// was really said.
#[tokio::test]
async fn every_source_the_draft_used_is_recorded_with_its_author() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;
    let helper = fixture.user("helper", SystemRole::Student).await;
    let (id, _) = fixture.thread(&author, &helper).await;

    let drafted = fixture
        .ai
        .draft_from_discussion(&author, id, now(), &audit())
        .await
        .expect("draft");

    let sources = fixture
        .store
        .list_for_entry(drafted.entry.id, VisibilityScope::Full)
        .await
        .expect("sources");

    // The opening post plus both replies.
    assert_eq!(sources.len(), 3);
    assert!(sources.iter().all(|source| source.source_post_id == id));
    // The opening post is attributed to the asker, the replies to the helper.
    assert!(sources
        .iter()
        .any(|source| source.source_comment_id.is_none() && source.source_author_id == author.id));
    assert_eq!(
        sources
            .iter()
            .filter(|source| source.source_author_id == helper.id)
            .count(),
        2
    );
}

/// The accepted answer is the community's own judgement about which reply was
/// useful, so a draft that ignores it would be worse than one that starts there.
#[tokio::test]
async fn an_accepted_answer_leads_the_draft() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;
    let helper = fixture.user("helper", SystemRole::Student).await;
    let (id, best) = fixture.thread(&author, &helper).await;

    let without = fixture
        .ai
        .draft_from_discussion(&author, id, now(), &audit())
        .await
        .expect("draft without an accepted answer");

    fixture
        .discussions
        .accept_answer(&author, id, Some(best), now(), &audit())
        .await
        .expect("accept");

    let with = fixture
        .ai
        .draft_from_discussion(&author, id, now(), &audit())
        .await
        .expect("draft with an accepted answer");

    assert_ne!(without.entry.body, with.entry.body);
    // The accepted reply's text opens the composed body.
    let accepted_text = "完整流程：团委登记，场馆办公室盖章，提前三天提交。";
    assert!(with.entry.body.starts_with(accepted_text));
}

/// The same rule M3 established for hand promotion: drafting copies text into
/// an artifact moderated separately, so the source has to be public. Being
/// able to see a draft or hidden thread is not enough.
#[tokio::test]
async fn only_a_publicly_readable_discussion_can_be_drafted_from() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;

    let draft = fixture
        .discussions
        .create(
            &author,
            NewDiscussionInput {
                title: "私密草稿".to_owned(),
                body: "还没想好".to_owned(),
                tags: Vec::new(),
            },
            now(),
            &audit(),
        )
        .await
        .expect("create");

    assert!(matches!(
        fixture
            .ai
            .draft_from_discussion(&author, draft.id, now(), &audit())
            .await,
        Err(ApplicationError::Conflict(_))
    ));
}

#[tokio::test]
async fn drafting_is_refused_when_the_capability_is_off() {
    let fixture = Fixture::with_ai_enabled(false);
    let author = fixture.user("author", SystemRole::Student).await;
    let helper = fixture.user("helper", SystemRole::Student).await;
    let (id, _) = fixture.thread(&author, &helper).await;

    assert!(matches!(
        fixture
            .ai
            .draft_from_discussion(&author, id, now(), &audit())
            .await,
        Err(ApplicationError::Forbidden)
    ));
}

#[tokio::test]
async fn a_guest_cannot_request_a_draft() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;
    let helper = fixture.user("helper", SystemRole::Student).await;
    let (id, _) = fixture.thread(&author, &helper).await;

    assert!(matches!(
        fixture
            .ai
            .draft_from_discussion_as_guest(id, now(), &audit())
            .await,
        Err(ApplicationError::Forbidden)
    ));
}

/// Traceable: an entry has to say it was AI-assisted and by what, or a reader
/// cannot tell composed text from written text.
#[tokio::test]
async fn the_entry_records_which_provider_produced_it() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;
    let helper = fixture.user("helper", SystemRole::Student).await;
    let (id, _) = fixture.thread(&author, &helper).await;

    let drafted = fixture
        .ai
        .draft_from_discussion(&author, id, now(), &audit())
        .await
        .expect("draft");

    assert_eq!(
        drafted.entry.ai_provider.as_deref(),
        Some("deterministic-v1")
    );

    // A hand-written entry stays unmarked, so the marker means something.
    let hand_written = fixture
        .discussions
        .promote(
            &author,
            id,
            campus_agora_application::discussion::PromoteInput::default(),
            now(),
            &audit(),
        )
        .await
        .expect("hand promotion");
    assert_eq!(hand_written.entry.ai_provider, None);
}

#[tokio::test]
async fn requesting_a_draft_is_audited() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;
    let helper = fixture.user("helper", SystemRole::Student).await;
    let (id, _) = fixture.thread(&author, &helper).await;

    fixture
        .ai
        .draft_from_discussion(&author, id, now(), &audit())
        .await
        .expect("draft");

    let events = fixture.store.audit_events_snapshot();
    let drafted = events
        .iter()
        .find(|event| event.action == "ai.draft_generated")
        .expect("an AI draft request is audited");

    assert_eq!(drafted.actor_id, Some(author.id));
    assert_eq!(drafted.metadata["provider"], "deterministic-v1");
    assert_eq!(drafted.metadata["sourceCount"], 3);
}
