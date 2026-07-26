use campus_agora_domain::{
    decide, is_allowed, Action, Actor, AuthenticatedActor, PermissionDecision, SystemRole,
};

fn actor(system_role: SystemRole) -> AuthenticatedActor {
    AuthenticatedActor {
        system_role,
        is_resource_author: false,
        is_assigned_maintainer: false,
        is_organization_member: false,
        owns_exported_data: false,
    }
}

fn authenticated(actor: AuthenticatedActor) -> Actor {
    Actor::Authenticated(actor)
}

#[test]
fn read_public_content_is_allowed_for_everyone() {
    assert_eq!(
        decide(Action::ReadPublicContent, &Actor::Guest),
        PermissionDecision::Allow
    );

    for system_role in [
        SystemRole::Student,
        SystemRole::OrganizationMember,
        SystemRole::Moderator,
        SystemRole::Admin,
    ] {
        assert_eq!(
            decide(
                Action::ReadPublicContent,
                &authenticated(actor(system_role))
            ),
            PermissionDecision::Allow
        );
    }
}

#[test]
fn create_own_draft_requires_an_authenticated_role() {
    assert_eq!(
        decide(Action::CreateOwnDraft, &Actor::Guest),
        PermissionDecision::Deny
    );

    for system_role in [
        SystemRole::Student,
        SystemRole::OrganizationMember,
        SystemRole::Moderator,
        SystemRole::Admin,
    ] {
        assert_eq!(
            decide(Action::CreateOwnDraft, &authenticated(actor(system_role))),
            PermissionDecision::Allow
        );
    }
}

#[test]
fn edit_own_draft_requires_author_maintainer_or_oversight_role() {
    assert_eq!(
        decide(Action::EditOwnDraft, &Actor::Guest),
        PermissionDecision::Deny
    );
    assert_eq!(
        decide(
            Action::EditOwnDraft,
            &authenticated(actor(SystemRole::Student))
        ),
        PermissionDecision::Deny
    );
    assert_eq!(
        decide(
            Action::EditOwnDraft,
            &authenticated(actor(SystemRole::OrganizationMember))
        ),
        PermissionDecision::Deny
    );

    let student_author = AuthenticatedActor {
        is_resource_author: true,
        ..actor(SystemRole::Student)
    };
    assert_eq!(
        decide(Action::EditOwnDraft, &authenticated(student_author)),
        PermissionDecision::Allow
    );

    let assigned_maintainer = AuthenticatedActor {
        is_assigned_maintainer: true,
        ..actor(SystemRole::Student)
    };
    assert_eq!(
        decide(Action::EditOwnDraft, &authenticated(assigned_maintainer)),
        PermissionDecision::Allow
    );

    assert_eq!(
        decide(
            Action::EditOwnDraft,
            &authenticated(actor(SystemRole::Moderator))
        ),
        PermissionDecision::Allow
    );
    assert_eq!(
        decide(
            Action::EditOwnDraft,
            &authenticated(actor(SystemRole::Admin))
        ),
        PermissionDecision::Allow
    );
}

#[test]
fn maintain_organization_content_requires_membership_or_assignment() {
    assert_eq!(
        decide(Action::MaintainOrganizationContent, &Actor::Guest),
        PermissionDecision::Deny
    );

    let member_in_organization = AuthenticatedActor {
        is_organization_member: true,
        ..actor(SystemRole::OrganizationMember)
    };
    assert_eq!(
        decide(
            Action::MaintainOrganizationContent,
            &authenticated(member_in_organization)
        ),
        PermissionDecision::Allow
    );

    let member_outside_organization = actor(SystemRole::OrganizationMember);
    assert_eq!(
        decide(
            Action::MaintainOrganizationContent,
            &authenticated(member_outside_organization)
        ),
        PermissionDecision::Deny
    );

    let student_with_membership_flag = AuthenticatedActor {
        is_organization_member: true,
        ..actor(SystemRole::Student)
    };
    assert_eq!(
        decide(
            Action::MaintainOrganizationContent,
            &authenticated(student_with_membership_flag)
        ),
        PermissionDecision::Deny
    );

    let author_only = AuthenticatedActor {
        is_resource_author: true,
        ..actor(SystemRole::Student)
    };
    assert_eq!(
        decide(
            Action::MaintainOrganizationContent,
            &authenticated(author_only)
        ),
        PermissionDecision::Deny
    );

    let assigned_maintainer = AuthenticatedActor {
        is_assigned_maintainer: true,
        ..actor(SystemRole::Student)
    };
    assert_eq!(
        decide(
            Action::MaintainOrganizationContent,
            &authenticated(assigned_maintainer)
        ),
        PermissionDecision::Allow
    );

    assert_eq!(
        decide(
            Action::MaintainOrganizationContent,
            &authenticated(actor(SystemRole::Moderator))
        ),
        PermissionDecision::Allow
    );
    assert_eq!(
        decide(
            Action::MaintainOrganizationContent,
            &authenticated(actor(SystemRole::Admin))
        ),
        PermissionDecision::Allow
    );
}

