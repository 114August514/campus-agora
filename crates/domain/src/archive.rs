//! Knowledge archive entry types, validation, and the moderation state
//! machine. Pure: no database, HTTP, or serialization concerns.

/// Whether a post is a durable archive entry or a transient discussion.
/// Discussion is defined here because both share one persistence spine; the
/// discussion workflows themselves belong to M3.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum PostKind {
    Knowledge,
    Discussion,
}

impl PostKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Knowledge => "knowledge",
            Self::Discussion => "discussion",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "knowledge" => Some(Self::Knowledge),
            "discussion" => Some(Self::Discussion),
            _ => None,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum ModerationStatus {
    Draft,
    Published,
    Hidden,
    Rejected,
    /// Retired but preserved: no longer inviting activity, still readable.
    Archived,
    /// Awaiting a moderator's decision. Reached by an author submitting a
    /// draft, or by a report re-opening published content.
    PendingReview,
}

impl ModerationStatus {
    /// Every status, so callers that must handle the whole set — notably the
    /// SQL visibility predicate — can derive it instead of restating it.
    /// `tests/discussion.rs` fails to compile if a variant is added without
    /// being listed here.
    pub const ALL: [Self; 6] = [
        Self::Draft,
        Self::Published,
        Self::Hidden,
        Self::Rejected,
        Self::Archived,
        Self::PendingReview,
    ];

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Draft => "draft",
            Self::Published => "published",
            Self::Hidden => "hidden",
            Self::Rejected => "rejected",
            Self::Archived => "archived",
            Self::PendingReview => "pending_review",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "draft" => Some(Self::Draft),
            "published" => Some(Self::Published),
            "hidden" => Some(Self::Hidden),
            "rejected" => Some(Self::Rejected),
            "archived" => Some(Self::Archived),
            "pending_review" => Some(Self::PendingReview),
            _ => None,
        }
    }

    /// Whether readers without a stake in the entry may see it. Ownership and
    /// moderation scope widen this, but that decision needs the actor and so
    /// lives in the application layer.
    ///
    /// `Archived` is readable on purpose: an archive entry links back to the
    /// discussion it was drawn from, and that link has to resolve. Taking
    /// content out of view is what `Hidden` does.
    pub fn is_publicly_visible(self) -> bool {
        matches!(self, Self::Published | Self::Archived)
    }

    /// Whether new replies may be attached. Archiving closes a discussion to
    /// further activity without removing what is already there.
    pub fn accepts_replies(self) -> bool {
        matches!(self, Self::Published)
    }
}

/// Allowed moderation transitions. Documented in
/// `docs/architecture/auth-permissions.md`; anything else is a conflict.
/// A self-transition is never allowed, so a no-op publish is rejected rather
/// than silently writing a revision.
pub fn can_transition(from: ModerationStatus, to: ModerationStatus) -> bool {
    use ModerationStatus::*;

    matches!(
        (from, to),
        (Draft, Published)
            | (Draft, Rejected)
            | (Published, Hidden)
            | (Hidden, Published)
            | (Rejected, Draft)
            | (Published, Archived)
            | (Archived, Published)
            // Archiving must not put content beyond moderation reach.
            | (Archived, Hidden)
            // An author may ask for review instead of publishing directly, and
            // a report re-opens review on content already live.
            | (Draft, PendingReview)
            | (Published, PendingReview)
            // A reviewer decides. Archiving or hiding content still under
            // review would settle the question by side effect.
            | (PendingReview, Published)
            | (PendingReview, Rejected)
            | (PendingReview, Draft)
    )
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum ArchiveCategory {
    Onboarding,
    CampusLife,
    Academics,
    Organizations,
    Procedures,
    Other,
}

impl ArchiveCategory {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Onboarding => "onboarding",
            Self::CampusLife => "campus_life",
            Self::Academics => "academics",
            Self::Organizations => "organizations",
            Self::Procedures => "procedures",
            Self::Other => "other",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "onboarding" => Some(Self::Onboarding),
            "campus_life" => Some(Self::CampusLife),
            "academics" => Some(Self::Academics),
            "organizations" => Some(Self::Organizations),
            "procedures" => Some(Self::Procedures),
            "other" => Some(Self::Other),
            _ => None,
        }
    }
}

