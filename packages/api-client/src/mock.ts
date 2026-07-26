import type {
  AiDraft,
  ArchiveSource,
  ContentReport,
  Correction,
  CurrentUser,
  Discussion,
  DiscussionReply,
  KnowledgeEntry,
  MetaResponse,
  MockLoginRequest,
  ModerationQueueItem,
  ModerationStatus,
  ReadinessResponse,
  ReportCategory,
  RiskLevel,
} from "./generated";

export interface CampusAgoraMockFetchOptions {
  meta?: Partial<MetaResponse>;
  readiness?: ReadinessResponse;
  /** Overrides the built-in personas with app-specific fixtures. */
  users?: Partial<Record<MockLoginRequest["persona"], CurrentUser>>;
  /** Session lifetime in seconds; mirrors SESSION_TTL_SECONDS. */
  sessionTtlSeconds?: number;
  /** Mirrors AI_ARCHIVE_ENABLED. Off by default, like the server. */
  aiArchiveEnabled?: boolean;
}

const DEFAULT_SESSION_TTL_SECONDS = 86400;

/// The content bounds from `crates/domain/src/archive.rs`, in one place. Each
/// handler used to re-implement its own subset, which is how three milestones
/// in a row shipped a rule the server enforced and the mock did not — and the
/// mock is the only backend `apps/web` tests ever see.
const LIMITS = {
  title: 200,
  summary: 500,
  body: 50_000,
  commentBody: 5_000,
  tag: 32,
  tags: 10,
  /// `SEARCH_QUERY_MAX_CHARS` in the two list services.
  searchQuery: 100,
  /// `REPORT_MESSAGE_MAX_CHARS` in crates/domain/src/moderation.rs.
  reportMessage: 1_000,
} as const;

const COMMENT_BODY_MAX_CHARS = LIMITS.commentBody;

/// Mirrors `bounded_text`: trims, rejects empty, and counts characters rather
/// than bytes so a CJK value is not rejected at a third of its stated limit.
function boundedText(
  value: unknown,
  max: number,
  field: string,
): { ok: true; value: string } | { ok: false; message: string } {
  const trimmed = typeof value === "string" ? value.trim() : "";

  if (!trimmed) {
    return { ok: false, message: `${field} must not be empty` };
  }

  if ([...trimmed].length > max) {
    return { ok: false, message: `${field} is too long` };
  }

  return { ok: true, value: trimmed };
}

/// Mirrors `validate_summary`: absent and whitespace-only both normalize to
/// undefined, so the store never holds a blank summary.
function boundedSummary(
  value: unknown,
): { ok: true; value: string | undefined } | { ok: false; message: string } {
  if (typeof value !== "string") {
    return { ok: true, value: undefined };
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return { ok: true, value: undefined };
  }

  if ([...trimmed].length > LIMITS.summary) {
    return { ok: false, message: "summary is too long" };
  }

  return { ok: true, value: trimmed };
}

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
  ["published", "archived"],
  ["archived", "published"],
  // Archiving must not put content beyond moderation reach.
  ["archived", "hidden"],
];

function canTransition(from: ModerationStatus, to: ModerationStatus): boolean {
  return ALLOWED_TRANSITIONS.some(([a, b]) => a === from && b === to);
}

/// Mirrors the SQL visibility predicate: published is public, and a viewer
/// additionally sees what they authored. Moderators and admins see all.
function isPubliclyVisible(status: ModerationStatus): boolean {
  // Archived content stays readable: an entry links back to the discussion it
  // came from, and that link has to resolve.
  return status === "published" || status === "archived";
}

