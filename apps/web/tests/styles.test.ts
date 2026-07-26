import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const srcDir = join(import.meta.dir, "../src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);

    if (statSync(path).isDirectory()) {
      return sourceFiles(path);
    }

    return path.endsWith(".tsx") ? [path] : [];
  });
}

const css = readFileSync(join(srcDir, "styles/globals.css"), "utf8");

function definedClasses(): Set<string> {
  return new Set(
    [...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((match) => match[1] as string),
  );
}

function usedClasses(): Map<string, string> {
  const used = new Map<string, string>();

  for (const file of sourceFiles(srcDir)) {
    const source = readFileSync(file, "utf8");

    for (const match of source.matchAll(/className=(?:"([^"]+)"|\{`([^`]+)`\})/g)) {
      // Drop `${...}` interpolations: a composed name like `button-${variant}`
      // has no single literal to look up, and its concrete values are covered
      // by the variant tests.
      const literal = (match[1] ?? match[2] ?? "").replace(/\$\{[^}]*\}/g, " ");

      for (const name of literal.split(/\s+/).filter(Boolean)) {
        // A trailing hyphen is the prefix half of a composed name such as
        // `badge-${tone}`; the concrete variants are covered by their own
        // tests, so only complete literals are checked here.
        if (/^[a-zA-Z][\w-]*[a-zA-Z0-9]$/.test(name)) {
          used.set(name, file.replace(srcDir, "src"));
        }
      }
    }
  }

  return used;
}

/**
 * A class name with no rule is invisible in review, in typecheck, and in lint —
 * the element simply renders unstyled. This catches the whole class of "the
 * page references a style that was never written".
 */
describe("stylesheet coverage", () => {
  test("every class name a component renders has a rule", () => {
    const defined = definedClasses();
    const missing = [...usedClasses().entries()]
      .filter(([name]) => !defined.has(name))
      .map(([name, file]) => `${name} (${file})`);

    expect(missing).toEqual([]);
  });

  test("entry bodies preserve the author's line breaks", () => {
    // Archive entries are prose written in a textarea. Without pre-wrap every
    // paragraph break collapses and the product's core content becomes a wall
    // of text.
    const rule = css.match(/\.entryBody\s*\{[^}]*\}/)?.[0] ?? "";

    expect(rule).toContain("white-space");
    expect(rule).toContain("pre-wrap");
  });
});
