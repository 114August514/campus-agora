import type {
  Correction,
  CurrentUser,
  KnowledgeEntry,
  MetaResponse,
  MockLoginRequest,
  ModerationStatus,
  ReadinessResponse,
} from "./generated";

export interface CampusAgoraMockFetchOptions {
  meta?: Partial<MetaResponse>;
  readiness?: ReadinessResponse;
  /** Overrides the built-in personas with app-specific fixtures. */
  users?: Partial<Record<MockLoginRequest["persona"], CurrentUser>>;
  /** Session lifetime in seconds; mirrors SESSION_TTL_SECONDS. */
  sessionTtlSeconds?: number;
}

const DEFAULT_SESSION_TTL_SECONDS = 86400;

// Stable ids so a login is reproducible across calls, but still UUID-shaped
// like the real server's, so consumers that parse or shorten ids behave the
// same against both.
const DEFAULT_USERS: Record<MockLoginRequest["persona"], CurrentUser> = {
  student: {
    id: "11111111-1111-4111-8111-111111111111",
    displayName: "示例学生",
    systemRole: "student",
    organizations: [],
  },
  organization_member: {
    id: "22222222-2222-4222-8222-222222222222",
    displayName: "示例组织成员",
    systemRole: "organization_member",
    organizations: [
      {
        organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        slug: "demo-student-union",
        name: "示例学生会",
      },
    ],
  },
  moderator: {
    id: "33333333-3333-4333-8333-333333333333",
    displayName: "示例审核员",
    systemRole: "moderator",
    organizations: [],
  },
  admin: {
    id: "44444444-4444-4444-8444-444444444444",
    displayName: "示例管理员",
    systemRole: "admin",
    organizations: [],
  },
};

interface MockSession {
  user: CurrentUser;
  expiresAt: string;
}

/// Mirrors crates/domain::can_transition so the mock rejects exactly the
/// transitions the server rejects.
const ALLOWED_TRANSITIONS: ReadonlyArray<[ModerationStatus, ModerationStatus]> = [
  ["draft", "published"],
  ["draft", "rejected"],
  ["published", "hidden"],
  ["hidden", "published"],
  ["rejected", "draft"],
];

function canTransition(from: ModerationStatus, to: ModerationStatus): boolean {
  return ALLOWED_TRANSITIONS.some(([a, b]) => a === from && b === to);
}

/// Mirrors the SQL visibility predicate: published is public, and a viewer
/// additionally sees what they authored. Moderators and admins see all.
function canSee(entry: KnowledgeEntry, viewer: CurrentUser | undefined): boolean {
  if (entry.moderationStatus === "published") {
    return true;
  }

  if (!viewer) {
    return false;
  }

  return (
    viewer.systemRole === "moderator" ||
    viewer.systemRole === "admin" ||
    entry.authorId === viewer.id
  );
}

let mockIdCounter = 0;

function mockUuid(): string {
  mockIdCounter += 1;
  const suffix = mockIdCounter.toString(16).padStart(12, "0");
  return `00000000-0000-4000-8000-${suffix}`;
}

