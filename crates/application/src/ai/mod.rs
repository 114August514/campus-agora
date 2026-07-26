//! AI-assisted archive drafting: the port, a deterministic provider, and the
//! use case that turns a suggestion into an ordinary human-owned draft.

mod provider;
mod service;

pub use provider::{
    ArchiveDraftProvider, DeterministicDraftProvider, DraftRequest, DraftSource, DraftSuggestion,
};
pub use service::{AiDraftConfig, AiDraftService, DraftOutcome};
