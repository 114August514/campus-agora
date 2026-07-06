use std::path::PathBuf;

fn main() {
    let output = std::env::args_os()
        .nth(1)
        .map(PathBuf::from)
        .expect("usage: export-openapi <output-path>");

    if let Some(parent) = output.parent() {
        std::fs::create_dir_all(parent).expect("failed to create OpenAPI output directory");
    }

    let document = campus_agora_api::openapi_document();
    let json = serde_json::to_string_pretty(&document).expect("failed to serialize OpenAPI");
    std::fs::write(&output, format!("{json}\n")).expect("failed to write OpenAPI document");
}
