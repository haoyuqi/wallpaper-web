import { beforeEach } from "vite-plus/test";
import { config } from "@vue/test-utils";
import { createAppI18n, LOCALE_STORAGE_KEY } from "../src/i18n";

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(LOCALE_STORAGE_KEY, "zh-CN");
  config.global.plugins = [createAppI18n()];
});
