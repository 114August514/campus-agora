# Desktop Architecture

The desktop app is a Tauri WebView shell for the web application. It should not
become a second backend.

## Responsibilities

`apps/desktop` owns:

- Tauri window configuration.
- Loading the web app in development and production modes.
- Tauri capability files.
- Small local commands when a system capability is required.

`apps/desktop` does not own:

- Discussion or archive business rules.
- Moderation workflows.
- Permission decisions.
- Database access.
- API contract generation.

## WebView And API Client

The WebView uses the same `apps/web` code and `@campus-agora/api-client` package
as the browser app. API calls go through HTTP unless a future feature documents
why a local command is necessary.

## Capability Policy

Tauri capabilities are minimum-permission:

- Only enable capabilities used by the current milestone.
- Record the purpose and risk before adding file system, shell, clipboard,
  notification, opener, or update capabilities.
- Add tests or checks that ensure unexpected capabilities are not enabled.

## Token And Cache Boundary

Before real login:

- Do not store long-lived tokens in WebView localStorage.
- Prefer short-lived session material or secure platform storage when needed.
- Define logout cleanup before storing auth state locally.
- Document cache expiry and offline behavior before adding local persistence.

## Future Local Commands

Future commands must state:

- User-facing purpose.
- Required Tauri permission.
- Input and output shape.
- Security risk.
- Test coverage.
- Fallback when the command is unavailable.

## Release Notes

Tauri auto-update is outside M0.2. Before desktop distribution, define:

- App version strategy.
- Minimum supported API version.
- Signing key handling.
- Rollback and failed-update behavior.
