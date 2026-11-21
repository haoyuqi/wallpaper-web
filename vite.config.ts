import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite-plus";
import vue from "@vitejs/plugin-vue";

function fileHash(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex").slice(0, 8);
}

function fontAssetVersioning(root: string): Plugin {
  return {
    name: "font-asset-versioning",
    transformIndexHtml(html) {
      const cssHash = fileHash(resolve(root, "public/fonts/wenkai.css"));
      const primaryChunkHash = fileHash(resolve(root, "public/fonts/wenkai-000.woff2"));
      const preload = `<link rel="preload" href="/fonts/wenkai-000.woff2?v=${primaryChunkHash}" as="font" type="font/woff2" crossorigin />`;
      const stylesheet = `<link rel="stylesheet" href="/fonts/wenkai.css?v=${cssHash}" />`;
      return html.replace(
        '<link rel="stylesheet" href="/fonts/wenkai.css" />',
        `${preload}\n    ${stylesheet}`,
      );
    },
  };
}

export default defineConfig(({ command, mode }) => {
  // Only the dev proxy target is read here; VITE_* values are handled by Vite itself.
  const env = loadEnv(mode, process.cwd(), "API_");
  const isBuild = command === "build";
  return {
    plugins: [vue(), fontAssetVersioning(process.cwd())],
    define: isBuild
      ? {
          __VUE_OPTIONS_API__: false,
          __VUE_PROD_DEVTOOLS__: false,
          __VUE_I18N_FULL_INSTALL__: false,
          __VUE_I18N_LEGACY_API__: false,
          __INTLIFY_PROD_DEVTOOLS__: false,
        }
      : undefined,
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
