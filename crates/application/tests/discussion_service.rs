use std::sync::Arc;

use campus_agora_application::archive::ArchiveService;
use campus_agora_application::auth::{AuditContext, CurrentUser};
use campus_agora_application::discussion::{
    DiscussionService, ListDiscussionQuery, NewDiscussionInput, PromoteInput, ReplyInput,
};
use campus_agora_application::memory::InMemoryAuthStore;
use campus_agora_application::ports::{NewUser, UserRepository};
use campus_agora_application::ApplicationError;
use campus_agora_domain::{AuthProviderKind, CommentId};
use campus_agora_domain::{ModerationStatus, PostId, SystemRole};
use chrono::{TimeZone, Utc};

fn now() -> chrono::DateTime<Utc> {
    Utc.with_ymd_and_hms(2026, 7, 26, 12, 0, 0).unwrap()
}

fn audit() -> AuditContext {
    AuditContext {
        request_id: Some("req-discussion-test".to_owned()),
    }
}

struct Fixture {
    discussions: DiscussionService,
    archive: ArchiveService,
    store: Arc<InMemoryAuthStore>,
}

impl Fixture {
    fn new() -> Self {
        let store = Arc::new(InMemoryAuthStore::default());
        let discussions = DiscussionService::new(
            store.clone(),
            store.clone(),
            store.clone(),
            store.clone(),
            store.clone(),
        );
        let archive =
            ArchiveService::new(store.clone(), store.clone(), store.clone(), store.clone());

        Self {
            discussions,
            archive,
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

    /// A discussion in the state most tests need: visible to everyone and open
    /// to replies.
    async fn published_discussion(&self, author: &CurrentUser, title: &str) -> PostId {
        let discussion = self
            .discussions
            .create(author, discussion_input(title), now(), &audit())
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
            .expect("publish discussion");

        discussion.id
    }

    async fn reply(&self, user: &CurrentUser, id: PostId, body: &str) -> CommentId {
        self.discussions
            .reply(
                user,
                id,
                ReplyInput {
                    body: body.to_owned(),
                },
                now(),
                &audit(),
            )
            .await
            .expect("reply")
            .id
    }
}

fn discussion_input(title: &str) -> NewDiscussionInput {
    NewDiscussionInput {
        title: title.to_owned(),
        body: "有人知道场地申请流程吗？".to_owned(),
        tags: vec!["办事流程".to_owned()],
    }
}

#[tokio::test]
async fn a_new_discussion_starts_as_a_draft() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;

    let discussion = fixture
        .discussions
        .create(&author, discussion_input("场地申请"), now(), &audit())
        .await
        .expect("create");

    assert_eq!(discussion.moderation_status, ModerationStatus::Draft);
    assert_eq!(discussion.author_id, author.id);
    assert_eq!(discussion.accepted_comment_id, None);
    assert_eq!(discussion.reply_count, 0);
}

#[tokio::test]
async fn a_draft_discussion_is_invisible_to_others() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;
    let stranger = fixture.user("stranger", SystemRole::Student).await;

    let discussion = fixture
        .discussions
        .create(&author, discussion_input("草稿"), now(), &audit())
        .await
        .expect("create");

    assert!(matches!(
        fixture
            .discussions
            .get(Some(&stranger), discussion.id)
            .await,
        Err(ApplicationError::NotFound(_))
    ));
    assert!(matches!(
        fixture.discussions.get(None, discussion.id).await,
        Err(ApplicationError::NotFound(_))
    ));
    assert!(fixture
        .discussions
        .get(Some(&author), discussion.id)
        .await
        .is_ok());
}

#[tokio::test]
async fn a_guest_cannot_reply() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;
    let id = fixture.published_discussion(&author, "开放讨论").await;

    assert!(matches!(
        fixture
            .discussions
            .reply_as_guest(
                id,
                ReplyInput {
                    body: "我也想知道".to_owned()
                },
                now(),
                &audit()
            )
            .await,
        Err(ApplicationError::Forbidden)
    ));
}