/// Who an entry applies to. Campus knowledge goes stale differently for
/// different audiences, so this is a first-class field rather than a tag.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum ApplicableAudience {
    AllStudents,
    NewStudents,
    Undergraduate,
    Graduate,
    OrganizationMembers,
}

impl ApplicableAudience {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::AllStudents => "all_students",
            Self::NewStudents => "new_students",
            Self::Undergraduate => "undergraduate",
            Self::Graduate => "graduate",
            Self::OrganizationMembers => "organization_members",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "all_students" => Some(Self::AllStudents),
            "new_students" => Some(Self::NewStudents),
            "undergraduate" => Some(Self::Undergraduate),
            "graduate" => Some(Self::Graduate),
            "organization_members" => Some(Self::OrganizationMembers),
            _ => None,
        }
    }
}

/// Where the knowledge came from. Readers judge reliability by provenance, so
/// an entry records its source kind even when no link is available.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum SourceKind {
    FirsthandExperience,
    OfficialAnnouncement,
    GroupChat,
    Discussion,
    Unspecified,
}

impl SourceKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::FirsthandExperience => "firsthand_experience",
            Self::OfficialAnnouncement => "official_announcement",
            Self::GroupChat => "group_chat",
            Self::Discussion => "discussion",
            Self::Unspecified => "unspecified",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "firsthand_experience" => Some(Self::FirsthandExperience),
            "official_announcement" => Some(Self::OfficialAnnouncement),
            "group_chat" => Some(Self::GroupChat),
            "discussion" => Some(Self::Discussion),
            "unspecified" => Some(Self::Unspecified),
            _ => None,
        }
    }
}

pub const TITLE_MAX_CHARS: usize = 200;
pub const SUMMARY_MAX_CHARS: usize = 500;
pub const BODY_MAX_CHARS: usize = 50_000;
pub const MAX_TAGS: usize = 10;
pub const TAG_MAX_CHARS: usize = 32;
/// Well under `BODY_MAX_CHARS`: a reply that wants to be an essay belongs in an
/// archive entry, where it can be versioned and corrected.
pub const COMMENT_BODY_MAX_CHARS: usize = 5_000;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TextError {
    Empty,
    TooLong,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TagError {
    TooMany,
    TagTooLong,
}

pub fn validate_title(input: &str) -> Result<String, TextError> {
    bounded_text(input, TITLE_MAX_CHARS)
}

pub fn validate_body(input: &str) -> Result<String, TextError> {
    bounded_text(input, BODY_MAX_CHARS)
}

pub fn validate_comment_body(input: &str) -> Result<String, TextError> {
    bounded_text(input, COMMENT_BODY_MAX_CHARS)
}

/// A summary is optional. Whitespace-only input normalizes to absent rather
/// than to an empty string, so the database never holds a blank summary.
pub fn validate_summary(input: Option<&str>) -> Result<Option<String>, TextError> {
    let Some(value) = input else {
        return Ok(None);
    };

    let trimmed = value.trim();

    if trimmed.is_empty() {
        return Ok(None);
    }

    if trimmed.chars().count() > SUMMARY_MAX_CHARS {
        return Err(TextError::TooLong);
    }

    Ok(Some(trimmed.to_owned()))
}

/// Trims, lowercases, and dedupes tags while preserving first-seen order.
/// Lowercasing keeps `Onboarding` and `onboarding` from splitting a facet.
pub fn normalize_tags(input: &[String]) -> Result<Vec<String>, TagError> {
    let mut normalized: Vec<String> = Vec::new();

    for raw in input {
        let tag = raw.trim().to_lowercase();

        if tag.is_empty() {
            continue;
        }

        if tag.chars().count() > TAG_MAX_CHARS {
            return Err(TagError::TagTooLong);
        }

        if !normalized.contains(&tag) {
            normalized.push(tag);
        }
    }

    if normalized.len() > MAX_TAGS {
        return Err(TagError::TooMany);
    }

    Ok(normalized)
}

fn bounded_text(input: &str, max_chars: usize) -> Result<String, TextError> {
    let trimmed = input.trim();

    if trimmed.is_empty() {
        return Err(TextError::Empty);
    }

    if trimmed.chars().count() > max_chars {
        return Err(TextError::TooLong);
    }

    Ok(trimmed.to_owned())
}
