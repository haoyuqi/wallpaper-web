import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { config, mount } from "@vue/test-utils";
import { defineComponent, nextTick } from "vue";
import {
  browserLocale,
  createAppI18n,
  isLocale,
  LOCALE_STORAGE_KEY,
  useDocumentLocale,
  useLocalization,
} from "../../src/i18n";
import en from "../../src/i18n/locales/en";
import zhCN from "../../src/i18n/locales/zh-CN";
import LanguageSelect from "../../src/components/LanguageSelect.vue";
import type { Wallpaper } from "../../src/services/wallpapers";

afterEach(() => {
  vi.restoreAllMocks();
  document.head.querySelector('meta[name="description"]')?.remove();
});

function host() {
  const i18n = createAppI18n();
  config.global.plugins = [i18n];
  const wrapper = mount(
    defineComponent({
      setup() {
        useDocumentLocale();
        return useLocalization();
      },
      template: "<div />",
    }),
  );
  return { i18n, wrapper };
}

describe("locale detection and preference storage", () => {
  it.each([
    [[], "en"],
    [["fr-FR", "ja-JP"], "en"],
    [["fr-FR", "zh-CN", "en-US"], "zh-CN"],
    [["en-GB", "zh-CN"], "en"],
    [["ZH-hans-CN"], "zh-CN"],
    [["zh-TW"], "zh-CN"],
    [["zh"], "zh-CN"],
    [["en"], "en"],
  ])("matches browser preferences %j to %s", (languages, expected) => {
    expect(browserLocale(languages)).toBe(expected);
  });

  it.each([null, undefined, "fr", "zh-cn", "", {}, 1])("rejects saved value %j", (value) => {
    expect(isLocale(value)).toBe(false);
  });

  it.each(["en", "zh-CN"])("honors a saved %s preference over the browser", (value) => {
    localStorage.setItem(LOCALE_STORAGE_KEY, value);
    vi.spyOn(navigator, "languages", "get").mockReturnValue(["fr-FR"]);
    expect(createAppI18n().global.locale.value).toBe(value);
  });

  it("uses the browser for invalid or missing saved values and language as an empty-list fallback", () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, "invalid");
    vi.spyOn(navigator, "languages", "get").mockReturnValue(["de", "zh-SG"]);
    expect(createAppI18n().global.locale.value).toBe("zh-CN");
    localStorage.removeItem(LOCALE_STORAGE_KEY);
    vi.spyOn(navigator, "languages", "get").mockReturnValue([]);
    vi.spyOn(navigator, "language", "get").mockReturnValue("en-AU");
    expect(createAppI18n().global.locale.value).toBe("en");
  });

  it("works when storage reads throw", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    vi.spyOn(navigator, "languages", "get").mockReturnValue(["zh-CN"]);
    expect(createAppI18n().global.locale.value).toBe("zh-CN");
  });

  it("persists valid selections, ignores invalid selections and tolerates blocked writes", () => {
    const { wrapper, i18n } = host();
    wrapper.vm.setLocale("en");
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("en");
    expect(createAppI18n().global.locale.value).toBe("en");
    wrapper.vm.setLocale("invalid");
    expect(i18n.global.locale.value).toBe("en");
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("en");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    expect(() => wrapper.vm.setLocale("zh-CN")).not.toThrow();
    expect(i18n.global.locale.value).toBe("zh-CN");
    wrapper.unmount();
  });
});

