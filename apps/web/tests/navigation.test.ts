import { describe, expect, test } from "bun:test";
import type { CurrentUser } from "@campus-agora/api-client";
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
