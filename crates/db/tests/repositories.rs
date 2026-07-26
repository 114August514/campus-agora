use std::path::Path;
use std::sync::Arc;

use campus_agora_application::ports::{
    ArchiveEntryUpdate, ArchiveListQuery, ArchiveRepository, ArchiveSourceRepository,
    AuditEventRepository, CommentRepository, CorrectionRepository, DiscussionRepository,
    NewArchiveEntry, NewArchiveSource, NewAuditEvent, NewComment, NewCorrection, NewDiscussion,
    NewRevision, NewSession, NewUser, OrganizationRepository, RevisionWrite, SessionRepository,
    UserRepository, VisibilityScope,
};
use campus_agora_application::ApplicationError;
use campus_agora_db::{PgAuthStore, MIGRATIONS_DIR};
use campus_agora_domain::{
    ApplicableAudience, ArchiveCategory, AuthProviderKind, ModerationStatus, SourceKind, SystemRole,
};
use chrono::{Duration, Utc};
use uuid::Uuid;

/// Runs only when DATABASE_URL points at a disposable PostgreSQL instance.
/// CI provides one; locally use the dockerized PostgreSQL 16 from the docs.
#[tokio::test]
async fn pg_repositories_cover_the_m1_identity_lifecycle() {
    let Ok(database_url) = std::env::var("DATABASE_URL") else {
        eprintln!("skipping pg repository test: DATABASE_URL is not set");
        return;
    };

    let pool = sqlx::postgres::PgPoolOptions::new()
        .max_connections(2)
        .connect(&database_url)
        .await
        .expect("connect to test database");

    let migrations = Path::new(env!("CARGO_MANIFEST_DIR")).join(MIGRATIONS_DIR);
    sqlx::migrate::Migrator::new(migrations)
        .await
        .expect("load migrations")
        .run(&pool)
        .await
        .expect("run migrations");

    let store = Arc::new(PgAuthStore::new(pool.clone()));
    let unique = Uuid::new_v4().simple().to_string();
    let now = Utc::now();

    // Users upsert by provider subject and stay stable across logins.
    let subject_hash = format!("test-subject-{unique}");
    let first = store
        .upsert(NewUser {
            auth_provider: AuthProviderKind::MockCampus,
            provider_subject_hash: subject_hash.clone(),
            display_name: "测试用户".to_owned(),
            system_role: SystemRole::Student,
        })
        .await
        .expect("insert user");
    let second = store
        .upsert(NewUser {
            auth_provider: AuthProviderKind::MockCampus,
            provider_subject_hash: subject_hash.clone(),
            display_name: "测试用户改名".to_owned(),
            system_role: SystemRole::Student,
        })
        .await
        .expect("upsert user again");

    assert_eq!(first.id, second.id);
    assert_eq!(second.display_name, "测试用户改名");

    let loaded = store
        .find_by_id(first.id)
        .await
        .expect("load user")
        .expect("user exists");
    assert_eq!(loaded.system_role, SystemRole::Student);
    assert_eq!(loaded.auth_provider, AuthProviderKind::MockCampus);

    // Logging in must not reset a locally managed role. The permission matrix
    // gives Admin a `Change roles` action, so once M4/M6 assigns roles the
    // provider must not silently undo them on the user's next login.
    sqlx::query("update users set system_role = 'moderator' where id = $1")
        .bind(first.id.into_uuid())
        .execute(&pool)
        .await
        .expect("promote user");

    let after_relogin = store
        .upsert(NewUser {
            auth_provider: AuthProviderKind::MockCampus,
            provider_subject_hash: subject_hash.clone(),
            display_name: "测试用户改名".to_owned(),
            system_role: SystemRole::Student,
        })
        .await
        .expect("upsert after promotion");
    assert_eq!(after_relogin.system_role, SystemRole::Moderator);

    // A soft-deleted account must not be able to log back in. `find_by_id`
    // already filters on `deleted_at`, so allowing the upsert through would
    // hand out a token whose every later request fails with 401.
    let deleted_subject = format!("test-deleted-{unique}");
    let deleted = store
        .upsert(NewUser {
            auth_provider: AuthProviderKind::MockCampus,
            provider_subject_hash: deleted_subject.clone(),
            display_name: "待删除用户".to_owned(),
            system_role: SystemRole::Student,
        })
        .await
        .expect("insert user to soft delete");
    sqlx::query("update users set deleted_at = now() where id = $1")
        .bind(deleted.id.into_uuid())
        .execute(&pool)
        .await
        .expect("soft delete user");

    let relogin_attempt = store
        .upsert(NewUser {
            auth_provider: AuthProviderKind::MockCampus,
            provider_subject_hash: deleted_subject,
            display_name: "待删除用户".to_owned(),
            system_role: SystemRole::Student,
        })
        .await;
    assert!(
        matches!(relogin_attempt, Err(ApplicationError::Forbidden)),
        "soft-deleted users must not be able to log in, got: {relogin_attempt:?}"
    );

    // Sessions store hashes with expiry and revocation.
    let token_hash = format!("test-token-hash-{unique}");
    // Qualified because ArchiveRepository and CorrectionRepository also
    // define `insert` for this store.
    let session = SessionRepository::insert(
        store.as_ref(),
        NewSession {
            user_id: first.id,
            token_hash: token_hash.clone(),
            created_at: now,
            expires_at: now + Duration::hours(24),
        },
    )
    .await
    .expect("insert session");

    let found = store
        .find_by_token_hash(&token_hash)
        .await
        .expect("find session")
        .expect("session exists");
    assert_eq!(found.id, session.id);
    assert_eq!(found.user_id, first.id);
    assert!(found.revoked_at.is_none());

    store
        .revoke(session.id, now + Duration::minutes(1))
        .await
        .expect("revoke session");

    let revoked = store
        .find_by_token_hash(&token_hash)
        .await
        .expect("find revoked session")
        .expect("session still readable");
    assert!(revoked.revoked_at.is_some());

    assert!(store
        .find_by_token_hash("missing-token-hash")
        .await
        .expect("query missing session")
        .is_none());

    // Organizations upsert by slug; memberships stay unique per user.
    let slug = format!("test-org-{unique}");
    let organization = store
        .upsert_organization(&slug, "测试组织")
        .await
        .expect("insert organization");
    let organization_again = store
        .upsert_organization(&slug, "测试组织")
        .await
        .expect("upsert organization again");
    assert_eq!(organization.id, organization_again.id);

    store
        .ensure_membership(organization.id, first.id)
        .await
        .expect("create membership");
    store
        .ensure_membership(organization.id, first.id)
        .await
        .expect("membership is idempotent");

    let memberships = store
        .list_memberships_for_user(first.id)
        .await
        .expect("list memberships");
    assert_eq!(memberships.len(), 1);
    assert_eq!(memberships[0].organization_id, organization.id);
    assert_eq!(memberships[0].slug, slug);
    assert_eq!(memberships[0].name, "测试组织");

    // Audit events persist without raw secret material.
    store
        .record(NewAuditEvent {
            actor_id: Some(first.id),
            action: format!("test.audit-{unique}"),
            resource_type: "session".to_owned(),
            resource_id: Some(session.id.into_uuid()),
            metadata: serde_json::json!({ "requestId": "req-db-test" }),
        })
        .await
        .expect("record audit event");

    let (count,): (i64,) = sqlx::query_as("select count(*) from audit_events where action = $1")
        .bind(format!("test.audit-{unique}"))
        .fetch_one(&pool)
        .await
        .expect("count audit events");
    assert_eq!(count, 1);
}