describe("translated presentation", () => {
  it("updates document language, title and description reactively and stops on unmount", async () => {
    const meta = document.createElement("meta");
    meta.name = "description";
    document.head.append(meta);
    const { wrapper, i18n } = host();
    expect(document.documentElement.lang).toBe("zh-CN");
    expect(document.title).toBe(zhCN.app.title);
    expect(meta.content).toBe(zhCN.app.description);
    wrapper.vm.setLocale("en");
    await nextTick();
    expect(document.documentElement.lang).toBe("en");
    expect(document.title).toBe(en.app.title);
    expect(meta.content).toBe(en.app.description);
    wrapper.unmount();
    i18n.global.locale.value = "zh-CN";
    await nextTick();
    expect(document.documentElement.lang).toBe("en");
  });

  it("handles missing metadata, formats calendar dates in UTC and translates only missing titles", () => {
    const { wrapper } = host();
    const wallpaper: Wallpaper = {
      id: "1",
      date: "2024-02-29",
      title: "",
      imageUrl: "https://example.com/image.jpg",
      downloadUrl: null,
      copyright: "© Original",
      copyrightLink: null,
    };
    expect(wrapper.vm.formatDate(wallpaper.date)).toBe("2024年2月29日");
    expect(wrapper.vm.wallpaperTitle(wallpaper)).toBe("2024年2月29日 壁纸");
    wrapper.vm.setLocale("en");
    expect(wrapper.vm.formatDate(wallpaper.date)).toBe("Feb 29, 2024");
    expect(wrapper.vm.wallpaperTitle(wallpaper)).toBe("Wallpaper for Feb 29, 2024");
    expect(wrapper.vm.wallpaperTitle({ ...wallpaper, title: "原始标题 <b>text</b>" })).toBe(
      "原始标题 <b>text</b>",
    );
    expect(wallpaper.copyright).toBe("© Original");
    wrapper.unmount();
  });

  it("offers exactly the supported languages and changes locale through the native select", async () => {
    const i18n = createAppI18n();
    config.global.plugins = [i18n];
    const wrapper = mount(LanguageSelect);
    expect(wrapper.findAll("option").map((option) => option.text())).toEqual([
      "English",
      "简体中文",
    ]);
    expect(wrapper.get("select").element.value).toBe("zh-CN");
    await wrapper.get("select").setValue("en");
    expect(wrapper.get("label").text()).toContain("Language");
    expect(i18n.global.locale.value).toBe("en");
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("en");
    wrapper.unmount();
  });

  it("uses English singular/plural messages and falls back to English for missing translations", () => {
    const i18n = createAppI18n();
    const { global } = i18n;
    global.locale.value = "en";
    expect(global.t("archive.added", 1)).toBe("Added 1 wallpaper.");
    expect(global.t("archive.added", 6)).toBe("Added 6 wallpapers.");
    expect(global.t("archive.wait", 1)).toBe("Try again in 1 second.");
    expect(global.t("archive.wait", 2)).toBe("Try again in 2 seconds.");
    global.setLocaleMessage("zh-CN", { ...zhCN, viewer: { ...zhCN.viewer, close: "" } });
    // Simulate an incomplete catalog rather than shipping a deliberately missing key.
    Reflect.deleteProperty(global.getLocaleMessage("zh-CN").viewer, "close");
    global.locale.value = "zh-CN";
    expect(global.t("viewer.close")).toBe(en.viewer.close);
  });

  it("keeps dictionary keys and interpolation parameters identical", () => {
    const flatten = (value: object, prefix = ""): Record<string, string> =>
      Object.fromEntries(
        Object.entries(value).flatMap(([key, entry]) => {
          const path = `${prefix}${key}`;
          return typeof entry === "string"
            ? [[path, entry]]
            : Object.entries(flatten(entry, `${path}.`));
        }),
      );
    const english = flatten(en);
    const chinese = flatten(zhCN);
    expect(Object.keys(chinese).sort()).toEqual(Object.keys(english).sort());
    const parameters = (text: string) => [...new Set(text.match(/\{\w+\}/g))].sort();
    for (const [key, value] of Object.entries(english)) {
      expect(value.trim(), key).not.toBe("");
      expect(chinese[key]?.trim(), key).not.toBe("");
      expect(parameters(chinese[key]!), key).toEqual(parameters(value));
    }
  });
});
