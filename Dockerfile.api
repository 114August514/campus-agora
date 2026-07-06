FROM rust:1-slim AS builder

WORKDIR /app

COPY Cargo.toml Cargo.lock rust-toolchain.toml ./
COPY crates ./crates

RUN cargo build --release -p campus_agora_api --bin campus-agora-api

FROM debian:bookworm-slim AS runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/campus-agora-api /usr/local/bin/campus-agora-api

ENV SERVER_HOST=0.0.0.0
ENV SERVER_PORT=8080
ENV RUST_LOG=campus_agora_api=info,tower_http=info

EXPOSE 8080

CMD ["campus-agora-api"]