#[test]
fn view_archive_entry_is_open_because_visibility_is_a_repository_concern() {
    // The matrix allows the read action for everyone; whether a specific entry
    // is visible is decided by the repository predicate (published, or owned /
    // maintained / moderated by the caller). Encoding visibility here too
    // would put the same rule in two places.
    assert_eq!(
        decide(Action::ViewArchiveEntry, &Actor::Guest),
        PermissionDecision::Allow
    );
    assert_eq!(
        decide(
            Action::ViewArchiveEntry,
            &authenticated(actor(SystemRole::Student))
        ),
        PermissionDecision::Allow
    );
}

#[test]
fn filing_a_correction_requires_authentication() {
    assert_eq!(
        decide(Action::FileCorrection, &Actor::Guest),
        PermissionDecision::Deny
    );

    for system_role in [
        SystemRole::Student,
        SystemRole::OrganizationMember,
        SystemRole::Moderator,
        SystemRole::Admin,
    ] {
        assert_eq!(
            decide(Action::FileCorrection, &authenticated(actor(system_role))),
            PermissionDecision::Allow
        );
    }
}

#[test]
fn resolving_a_correction_requires_a_stake_in_the_entry() {
    assert_eq!(
        decide(Action::ResolveCorrection, &Actor::Guest),
        PermissionDecision::Deny
    );
    assert_eq!(
        decide(
            Action::ResolveCorrection,
            &authenticated(actor(SystemRole::Student))
        ),
        PermissionDecision::Deny
    );

    let author = AuthenticatedActor {
        is_resource_author: true,
        ..actor(SystemRole::Student)
    };
    assert_eq!(
        decide(Action::ResolveCorrection, &authenticated(author)),
        PermissionDecision::Allow
    );

    let maintainer = AuthenticatedActor {
        is_assigned_maintainer: true,
        ..actor(SystemRole::Student)
    };
    assert_eq!(
        decide(Action::ResolveCorrection, &authenticated(maintainer)),
        PermissionDecision::Allow
    );

    for system_role in [SystemRole::Moderator, SystemRole::Admin] {
        assert_eq!(
            decide(
                Action::ResolveCorrection,
                &authenticated(actor(system_role))
            ),
            PermissionDecision::Allow
        );
    }
}

#[test]
fn publish_archive_entry_is_conditional_for_members_and_authors() {
    assert_eq!(
        decide(Action::PublishArchiveEntry, &Actor::Guest),
        PermissionDecision::Deny
    );
    assert_eq!(
        decide(
            Action::PublishArchiveEntry,
            &authenticated(actor(SystemRole::Student))
        ),
        PermissionDecision::Deny
    );

    let organization_member = AuthenticatedActor {
        is_organization_member: true,
        ..actor(SystemRole::OrganizationMember)
    };
    assert_eq!(
        decide(
            Action::PublishArchiveEntry,
            &authenticated(organization_member)
        ),
        PermissionDecision::Conditional
    );

    // M2.1 resolves the Author condition: an author may publish their own
    // draft. The state machine still decides whether the transition is legal.
    let author = AuthenticatedActor {
        is_resource_author: true,
        ..actor(SystemRole::Student)
    };
    assert_eq!(
        decide(Action::PublishArchiveEntry, &authenticated(author)),
        PermissionDecision::Allow
    );

    let assigned_maintainer = AuthenticatedActor {
        is_assigned_maintainer: true,
        ..actor(SystemRole::Student)
    };
    assert_eq!(
        decide(
            Action::PublishArchiveEntry,
            &authenticated(assigned_maintainer)
        ),
        PermissionDecision::Allow
    );

    assert_eq!(
        decide(
            Action::PublishArchiveEntry,
            &authenticated(actor(SystemRole::Moderator))
        ),
        PermissionDecision::Allow
    );
    assert_eq!(
        decide(
            Action::PublishArchiveEntry,
            &authenticated(actor(SystemRole::Admin))
        ),
        PermissionDecision::Allow
    );
}