function canSee(
  post: { moderationStatus: ModerationStatus; authorId: string },
  viewer: CurrentUser | undefined,
): boolean {
  if (isPubliclyVisible(post.moderationStatus)) {
    return true;
  }

  if (!viewer) {
    return false;
  }

  return (
    viewer.systemRole === "moderator" ||
    viewer.systemRole === "admin" ||
    post.authorId === viewer.id
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
  const aiArchiveEnabled =
    options.aiArchiveEnabled ?? options.meta?.capabilities?.aiArchiveEnabled ?? false;
  const activeSessions = new Map<string, MockSession>();
  const entries = new Map<string, KnowledgeEntry>();
  const revisions = new Map<string, Array<Record<string, unknown>>>();
  const corrections = new Map<string, Correction>();
  const discussions = new Map<string, Discussion>();
  const replies = new Map<string, DiscussionReply>();
  const sources: ArchiveSource[] = [];
  const reports: ContentReport[] = [];
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

      if ([...tag].length > LIMITS.tag) {
        return "invalid";
      }

      if (!tags.includes(tag)) {
        tags.push(tag);
      }
    }

    return tags.length > LIMITS.tags ? "invalid" : tags;
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

    if (entry.authorId !== viewer.id) {
      return false;
    }

    // An author may publish their own draft, and may retire or restore their
    // own published work. Hiding stays a moderation action.
    return (
      (target === "published" && entry.moderationStatus === "draft") ||
      (target === "archived" && entry.moderationStatus === "published") ||
      (target === "published" && entry.moderationStatus === "archived")
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

  /// AcceptAnswer: the asker plus the curators. The mock has no maintainer
  /// concept, so it models author, moderator, and admin.
  function mayAcceptAnswer(viewer: CurrentUser, discussion: Discussion): boolean {
    return (
      discussion.authorId === viewer.id ||
      viewer.systemRole === "moderator" ||
      viewer.systemRole === "admin"
    );
  }

  /// Same shape as `mayChangeStatus` for entries, against a discussion.
  function mayChangeDiscussionStatus(
    viewer: CurrentUser,
    discussion: Discussion,
    target: ModerationStatus,
  ): boolean {
    if (viewer.systemRole === "moderator" || viewer.systemRole === "admin") {
      return true;
    }

    if (discussion.authorId !== viewer.id) {
      return false;
    }

    return (
      (target === "published" && discussion.moderationStatus === "draft") ||
      (target === "archived" && discussion.moderationStatus === "published") ||
      (target === "published" && discussion.moderationStatus === "archived")
    );
  }

  function withReplyCount(discussion: Discussion): Discussion {
    return {
      ...discussion,
      replyCount: [...replies.values()].filter(
        (reply) => reply.postId === discussion.id,
      ).length,
    };
  }

  /// Mirrors campus_agora_domain::moderation::ReportCategory::risk.
  function riskForCategory(category: ReportCategory): RiskLevel {
    switch (category) {
      case "harassment":
      case "privacy_violation":
      case "illegal":
        return "high";
      case "misinformation":
        return "medium";
      default:
        return "low";
    }
  }

  const RISK_ORDER: RiskLevel[] = ["none", "low", "medium", "high"];

  /// The worst thing anyone said about it. One serious report is not diluted
  /// by any number of trivial ones.
  function riskFor(categories: ReportCategory[]): RiskLevel {
    return categories.reduce<RiskLevel>(
      (worst, category) =>
        RISK_ORDER.indexOf(riskForCategory(category)) > RISK_ORDER.indexOf(worst)
          ? riskForCategory(category)
          : worst,
      "none",
    );
  }

  /// Content of either kind, for the paths that treat content as content.
  function findPost(id: string) {
    const entry = entries.get(id);
    if (entry) {
      return {
        id,
        kind: "knowledge" as const,
        authorId: entry.authorId,
        title: entry.title,
        moderationStatus: entry.moderationStatus,
        updatedAt: entry.updatedAt,
      };
    }

    const discussion = discussions.get(id);
    if (discussion) {
      return {
        id,
        kind: "discussion" as const,
        authorId: discussion.authorId,
        title: discussion.title,
        moderationStatus: discussion.moderationStatus,
        updatedAt: discussion.updatedAt,
      };
    }

    return undefined;
  }

  /// ReviewReports is moderation only, and pointedly not the content's author:
  /// a report may be about them, and the accused must not close the case.
  function mayReviewReports(viewer: CurrentUser | undefined): boolean {
    return viewer?.systemRole === "moderator" || viewer?.systemRole === "admin";
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

          const rawQuery = url.searchParams.get("q");
          if (rawQuery && [...rawQuery.trim()].length > LIMITS.searchQuery) {
            return unprocessable(`q must be at most ${LIMITS.searchQuery} characters`);
          }

          const q = rawQuery?.toLowerCase();
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

          const title = boundedText(body.title, LIMITS.title, "title");
          if (!title.ok) {
            return unprocessable(title.message);
          }

          const text = boundedText(body.body, LIMITS.body, "body");
          if (!text.ok) {
            return unprocessable(text.message);
          }

          const summary = boundedSummary(body.summary);
          if (!summary.ok) {
            return unprocessable(summary.message);
          }

          const timestamp = new Date().toISOString();
          const entry: KnowledgeEntry = {
            id: mockUuid(),
            authorId: viewer.id,
            title: title.value,
            body: text.value,
            summary: summary.value,
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

    const sourcesMatch = /^\/api\/v1\/knowledge-entries\/([^/]+)\/sources$/.exec(path);

    if (sourcesMatch) {
      const [, entryId] = sourcesMatch;
      const resolved = viewerFor(request);

      if (resolved === "invalid") {
        return errorResponse(
          401,
          "unauthorized",
          "Authentication is required",
          requestId,
        );
      }

      if (request.method !== "GET") {
        return methodNotAllowed("GET", requestId);
      }

      const entry = entries.get(entryId as string);

      if (!entry || !canSee(entry, resolved)) {
        return errorResponse(404, "not_found", "Resource not found", requestId);
      }

      // A source pointing at a discussion the reader cannot see is omitted,
      // so the backlink cannot disclose a hidden title.
      const items = sources
        .filter((source) => source.entryId === entry.id)
        .filter((source) => {
          const discussion = discussions.get(source.sourcePostId);
          return discussion !== undefined && canSee(discussion, resolved);
        });

      return jsonResponse({ items }, 200, requestId);
    }

    const discussionMatch =
      /^\/api\/v1\/discussions(?:\/([^/]+))?(?:\/(status|replies|accepted-answer|promotions|derived-entries|ai-draft))?$/.exec(
        path,
      );

    if (discussionMatch) {
      const [, discussionId, subresource] = discussionMatch;
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

      if (resolved === "invalid") {
        return unauthorized();
      }

      const viewer = resolved;

      if (!discussionId) {
        if (request.method === "GET") {
          const url = new URL(request.url);
          const rawQuery = url.searchParams.get("q");
          const q = rawQuery?.toLowerCase();
          const tag = url.searchParams.get("tag")?.toLowerCase();
          const page = Number(url.searchParams.get("page") ?? "1");
          const pageSize = Number(url.searchParams.get("pageSize") ?? "20");

          if (!Number.isInteger(page) || !Number.isInteger(pageSize)) {
            return errorResponse(
              400,
              "invalid_query",
              "Query parameters are invalid",
              requestId,
            );
          }

          if (page < 1 || pageSize < 1 || pageSize > 100) {
            return unprocessable("page and pageSize are out of range");
          }

          if (rawQuery && [...rawQuery.trim()].length > LIMITS.searchQuery) {
            return unprocessable(`q must be at most ${LIMITS.searchQuery} characters`);
          }

          const matched = [...discussions.values()]
            .filter((discussion) => canSee(discussion, viewer))
            .filter(
              (discussion) =>
                !q ||
                discussion.title.toLowerCase().includes(q) ||
                discussion.body.toLowerCase().includes(q),
            )
            .filter((discussion) => !tag || discussion.tags.includes(tag))
            .map(withReplyCount);

          return jsonResponse(
            {
              items: matched.slice((page - 1) * pageSize, page * pageSize),
              page,
              pageSize,
              totalItems: matched.length,
              totalPages: Math.ceil(matched.length / pageSize),
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
            | { title?: unknown; body?: unknown; tags?: unknown }
            | undefined;

          if (
            !body ||
            typeof body.title !== "string" ||
            typeof body.body !== "string"
          ) {
            return badBody();
          }

          const title = boundedText(body.title, LIMITS.title, "title");
          if (!title.ok) {
            return unprocessable(title.message);
          }

          const text = boundedText(body.body, LIMITS.body, "body");
          if (!text.ok) {
            return unprocessable(text.message);
          }

          const tags = normalizeTags(body.tags);
          if (tags === "invalid") {
            return unprocessable("tags are invalid");
          }

          const now = new Date().toISOString();
          const discussion: Discussion = {
            id: mockUuid(),
            authorId: viewer.id,
            title: title.value,
            body: text.value,
            tags,
            moderationStatus: "draft",
            acceptedCommentId: null,
            replyCount: 0,
            createdAt: now,
            updatedAt: now,
          };
          discussions.set(discussion.id, discussion);

          return jsonResponse(discussion, 201, requestId);
        }

        return methodNotAllowed("GET, POST", requestId);
      }

      const discussion = discussions.get(discussionId);

      // Visibility before permission: an invisible discussion is 404 on every
      // one of its endpoints, never 403.
      if (!discussion || !canSee(discussion, viewer)) {
        return notFound();
      }

      if (!subresource) {
        if (request.method !== "GET") {
          return methodNotAllowed("GET", requestId);
        }

        return jsonResponse(withReplyCount(discussion), 200, requestId);
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
          return badBody();
        }

        const target = body.status as ModerationStatus;

        if (!ALLOWED_TRANSITIONS.some(([, to]) => to === target)) {
          return badBody();
        }

        if (!mayChangeDiscussionStatus(viewer, discussion, target)) {
          return forbidden();
        }

        if (!canTransition(discussion.moderationStatus, target)) {
          return errorResponse(
            409,
            "conflict",
            `cannot move a discussion from ${discussion.moderationStatus} to ${target}`,
            requestId,
          );
        }

        const updated: Discussion = {
          ...discussion,
          moderationStatus: target,
          updatedAt: new Date().toISOString(),
        };
        discussions.set(updated.id, updated);

        return jsonResponse(withReplyCount(updated), 200, requestId);
      }

      if (subresource === "replies") {
        if (request.method === "GET") {
          const items = [...replies.values()].filter(
            (reply) => reply.postId === discussion.id,
          );

          return jsonResponse({ items }, 200, requestId);
        }

        if (request.method === "POST") {
          if (!viewer) {
            return unauthorized();
          }

          const body = (await request.json().catch(() => undefined)) as
            | { body?: unknown }
            | undefined;

          if (!body || typeof body.body !== "string") {
            return badBody();
          }

          // A draft is still being worded and an archived thread is closed.
          if (discussion.moderationStatus !== "published") {
            return errorResponse(
              409,
              "conflict",
              `a ${discussion.moderationStatus} discussion does not accept replies`,
              requestId,
            );
          }

          const text = body.body.trim();

          if (!text) {
            return unprocessable("body must not be empty");
          }

          if ([...text].length > COMMENT_BODY_MAX_CHARS) {
            return unprocessable(
              `body must be at most ${COMMENT_BODY_MAX_CHARS} characters`,
            );
          }

          const now = new Date().toISOString();
          const reply: DiscussionReply = {
            id: mockUuid(),
            postId: discussion.id,
            authorId: viewer.id,
            body: text,
            createdAt: now,
            updatedAt: now,
          };
          replies.set(reply.id, reply);

          return jsonResponse(reply, 201, requestId);
        }

        return methodNotAllowed("GET, POST", requestId);
      }

      if (subresource === "accepted-answer") {
        if (request.method !== "POST") {
          return methodNotAllowed("POST", requestId);
        }

        if (!viewer) {
          return unauthorized();
        }

        const body = (await request.json().catch(() => undefined)) as
          | { commentId?: unknown }
          | undefined;

        if (!body || (body.commentId !== null && typeof body.commentId !== "string")) {
          return badBody();
        }

        if (!mayAcceptAnswer(viewer, discussion)) {
          return forbidden();
        }

        // Resolved inside the discussion the caller was authorized against.
        if (typeof body.commentId === "string") {
          const reply = replies.get(body.commentId);

          if (!reply || reply.postId !== discussion.id) {
            return notFound();
          }
        }

        const updated: Discussion = {
          ...discussion,
          acceptedCommentId: (body.commentId as string | null) ?? null,
          updatedAt: new Date().toISOString(),
        };
        discussions.set(updated.id, updated);

        return jsonResponse(withReplyCount(updated), 200, requestId);
      }

      if (subresource === "promotions") {
        if (request.method !== "POST") {
          return methodNotAllowed("POST", requestId);
        }

        if (!viewer) {
          return unauthorized();
        }

        const body = (await request.json().catch(() => undefined)) as
          | Record<string, unknown>
          | undefined;

        if (!body) {
          return badBody();
        }

        // Promotion copies text into a separately-moderated artifact, so the
        // source must be public. Being able to see it is not enough.
        if (!isPubliclyVisible(discussion.moderationStatus)) {
          return errorResponse(
            409,
            "conflict",
            `only a publicly readable discussion can be promoted, this one is ${discussion.moderationStatus}`,
            requestId,
          );
        }

        let sourceBody = discussion.body;
        let sourceAuthorId = discussion.authorId;

        if (typeof body.commentId === "string") {
          const reply = replies.get(body.commentId);

          if (!reply || reply.postId !== discussion.id) {
            return notFound();
          }

          sourceBody = reply.body;
          sourceAuthorId = reply.authorId;
        } else if (body.commentId !== undefined && body.commentId !== null) {
          return badBody();
        }

        // Overrides go through the same bounds as any other write. Promoting a
        // reply builds its title from the thread's, so a legal thread title
        // plus a suffix can exceed the entry limit — the server rejects that
        // and the mock has to as well, or the web tests assert a navigation
        // that never happens in production.
        const title = boundedText(
          typeof body.title === "string" ? body.title : discussion.title,
          LIMITS.title,
          "title",
        );
        if (!title.ok) {
          return unprocessable(title.message);
        }

        const text = boundedText(
          typeof body.body === "string" ? body.body : sourceBody,
          LIMITS.body,
          "body",
        );
        if (!text.ok) {
          return unprocessable(text.message);
        }

        const summary = boundedSummary(body.summary);
        if (!summary.ok) {
          return unprocessable(summary.message);
        }

        const tags = Array.isArray(body.tags)
          ? normalizeTags(body.tags)
          : discussion.tags;
        if (tags === "invalid") {
          return unprocessable("tags are invalid");
        }

        const now = new Date().toISOString();
        const entry: KnowledgeEntry = {
          id: mockUuid(),
          authorId: viewer.id,
          title: title.value,
          body: text.value,
          summary: summary.value,
          tags,
          category: (typeof body.category === "string"
            ? body.category
            : "other") as KnowledgeEntry["category"],
          applicableAudience: (typeof body.applicableAudience === "string"
            ? body.applicableAudience
            : "all_students") as KnowledgeEntry["applicableAudience"],
          sourceKind: "discussion",
          moderationStatus: "draft",
          currentRevision: 1,
          createdAt: now,
          updatedAt: now,
        };

        entries.set(entry.id, entry);
        revisions.set(entry.id, [
          {
            id: mockUuid(),
            postId: entry.id,
            revision: 1,
            editorId: viewer.id,
            title: entry.title,
            body: entry.body,
            summary: entry.summary,
            tags: entry.tags,
            createdAt: now,
          },
        ]);

        const source: ArchiveSource = {
          entryId: entry.id,
          sourcePostId: discussion.id,
          sourceCommentId: (body.commentId as string | undefined) ?? null,
          sourceAuthorId,
          sourceAuthorName:
            Object.values(users).find((user) => user.id === sourceAuthorId)
              ?.displayName ?? "未知用户",
          sourceTitle: discussion.title,
          createdAt: now,
        };
        sources.push(source);

        return jsonResponse({ entry, source }, 201, requestId);
      }

      if (subresource === "ai-draft") {
        if (request.method !== "POST") {
          return methodNotAllowed("POST", requestId);
        }

        if (!viewer) {
          return unauthorized();
        }

        // Off unless the deployment turned it on, mirroring
        // AI_ARCHIVE_ENABLED. The mock has no flag of its own, so it refuses —
        // a page must not be built against a capability the server may not
        // have.
        if (!aiArchiveEnabled) {
          return forbidden();
        }

        if (!isPubliclyVisible(discussion.moderationStatus)) {
          return errorResponse(
            409,
            "conflict",
            `only a publicly readable discussion can be drafted from, this one is ${discussion.moderationStatus}`,
            requestId,
          );
        }

        const threadReplies = [...replies.values()].filter(
          (reply) => reply.postId === discussion.id,
        );

        // The accepted answer leads, matching the deterministic provider.
        const ordered = [
          {
            commentId: null as string | null,
            body: discussion.body,
            authorId: discussion.authorId,
          },
          ...threadReplies.map((reply) => ({
            commentId: reply.id,
            body: reply.body,
            authorId: reply.authorId,
          })),
        ].sort((left, right) => {
          const leftAccepted = left.commentId === discussion.acceptedCommentId ? 0 : 1;
          const rightAccepted =
            right.commentId === discussion.acceptedCommentId ? 0 : 1;
          return leftAccepted - rightAccepted;
        });

        const now = new Date().toISOString();
        const entry: KnowledgeEntry = {
          id: mockUuid(),
          authorId: viewer.id,
          title: discussion.title,
          body: ordered.map((source) => source.body.trim()).join("\n\n"),
          summary: undefined,
          tags: discussion.tags,
          category: "other",
          applicableAudience: "all_students",
          sourceKind: "discussion",
          moderationStatus: "draft",
          currentRevision: 1,
          aiProvider: "deterministic-v1",
          createdAt: now,
          updatedAt: now,
        };
        entries.set(entry.id, entry);
        revisions.set(entry.id, [
          {
            id: mockUuid(),
            postId: entry.id,
            revision: 1,
            editorId: viewer.id,
            title: entry.title,
            body: entry.body,
            summary: entry.summary,
            tags: entry.tags,
            createdAt: now,
          },
        ]);

        const drafted: ArchiveSource[] = ordered.map((source) => {
          const record: ArchiveSource = {
            entryId: entry.id,
            sourcePostId: discussion.id,
            sourceCommentId: source.commentId,
            sourceAuthorId: source.authorId,
            sourceAuthorName:
              Object.values(users).find((user) => user.id === source.authorId)
                ?.displayName ?? "未知用户",
            sourceTitle: discussion.title,
            createdAt: now,
          };
          sources.push(record);
          return record;
        });

        return jsonResponse({ entry, sources: drafted }, 201, requestId);
      }

      if (subresource === "derived-entries") {
        if (request.method !== "GET") {
          return methodNotAllowed("GET", requestId);
        }

        // Scoped: an entry the reader cannot see is not listed, so the
        // backlink cannot enumerate other people's drafts.
        const items = sources
          .filter((source) => source.sourcePostId === discussion.id)
          .map((source) => ({ source, entry: entries.get(source.entryId) }))
          .filter(
            (pair): pair is { source: ArchiveSource; entry: KnowledgeEntry } =>
              pair.entry !== undefined && canSee(pair.entry, viewer),
          )
          .map(({ source, entry }) => ({
            entryId: entry.id,
            title: entry.title,
            moderationStatus: entry.moderationStatus,
            createdAt: source.createdAt,
          }));

        return jsonResponse({ items }, 200, requestId);
      }
    }

    // ---- M4: reports, the moderation queue, and AI drafting ----------------

    if (path === "/api/v1/reports") {
      const resolved = viewerFor(request);
      const requestUnauthorized = () =>
        errorResponse(401, "unauthorized", "Authentication is required", requestId);

      if (resolved === "invalid" || !resolved) {
        return requestUnauthorized();
      }

      if (request.method !== "POST") {
        return methodNotAllowed("POST", requestId);
      }

      const body = (await request.json().catch(() => undefined)) as
        | { postId?: unknown; category?: unknown; message?: unknown }
        | undefined;

      if (
        !body ||
        typeof body.postId !== "string" ||
        typeof body.category !== "string" ||
        ![
          "spam",
          "harassment",
          "privacy_violation",
          "misinformation",
          "illegal",
          "other",
        ].includes(body.category)
      ) {
        return errorResponse(
          400,
          "invalid_request_body",
          "Request body is invalid",
          requestId,
        );
      }

      const post = findPost(body.postId);
      if (!post || !canSee(post, resolved)) {
        return errorResponse(404, "not_found", "Resource not found", requestId);
      }

      const message = boundedText(body.message, LIMITS.reportMessage, "report message");
      if (!message.ok) {
        return errorResponse(422, "validation_failed", message.message, requestId);
      }

      // One open report per reporter and post, matching the partial unique
      // index. A report control must not double as a flood button.
      const duplicate = reports.some(
        (report) =>
          report.postId === post.id &&
          report.reporterId === resolved.id &&
          !report.resolvedAt,
      );
      if (duplicate) {
        return errorResponse(
          409,
          "conflict",
          "you already have an open report on this content",
          requestId,
        );
      }

      const report: ContentReport = {
        id: mockUuid(),
        postId: post.id,
        reporterId: resolved.id,
        category: body.category as ReportCategory,
        message: message.value,
        createdAt: new Date().toISOString(),
        resolvedAt: null,
        resolvedBy: null,
        resolution: null,
      };
      reports.push(report);

      // Reporting deliberately changes no status: otherwise every user would
      // hold a takedown button, and the first report would also be the last.
      return jsonResponse(report, 201, requestId);
    }

    if (path === "/api/v1/moderation/queue") {
      const resolved = viewerFor(request);

      if (resolved === "invalid" || !resolved) {
        return errorResponse(
          401,
          "unauthorized",
          "Authentication is required",
          requestId,
        );
      }

      if (request.method !== "GET") {
        return methodNotAllowed("GET", requestId);
      }

      if (!mayReviewReports(resolved)) {
        return errorResponse(403, "forbidden", "Not allowed", requestId);
      }

      const url = new URL(request.url);
      const page = Number(url.searchParams.get("page") ?? "1");
      const pageSize = Number(url.searchParams.get("pageSize") ?? "20");

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

      const queued: ModerationQueueItem[] = [];
      for (const id of [...entries.keys(), ...discussions.keys()]) {
        const post = findPost(id);
        if (!post) {
          continue;
        }

        const open = reports.filter(
          (report) => report.postId === id && !report.resolvedAt,
        );

        // Everything awaiting a decision: open reports, plus content its
        // author submitted for review with none.
        if (open.length === 0 && post.moderationStatus !== "pending_review") {
          continue;
        }

        queued.push({
          postId: id,
          postKind: post.kind,
          title: post.title,
          authorId: post.authorId,
          moderationStatus: post.moderationStatus,
          risk: riskFor(open.map((report) => report.category)),
          openReportCount: open.length,
          queuedAt: open[0]?.createdAt ?? post.updatedAt,
        });
      }

      // Worst first, then longest-waiting within a band.
      queued.sort(
        (left, right) =>
          RISK_ORDER.indexOf(right.risk) - RISK_ORDER.indexOf(left.risk) ||
          left.queuedAt.localeCompare(right.queuedAt) ||
          left.postId.localeCompare(right.postId),
      );

      return jsonResponse(
        {
          items: queued.slice((page - 1) * pageSize, page * pageSize),
          page,
          pageSize,
          totalItems: queued.length,
          totalPages: Math.ceil(queued.length / pageSize),
        },
        200,
        requestId,
      );
    }

    const reviewMatch =
      /^\/api\/v1\/moderation\/content\/([^/]+)\/reports(?:\/([^/]+)\/resolve)?$/.exec(
        path,
      );

    if (reviewMatch) {
      const [, postId, reportId] = reviewMatch;
      const resolved = viewerFor(request);

      if (resolved === "invalid" || !resolved) {
        return errorResponse(
          401,
          "unauthorized",
          "Authentication is required",
          requestId,
        );
      }

      if (!mayReviewReports(resolved)) {
        return errorResponse(403, "forbidden", "Not allowed", requestId);
      }

      const post = findPost(postId as string);
      if (!post || !canSee(post, resolved)) {
        return errorResponse(404, "not_found", "Resource not found", requestId);
      }

      if (!reportId) {
        if (request.method !== "GET") {
          return methodNotAllowed("GET", requestId);
        }

        return jsonResponse(
          { items: reports.filter((report) => report.postId === post.id) },
          200,
          requestId,
        );
      }

      if (request.method !== "POST") {
        return methodNotAllowed("POST", requestId);
      }

      const body = (await request.json().catch(() => undefined)) as
        | { resolution?: unknown }
        | undefined;

      if (
        !body ||
        typeof body.resolution !== "string" ||
        !["upheld", "dismissed"].includes(body.resolution)
      ) {
        return errorResponse(
          400,
          "invalid_request_body",
          "Request body is invalid",
          requestId,
        );
      }

      // Scoped to the content the caller was authorized against: a report
      // belonging to a different item is missing, not resolvable.
      const report = reports.find(
        (candidate) => candidate.id === reportId && candidate.postId === post.id,
      );
      if (!report) {
        return errorResponse(404, "not_found", "Resource not found", requestId);
      }

      if (!report.resolvedAt) {
        report.resolvedAt = new Date().toISOString();
        report.resolvedBy = resolved.id;
        report.resolution = body.resolution as ContentReport["resolution"];
      }

      return jsonResponse(report, 200, requestId);
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
