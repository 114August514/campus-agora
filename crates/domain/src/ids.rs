use std::fmt;

use uuid::Uuid;

macro_rules! define_id {
    ($name:ident) => {
        #[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
        pub struct $name(Uuid);

        impl $name {
            pub fn from_uuid(value: Uuid) -> Self {
                Self(value)
            }

            pub fn into_uuid(self) -> Uuid {
                self.0
            }
        }

        impl fmt::Display for $name {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                self.0.fmt(f)
            }
        }
    };
}

define_id!(UserId);
define_id!(OrganizationId);
define_id!(SessionId);
define_id!(PostId);
define_id!(RevisionId);
define_id!(CorrectionId);
define_id!(CommentId);
