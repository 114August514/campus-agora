pub mod ids;
pub mod permissions;
pub mod roles;
pub mod users;

pub use ids::{OrganizationId, SessionId, UserId};
pub use permissions::{decide, is_allowed, Action, Actor, AuthenticatedActor, PermissionDecision};
pub use roles::SystemRole;
pub use users::{
    validate_display_name, AuthProviderKind, DisplayNameError, DISPLAY_NAME_MAX_CHARS,
};

pub const DOMAIN_BOUNDARY: &str = "campus-agora-domain";
