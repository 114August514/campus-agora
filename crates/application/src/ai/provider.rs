//! The drafting port and the deterministic provider behind it.
//!
//! The port's shape is the security design. A provider receives text and
//! returns text plus the ids of the sources it drew from. It is handed no
//! repository, no service, and no user — so there is no code path by which it
//! could write, publish, or read anything it was not given. The exit criterion
//! "AI output cannot bypass human action to publish" is satisfied by there
//! being nothing to review rather than by a guard someone could later remove.
//!
//! No external provider is contacted. `docs/product/milestones.md` lists that
//! as an M4 non-goal until the privacy and security documents cover what would
//! be sent, and `docs/operations/security.md` records the boundary.

use async_trait::async_trait;
use campus_agora_domain::CommentId;

use crate::errors::ApplicationError;

/// One piece of source text the provider may draw from. `comment_id` is `None`
/// for the discussion's opening post.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DraftSource {
    pub comment_id: Option<CommentId>,
    pub body: String,
    /// Whether the community marked this reply as the accepted answer.
    pub accepted: bool,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DraftRequest {
    pub title: String,
    pub tags: Vec<String>,
    pub sources: Vec<DraftSource>,
}

/// What the provider produced, and which of the offered sources it used. The
/// service records exactly these as the entry's provenance, so the claim "this
/// draft came from those replies" is checkable rather than asserted.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DraftSuggestion {
    pub title: String,
    pub summary: Option<String>,
    pub body: String,
    pub used_sources: Vec<Option<CommentId>>,
}

#[async_trait]
pub trait ArchiveDraftProvider: Send + Sync {
    /// Recorded on the entry, so a reader can tell which provider composed it.
    fn name(&self) -> &'static str;

    async fn draft(&self, request: DraftRequest) -> Result<DraftSuggestion, ApplicationError>;
}

/// Composes a draft in process, with no model and no network call.
///
/// It is deliberately simple and deliberately deterministic: the milestone is
/// about the *interface* — traceability, editability, and the human gate — not
/// about generation quality. A provider that produced a different draft each
/// time would make the human review harder, not easier, because a reviewer
/// could not tell whether text changed because the sources changed.
pub struct DeterministicDraftProvider;

#[async_trait]
impl ArchiveDraftProvider for DeterministicDraftProvider {
    fn name(&self) -> &'static str {
        "deterministic-v1"
    }

    async fn draft(&self, request: DraftRequest) -> Result<DraftSuggestion, ApplicationError> {
        if request.sources.is_empty() {
            return Err(ApplicationError::Validation(
                "a draft needs at least one source".to_owned(),
            ));
        }

        // The accepted answer leads: it is the community's own judgement about
        // which reply was useful, and a draft that buried it would be worse
        // than one that starts there.
        let mut ordered = request.sources.clone();
        ordered.sort_by_key(|source| !source.accepted);

        let body = ordered
            .iter()
            .map(|source| source.body.trim())
            .filter(|text| !text.is_empty())
            .collect::<Vec<_>>()
            .join("\n\n");

        // A summary a person can correct at a glance, rather than a claim the
        // draft makes on its own authority.
        let summary = ordered
            .first()
            .map(|source| first_sentence(&source.body))
            .filter(|text| !text.is_empty());

        Ok(DraftSuggestion {
            title: request.title,
            summary,
            body,
            used_sources: ordered.iter().map(|source| source.comment_id).collect(),
        })
    }
}

/// The opening sentence, bounded so a reply written as one long paragraph does
/// not become a summary as long as the body.
fn first_sentence(text: &str) -> String {
    const MAX: usize = 120;

    let trimmed = text.trim();
    let end = trimmed
        .char_indices()
        .find(|(_, character)| matches!(character, '。' | '！' | '？' | '\n'))
        .map(|(index, character)| index + character.len_utf8());

    let sentence = match end {
        Some(index) => &trimmed[..index],
        None => trimmed,
    };

    sentence.chars().take(MAX).collect()
}
