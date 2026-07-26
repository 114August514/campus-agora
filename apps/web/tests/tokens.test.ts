import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const stylesDir = join(import.meta.dir, "../src/styles");

function readStyle(name: string): string {
  return readFileSync(join(stylesDir, name), "utf8");
}

function declaredTokens(css: string): Set<string> {
  return new Set(
    [...css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((match) => match[1] as string),
  );
}

function referencedTokens(css: string): Set<string> {
  return new Set(
    [...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((match) => match[1] as string),
  );
}

const tokens = readStyle("tokens.css");
const themes = readStyle("themes.css");
const globals = readStyle("globals.css");

describe("design tokens", () => {
  test("every token used in global styles is defined", () => {
    const defined = declaredTokens(tokens);
    const missing = [...referencedTokens(globals)].filter(
      (token) => !defined.has(token),
    );

    expect(missing).toEqual([]);
  });

  test("the dark theme overrides every colour token", () => {
    // A colour token missing from the dark theme silently keeps its light
    // value, which is invisible in code review but obvious to a user.
    const lightColours = [...declaredTokens(tokens)].filter((token) =>
      token.startsWith("--color-"),
    );
    const darkColours = declaredTokens(themes);
    const missing = lightColours.filter((token) => !darkColours.has(token));

    expect(missing).toEqual([]);
  });

  test("the semantic tokens the archive flows need are defined", () => {
    const defined = declaredTokens(tokens);

    for (const token of [
      "--color-success",
      "--color-warning",
      "--color-info",
      "--color-danger-hover",
      "--color-hover",
      "--color-selected",
      "--color-border-strong",
      "--shadow-overlay",
      "--z-dropdown",
      "--z-modal",
      "--font-size-xxl",
      "--space-12",
      "--duration-medium",
    ]) {
      expect(defined.has(token)).toBe(true);
    }
  });
});
