use campus_agora_domain::archive::{
    can_transition, validate_comment_body, ModerationStatus, TextError, COMMENT_BODY_MAX_CHARS,
};

#[test]
fn archived_status_round_trips_through_its_wire_value() {
    assert_eq!(ModerationStatus::Archived.as_str(), "archived");
    assert_eq!(
        ModerationStatus::parse("archived"),
        Some(ModerationStatus::Archived)
    );
    assert_eq!(ModerationStatus::parse("Archived"), None);
}

/// An archive is preserved and readable by definition. If archiving hid the
/// discussion, every archive entry's backlink to its source would 404 and the
/// milestone's traceable-source requirement would be unmeetable. Removing
/// content from view is what `Hidden` is for.
#[test]
fn archived_content_stays_publicly_readable() {
    assert!(ModerationStatus::Archived.is_publicly_visible());
    assert!(ModerationStatus::Published.is_publicly_visible());
    assert!(!ModerationStatus::Hidden.is_publicly_visible());
    assert!(!ModerationStatus::Draft.is_publicly_visible());
    assert!(!ModerationStatus::Rejected.is_publicly_visible());
}

#[test]
fn published_content_can_be_archived_and_restored() {
    assert!(can_transition(
        ModerationStatus::Published,
        ModerationStatus::Archived
    ));
    assert!(can_transition(
        ModerationStatus::Archived,
        ModerationStatus::Published
    ));
}

/// Archiving must not become a way to put content beyond moderation reach.
#[test]
fn archived_content_can_still_be_hidden_by_a_moderator() {
    assert!(can_transition(
        ModerationStatus::Archived,
        ModerationStatus::Hidden
    ));
}

#[test]
fn nothing_else_transitions_into_or_out_of_archived() {
    for from in [
        ModerationStatus::Draft,
        ModerationStatus::Hidden,
        ModerationStatus::Rejected,
    ] {
        assert!(
            !can_transition(from, ModerationStatus::Archived),
            "{from:?} must not archive directly"
        );
    }

    for to in [ModerationStatus::Draft, ModerationStatus::Rejected] {
        assert!(
            !can_transition(ModerationStatus::Archived, to),
            "archived must not become {to:?}"
        );
    }

    assert!(!can_transition(
        ModerationStatus::Archived,
        ModerationStatus::Archived
    ));
}

#[test]
fn comment_bodies_are_trimmed_and_bounded() {
    assert_eq!(
        validate_comment_body("  useful reply  "),
        Ok("useful reply".to_owned())
    );
    assert_eq!(validate_comment_body("   "), Err(TextError::Empty));
    assert_eq!(validate_comment_body(""), Err(TextError::Empty));

    let at_limit = "x".repeat(COMMENT_BODY_MAX_CHARS);
    assert!(validate_comment_body(&at_limit).is_ok());

    let over_limit = "x".repeat(COMMENT_BODY_MAX_CHARS + 1);
    assert_eq!(validate_comment_body(&over_limit), Err(TextError::TooLong));
}

/// A reply is a reply, not an essay. The bound is well under the archive body
/// limit so that long-form content is written where it can be versioned.
#[test]
fn comment_bound_is_smaller_than_the_archive_body_bound() {
    assert!(COMMENT_BODY_MAX_CHARS < campus_agora_domain::archive::BODY_MAX_CHARS);
}

/// Character-counted, not byte-counted: a CJK reply must not be rejected at a
/// third of the advertised limit.
#[test]
fn comment_length_counts_characters_not_bytes() {
    let cjk = "讨".repeat(COMMENT_BODY_MAX_CHARS);

    assert!(cjk.len() > COMMENT_BODY_MAX_CHARS);
    assert!(validate_comment_body(&cjk).is_ok());
}

/// `ModerationStatus::ALL` feeds the database visibility predicate. If a new
/// status is added and not listed there, the predicate silently stops matching
/// it — content becomes invisible or, worse, visible. The exhaustive match
/// below fails to compile when a variant is added, and the length assertion
/// fails until it is added to `ALL`.
#[test]
fn every_status_is_listed_in_all() {
    for status in ModerationStatus::ALL {
        match status {
            ModerationStatus::Draft
            | ModerationStatus::Published
            | ModerationStatus::Hidden
            | ModerationStatus::Rejected
            | ModerationStatus::Archived => {}
        }
    }

    let mut seen: Vec<&str> = ModerationStatus::ALL.iter().map(|s| s.as_str()).collect();
    seen.sort_unstable();
    seen.dedup();

    assert_eq!(seen.len(), ModerationStatus::ALL.len());
    assert_eq!(ModerationStatus::ALL.len(), 5);
}
