import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { defineConfig, loadEnv, type Plugin } from "vite-plus";
import vue from "@vitejs/plugin-vue";

const FONT_CSS_LINK = '<link rel="stylesheet" href="/fonts/wenkai.css" />';
const GZIP_EXTENSIONS = new Set([".css", ".html", ".js"]);
const GZIP_MIN_BYTES = 1024;

function fileHash(content: Buffer | string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 8);
}

// Keep public/fonts/wenkai.css formatted for the repository while shipping the
// smallest equivalent stylesheet from dist/ without touching quoted strings.
function minifyFontCss(css: string): string {
  return css
    .replace(/"[^"]*"|\s+/g, (token) => (token.startsWith('"') ? token : " "))
    .replace(/"[^"]*"|\s*([{};:,])\s*/g, (token, punct?: string) => (punct ? punct : token))
    .trim();
}

// Precompress text assets once so Nginx can serve them with gzip_static and no
// per-request CPU. Binary formats such as woff2 are already compressed.
function writeGzipCopies(directory: string): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      writeGzipCopies(path);
      continue;
    }
    if (!GZIP_EXTENSIONS.has(extname(entry.name))) continue;
    const source = readFileSync(path);
    if (source.byteLength < GZIP_MIN_BYTES) continue;
    const compressed = gzipSync(source, { level: 9 });
    if (compressed.byteLength < source.byteLength) {
      writeFileSync(`${path}.gz`, compressed);
    }
  }
}

function fontAssetVersioning(root: string, isBuild: boolean): Plugin {
  let outDir = resolve(root, "dist");
  let fontCss: string | undefined;

  return {
    name: "font-asset-versioning",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    transformIndexHtml(html) {
      if (!html.includes(FONT_CSS_LINK)) {
        throw new Error(`index.html must contain ${FONT_CSS_LINK}`);
      }
      const sourceCss = readFileSync(resolve(root, "public/fonts/wenkai.css"), "utf8");
      fontCss = isBuild ? minifyFontCss(sourceCss) : sourceCss;
      const cssHash = fileHash(fontCss);
      const primaryChunkHash = fileHash(
        readFileSync(resolve(root, "public/fonts/wenkai-000.woff2")),
      );
      const preload = `<link rel="preload" href="/fonts/wenkai-000.woff2?v=${primaryChunkHash}" as="font" type="font/woff2" crossorigin />`;
      const stylesheet = `<link rel="stylesheet" href="/fonts/wenkai.css?v=${cssHash}" />`;
      return html.replace(FONT_CSS_LINK, `${preload}\n    ${stylesheet}`);
    },
    closeBundle() {
      if (!isBuild) return;
      if (fontCss !== undefined) {
        // Vite copies public/ before writing the bundle; overwrite the formatted
        // source with the version whose hash is referenced by dist/index.html.
        writeFileSync(resolve(outDir, "fonts/wenkai.css"), fontCss);
      }
      writeGzipCopies(outDir);
    },
  };
}

export default defineConfig(({ command, mode }) => {
  // Only the dev proxy target is read here; VITE_* values are handled by Vite itself.
  const env = loadEnv(mode, process.cwd(), "API_");
  const isBuild = command === "build";
  return {
    plugins: [vue(), fontAssetVersioning(process.cwd(), isBuild)],
    define: isBuild
      ? {
          __VUE_OPTIONS_API__: false,
          __VUE_PROD_DEVTOOLS__: false,
          __VUE_I18N_FULL_INSTALL__: false,
          __VUE_I18N_LEGACY_API__: false,
          __INTLIFY_PROD_DEVTOOLS__: false,
        }
      : undefined,
    build: {
      // The SPA has a single entry chunk, so the modulepreload polyfill is unused.
      modulePreload: false,
    },
    server: {
      host: "127.0.0.1",
      port: 5174,
      strictPort: true,
      proxy: {
        "/api": {
          target: env.API_PROXY_TARGET || "http://wallpaper-api.test:8100",
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: "happy-dom",
      include: ["tests/unit/**/*.test.ts"],
      setupFiles: ["tests/setup.ts"],
      restoreMocks: true,
      coverage: {
        provider: "v8",
        include: ["src/**/*.{ts,vue}"],
        reporter: ["text", "html", "json", "json-summary"],
        thresholds: {
          // Every executable statement, branch, function and line in src/ must be
          // covered; the locale dictionaries hold static data verified by parity tests.
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
      },
    },
  };
});
