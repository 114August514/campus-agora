/// Identity providers behind the auth provider abstraction. Real campus
/// providers reuse this enum; they must not introduce new permission logic.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum AuthProviderKind {
    MockCampus,
    CampusSso,
    CampusOidc,
}

impl AuthProviderKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::MockCampus => "mock_campus",
            Self::CampusSso => "campus_sso",
            Self::CampusOidc => "campus_oidc",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "mock_campus" => Some(Self::MockCampus),
            "campus_sso" => Some(Self::CampusSso),
            "campus_oidc" => Some(Self::CampusOidc),
            _ => None,
        }
    }
}

pub const DISPLAY_NAME_MAX_CHARS: usize = 64;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DisplayNameError {
    Empty,
    TooLong,
}

/// Normalizes a display name: surrounding whitespace is dropped, the result
/// must be non-empty and at most `DISPLAY_NAME_MAX_CHARS` characters.
pub fn validate_display_name(input: &str) -> Result<String, DisplayNameError> {
    let trimmed = input.trim();

    if trimmed.is_empty() {
        return Err(DisplayNameError::Empty);
    }

    if trimmed.chars().count() > DISPLAY_NAME_MAX_CHARS {
        return Err(DisplayNameError::TooLong);
    }

    Ok(trimmed.to_owned())
}
