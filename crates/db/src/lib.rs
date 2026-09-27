pub mod pool;
pub mod repositories;

pub use pool::connect_lazy;
pub use repositories::PgAuthStore;

/// Directory holding the committed SQL migrations, relative to this crate.
/// Tests and tooling load it at runtime; the API server never migrates on
/// boot.
pub const MIGRATIONS_DIR: &str = "migrations";

pub const DB_BOUNDARY: &str = "campus-agora-db";