#[test]
fn conditional_decisions_are_denied_at_runtime() {
    // Organization-scoped publishing still depends on resource state that no
    // milestone has modelled yet, so it stays Conditional and is denied.
    let organization_member = AuthenticatedActor {
        is_organization_member: true,
        ..actor(SystemRole::OrganizationMember)
    };

    assert_eq!(
        decide(
            Action::PublishArchiveEntry,
            &authenticated(organization_member.clone())
        ),
        PermissionDecision::Conditional
    );
    assert!(!is_allowed(
        Action::PublishArchiveEntry,
        &authenticated(organization_member)
    ));
}

#[test]
fn change_moderation_state_is_limited_to_moderation_roles() {
    let author_and_maintainer = AuthenticatedActor {
        is_resource_author: true,
        is_assigned_maintainer: true,
        ..actor(SystemRole::Student)
    };

    assert_eq!(
        decide(Action::ChangeModerationState, &Actor::Guest),
        PermissionDecision::Deny
    );
    assert_eq!(
        decide(
            Action::ChangeModerationState,
            &authenticated(author_and_maintainer)
        ),
        PermissionDecision::Deny
    );
    assert_eq!(
        decide(
            Action::ChangeModerationState,
            &authenticated(actor(SystemRole::OrganizationMember))
        ),
        PermissionDecision::Deny
    );
    assert_eq!(
        decide(
            Action::ChangeModerationState,
            &authenticated(actor(SystemRole::Moderator))
        ),
        PermissionDecision::Allow
    );
    assert_eq!(
        decide(
            Action::ChangeModerationState,
            &authenticated(actor(SystemRole::Admin))
        ),
        PermissionDecision::Allow
    );
}

#[test]
fn change_roles_is_admin_only() {
    let moderator_with_all_flags = AuthenticatedActor {
        is_resource_author: true,
        is_assigned_maintainer: true,
        is_organization_member: true,
        owns_exported_data: true,
        ..actor(SystemRole::Moderator)
    };

    assert_eq!(
        decide(Action::ChangeRoles, &Actor::Guest),
        PermissionDecision::Deny
    );
    assert_eq!(
        decide(
            Action::ChangeRoles,
            &authenticated(moderator_with_all_flags)
        ),
        PermissionDecision::Deny
    );
    assert_eq!(
        decide(
            Action::ChangeRoles,
            &authenticated(actor(SystemRole::Admin))
        ),
        PermissionDecision::Allow
    );
}

#[test]
fn export_data_is_own_data_only_except_for_admin() {
    assert_eq!(
        decide(Action::ExportData, &Actor::Guest),
        PermissionDecision::Deny
    );

    let student_own_data = AuthenticatedActor {
        owns_exported_data: true,
        ..actor(SystemRole::Student)
    };
    assert_eq!(
        decide(Action::ExportData, &authenticated(student_own_data)),
        PermissionDecision::Allow
    );
    assert_eq!(
        decide(
            Action::ExportData,
            &authenticated(actor(SystemRole::Student))
        ),
        PermissionDecision::Deny
    );

    let member_own_data = AuthenticatedActor {
        owns_exported_data: true,
        ..actor(SystemRole::OrganizationMember)
    };
    assert_eq!(
        decide(Action::ExportData, &authenticated(member_own_data)),
        PermissionDecision::Allow
    );

    let author_own_data = AuthenticatedActor {
        is_resource_author: true,
        owns_exported_data: true,
        ..actor(SystemRole::Student)
    };
    assert_eq!(
        decide(Action::ExportData, &authenticated(author_own_data)),
        PermissionDecision::Allow
    );

    let moderator_own_data = AuthenticatedActor {
        owns_exported_data: true,
        ..actor(SystemRole::Moderator)
    };
    assert_eq!(
        decide(Action::ExportData, &authenticated(moderator_own_data)),
        PermissionDecision::Deny
    );

    assert_eq!(
        decide(Action::ExportData, &authenticated(actor(SystemRole::Admin))),
        PermissionDecision::Allow
    );
}