/// The reply endpoint must not become an existence oracle for drafts.
#[tokio::test]
async fn replying_to_an_invisible_discussion_is_not_found() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;
    let stranger = fixture.user("stranger", SystemRole::Student).await;

    let discussion = fixture
        .discussions
        .create(&author, discussion_input("草稿"), now(), &audit())
        .await
        .expect("create");

    assert!(matches!(
        fixture
            .discussions
            .reply(
                &stranger,
                discussion.id,
                ReplyInput {
                    body: "插一句".to_owned()
                },
                now(),
                &audit()
            )
            .await,
        Err(ApplicationError::NotFound(_))
    ));
}

/// Archiving closes a thread. Its content stays readable, but it stops
/// collecting new replies — otherwise "archived" would mean nothing.
#[tokio::test]
async fn an_archived_discussion_accepts_no_new_replies() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;
    let reader = fixture.user("reader", SystemRole::Student).await;
    let id = fixture.published_discussion(&author, "已沉淀").await;

    fixture
        .discussions
        .change_status(&author, id, ModerationStatus::Archived, now(), &audit())
        .await
        .expect("archive");

    // Still readable by a guest: an archive entry links back here.
    assert!(fixture.discussions.get(None, id).await.is_ok());

    assert!(matches!(
        fixture
            .discussions
            .reply(
                &reader,
                id,
                ReplyInput {
                    body: "补充".to_owned()
                },
                now(),
                &audit()
            )
            .await,
        Err(ApplicationError::Conflict(_))
    ));
}

#[tokio::test]
async fn replies_are_listed_oldest_first_and_counted() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;
    let helper = fixture.user("helper", SystemRole::Student).await;
    let id = fixture.published_discussion(&author, "排序").await;

    let first = fixture.reply(&helper, id, "第一条").await;
    let second = fixture.reply(&helper, id, "第二条").await;

    let replies = fixture
        .discussions
        .list_replies(None, id)
        .await
        .expect("list replies");

    assert_eq!(
        replies.iter().map(|c| c.id).collect::<Vec<_>>(),
        vec![first, second]
    );

    let discussion = fixture.discussions.get(None, id).await.expect("get");
    assert_eq!(discussion.reply_count, 2);
}

#[tokio::test]
async fn replies_of_an_invisible_discussion_are_not_listable() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;
    let discussion = fixture
        .discussions
        .create(&author, discussion_input("草稿"), now(), &audit())
        .await
        .expect("create");

    assert!(matches!(
        fixture.discussions.list_replies(None, discussion.id).await,
        Err(ApplicationError::NotFound(_))
    ));
}

#[tokio::test]
async fn the_asker_accepts_exactly_one_answer_at_a_time() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;
    let helper = fixture.user("helper", SystemRole::Student).await;
    let id = fixture.published_discussion(&author, "接受回答").await;

    let first = fixture.reply(&helper, id, "方案一").await;
    let second = fixture.reply(&helper, id, "方案二").await;

    let accepted = fixture
        .discussions
        .accept_answer(&author, id, Some(first), now(), &audit())
        .await
        .expect("accept first");
    assert_eq!(accepted.accepted_comment_id, Some(first));

    let replaced = fixture
        .discussions
        .accept_answer(&author, id, Some(second), now(), &audit())
        .await
        .expect("accept second");
    assert_eq!(replaced.accepted_comment_id, Some(second));

    let cleared = fixture
        .discussions
        .accept_answer(&author, id, None, now(), &audit())
        .await
        .expect("clear");
    assert_eq!(cleared.accepted_comment_id, None);
}

#[tokio::test]
async fn a_stranger_cannot_accept_an_answer() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;
    let stranger = fixture.user("stranger", SystemRole::Student).await;
    let id = fixture.published_discussion(&author, "接受回答").await;
    let comment = fixture.reply(&stranger, id, "我的回答").await;

    assert!(matches!(
        fixture
            .discussions
            .accept_answer(&stranger, id, Some(comment), now(), &audit())
            .await,
        Err(ApplicationError::Forbidden)
    ));
}

