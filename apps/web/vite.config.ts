import react from "@vitejs/plugin-react";
import { type Plugin, defineConfig } from "vite";

function attribute(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"))?.[2];
}

function assetPath(value: string | undefined): string | undefined {
  return value?.replace(/^\.\//, "");
}

/** Produce one portable HTML file with library CSS and a classic IIFE script. */
function inlineIntoHtml(): Plugin {
  return {
    name: "campus-agora:inline-into-html",
    apply: "build",
    enforce: "post",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        return html
          .replace(
            /<script\b(?=[^>]*\bdata-development-entry\b)[^>]*>[\s\S]*?<\/script\s*>/gi,
            "",
          )
          .replace(
            /<p\b(?=[^>]*\bdata-development-fallback\b)[^>]*>[\s\S]*?<\/p\s*>/gi,
            "",
          );
      },
    },
    generateBundle(_options, bundle) {
      const html = bundle["index.html"];
      if (!html || html.type !== "asset") {
        this.error("Single-file export requires an index.html asset.");
      }
      const entries = Object.values(bundle).filter(
        (file) => file.type === "chunk" && file.isEntry,
      );
      if (entries.length !== 1 || entries[0].type !== "chunk") {
        this.error("Single-file export requires exactly one JavaScript entry.");
      }
      const entry = entries[0];
      if (entry.imports.length || entry.dynamicImports.length) {
        this.error("Single-file export cannot contain imported JavaScript chunks.");
      }

      const decode = (value: string | Uint8Array) =>
        typeof value === "string" ? value : new TextDecoder().decode(value);
      let source = decode(html.source);
      let scriptMatches = 0;
      source = source.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, (tag) => {
        if (assetPath(attribute(tag, "src")) !== entry.fileName) return tag;
        scriptMatches += 1;
        return "";
      });
      if (scriptMatches !== 1) {
        this.error(
          `Expected one script tag for ${entry.fileName}; found ${scriptMatches}.`,
        );
      }

      const inlined = [entry.fileName];
      for (const file of Object.values(bundle)) {
        if (file.type !== "asset" || !file.fileName.endsWith(".css")) continue;
        let styleMatches = 0;
        const css = decode(file.source).replace(/<\/style/gi, "<\\/style");
        source = source.replace(/<link\b[^>]*>/gi, (tag) => {
          const rel = attribute(tag, "rel")?.toLowerCase().split(/\s+/);
          if (
            !rel?.includes("stylesheet") ||
            assetPath(attribute(tag, "href")) !== file.fileName
          ) {
            return tag;
          }
          styleMatches += 1;
          return `<style>${css}</style>`;
        });
        if (styleMatches !== 1) {
          this.error(
            `Expected one stylesheet tag for ${file.fileName}; found ${styleMatches}.`,
          );
        }
        inlined.push(file.fileName);
      }

      if (!source.includes('id="root"') || !source.includes("</body>")) {
        this.error("Single-file export requires a root element and closing body tag.");
      }
      const code = entry.code.replace(/<\/script/gi, "<\\/script");
      // Inline classic scripts do not defer: run only after the root exists.
      source = source.replace("</body>", () => `<script>${code}</script>\n  </body>`);
      const markup = source.replace(
        /<(script|style)\b([^>]*)>[\s\S]*?<\/\1\s*>/gi,
        (_tag, name, attributes) => `<${name}${attributes}></${name}>`,
      );
      if (
        /<script\b[^>]*\bsrc\s*=/i.test(markup) ||
        /<script\b[^>]*\btype\s*=\s*["']module["']/i.test(markup) ||
        /<link\b[^>]*\brel\s*=\s*["'](?:stylesheet|modulepreload)["']/i.test(markup) ||
        /\bdata-development-(?:entry|fallback)\b/i.test(markup)
      ) {
        this.error(
          "Single-file export still contains external or development entry tags.",
        );
      }
      const leftovers = Object.keys(bundle).filter(
        (name) => name !== html.fileName && !inlined.includes(name),
      );
      if (leftovers.length) {
        this.error(
          `Single-file export still has separate assets: ${leftovers.join(", ")}`,
        );
      }
      html.source = source;
      for (const name of inlined) delete bundle[name];
    },
  };
}

export default defineConfig({
  plugins: [react(), inlineIntoHtml()],
  // Hash routes and relative URLs also work when the exported file is moved.
  base: "./",
  build: {
    assetsInlineLimit: 4096,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: {
      output: {
        format: "iife",
        inlineDynamicImports: true,
      },
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      // Local discovery API (tools/discovery-trial: `npm run serve`).
      "/api/discovery": "http://127.0.0.1:8787",
    },
  },
});
