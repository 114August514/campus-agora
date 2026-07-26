import { describe, expect, test } from "bun:test";
import type { CurrentUser } from "@campus-agora/api-client";
import { allowedTransitions } from "../src/features/archive/labels";
import {
  visibleNavigationItems,
  visibleNavigationLabels,
} from "../src/features/auth/navigation";

function user(systemRole: CurrentUser["systemRole"]): CurrentUser {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    displayName: "测试用户",
    systemRole,
    organizations: [],
  };
}

describe("shell navigation visibility", () => {
  test("guests only see public entries", () => {
    expect(visibleNavigationLabels(undefined)).toEqual(["资料库", "讨论"]);
  });

  test("authenticated students gain the archive assistant but not moderation", () => {
    expect(visibleNavigationLabels(user("student"))).toEqual([
      "资料库",
      "讨论",
      "归档助手",
    ]);
  });

  test("organization members do not gain moderation access", () => {
    expect(visibleNavigationLabels(user("organization_member"))).not.toContain("审核");
  });

  test("moderators and admins see the moderation entry", () => {
    for (const role of ["moderator", "admin"] as const) {
      expect(visibleNavigationLabels(user(role))).toContain("审核");
    }
  });

  test("every visible entry carries a route the shell can link to", () => {
    for (const item of visibleNavigationItems(user("admin"))) {
      expect(item.to.startsWith("/")).toBe(true);
    }
  });
});

describe("archive status transitions offered in the UI", () => {
  const student = { systemRole: "student" as const, isAuthor: true };
  const stranger = { systemRole: "student" as const, isAuthor: false };
  const moderator = { systemRole: "moderator" as const, isAuthor: false };

  test("an author may publish, retire, and restore their own work", () => {
    // Mirrors the backend matrix: publishing a draft and archiving or
    // restoring one's own content are author privileges. Hiding is not, and
    // showing a button the server refuses guarantees a 403.
    expect(allowedTransitions("draft", student)).toEqual(["published"]);
    expect(allowedTransitions("published", student)).toEqual(["archived"]);
    expect(allowedTransitions("archived", student)).toEqual(["published"]);
    expect(allowedTransitions("hidden", student)).toEqual([]);
    expect(allowedTransitions("rejected", student)).toEqual([]);
  });

  test("a non-author student is offered nothing", () => {
    for (const status of [
      "draft",
      "published",
      "hidden",
      "rejected",
      "archived",
    ] as const) {
      expect(allowedTransitions(status, stranger)).toEqual([]);
    }
  });

  test("a moderator gets the full state machine", () => {
    expect(allowedTransitions("draft", moderator)).toEqual(["published", "rejected"]);
    expect(allowedTransitions("published", moderator)).toEqual(["hidden", "archived"]);
    expect(allowedTransitions("hidden", moderator)).toEqual(["published"]);
    expect(allowedTransitions("rejected", moderator)).toEqual(["draft"]);
    // Archiving must not put content beyond moderation reach.
    expect(allowedTransitions("archived", moderator)).toEqual([
      "published",
      "hidden",
    ]);
  });
});