#[tokio::test]
async fn a_moderator_can_accept_an_answer() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;
    let moderator = fixture.user("moderator", SystemRole::Moderator).await;
    let id = fixture.published_discussion(&author, "接受回答").await;
    let comment = fixture.reply(&author, id, "自答").await;

    assert!(fixture
        .discussions
        .accept_answer(&moderator, id, Some(comment), now(), &audit())
        .await
        .is_ok());
}

/// The M2 review found authorization checked against the path resource while
/// the action used an id from the body. This is the same shape, checked up
/// front: a comment id must belong to the discussion in the path.
#[tokio::test]
async fn accepting_a_comment_from_another_discussion_is_not_found() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;
    let other = fixture.user("other", SystemRole::Student).await;

    let mine = fixture.published_discussion(&author, "我的讨论").await;
    let theirs = fixture.published_discussion(&other, "别人的讨论").await;
    let their_comment = fixture.reply(&other, theirs, "别人的回复").await;

    assert!(matches!(
        fixture
            .discussions
            .accept_answer(&author, mine, Some(their_comment), now(), &audit())
            .await,
        Err(ApplicationError::NotFound(_))
    ));

    let untouched = fixture.discussions.get(None, theirs).await.expect("get");
    assert_eq!(untouched.accepted_comment_id, None);
}

#[tokio::test]
async fn promoting_a_reply_creates_a_draft_entry_owned_by_the_promoter() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;
    let helper = fixture.user("helper", SystemRole::Student).await;
    let curator = fixture.user("curator", SystemRole::Student).await;

    let id = fixture.published_discussion(&author, "场地申请流程").await;
    let comment = fixture
        .reply(&helper, id, "先去团委登记，再到场馆办公室盖章。")
        .await;

    let promoted = fixture
        .discussions
        .promote(
            &curator,
            id,
            PromoteInput {
                comment_id: Some(comment),
                title: Some("场地申请流程指南".to_owned()),
                ..PromoteInput::default()
            },
            now(),
            &audit(),
        )
        .await
        .expect("promote");

    assert_eq!(promoted.entry.moderation_status, ModerationStatus::Draft);
    assert_eq!(promoted.entry.author_id, curator.id);
    assert_eq!(promoted.entry.title, "场地申请流程指南");
    assert_eq!(promoted.entry.body, "先去团委登记，再到场馆办公室盖章。");

    // The reply's author keeps their attribution through the source record.
    assert_eq!(promoted.source.source_author_id, helper.id);
    assert_eq!(promoted.source.source_post_id, id);
    assert_eq!(promoted.source.source_comment_id, Some(comment));
}

#[tokio::test]
async fn promoting_leaves_the_source_discussion_untouched() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;
    let curator = fixture.user("curator", SystemRole::Student).await;
    let id = fixture.published_discussion(&author, "原帖").await;
    let comment = fixture.reply(&author, id, "原始回复").await;

    fixture
        .discussions
        .promote(&curator, id, PromoteInput::default(), now(), &audit())
        .await
        .expect("promote");

    let discussion = fixture.discussions.get(None, id).await.expect("get");
    assert_eq!(discussion.moderation_status, ModerationStatus::Published);
    assert_eq!(discussion.title, "原帖");

    let replies = fixture
        .discussions
        .list_replies(None, id)
        .await
        .expect("replies");
    assert_eq!(replies.len(), 1);
    assert_eq!(replies[0].id, comment);
    assert_eq!(replies[0].body, "原始回复");
}

/// A discussion is not consumed by being promoted: two people may sediment
/// two different answers from the same thread.
#[tokio::test]
async fn one_discussion_can_seed_several_entries() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;
    let curator = fixture.user("curator", SystemRole::Student).await;
    let id = fixture.published_discussion(&author, "多次沉淀").await;

    let first = fixture
        .discussions
        .promote(
            &curator,
            id,
            PromoteInput {
                title: Some("第一篇".to_owned()),
                ..PromoteInput::default()
            },
            now(),
            &audit(),
        )
        .await
        .expect("first");
    let second = fixture
        .discussions
        .promote(
            &curator,
            id,
            PromoteInput {
                title: Some("第二篇".to_owned()),
                ..PromoteInput::default()
            },
            now(),
            &audit(),
        )
        .await
        .expect("second");

    assert_ne!(first.entry.id, second.entry.id);

    // Listed to the promoter, who owns both drafts. A guest sees neither
    // until they are published — that rule has its own test below.
    let derived = fixture
        .discussions
        .list_derived_entries(Some(&curator), id)
        .await
        .expect("derived");
    assert_eq!(derived.len(), 2);
}

