use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;

/// Creates a lazy pool: connections are established on first use, so the API
/// can boot and report readiness even while PostgreSQL is still starting.
pub fn connect_lazy(database_url: &str) -> Result<PgPool, sqlx::Error> {
    PgPoolOptions::new()
        .max_connections(5)
        .connect_lazy(database_url)
}