#[test]
fn columns_combine_as_a_union_of_grants() {
    // Documented in docs/architecture/auth-permissions.md: an actor can match
    // several columns at once and the most permissive one wins. A `Deny` cell
    // means "this column alone grants nothing", never "this column revokes".
    //
    // Concretely: a Moderator exporting their own authored data is allowed,
    // because the Author column grants "own data only". The Moderator column's
    // Deny only means moderation status by itself confers no export right.
    let moderator_exporting_own_authored_data = AuthenticatedActor {
        is_resource_author: true,
        owns_exported_data: true,
        ..actor(SystemRole::Moderator)
    };
    assert_eq!(
        decide(
            Action::ExportData,
            &authenticated(moderator_exporting_own_authored_data)
        ),
        PermissionDecision::Allow
    );

    // The same moderator exporting data that is not theirs stays denied.
    let moderator_exporting_other_data = AuthenticatedActor {
        is_resource_author: true,
        owns_exported_data: false,
        ..actor(SystemRole::Moderator)
    };
    assert_eq!(
        decide(
            Action::ExportData,
            &authenticated(moderator_exporting_other_data)
        ),
        PermissionDecision::Deny
    );
}

#[test]
fn is_allowed_matches_allow_decisions_only() {
    assert!(is_allowed(Action::ReadPublicContent, &Actor::Guest));
    assert!(!is_allowed(Action::CreateOwnDraft, &Actor::Guest));
    assert!(is_allowed(
        Action::ChangeRoles,
        &authenticated(actor(SystemRole::Admin))
    ));
}

#[test]
fn replying_to_a_discussion_requires_a_session() {
    assert!(!is_allowed(Action::ReplyToDiscussion, &Actor::Guest));

    for system_role in [
        SystemRole::Student,
        SystemRole::OrganizationMember,
        SystemRole::Moderator,
        SystemRole::Admin,
    ] {
        assert!(is_allowed(
            Action::ReplyToDiscussion,
            &authenticated(actor(system_role))
        ));
    }
}

/// Marking the useful reply belongs to whoever asked the question, plus the
/// people who curate the discussion. It is an affordance for readers, not a
/// moderation power, so a passer-by must not have it.
#[test]
fn accepting_an_answer_belongs_to_the_asker_and_the_curators() {
    let mut author = actor(SystemRole::Student);
    author.is_resource_author = true;
    assert!(is_allowed(Action::AcceptAnswer, &authenticated(author)));

    let mut maintainer = actor(SystemRole::Student);
    maintainer.is_assigned_maintainer = true;
    assert!(is_allowed(Action::AcceptAnswer, &authenticated(maintainer)));

    for system_role in [SystemRole::Moderator, SystemRole::Admin] {
        assert!(is_allowed(
            Action::AcceptAnswer,
            &authenticated(actor(system_role))
        ));
    }

    for system_role in [SystemRole::Student, SystemRole::OrganizationMember] {
        assert!(!is_allowed(
            Action::AcceptAnswer,
            &authenticated(actor(system_role))
        ));
    }

    assert!(!is_allowed(Action::AcceptAnswer, &Actor::Guest));
}

/// Promotion creates the promoter's own draft and leaves the source untouched,
/// so it needs no authority over the discussion — only a session. Requiring
/// authorship here would mean only the asker could sediment their own thread.
#[test]
fn promoting_to_archive_needs_only_a_session() {
    assert!(!is_allowed(Action::PromoteToArchive, &Actor::Guest));

    for system_role in [
        SystemRole::Student,
        SystemRole::OrganizationMember,
        SystemRole::Moderator,
        SystemRole::Admin,
    ] {
        assert!(is_allowed(
            Action::PromoteToArchive,
            &authenticated(actor(system_role))
        ));
    }
}