/// Promotion copies text verbatim into a separately-moderated artifact. If a
/// draft or hidden thread could be promoted, publishing the entry would
/// republish content that was deliberately not public — the same disclosure
/// shape the M2 review found in revision 1.
#[tokio::test]
async fn only_publicly_readable_discussions_can_be_promoted() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;
    let moderator = fixture.user("moderator", SystemRole::Moderator).await;

    let draft = fixture
        .discussions
        .create(&author, discussion_input("私密草稿"), now(), &audit())
        .await
        .expect("create");

    // Even its own author, who can see it, may not promote it.
    assert!(matches!(
        fixture
            .discussions
            .promote(&author, draft.id, PromoteInput::default(), now(), &audit())
            .await,
        Err(ApplicationError::Conflict(_))
    ));

    let hidden = fixture.published_discussion(&author, "将被隐藏").await;
    fixture
        .discussions
        .change_status(
            &moderator,
            hidden,
            ModerationStatus::Hidden,
            now(),
            &audit(),
        )
        .await
        .expect("hide");

    // A moderator can see hidden content but must not launder it into an entry.
    assert!(matches!(
        fixture
            .discussions
            .promote(&moderator, hidden, PromoteInput::default(), now(), &audit())
            .await,
        Err(ApplicationError::Conflict(_))
    ));
}

#[tokio::test]
async fn a_guest_cannot_promote() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;
    let id = fixture.published_discussion(&author, "开放").await;

    assert!(matches!(
        fixture
            .discussions
            .promote_as_guest(id, PromoteInput::default(), now(), &audit())
            .await,
        Err(ApplicationError::Forbidden)
    ));
}

#[tokio::test]
async fn promoting_a_comment_from_another_discussion_is_not_found() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;
    let other = fixture.user("other", SystemRole::Student).await;
    let curator = fixture.user("curator", SystemRole::Student).await;

    let mine = fixture.published_discussion(&author, "我的").await;
    let theirs = fixture.published_discussion(&other, "别人的").await;
    let their_comment = fixture.reply(&other, theirs, "别人的回复").await;

    assert!(matches!(
        fixture
            .discussions
            .promote(
                &curator,
                mine,
                PromoteInput {
                    comment_id: Some(their_comment),
                    ..PromoteInput::default()
                },
                now(),
                &audit()
            )
            .await,
        Err(ApplicationError::NotFound(_))
    ));
}

#[tokio::test]
async fn an_entry_lists_the_discussion_it_came_from() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;
    let curator = fixture.user("curator", SystemRole::Student).await;
    let id = fixture.published_discussion(&author, "来源讨论").await;

    let promoted = fixture
        .discussions
        .promote(&curator, id, PromoteInput::default(), now(), &audit())
        .await
        .expect("promote");

    // The new entry is a draft, so only its owner can read it at all; the
    // source listing inherits the entry's own visibility.
    assert!(matches!(
        fixture.archive.list_sources(None, promoted.entry.id).await,
        Err(ApplicationError::NotFound(_))
    ));

    let sources = fixture
        .archive
        .list_sources(Some(&curator), promoted.entry.id)
        .await
        .expect("sources");

    assert_eq!(sources.len(), 1);
    assert_eq!(sources[0].source_post_id, id);
    assert_eq!(sources[0].source_title, "来源讨论");
}

