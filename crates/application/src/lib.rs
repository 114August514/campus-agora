pub mod auth;
pub mod errors;
pub mod memory;
pub mod ports;

pub use errors::ApplicationError;

pub const APPLICATION_BOUNDARY: &str = "campus-agora-application";
