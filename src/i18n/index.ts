import { watchEffect } from "vue";
import { createI18n, useI18n } from "vue-i18n";
import type { Wallpaper } from "../services/wallpapers";
import en from "./locales/en";
import zhCN from "./locales/zh-CN";

export const LOCALE_STORAGE_KEY = "wallpaper-web.locale";
export const locales = [
  { value: "en", label: "English" },
  { value: "zh-CN", label: "简体中文" },
] as const;
export type Locale = (typeof locales)[number]["value"];

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "zh-CN";
}

export function browserLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const base = language.toLowerCase().split("-")[0];
    if (base === "en") return "en";
    if (base === "zh") return "zh-CN";
  }
  return "en";
}

export function createAppI18n() {
  let saved: unknown;
  try {
    saved = localStorage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    // Storage can be disabled; browser preference still works.
  }
  return createI18n({
    legacy: false,
    locale: isLocale(saved)
      ? saved
      : browserLocale(navigator.languages.length ? navigator.languages : [navigator.language]),
    fallbackLocale: "en",
    messages: { en, "zh-CN": zhCN },
  });
}

// Date labels repeat for every card, so reuse one formatter per locale.
const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function dateFormatter(locale: string) {
  let formatter = dateFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
    dateFormatters.set(locale, formatter);
  }
  return formatter;
}

export function useLocalization() {
  const { t, locale } = useI18n({ useScope: "global" });
  function setLocale(value: string) {
    if (!isLocale(value)) return;
    locale.value = value;
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, value);
    } catch {
      // A manual choice remains effective for this visit without storage.
    }
  }
  function formatDate(date: string) {
    return dateFormatter(locale.value).format(new Date(`${date}T00:00:00Z`));
  }
  function wallpaperTitle(wallpaper: Wallpaper) {
    return wallpaper.title || t("image.untitled", { date: formatDate(wallpaper.date) });
  }
  return { t, locale, setLocale, formatDate, wallpaperTitle };
}

export function useDocumentLocale() {
  const { t, locale } = useLocalization();
  watchEffect(() => {
    document.documentElement.lang = locale.value;
    document.title = t("app.title");
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", t("app.description"));
  });
}
