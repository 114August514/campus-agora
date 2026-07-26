//! Discussion use cases and the discussion-to-archive loop.

mod service;

pub(crate) use service::action_for_transition;
pub use service::{
    DiscussionService, ListDiscussionQuery, NewDiscussionInput, PromoteInput, PromotionOutcome,
    ReplyInput, MAX_PAGE_SIZE,
};
