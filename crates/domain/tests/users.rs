use campus_agora_domain::{
    validate_display_name, AuthProviderKind, DisplayNameError, SystemRole, UserId,
    DISPLAY_NAME_MAX_CHARS,
};
use uuid::Uuid;

#[test]
fn system_role_round_trips_through_stable_strings() {
    let cases = [
        (SystemRole::Student, "student"),
        (SystemRole::OrganizationMember, "organization_member"),
        (SystemRole::Moderator, "moderator"),
        (SystemRole::Admin, "admin"),
    ];

    for (role, value) in cases {
        assert_eq!(role.as_str(), value);
        assert_eq!(SystemRole::parse(value), Some(role));
    }

    assert_eq!(SystemRole::parse("guest"), None);
    assert_eq!(SystemRole::parse("superuser"), None);
}

#[test]
fn auth_provider_kind_round_trips_through_stable_strings() {
    let cases = [
        (AuthProviderKind::MockCampus, "mock_campus"),
        (AuthProviderKind::CampusSso, "campus_sso"),
        (AuthProviderKind::CampusOidc, "campus_oidc"),
    ];

    for (provider, value) in cases {
        assert_eq!(provider.as_str(), value);
        assert_eq!(AuthProviderKind::parse(value), Some(provider));
    }

    assert_eq!(AuthProviderKind::parse("password"), None);
}

#[test]
fn display_name_validation_trims_and_bounds_input() {
    assert_eq!(
        validate_display_name("  示例学生  ").as_deref(),
        Ok("示例学生")
    );
    assert_eq!(validate_display_name(""), Err(DisplayNameError::Empty));
    assert_eq!(validate_display_name("   "), Err(DisplayNameError::Empty));

    let longest_allowed = "名".repeat(DISPLAY_NAME_MAX_CHARS);
    assert_eq!(
        validate_display_name(&longest_allowed).as_deref(),
        Ok(longest_allowed.as_str())
    );

    let too_long = "名".repeat(DISPLAY_NAME_MAX_CHARS + 1);
    assert_eq!(
        validate_display_name(&too_long),
        Err(DisplayNameError::TooLong)
    );
}

#[test]
fn ids_round_trip_through_uuid_values() {
    let raw = Uuid::new_v4();
    let user_id = UserId::from_uuid(raw);

    assert_eq!(user_id.into_uuid(), raw);
    assert_eq!(user_id.to_string(), raw.to_string());
}
