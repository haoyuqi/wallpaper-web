import { defineConfig, loadEnv } from "vite-plus";
import vue from "@vitejs/plugin-vue";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
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
          "src/i18n/**": { statements: 100, branches: 100, functions: 100, lines: 100 },
          "src/components/LanguageSelect.vue": {
            statements: 100,
            branches: 100,
            functions: 100,
            lines: 100,
          },
        },
      },
    },
  };
});
