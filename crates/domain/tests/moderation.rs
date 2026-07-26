use campus_agora_domain::archive::{can_transition, ModerationStatus};
use campus_agora_domain::moderation::{
    risk_for, validate_report_message, ReportCategory, RiskLevel, REPORT_MESSAGE_MAX_CHARS,
};
use campus_agora_domain::TextError;

#[test]
fn pending_review_round_trips_through_its_wire_value() {
    assert_eq!(ModerationStatus::PendingReview.as_str(), "pending_review");
    assert_eq!(
        ModerationStatus::parse("pending_review"),
        Some(ModerationStatus::PendingReview)
    );
    assert_eq!(ModerationStatus::parse("pendingReview"), None);
}

/// Content awaiting a decision is not content the campus should be reading.
/// `archived` is readable because it is preserved; `pending_review` is not,
/// because whether it should exist at all is the open question.
#[test]
fn content_awaiting_review_is_not_publicly_readable() {
    assert!(!ModerationStatus::PendingReview.is_publicly_visible());
    assert!(!ModerationStatus::PendingReview.accepts_replies());
}

#[test]
fn an_author_may_submit_a_draft_for_review_and_a_reviewer_may_decide() {
    assert!(can_transition(
        ModerationStatus::Draft,
        ModerationStatus::PendingReview
    ));

    for decision in [
        ModerationStatus::Published,
        ModerationStatus::Rejected,
        ModerationStatus::Draft,
    ] {
        assert!(
            can_transition(ModerationStatus::PendingReview, decision),
            "a reviewer must be able to decide {decision:?}"
        );
    }
}

/// A report on live content re-opens review. Archived content is retired and
/// already out of the way, so it goes to `hidden` if it turns out to be a
/// problem rather than back into a queue.
#[test]
fn a_report_can_move_published_content_back_into_review() {
    assert!(can_transition(
        ModerationStatus::Published,
        ModerationStatus::PendingReview
    ));
    assert!(!can_transition(
        ModerationStatus::Archived,
        ModerationStatus::PendingReview
    ));
    assert!(!can_transition(
        ModerationStatus::Hidden,
        ModerationStatus::PendingReview
    ));
}

/// Retiring or hiding content still under review would settle the question by
/// side effect. A reviewer decides first.
#[test]
fn content_under_review_cannot_be_archived_or_hidden_directly() {
    assert!(!can_transition(
        ModerationStatus::PendingReview,
        ModerationStatus::Archived
    ));
    assert!(!can_transition(
        ModerationStatus::PendingReview,
        ModerationStatus::Hidden
    ));
    assert!(!can_transition(
        ModerationStatus::PendingReview,
        ModerationStatus::PendingReview
    ));
}

#[test]
fn report_categories_round_trip_through_stable_strings() {
    for (category, value) in [
        (ReportCategory::Spam, "spam"),
        (ReportCategory::Harassment, "harassment"),
        (ReportCategory::PrivacyViolation, "privacy_violation"),
        (ReportCategory::Misinformation, "misinformation"),
        (ReportCategory::Illegal, "illegal"),
        (ReportCategory::Other, "other"),
    ] {
        assert_eq!(category.as_str(), value);
        assert_eq!(ReportCategory::parse(value), Some(category));
    }

    assert_eq!(ReportCategory::parse("Spam"), None);
    assert_eq!(ReportCategory::parse("unknown"), None);
}

/// Risk is derived from what was reported, not scored. Anything cleverer would
/// be the "trust and safety automation" the milestone rules out.
#[test]
fn risk_is_the_highest_severity_among_the_open_reports() {
    assert_eq!(risk_for(&[]), RiskLevel::None);
    assert_eq!(risk_for(&[ReportCategory::Other]), RiskLevel::Low);
    assert_eq!(risk_for(&[ReportCategory::Spam]), RiskLevel::Low);
    assert_eq!(
        risk_for(&[ReportCategory::Misinformation]),
        RiskLevel::Medium
    );

    for category in [
        ReportCategory::Harassment,
        ReportCategory::PrivacyViolation,
        ReportCategory::Illegal,
    ] {
        assert_eq!(risk_for(&[category]), RiskLevel::High, "{category:?}");
    }

    // One serious report is not diluted by any number of trivial ones.
    assert_eq!(
        risk_for(&[
            ReportCategory::Spam,
            ReportCategory::Illegal,
            ReportCategory::Other
        ]),
        RiskLevel::High
    );
}

#[test]
fn risk_levels_order_from_none_to_high() {
    assert!(RiskLevel::None < RiskLevel::Low);
    assert!(RiskLevel::Low < RiskLevel::Medium);
    assert!(RiskLevel::Medium < RiskLevel::High);

    for (level, value) in [
        (RiskLevel::None, "none"),
        (RiskLevel::Low, "low"),
        (RiskLevel::Medium, "medium"),
        (RiskLevel::High, "high"),
    ] {
        assert_eq!(level.as_str(), value);
    }
}

#[test]
fn report_messages_are_trimmed_and_bounded() {
    assert_eq!(
        validate_report_message("  这条内容泄露了同学的手机号  "),
        Ok("这条内容泄露了同学的手机号".to_owned())
    );
    assert_eq!(validate_report_message("   "), Err(TextError::Empty));

    let at_limit = "x".repeat(REPORT_MESSAGE_MAX_CHARS);
    assert!(validate_report_message(&at_limit).is_ok());
    assert_eq!(
        validate_report_message(&"x".repeat(REPORT_MESSAGE_MAX_CHARS + 1)),
        Err(TextError::TooLong)
    );
}

/// Character-counted, not byte-counted: a report written in Chinese must not
/// be rejected at a third of the advertised limit.
#[test]
fn report_message_length_counts_characters() {
    let cjk = "举".repeat(REPORT_MESSAGE_MAX_CHARS);

    assert!(cjk.len() > REPORT_MESSAGE_MAX_CHARS);
    assert!(validate_report_message(&cjk).is_ok());
}
