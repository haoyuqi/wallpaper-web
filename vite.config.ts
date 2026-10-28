import { defineConfig, loadEnv } from "vite-plus";
import vue from "@vitejs/plugin-vue";

export default defineConfig(({ mode }) => {
  // Only the dev proxy target is read here; VITE_* values are handled by Vite itself.
  const env = loadEnv(mode, process.cwd(), "API_");
  return {
    plugins: [vue()],
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
