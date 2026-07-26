use async_trait::async_trait;
use campus_agora_domain::{AuthProviderKind, SystemRole};

use crate::errors::ApplicationError;

/// Provider-specific login input. Real campus providers add variants (for
/// example an SSO ticket or an OIDC authorization code) without touching
/// business permissions.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum AuthCredential {
    MockPersona(String),
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct OrganizationSeed {
    pub slug: String,
    pub name: String,
}

/// The provider-verified identity handed to the auth service. Raw provider
/// subjects are hashed before persistence; no raw assertions are stored.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct VerifiedCampusIdentity {
    pub provider: AuthProviderKind,
    pub subject: String,
    pub display_name: String,
    pub system_role: SystemRole,
    pub organization: Option<OrganizationSeed>,
}

#[async_trait]
pub trait AuthProvider: Send + Sync {
    async fn verify(
        &self,
        credential: &AuthCredential,
    ) -> Result<VerifiedCampusIdentity, ApplicationError>;
}

/// Deterministic personas for local development, CI, and demos. See
/// `docs/architecture/auth-permissions.md`.
pub struct MockCampusAuthProvider;

pub const MOCK_PERSONAS: [&str; 4] = ["student", "organization_member", "moderator", "admin"];

const DEMO_ORGANIZATION_SLUG: &str = "demo-student-union";
const DEMO_ORGANIZATION_NAME: &str = "示例学生会";

#[async_trait]
impl AuthProvider for MockCampusAuthProvider {
    async fn verify(
        &self,
        credential: &AuthCredential,
    ) -> Result<VerifiedCampusIdentity, ApplicationError> {
        let AuthCredential::MockPersona(persona) = credential;

        let identity = match persona.as_str() {
            "student" => VerifiedCampusIdentity {
                provider: AuthProviderKind::MockCampus,
                subject: "mock-student-1".to_owned(),
                display_name: "示例学生".to_owned(),
                system_role: SystemRole::Student,
                organization: None,
            },
            "organization_member" => VerifiedCampusIdentity {
                provider: AuthProviderKind::MockCampus,
                subject: "mock-organization-member-1".to_owned(),
                display_name: "示例组织成员".to_owned(),
                system_role: SystemRole::OrganizationMember,
                organization: Some(OrganizationSeed {
                    slug: DEMO_ORGANIZATION_SLUG.to_owned(),
                    name: DEMO_ORGANIZATION_NAME.to_owned(),
                }),
            },
            "moderator" => VerifiedCampusIdentity {
                provider: AuthProviderKind::MockCampus,
                subject: "mock-moderator-1".to_owned(),
                display_name: "示例审核员".to_owned(),
                system_role: SystemRole::Moderator,
                organization: None,
            },
            "admin" => VerifiedCampusIdentity {
                provider: AuthProviderKind::MockCampus,
                subject: "mock-admin-1".to_owned(),
                display_name: "示例管理员".to_owned(),
                system_role: SystemRole::Admin,
                organization: None,
            },
            // The message is fixed rather than echoing `persona`: it is
            // caller-controlled and reaches the client verbatim in the 422
            // body, so reflecting it would turn the error contract into an
            // arbitrary reflection channel.
            _ => {
                return Err(ApplicationError::Validation(
                    "Unknown mock persona".to_owned(),
                ))
            }
        };

        Ok(identity)
    }
}