/// Exercises the archive repositories against real PostgreSQL. The visibility
/// predicate lives in SQL, so only a real database proves it works.
#[tokio::test]
async fn pg_archive_repository_enforces_visibility_and_versioning() {
    let Ok(database_url) = std::env::var("DATABASE_URL") else {
        eprintln!("skipping pg archive test: DATABASE_URL is not set");
        return;
    };

    let pool = sqlx::postgres::PgPoolOptions::new()
        .max_connections(2)
        .connect(&database_url)
        .await
        .expect("connect to test database");

    let migrations = Path::new(env!("CARGO_MANIFEST_DIR")).join(MIGRATIONS_DIR);
    sqlx::migrate::Migrator::new(migrations)
        .await
        .expect("load migrations")
        .run(&pool)
        .await
        .expect("run migrations");

    let store = Arc::new(PgAuthStore::new(pool.clone()));
    let unique = Uuid::new_v4().simple().to_string();
    let now = Utc::now();

    let make_user = |suffix: &str| {
        let store = store.clone();
        let subject = format!("archive-{suffix}-{unique}");
        async move {
            store
                .upsert(NewUser {
                    auth_provider: AuthProviderKind::MockCampus,
                    provider_subject_hash: subject,
                    display_name: "归档用户".to_owned(),
                    system_role: SystemRole::Student,
                })
                .await
                .expect("create user")
        }
    };

    let author = make_user("author").await;
    let stranger = make_user("stranger").await;

    let entry = ArchiveRepository::insert(
        store.as_ref(),
        NewArchiveEntry {
            author_id: author.id,
            title: format!("可见性测试-{unique}"),
            body: "正文".to_owned(),
            summary: Some("摘要".to_owned()),
            tags: vec![format!("tag-{unique}")],
            category: ArchiveCategory::Onboarding,
            applicable_audience: ApplicableAudience::NewStudents,
            source_kind: SourceKind::FirsthandExperience,
            source_reference: None,
            created_at: now,
        },
    )
    .await
    .expect("insert archive entry");

    assert_eq!(entry.moderation_status, ModerationStatus::Draft);
    assert_eq!(entry.current_revision, 1);

    // A draft is invisible to the public and to unrelated users, but visible
    // to its author and to moderation scope.
    assert!(
        ArchiveRepository::find_visible(store.as_ref(), entry.id, VisibilityScope::Public)
            .await
            .unwrap()
            .is_none()
    );
    assert!(ArchiveRepository::find_visible(
        store.as_ref(),
        entry.id,
        VisibilityScope::Owner(stranger.id)
    )
    .await
    .unwrap()
    .is_none());
    assert!(ArchiveRepository::find_visible(
        store.as_ref(),
        entry.id,
        VisibilityScope::Owner(author.id)
    )
    .await
    .unwrap()
    .is_some());
    assert!(
        ArchiveRepository::find_visible(store.as_ref(), entry.id, VisibilityScope::Full)
            .await
            .unwrap()
            .is_some()
    );

    // An assigned maintainer sees the draft too.
    sqlx::query("insert into post_maintainers (post_id, user_id) values ($1, $2)")
        .bind(entry.id.into_uuid())
        .bind(stranger.id.into_uuid())
        .execute(&pool)
        .await
        .expect("assign maintainer");
    assert!(
        ArchiveRepository::is_maintainer(store.as_ref(), entry.id, stranger.id)
            .await
            .unwrap()
    );
    assert!(ArchiveRepository::find_visible(
        store.as_ref(),
        entry.id,
        VisibilityScope::Owner(stranger.id)
    )
    .await
    .unwrap()
    .is_some());

    // Publishing makes it public; updating then writes revision 2 atomically.
    ArchiveRepository::set_status(
        store.as_ref(),
        entry.id,
        ModerationStatus::Draft,
        ModerationStatus::Published,
        now,
    )
    .await
    .expect("publish");
    assert!(
        ArchiveRepository::find_visible(store.as_ref(), entry.id, VisibilityScope::Public)
            .await
            .unwrap()
            .is_some()
    );

    let updated = ArchiveRepository::update(
        store.as_ref(),
        entry.id,
        ArchiveEntryUpdate {
            title: format!("可见性测试改-{unique}"),
            body: "正文改".to_owned(),
            summary: None,
            tags: vec![format!("tag-{unique}")],
            category: ArchiveCategory::Procedures,
            applicable_audience: ApplicableAudience::AllStudents,
            source_kind: SourceKind::OfficialAnnouncement,
            source_reference: Some("https://example.test".to_owned()),
            updated_at: now + Duration::minutes(1),
            revision: RevisionWrite::Append(NewRevision {
                revision: 2,
                editor_id: author.id,
            }),
        },
    )
    .await
    .expect("update entry");

    assert_eq!(updated.current_revision, 2);
    assert_eq!(updated.category, ArchiveCategory::Procedures);

    let revisions = ArchiveRepository::list_revisions(store.as_ref(), entry.id)
        .await
        .expect("list revisions");
    assert_eq!(revisions.len(), 2);
    assert_eq!(revisions[0].revision, 1);
    assert_eq!(revisions[1].revision, 2);
    assert_eq!(revisions[1].editor_id, author.id);

    // Search-lite filters and pagination totals.
    let page = ArchiveRepository::list(
        store.as_ref(),
        ArchiveListQuery {
            scope: VisibilityScope::Public,
            q: Some("可见性测试改".to_owned()),
            tag: Some(format!("tag-{unique}")),
            category: Some(ArchiveCategory::Procedures),
            page: 1,
            page_size: 20,
        },
    )
    .await
    .expect("list entries");
    assert_eq!(page.total_items, 1);
    assert_eq!(page.total_pages, 1);
    assert_eq!(page.items[0].id, entry.id);

    // A tag that does not match filters the entry out.
    let empty = ArchiveRepository::list(
        store.as_ref(),
        ArchiveListQuery {
            scope: VisibilityScope::Public,
            q: None,
            tag: Some(format!("missing-{unique}")),
            category: None,
            page: 1,
            page_size: 20,
        },
    )
    .await
    .unwrap();
    assert_eq!(empty.total_items, 0);

    // Corrections: insert, list, and idempotent resolve.
    let correction = CorrectionRepository::insert(
        store.as_ref(),
        NewCorrection {
            post_id: entry.id,
            reporter_id: stranger.id,
            message: "流程已变更".to_owned(),
            created_at: now,
        },
    )
    .await
    .expect("file correction");
    assert!(correction.resolved_at.is_none());

    let first_resolution = now + Duration::minutes(2);
    CorrectionRepository::resolve(
        store.as_ref(),
        entry.id,
        correction.id,
        author.id,
        first_resolution,
    )
    .await
    .expect("resolve correction");
    let repeat = CorrectionRepository::resolve(
        store.as_ref(),
        entry.id,
        correction.id,
        stranger.id,
        now + Duration::minutes(3),
    )
    .await
    .expect("resolving twice must stay successful");

    assert_eq!(repeat.resolved_by, Some(author.id));
    assert_eq!(
        repeat.resolved_at.map(|at| at.timestamp()),
        Some(first_resolution.timestamp())
    );

    let corrections = CorrectionRepository::list_for_post(store.as_ref(), entry.id)
        .await
        .unwrap();
    assert_eq!(corrections.len(), 1);
}

