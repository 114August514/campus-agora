use std::fmt;

/// Application-level errors. The API crate maps these onto the flat HTTP
/// `ErrorResponse` contract; message strings stay free of secret material.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ApplicationError {
    Unauthorized,
    Forbidden,
    Validation(String),
    NotFound(String),
    Conflict(String),
    Internal(String),
}

impl fmt::Display for ApplicationError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Unauthorized => write!(f, "unauthorized"),
            Self::Forbidden => write!(f, "forbidden"),
            Self::Validation(message) => write!(f, "validation failed: {message}"),
            Self::NotFound(message) => write!(f, "not found: {message}"),
            Self::Conflict(message) => write!(f, "conflict: {message}"),
            Self::Internal(message) => write!(f, "internal error: {message}"),
        }
    }
}

impl std::error::Error for ApplicationError {}
