#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "campus_agora_api=info,tower_http=info".into()),
        )
        .init();

    let host = std::env::var("SERVER_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = std::env::var("SERVER_PORT").unwrap_or_else(|_| "8080".to_string());
    let address = format!("{host}:{port}");

    let listener = tokio::net::TcpListener::bind(&address)
        .await
        .expect("failed to bind API listener");

    tracing::info!(%address, "campus agora api listening");

    axum::serve(listener, campus_agora_api::build_router())
        .await
        .expect("api server failed");
}
