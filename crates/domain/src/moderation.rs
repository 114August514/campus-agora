//! Abuse reporting and the risk vocabulary the moderation queue orders by.
//! Pure: no database, HTTP, or serialization concerns.
//!
//! A report is not a correction. A correction says "this entry is out of date
//! or wrong" and is resolved by the people who maintain it. A report says
//! "this content breaks the rules" and may be *about* those same people, so it
//! is reviewed by moderators instead. The two stay separate all the way down.

use crate::archive::TextError;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum ReportCategory {
    Spam,
    Harassment,
    PrivacyViolation,
    Misinformation,
    Illegal,
    Other,
}

impl ReportCategory {
    pub const ALL: [Self; 6] = [
        Self::Spam,
        Self::Harassment,
        Self::PrivacyViolation,
        Self::Misinformation,
        Self::Illegal,
        Self::Other,
    ];

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Spam => "spam",
            Self::Harassment => "harassment",
            Self::PrivacyViolation => "privacy_violation",
            Self::Misinformation => "misinformation",
            Self::Illegal => "illegal",
            Self::Other => "other",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "spam" => Some(Self::Spam),
            "harassment" => Some(Self::Harassment),
            "privacy_violation" => Some(Self::PrivacyViolation),
            "misinformation" => Some(Self::Misinformation),
            "illegal" => Some(Self::Illegal),
            "other" => Some(Self::Other),
            _ => None,
        }
    }

    /// How urgently a moderator should look. Fixed per category rather than
    /// scored: anything adaptive would be the trust-and-safety automation the
    /// milestone rules out, and a queue whose ordering nobody can predict is
    /// worse than one that is merely coarse.
    pub fn risk(self) -> RiskLevel {
        match self {
            // Someone may be being hurt, exposed, or put at legal risk.
            Self::Harassment | Self::PrivacyViolation | Self::Illegal => RiskLevel::High,
            // Wrong campus information can send people to the wrong office on
            // the wrong day, but it is not an emergency.
            Self::Misinformation => RiskLevel::Medium,
            Self::Spam | Self::Other => RiskLevel::Low,
        }
    }
}

/// Ordered so the queue can sort by it. `None` exists for an item whose
/// reports have all been resolved but which a reviewer has not yet closed.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum RiskLevel {
    None,
    Low,
    Medium,
    High,
}

impl RiskLevel {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::None => "none",
            Self::Low => "low",
            Self::Medium => "medium",
            Self::High => "high",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "none" => Some(Self::None),
            "low" => Some(Self::Low),
            "medium" => Some(Self::Medium),
            "high" => Some(Self::High),
            _ => None,
        }
    }
}

/// The risk of a piece of content is the worst thing anyone has said about it.
/// One serious report is not diluted by any number of trivial ones.
pub fn risk_for(categories: &[ReportCategory]) -> RiskLevel {
    categories
        .iter()
        .map(|category| category.risk())
        .max()
        .unwrap_or(RiskLevel::None)
}

/// Long enough to explain what is wrong and where, short enough that the
/// field is not a channel for pasting the very content being reported.
pub const REPORT_MESSAGE_MAX_CHARS: usize = 1_000;

pub fn validate_report_message(input: &str) -> Result<String, TextError> {
    let trimmed = input.trim();

    if trimmed.is_empty() {
        return Err(TextError::Empty);
    }

    if trimmed.chars().count() > REPORT_MESSAGE_MAX_CHARS {
        return Err(TextError::TooLong);
    }

    Ok(trimmed.to_owned())
}
