import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ROUTES,
  ROUTE_PATHS,
  archiveDetailPath,
  archiveEditPath,
} from "../src/app/routes";

describe("route table", () => {
  test("declares every archive and discussion flow plus the design system", () => {
    expect(ROUTE_PATHS).toEqual([
      "/",
      "/archive",
      "/archive/new",
      "/archive/:id",
      "/archive/:id/edit",
      "/discussions",
      "/discussions/new",
      "/discussions/:id",
      "/design-system",
    ]);
  });

  test("builds addressable paths for a specific entry", () => {
    // Linkability is the point: durable knowledge has to be referenceable.
    expect(archiveDetailPath("abc")).toBe("/archive/abc");
    expect(archiveEditPath("abc")).toBe("/archive/abc/edit");
  });

  test("the app renders a route for every declared path and a catch-all", () => {
    const app = readFileSync(join(import.meta.dir, "../src/app/App.tsx"), "utf8");

    for (const key of Object.keys(ROUTES) as Array<keyof typeof ROUTES>) {
      expect(app).toContain(`ROUTES.${key}`);
    }

    // Without the catch-all an unknown URL renders a blank shell.
    expect(app).toContain('path="*"');
  });
});