/// Promotion must grant no read access of its own: a student who cannot see a
/// draft discussion must not be able to launder it into a published entry.
/// Visibility stays the repository's job, exactly as it is for archive reads.
#[test]
fn promotion_permission_does_not_imply_visibility() {
    assert_eq!(
        decide(
            Action::PromoteToArchive,
            &authenticated(actor(SystemRole::Student))
        ),
        decide(
            Action::CreateOwnDraft,
            &authenticated(actor(SystemRole::Student))
        )
    );
}

/// Retiring content is curation, not moderation: it stays readable, and the
/// person who owns or maintains it may do it. Taking content *out of view*
/// remains `ChangeModerationState`, which only moderators hold.
#[test]
fn archiving_content_belongs_to_its_owner_and_curators() {
    let mut author = actor(SystemRole::Student);
    author.is_resource_author = true;
    assert!(is_allowed(Action::ArchiveContent, &authenticated(author)));

    let mut maintainer = actor(SystemRole::Student);
    maintainer.is_assigned_maintainer = true;
    assert!(is_allowed(
        Action::ArchiveContent,
        &authenticated(maintainer)
    ));

    for system_role in [SystemRole::Moderator, SystemRole::Admin] {
        assert!(is_allowed(
            Action::ArchiveContent,
            &authenticated(actor(system_role))
        ));
    }

    for system_role in [SystemRole::Student, SystemRole::OrganizationMember] {
        assert!(!is_allowed(
            Action::ArchiveContent,
            &authenticated(actor(system_role))
        ));
    }

    assert!(!is_allowed(Action::ArchiveContent, &Actor::Guest));
}

/// Archiving must not become a back door to the moderation powers it sits
/// next to: an author who may retire their own thread still may not hide it.
#[test]
fn archiving_does_not_confer_moderation() {
    let mut author = actor(SystemRole::Student);
    author.is_resource_author = true;

    assert!(is_allowed(
        Action::ArchiveContent,
        &authenticated(author.clone())
    ));
    assert!(!is_allowed(
        Action::ChangeModerationState,
        &authenticated(author)
    ));
}

/// Anyone with a session may report. The person best placed to notice a
/// privacy leak is usually the person it exposes, who has no special role.
#[test]
fn reporting_content_requires_only_a_session() {
    assert!(!is_allowed(Action::ReportContent, &Actor::Guest));

    for system_role in [
        SystemRole::Student,
        SystemRole::OrganizationMember,
        SystemRole::Moderator,
        SystemRole::Admin,
    ] {
        assert!(is_allowed(
            Action::ReportContent,
            &authenticated(actor(system_role))
        ));
    }
}

/// Reviewing reports is moderation, and deliberately NOT an author or
/// maintainer privilege: a report may be about the author, so letting them
/// review it would let the accused close the case. This is the one place a
/// resource role must not widen the decision.
#[test]
fn reviewing_reports_is_moderation_only_and_never_the_author() {
    for system_role in [SystemRole::Moderator, SystemRole::Admin] {
        assert!(is_allowed(
            Action::ReviewReports,
            &authenticated(actor(system_role))
        ));
    }

    let mut author = actor(SystemRole::Student);
    author.is_resource_author = true;
    assert!(!is_allowed(Action::ReviewReports, &authenticated(author)));

    let mut maintainer = actor(SystemRole::Student);
    maintainer.is_assigned_maintainer = true;
    assert!(!is_allowed(
        Action::ReviewReports,
        &authenticated(maintainer)
    ));

    for system_role in [SystemRole::Student, SystemRole::OrganizationMember] {
        assert!(!is_allowed(
            Action::ReviewReports,
            &authenticated(actor(system_role))
        ));
    }

    assert!(!is_allowed(Action::ReviewReports, &Actor::Guest));
}

/// The union-of-grants rule means a Deny cell cannot revoke a capability
/// another column grants. `ReviewReports` therefore has to be Deny in *every*
/// non-moderation column rather than relying on Author being denied — a point
/// the matrix documentation calls out explicitly.
#[test]
fn a_moderator_who_authored_the_content_still_reviews_by_role_not_by_authorship() {
    let mut moderator_author = actor(SystemRole::Moderator);
    moderator_author.is_resource_author = true;

    assert!(is_allowed(
        Action::ReviewReports,
        &authenticated(moderator_author)
    ));
}
