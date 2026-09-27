/// System-level roles for authenticated users. Guests are represented by
/// `permissions::Actor::Guest`, not by a stored role.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum SystemRole {
    Student,
    OrganizationMember,
    Moderator,
    Admin,
}

impl SystemRole {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Student => "student",
            Self::OrganizationMember => "organization_member",
            Self::Moderator => "moderator",
            Self::Admin => "admin",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "student" => Some(Self::Student),
            "organization_member" => Some(Self::OrganizationMember),
            "moderator" => Some(Self::Moderator),
            "admin" => Some(Self::Admin),
            _ => None,
        }
    }
}
