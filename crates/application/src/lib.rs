pub mod archive;
pub mod auth;
pub mod discussion;
pub mod errors;
pub mod memory;
pub mod moderation;
pub mod ports;

pub use errors::ApplicationError;

pub const APPLICATION_BOUNDARY: &str = "campus-agora-application";
