import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import ts from "typescript";

const violations: string[] = [];

async function inspect(directory: string) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await inspect(path);
      continue;
    }
    if (/\.(css|scss|less)$/.test(path)) {
      violations.push(`${path}: application styles are not allowed`);
      continue;
    }
    if (!/\.tsx?$/.test(path)) continue;
    const source = ts.createSourceFile(
      path,
      await readFile(path, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    function visit(node: ts.Node) {
      if (
        ts.isJsxAttribute(node) &&
        ["style", "sx", "className"].includes(node.name.getText(source))
      ) {
        violations.push(`${path}: ${node.name.getText(source)} bypasses the UI system`);
      }
      if (
        (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
        node.tagName.getText(source) === "style"
      ) {
        violations.push(`${path}: inline stylesheet is not allowed`);
      }
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        const module = node.moduleSpecifier.text;
        if (/\.(css|scss|less)$/.test(module) && !module.startsWith("@primer/")) {
          violations.push(`${path}: only Primer distribution styles may be imported`);
        }
        if (
          /^(tailwindcss|styled-components|@emotion\/|@mui\/|antd|lucide-react)/.test(
            module,
          )
        ) {
          violations.push(`${path}: ${module} is outside the selected UI system`);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
}

await inspect("src");
if (violations.length) {
  console.error(violations.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    "UI source checks passed. Visual and keyboard checks still require the browser.",
  );
}
