pub mod archive;
pub mod ids;
pub mod moderation;
pub mod permissions;
pub mod roles;
pub mod users;

pub use archive::{
    can_transition, normalize_tags, validate_body, validate_comment_body, validate_summary,
    validate_title, ApplicableAudience, ArchiveCategory, ModerationStatus, PostKind, SourceKind,
    TagError, TextError, BODY_MAX_CHARS, COMMENT_BODY_MAX_CHARS, MAX_TAGS, SUMMARY_MAX_CHARS,
    TAG_MAX_CHARS, TITLE_MAX_CHARS,
};
pub use ids::{CommentId, CorrectionId, OrganizationId, PostId, RevisionId, SessionId, UserId};
pub use moderation::{
    risk_for, validate_report_message, ReportCategory, RiskLevel, REPORT_MESSAGE_MAX_CHARS,
};
pub use permissions::{decide, is_allowed, Action, Actor, AuthenticatedActor, PermissionDecision};
pub use roles::SystemRole;
pub use users::{
    validate_display_name, AuthProviderKind, DisplayNameError, DISPLAY_NAME_MAX_CHARS,
};

pub const DOMAIN_BOUNDARY: &str = "campus-agora-domain";
