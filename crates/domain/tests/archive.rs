use campus_agora_domain::{
    can_transition, normalize_tags, validate_body, validate_summary, validate_title,
    ApplicableAudience, ArchiveCategory, ModerationStatus, PostKind, SourceKind, TagError,
    TextError, BODY_MAX_CHARS, MAX_TAGS, SUMMARY_MAX_CHARS, TAG_MAX_CHARS, TITLE_MAX_CHARS,
};

#[test]
fn moderation_status_round_trips_through_stable_strings() {
    let cases = [
        (ModerationStatus::Draft, "draft"),
        (ModerationStatus::Published, "published"),
        (ModerationStatus::Hidden, "hidden"),
        (ModerationStatus::Rejected, "rejected"),
        // Added by M3; its transitions and visibility live in tests/discussion.rs.
        (ModerationStatus::Archived, "archived"),
    ];

    for (status, value) in cases {
        assert_eq!(status.as_str(), value);
        assert_eq!(ModerationStatus::parse(value), Some(status));
    }

    assert_eq!(ModerationStatus::parse("deleted"), None);
    assert_eq!(ModerationStatus::parse("Published"), None);
}

#[test]
fn post_kind_round_trips_through_stable_strings() {
    assert_eq!(PostKind::Knowledge.as_str(), "knowledge");
    assert_eq!(PostKind::Discussion.as_str(), "discussion");
    assert_eq!(PostKind::parse("knowledge"), Some(PostKind::Knowledge));
    assert_eq!(PostKind::parse("discussion"), Some(PostKind::Discussion));
    assert_eq!(PostKind::parse("announcement"), None);
}

#[test]
fn archive_metadata_enums_round_trip() {
    for (category, value) in [
        (ArchiveCategory::Onboarding, "onboarding"),
        (ArchiveCategory::CampusLife, "campus_life"),
        (ArchiveCategory::Academics, "academics"),
        (ArchiveCategory::Organizations, "organizations"),
        (ArchiveCategory::Procedures, "procedures"),
        (ArchiveCategory::Other, "other"),
    ] {
        assert_eq!(category.as_str(), value);
        assert_eq!(ArchiveCategory::parse(value), Some(category));
    }

    for (audience, value) in [
        (ApplicableAudience::AllStudents, "all_students"),
        (ApplicableAudience::NewStudents, "new_students"),
        (ApplicableAudience::Undergraduate, "undergraduate"),
        (ApplicableAudience::Graduate, "graduate"),
        (
            ApplicableAudience::OrganizationMembers,
            "organization_members",
        ),
    ] {
        assert_eq!(audience.as_str(), value);
        assert_eq!(ApplicableAudience::parse(value), Some(audience));
    }

    for (source, value) in [
        (SourceKind::FirsthandExperience, "firsthand_experience"),
        (SourceKind::OfficialAnnouncement, "official_announcement"),
        (SourceKind::GroupChat, "group_chat"),
        (SourceKind::Discussion, "discussion"),
        (SourceKind::Unspecified, "unspecified"),
    ] {
        assert_eq!(source.as_str(), value);
        assert_eq!(SourceKind::parse(value), Some(source));
    }

    assert_eq!(ArchiveCategory::parse("random"), None);
    assert_eq!(ApplicableAudience::parse("faculty"), None);
    assert_eq!(SourceKind::parse("rumor"), None);
}

#[test]
fn moderation_transitions_follow_the_documented_state_machine() {
    use ModerationStatus::*;

    for (from, to) in [
        (Draft, Published),
        (Draft, Rejected),
        (Published, Hidden),
        (Hidden, Published),
        (Rejected, Draft),
    ] {
        assert!(
            can_transition(from, to),
            "{from:?} -> {to:?} must be allowed"
        );
    }

    for (from, to) in [
        (Published, Draft),
        (Published, Rejected),
        (Rejected, Published),
        (Rejected, Hidden),
        (Hidden, Draft),
        (Hidden, Rejected),
        (Draft, Hidden),
    ] {
        assert!(
            !can_transition(from, to),
            "{from:?} -> {to:?} must be denied"
        );
    }
}

#[test]
fn a_status_never_transitions_to_itself() {
    for status in [
        ModerationStatus::Draft,
        ModerationStatus::Published,
        ModerationStatus::Hidden,
        ModerationStatus::Rejected,
    ] {
        assert!(!can_transition(status, status), "{status:?} -> itself");
    }
}

#[test]
fn title_validation_trims_and_bounds_input() {
    assert_eq!(
        validate_title("  2026 新生报到物品清单  ").as_deref(),
        Ok("2026 新生报到物品清单")
    );
    assert_eq!(validate_title(""), Err(TextError::Empty));
    assert_eq!(validate_title("   "), Err(TextError::Empty));

    let longest = "题".repeat(TITLE_MAX_CHARS);
    assert_eq!(validate_title(&longest).as_deref(), Ok(longest.as_str()));
    assert_eq!(
        validate_title(&"题".repeat(TITLE_MAX_CHARS + 1)),
        Err(TextError::TooLong)
    );
}

#[test]
fn summary_is_optional_but_bounded_when_present() {
    assert_eq!(validate_summary(None), Ok(None));
    assert_eq!(validate_summary(Some("   ")), Ok(None));
    assert_eq!(
        validate_summary(Some("  一句话摘要  ")),
        Ok(Some("一句话摘要".to_owned()))
    );
    assert_eq!(
        validate_summary(Some(&"要".repeat(SUMMARY_MAX_CHARS + 1))),
        Err(TextError::TooLong)
    );
}

#[test]
fn body_must_be_present_and_bounded() {
    assert_eq!(validate_body("  正文  ").as_deref(), Ok("正文"));
    assert_eq!(validate_body("  "), Err(TextError::Empty));
    assert_eq!(
        validate_body(&"文".repeat(BODY_MAX_CHARS + 1)),
        Err(TextError::TooLong)
    );
}

#[test]
fn tags_are_normalized_deduped_and_bounded() {
    assert_eq!(
        normalize_tags(&[
            "  新生  ".to_owned(),
            "报到".to_owned(),
            "新生".to_owned(),
            "Onboarding".to_owned(),
            "onboarding".to_owned(),
        ]),
        Ok(vec![
            "新生".to_owned(),
            "报到".to_owned(),
            "onboarding".to_owned()
        ])
    );

    assert_eq!(normalize_tags(&[]), Ok(Vec::new()));
    // Blank entries drop out rather than becoming empty tags.
    assert_eq!(normalize_tags(&["  ".to_owned()]), Ok(Vec::new()));

    let too_many: Vec<String> = (0..=MAX_TAGS).map(|index| format!("tag{index}")).collect();
    assert_eq!(normalize_tags(&too_many), Err(TagError::TooMany));

    assert_eq!(
        normalize_tags(&["x".repeat(TAG_MAX_CHARS + 1)]),
        Err(TagError::TagTooLong)
    );
}