/// The M3 loop against a real database. The in-memory store answers the same
/// questions, but only PostgreSQL can prove the CHECK constraint admits
/// `archived`, that the accepted-answer guard lives in the statement, and that
/// the visibility joins actually filter.
#[tokio::test]
async fn pg_repositories_cover_the_m3_discussion_loop() {
    let Ok(database_url) = std::env::var("DATABASE_URL") else {
        eprintln!("skipping pg discussion test: DATABASE_URL is not set");
        return;
    };

    let pool = sqlx::postgres::PgPoolOptions::new()
        .max_connections(2)
        .connect(&database_url)
        .await
        .expect("connect to test database");

    let migrations = Path::new(env!("CARGO_MANIFEST_DIR")).join(MIGRATIONS_DIR);
    sqlx::migrate::Migrator::new(migrations)
        .await
        .expect("load migrations")
        .run(&pool)
        .await
        .expect("run migrations");

    let store = Arc::new(PgAuthStore::new(pool.clone()));
    let unique = Uuid::new_v4().simple().to_string();
    let now = Utc::now();

    let author = store
        .upsert(NewUser {
            auth_provider: AuthProviderKind::MockCampus,
            provider_subject_hash: format!("m3-author-{unique}"),
            display_name: "提问者".to_owned(),
            system_role: SystemRole::Student,
        })
        .await
        .expect("author");
    let helper = store
        .upsert(NewUser {
            auth_provider: AuthProviderKind::MockCampus,
            provider_subject_hash: format!("m3-helper-{unique}"),
            display_name: "回答者".to_owned(),
            system_role: SystemRole::Student,
        })
        .await
        .expect("helper");

    let discussion = DiscussionRepository::insert(
        store.as_ref(),
        NewDiscussion {
            author_id: author.id,
            title: format!("场地申请-{unique}"),
            body: "有人知道流程吗".to_owned(),
            tags: vec!["办事流程".to_owned()],
            created_at: now,
        },
    )
    .await
    .expect("insert discussion");

    assert_eq!(discussion.moderation_status, ModerationStatus::Draft);
    assert_eq!(discussion.reply_count, 0);

    // A draft is invisible publicly and visible to its author.
    assert!(DiscussionRepository::find_visible(
        store.as_ref(),
        discussion.id,
        VisibilityScope::Public
    )
    .await
    .expect("public read")
    .is_none());
    assert!(DiscussionRepository::find_visible(
        store.as_ref(),
        discussion.id,
        VisibilityScope::Owner(author.id)
    )
    .await
    .expect("owner read")
    .is_some());

    let published = DiscussionRepository::set_status(
        store.as_ref(),
        discussion.id,
        ModerationStatus::Draft,
        ModerationStatus::Published,
        now,
    )
    .await
    .expect("publish");
    assert_eq!(published.moderation_status, ModerationStatus::Published);

    // A stale expected-status is a conflict, not a silent overwrite.
    assert!(matches!(
        DiscussionRepository::set_status(
            store.as_ref(),
            discussion.id,
            ModerationStatus::Draft,
            ModerationStatus::Hidden,
            now,
        )
        .await,
        Err(ApplicationError::Conflict(_))
    ));

    let first = CommentRepository::insert(
        store.as_ref(),
        NewComment {
            post_id: discussion.id,
            author_id: helper.id,
            body: "先去团委登记".to_owned(),
            created_at: now,
        },
    )
    .await
    .expect("first reply");
    let second = CommentRepository::insert(
        store.as_ref(),
        NewComment {
            post_id: discussion.id,
            author_id: helper.id,
            body: "再去场馆盖章".to_owned(),
            created_at: now + Duration::seconds(1),
        },
    )
    .await
    .expect("second reply");

    let replies = CommentRepository::list_for_post(store.as_ref(), discussion.id)
        .await
        .expect("list replies");
    assert_eq!(
        replies.iter().map(|c| c.id).collect::<Vec<_>>(),
        vec![first.id, second.id]
    );

    // `reply_count` is computed by the query, so it tracks the comments.
    let reloaded =
        DiscussionRepository::find_visible(store.as_ref(), discussion.id, VisibilityScope::Public)
            .await
            .expect("reload")
            .expect("visible");
    assert_eq!(reloaded.reply_count, 2);

    // A comment is only ever found inside its own discussion.
    let other = DiscussionRepository::insert(
        store.as_ref(),
        NewDiscussion {
            author_id: helper.id,
            title: format!("另一个讨论-{unique}"),
            body: "无关内容".to_owned(),
            tags: vec![],
            created_at: now,
        },
    )
    .await
    .expect("other discussion");

    assert!(
        CommentRepository::find_in_post(store.as_ref(), other.id, first.id)
            .await
            .expect("cross lookup")
            .is_none()
    );

    let accepted = DiscussionRepository::set_accepted_comment(
        store.as_ref(),
        discussion.id,
        Some(second.id),
        now,
    )
    .await
    .expect("accept");
    assert_eq!(accepted.accepted_comment_id, Some(second.id));

    // The guard is in the statement: accepting a foreign comment fails even
    // when the service layer is bypassed entirely.
    assert!(matches!(
        DiscussionRepository::set_accepted_comment(store.as_ref(), other.id, Some(first.id), now)
            .await,
        Err(ApplicationError::NotFound(_))
    ));

    let cleared =
        DiscussionRepository::set_accepted_comment(store.as_ref(), discussion.id, None, now)
            .await
            .expect("clear");
    assert_eq!(cleared.accepted_comment_id, None);

    // `archived` must survive the CHECK constraint and stay publicly readable.
    let archived = DiscussionRepository::set_status(
        store.as_ref(),
        discussion.id,
        ModerationStatus::Published,
        ModerationStatus::Archived,
        now,
    )
    .await
    .expect("archive");
    assert_eq!(archived.moderation_status, ModerationStatus::Archived);
    assert!(DiscussionRepository::find_visible(
        store.as_ref(),
        discussion.id,
        VisibilityScope::Public
    )
    .await
    .expect("public read of archived")
    .is_some());

    // Provenance, and both directions of the link.
    let entry = ArchiveRepository::insert(
        store.as_ref(),
        NewArchiveEntry {
            author_id: helper.id,
            title: format!("场地申请指南-{unique}"),
            body: "整理自讨论".to_owned(),
            summary: None,
            tags: vec![],
            category: ArchiveCategory::Procedures,
            applicable_audience: ApplicableAudience::AllStudents,
            source_kind: SourceKind::Discussion,
            source_reference: None,
            created_at: now,
        },
    )
    .await
    .expect("entry");

    let source = ArchiveSourceRepository::insert(
        store.as_ref(),
        NewArchiveSource {
            entry_id: entry.id,
            source_post_id: discussion.id,
            source_comment_id: Some(second.id),
            source_author_id: helper.id,
            created_at: now,
        },
    )
    .await
    .expect("source");
    assert_eq!(source.source_title, discussion.title);
    assert_eq!(source.source_author_id, helper.id);

    // The same source recorded twice for one entry is a duplicate.
    assert!(matches!(
        ArchiveSourceRepository::insert(
            store.as_ref(),
            NewArchiveSource {
                entry_id: entry.id,
                source_post_id: discussion.id,
                source_comment_id: Some(second.id),
                source_author_id: helper.id,
                created_at: now,
            },
        )
        .await,
        Err(ApplicationError::Conflict(_))
    ));

    let sources =
        ArchiveSourceRepository::list_for_entry(store.as_ref(), entry.id, VisibilityScope::Public)
            .await
            .expect("sources");
    assert_eq!(sources.len(), 1);
    assert_eq!(sources[0].source_post_id, discussion.id);

    // The derived entry is still a draft, so only its owner sees it.
    assert!(ArchiveSourceRepository::list_derived_entries(
        store.as_ref(),
        discussion.id,
        VisibilityScope::Public
    )
    .await
    .expect("public derived")
    .is_empty());

    let owned = ArchiveSourceRepository::list_derived_entries(
        store.as_ref(),
        discussion.id,
        VisibilityScope::Owner(helper.id),
    )
    .await
    .expect("owner derived");
    assert_eq!(owned.len(), 1);
    assert_eq!(owned[0].entry_id, entry.id);

    // Hiding the source discussion drops it from the entry's backlink, so the
    // listing cannot be used to read a hidden title.
    DiscussionRepository::set_status(
        store.as_ref(),
        discussion.id,
        ModerationStatus::Archived,
        ModerationStatus::Hidden,
        now,
    )
    .await
    .expect("hide source");

    assert!(ArchiveSourceRepository::list_for_entry(
        store.as_ref(),
        entry.id,
        VisibilityScope::Public
    )
    .await
    .expect("sources after hide")
    .is_empty());
}