export function createCampusAgoraMockFetch(
  options: CampusAgoraMockFetchOptions = {},
): typeof fetch {
  const meta: MetaResponse = {
    appName: "Campus Agora",
    version: "0.1.0",
    capabilities: {
      authMockEnabled: true,
      desktopEnabled: true,
      aiArchiveEnabled: false,
      attachmentsEnabled: false,
    },
    ...options.meta,
  };
  const readiness = options.readiness ?? {
    status: "ready",
    checks: {
      postgres: "ok",
    },
  };
  const users = { ...DEFAULT_USERS, ...options.users };
  const ttlSeconds = options.sessionTtlSeconds ?? DEFAULT_SESSION_TTL_SECONDS;
  const activeSessions = new Map<string, MockSession>();
  const entries = new Map<string, KnowledgeEntry>();
  const revisions = new Map<string, Array<Record<string, unknown>>>();
  const corrections = new Map<string, Correction>();
  let tokenCounter = 0;

  /// Mirrors the server: no header means guest, but a header the server
  /// cannot resolve is 401. Downgrading an expired session to guest would
  /// hide the reader's own drafts instead of telling them to log in again.
  function viewerFor(request: Request): CurrentUser | undefined | "invalid" {
    const token = bearerToken(request);

    if (!token) {
      return undefined;
    }

    const session = activeSessions.get(token);

    return session && Date.parse(session.expiresAt) > Date.now()
      ? session.user
      : "invalid";
  }

  const CATEGORIES = [
    "onboarding",
    "campus_life",
    "academics",
    "organizations",
    "procedures",
    "other",
  ];
  const AUDIENCES = [
    "all_students",
    "new_students",
    "undergraduate",
    "graduate",
    "organization_members",
  ];
  const SOURCE_KINDS = [
    "firsthand_experience",
    "official_announcement",
    "group_chat",
    "discussion",
    "unspecified",
  ];

  /// Mirrors crates/domain: trimmed, lowercased, deduped, bounded.
  function normalizeTags(input: unknown): string[] | "invalid" {
    if (input === undefined) {
      return [];
    }

    if (!Array.isArray(input)) {
      return "invalid";
    }

    const tags: string[] = [];

    for (const raw of input) {
      const tag = String(raw).trim().toLowerCase();

      if (!tag) {
        continue;
      }

      if ([...tag].length > 32) {
        return "invalid";
      }

      if (!tags.includes(tag)) {
        tags.push(tag);
      }
    }

    return tags.length > 10 ? "invalid" : tags;
  }

  /// Mirrors the domain permission matrix for the two moderation actions.
  function mayChangeStatus(
    viewer: CurrentUser,
    entry: KnowledgeEntry,
    target: ModerationStatus,
  ): boolean {
    const isModeration =
      viewer.systemRole === "moderator" || viewer.systemRole === "admin";

    if (isModeration) {
      return true;
    }

    // An author may publish their own draft; everything else is moderation.
    return (
      target === "published" &&
      entry.moderationStatus === "draft" &&
      entry.authorId === viewer.id
    );
  }

  /// EditOwnDraft: author, assigned maintainer, moderator, admin. The mock has
  /// no maintainer concept, so it models the other three.
  function mayEdit(viewer: CurrentUser, entry: KnowledgeEntry): boolean {
    return (
      entry.authorId === viewer.id ||
      viewer.systemRole === "moderator" ||
      viewer.systemRole === "admin"
    );
  }

  function isPersona(value: unknown): value is MockLoginRequest["persona"] {
    return typeof value === "string" && Object.hasOwn(users, value);
  }

  return async (input, init) => {
    const request = new Request(input, init);
    const path = new URL(request.url).pathname;
    const requestId = request.headers.get("x-request-id") ?? "mock-request-id";

    if (path === "/healthz") {
      return textResponse("ok", requestId);
    }

    if (path === "/readyz") {
      // The server answers 503 when a dependency is down; a mock that always
      // returns 200 would hide every readiness failure from the client.
      const status = readiness.status === "ready" ? 200 : 503;
      return jsonResponse(readiness, status, requestId);
    }

    if (path === "/api/v1/meta") {
      return jsonResponse(meta, 200, requestId);
    }

    if (path === "/api/v1/auth/mock-login") {
      if (request.method !== "POST") {
        return methodNotAllowed("POST", requestId);
      }

      if (!meta.capabilities.authMockEnabled) {
        return errorResponse(
          403,
          "auth_mock_disabled",
          "Mock campus login is disabled",
          requestId,
        );
      }

      const body = (await request.json().catch(() => undefined)) as
        | { persona?: unknown }
        | undefined;

      // The server distinguishes a body it cannot parse (400) from a
      // well-formed body naming an unknown persona (422).
      if (
        typeof body !== "object" ||
        body === null ||
        typeof body.persona !== "string"
      ) {
        return errorResponse(
          400,
          "invalid_request_body",
          "Request body must be valid JSON",
          requestId,
        );
      }

      if (!isPersona(body.persona)) {
        return errorResponse(
          422,
          "validation_failed",
          "Unknown mock persona",
          requestId,
        );
      }

      tokenCounter += 1;
      const token = `mock-session-token-${tokenCounter}`;
      const session: MockSession = {
        user: users[body.persona],
        expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      };
      activeSessions.set(token, session);

      return jsonResponse(
        { token, expiresAt: session.expiresAt, user: session.user },
        200,
        requestId,
      );
    }

    if (path === "/api/v1/auth/session" || path === "/api/v1/auth/logout") {
      const isLogout = path === "/api/v1/auth/logout";
      const allowed = isLogout ? "POST" : "GET";

      if (request.method !== allowed) {
        return methodNotAllowed(allowed, requestId);
      }

      const token = bearerToken(request);
      const session = token ? activeSessions.get(token) : undefined;

      if (!token || !session || Date.parse(session.expiresAt) <= Date.now()) {
        if (token && session) {
          activeSessions.delete(token);
        }

        return errorResponse(
          401,
          "unauthorized",
          "Authentication is required",
          requestId,
        );
      }

      if (isLogout) {
        activeSessions.delete(token);
        return emptyResponse(204, requestId);
      }

      return jsonResponse(
        { user: session.user, expiresAt: session.expiresAt },
        200,
        requestId,
      );
    }

    const archiveMatch =
      /^\/api\/v1\/knowledge-entries(?:\/([^/]+))?(?:\/(status|revisions|corrections))?(?:\/([^/]+)\/resolve)?$/.exec(
        path,
      );

    if (archiveMatch) {
      const [, entryId, subresource, correctionId] = archiveMatch;
      const resolved = viewerFor(request);
      const unauthorized = () =>
        errorResponse(401, "unauthorized", "Authentication is required", requestId);
      const forbidden = () => errorResponse(403, "forbidden", "Not allowed", requestId);
      const notFound = () =>
        errorResponse(404, "not_found", "Resource not found", requestId);
      const badBody = () =>
        errorResponse(
          400,
          "invalid_request_body",
          "Request body is invalid",
          requestId,
        );
      const unprocessable = (message: string) =>
        errorResponse(422, "validation_failed", message, requestId);

      // A token the server cannot resolve is an error on every archive path.
      if (resolved === "invalid") {
        return unauthorized();
      }

      const viewer = resolved;

      // Collection.
      if (!entryId) {
        if (request.method === "GET") {
          const url = new URL(request.url);
          const pageSize = Number(url.searchParams.get("pageSize") ?? "20");
          const page = Number(url.searchParams.get("page") ?? "1");

          if (!Number.isInteger(page) || !Number.isInteger(pageSize)) {
            return errorResponse(
              400,
              "invalid_query",
              "Query parameters are invalid",
              requestId,
            );
          }

          if (page < 1 || pageSize < 1 || pageSize > 100) {
            return errorResponse(
              422,
              "validation_failed",
              "page and pageSize are out of range",
              requestId,
            );
          }

          const q = url.searchParams.get("q")?.toLowerCase();
          const tag = url.searchParams.get("tag")?.toLowerCase();
          const category = url.searchParams.get("category");
          const matched = [...entries.values()]
            .filter((entry) => canSee(entry, viewer))
            .filter(
              (entry) =>
                !q ||
                entry.title.toLowerCase().includes(q) ||
                (entry.summary ?? "").toLowerCase().includes(q),
            )
            .filter((entry) => !tag || entry.tags.includes(tag))
            .filter((entry) => !category || entry.category === category);

          const totalItems = matched.length;
          return jsonResponse(
            {
              items: matched.slice((page - 1) * pageSize, page * pageSize),
              page,
              pageSize,
              totalItems,
              totalPages: Math.ceil(totalItems / pageSize),
            },
            200,
            requestId,
          );
        }

        if (request.method === "POST") {
          if (!viewer) {
            return unauthorized();
          }

          const body = (await request.json().catch(() => undefined)) as
            | Record<string, unknown>
            | undefined;

          if (
            !body ||
            typeof body.title !== "string" ||
            typeof body.body !== "string"
          ) {
            return badBody();
          }

          // The three metadata fields are required and enum-constrained, so an
          // unknown value is a malformed body rather than a validation failure
          // — matching how the server's serde layer rejects it.
          if (
            !CATEGORIES.includes(String(body.category)) ||
            !AUDIENCES.includes(String(body.applicableAudience)) ||
            !SOURCE_KINDS.includes(String(body.sourceKind))
          ) {
            return badBody();
          }

          const tags = normalizeTags(body.tags);

          if (tags === "invalid") {
            return unprocessable("tags are invalid");
          }

          if (body.title.trim().length === 0) {
            return unprocessable("title must not be empty");
          }

          if ([...body.title.trim()].length > 200) {
            return unprocessable("title is too long");
          }

          if (body.body.trim().length === 0) {
            return unprocessable("body must not be empty");
          }

          const timestamp = new Date().toISOString();
          const entry: KnowledgeEntry = {
            id: mockUuid(),
            authorId: viewer.id,
            title: body.title.trim(),
            body: body.body,
            summary:
              typeof body.summary === "string"
                ? body.summary.trim() || undefined
                : undefined,
            tags,
            category: body.category as KnowledgeEntry["category"],
            applicableAudience:
              body.applicableAudience as KnowledgeEntry["applicableAudience"],
            sourceKind: body.sourceKind as KnowledgeEntry["sourceKind"],
            sourceReference:
              typeof body.sourceReference === "string"
                ? body.sourceReference
                : undefined,
            moderationStatus: "draft",
            currentRevision: 1,
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          entries.set(entry.id, entry);
          revisions.set(entry.id, [
            {
              id: mockUuid(),
              revision: 1,
              editorId: viewer.id,
              title: entry.title,
              body: entry.body,
              summary: entry.summary,
              tags: entry.tags,
              createdAt: timestamp,
            },
          ]);

          return jsonResponse(entry, 201, requestId);
        }

        return methodNotAllowed("GET, POST", requestId);
      }

      const entry = entries.get(entryId);

      if (!entry || !canSee(entry, viewer)) {
        return notFound();
      }

      if (!subresource) {
        if (request.method === "GET") {
          return jsonResponse(entry, 200, requestId);
        }

        if (request.method === "PATCH") {
          if (!viewer) {
            return unauthorized();
          }

          if (!mayEdit(viewer, entry)) {
            return forbidden();
          }

          const body = (await request.json().catch(() => undefined)) as
            | Record<string, unknown>
            | undefined;

          if (!body) {
            return badBody();
          }

          for (const [field, allowed] of [
            ["category", CATEGORIES],
            ["applicableAudience", AUDIENCES],
            ["sourceKind", SOURCE_KINDS],
          ] as const) {
            if (body[field] !== undefined && !allowed.includes(String(body[field]))) {
              return badBody();
            }
          }

          const patchedTags =
            body.tags === undefined ? entry.tags : normalizeTags(body.tags);

          if (patchedTags === "invalid") {
            return unprocessable("tags are invalid");
          }

          if (typeof body.title === "string" && body.title.trim().length === 0) {
            return unprocessable("title must not be empty");
          }

          if (typeof body.body === "string" && body.body.trim().length === 0) {
            return unprocessable("body must not be empty");
          }

          const timestamp = new Date().toISOString();
          // The server merges all eight fields; dropping any of them here
          // would make the editor's save path untestable.
          const updated: KnowledgeEntry = {
            ...entry,
            title: typeof body.title === "string" ? body.title.trim() : entry.title,
            body: typeof body.body === "string" ? body.body : entry.body,
            summary:
              typeof body.summary === "string"
                ? body.summary.trim() || undefined
                : entry.summary,
            tags: patchedTags,
            category: (body.category as KnowledgeEntry["category"]) ?? entry.category,
            applicableAudience:
              (body.applicableAudience as KnowledgeEntry["applicableAudience"]) ??
              entry.applicableAudience,
            sourceKind:
              (body.sourceKind as KnowledgeEntry["sourceKind"]) ?? entry.sourceKind,
            sourceReference:
              typeof body.sourceReference === "string"
                ? body.sourceReference.trim() || undefined
                : entry.sourceReference,
            updatedAt: timestamp,
            // Only a private draft is rewritten in place.
            currentRevision:
              entry.moderationStatus === "draft"
                ? entry.currentRevision
                : entry.currentRevision + 1,
          };
          entries.set(entry.id, updated);

          const history = revisions.get(entry.id) ?? [];

          if (entry.moderationStatus === "draft") {
            // Rewrite the draft's single revision rather than leaving the
            // original text behind for publication to expose.
            const current = history.find(
              (snapshot) => snapshot.revision === updated.currentRevision,
            );

            if (current) {
              Object.assign(current, {
                editorId: viewer.id,
                title: updated.title,
                body: updated.body,
                summary: updated.summary,
                tags: updated.tags,
                createdAt: timestamp,
              });
            }
          } else {
            history.push({
              id: mockUuid(),
              revision: updated.currentRevision,
              editorId: viewer.id,
              title: updated.title,
              body: updated.body,
              summary: updated.summary,
              tags: updated.tags,
              createdAt: timestamp,
            });
          }

          return jsonResponse(updated, 200, requestId);
        }

        return methodNotAllowed("GET, PATCH", requestId);
      }

      if (subresource === "status") {
        if (request.method !== "POST") {
          return methodNotAllowed("POST", requestId);
        }

        if (!viewer) {
          return unauthorized();
        }

        const body = (await request.json().catch(() => undefined)) as
          | { status?: unknown }
          | undefined;

        if (!body || typeof body.status !== "string") {
          return errorResponse(
            400,
            "invalid_request_body",
            "Request body is invalid",
            requestId,
          );
        }

        const target = body.status as ModerationStatus;

        if (!ALLOWED_TRANSITIONS.some(([, to]) => to === target)) {
          return badBody();
        }

        if (!mayChangeStatus(viewer, entry, target)) {
          return forbidden();
        }

        if (!canTransition(entry.moderationStatus, target)) {
          return errorResponse(
            409,
            "conflict",
            `cannot move an entry from ${entry.moderationStatus} to ${target}`,
            requestId,
          );
        }

        const updated: KnowledgeEntry = {
          ...entry,
          moderationStatus: target,
          updatedAt: new Date().toISOString(),
        };
        entries.set(entry.id, updated);

        return jsonResponse(updated, 200, requestId);
      }

      if (subresource === "revisions") {
        if (request.method !== "GET") {
          return methodNotAllowed("GET", requestId);
        }

        return jsonResponse({ items: revisions.get(entry.id) ?? [] }, 200, requestId);
      }

      // Corrections, including the nested resolve action.
      if (correctionId) {
        if (request.method !== "POST") {
          return methodNotAllowed("POST", requestId);
        }

        if (!viewer) {
          return unauthorized();
        }

        const correction = corrections.get(correctionId);

        // Scoped to the entry in the path: resolving a correction that belongs
        // elsewhere must not succeed, and must not disclose its contents.
        if (!correction || correction.postId !== entry.id) {
          return notFound();
        }

        if (!mayEdit(viewer, entry)) {
          return forbidden();
        }

        // Idempotent: the first resolution wins, matching the server.
        const resolved: Correction = correction.resolvedAt
          ? correction
          : {
              ...correction,
              resolvedAt: new Date().toISOString(),
              resolvedBy: viewer.id,
            };
        corrections.set(correctionId, resolved);

        return jsonResponse(resolved, 200, requestId);
      }

      if (request.method === "GET") {
        if (!viewer) {
          return unauthorized();
        }

        // privacy.md limits reporter identities to people with a stake in the
        // entry.
        if (!mayEdit(viewer, entry)) {
          return forbidden();
        }

        return jsonResponse(
          {
            items: [...corrections.values()].filter(
              (correction) => correction.postId === entry.id,
            ),
          },
          200,
          requestId,
        );
      }

      if (request.method === "POST") {
        if (!viewer) {
          return unauthorized();
        }

        const body = (await request.json().catch(() => undefined)) as
          | { message?: unknown }
          | undefined;

        if (!body || typeof body.message !== "string") {
          return errorResponse(
            400,
            "invalid_request_body",
            "Request body is invalid",
            requestId,
          );
        }

        if (body.message.trim().length === 0) {
          return errorResponse(
            422,
            "validation_failed",
            "correction message must not be empty",
            requestId,
          );
        }

        const correction: Correction = {
          id: mockUuid(),
          postId: entry.id,
          reporterId: viewer.id,
          message: body.message.trim(),
          createdAt: new Date().toISOString(),
        };
        corrections.set(correction.id, correction);

        return jsonResponse(correction, 201, requestId);
      }

      return methodNotAllowed("GET, POST", requestId);
    }

    return errorResponse(404, "not_found", "Route not found", requestId);
  };
}

/// RFC 7235 makes the auth scheme case-insensitive, matching the server.
function bearerToken(request: Request): string | undefined {
  const header = request.headers.get("authorization");

  if (!header) {
    return undefined;
  }

  const separator = header.search(/\s/);

  if (separator < 0 || !/^bearer$/i.test(header.slice(0, separator))) {
    return undefined;
  }

  const token = header.slice(separator + 1).trim();
  return token.length > 0 ? token : undefined;
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  requestId: string,
): Response {
  return jsonResponse({ code, message, requestId }, status, requestId);
}

function methodNotAllowed(allow: string, requestId: string): Response {
  return new Response(null, {
    status: 405,
    headers: {
      allow,
      "x-request-id": requestId,
    },
  });
}

function jsonResponse(body: unknown, status: number, requestId: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "x-request-id": requestId,
    },
  });
}

function emptyResponse(status: number, requestId: string): Response {
  return new Response(null, {
    status,
    headers: {
      "x-request-id": requestId,
    },
  });
}

function textResponse(body: string, requestId: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/plain",
      "x-request-id": requestId,
    },
  });
}