/// The backlink must not become a way to enumerate drafts: a derived entry
/// that the reader cannot see is not listed on the discussion.
#[tokio::test]
async fn derived_entries_respect_the_readers_visibility() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;
    let curator = fixture.user("curator", SystemRole::Student).await;
    let stranger = fixture.user("stranger", SystemRole::Student).await;
    let id = fixture.published_discussion(&author, "来源").await;

    let promoted = fixture
        .discussions
        .promote(&curator, id, PromoteInput::default(), now(), &audit())
        .await
        .expect("promote");

    assert!(fixture
        .discussions
        .list_derived_entries(Some(&stranger), id)
        .await
        .expect("stranger view")
        .is_empty());
    assert!(fixture
        .discussions
        .list_derived_entries(None, id)
        .await
        .expect("guest view")
        .is_empty());

    // Its own author sees their draft.
    assert_eq!(
        fixture
            .discussions
            .list_derived_entries(Some(&curator), id)
            .await
            .expect("curator view")
            .len(),
        1
    );

    fixture
        .archive
        .change_status(
            &curator,
            promoted.entry.id,
            ModerationStatus::Published,
            now(),
            &audit(),
        )
        .await
        .expect("publish");

    assert_eq!(
        fixture
            .discussions
            .list_derived_entries(None, id)
            .await
            .expect("guest view after publish")
            .len(),
        1
    );
}

/// The mirror of the rule above, on the other direction of the link.
#[tokio::test]
async fn sources_pointing_at_invisible_discussions_are_not_listed() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;
    let curator = fixture.user("curator", SystemRole::Student).await;
    let moderator = fixture.user("moderator", SystemRole::Moderator).await;
    let id = fixture
        .published_discussion(&author, "会被隐藏的来源")
        .await;

    let promoted = fixture
        .discussions
        .promote(&curator, id, PromoteInput::default(), now(), &audit())
        .await
        .expect("promote");

    fixture
        .discussions
        .change_status(&moderator, id, ModerationStatus::Hidden, now(), &audit())
        .await
        .expect("hide source");

    assert!(fixture
        .archive
        .list_sources(Some(&curator), promoted.entry.id)
        .await
        .expect("sources")
        .is_empty());
}

#[tokio::test]
async fn listing_discussions_excludes_drafts_from_strangers() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;
    let stranger = fixture.user("stranger", SystemRole::Student).await;

    fixture.published_discussion(&author, "公开讨论").await;
    fixture
        .discussions
        .create(&author, discussion_input("私密草稿"), now(), &audit())
        .await
        .expect("draft");

    let page = fixture
        .discussions
        .list(Some(&stranger), ListDiscussionQuery::default())
        .await
        .expect("list");

    assert_eq!(page.total_items, 1);
    assert_eq!(page.items[0].title, "公开讨论");
}

#[tokio::test]
async fn promotion_and_acceptance_are_audited() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;
    let curator = fixture.user("curator", SystemRole::Student).await;
    let id = fixture.published_discussion(&author, "审计").await;
    let comment = fixture.reply(&author, id, "回复").await;

    fixture
        .discussions
        .accept_answer(&author, id, Some(comment), now(), &audit())
        .await
        .expect("accept");
    fixture
        .discussions
        .promote(&curator, id, PromoteInput::default(), now(), &audit())
        .await
        .expect("promote");

    let actions: Vec<String> = fixture
        .store
        .audit_events_snapshot()
        .into_iter()
        .map(|event| event.action)
        .collect();

    assert!(actions.iter().any(|a| a == "discussion.answer_accepted"));
    assert!(actions.iter().any(|a| a == "discussion.promoted"));
}

#[tokio::test]
async fn reply_bodies_are_validated() {
    let fixture = Fixture::new();
    let author = fixture.user("author", SystemRole::Student).await;
    let id = fixture.published_discussion(&author, "校验").await;

    assert!(matches!(
        fixture
            .discussions
            .reply(
                &author,
                id,
                ReplyInput {
                    body: "   ".to_owned()
                },
                now(),
                &audit()
            )
            .await,
        Err(ApplicationError::Validation(_))
    ));

    let too_long = "x".repeat(campus_agora_domain::archive::COMMENT_BODY_MAX_CHARS + 1);
    assert!(matches!(
        fixture
            .discussions
            .reply(&author, id, ReplyInput { body: too_long }, now(), &audit())
            .await,
        Err(ApplicationError::Validation(_))
    ));
}
