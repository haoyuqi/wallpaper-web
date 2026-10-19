import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { flushPromises, mount } from "@vue/test-utils";
import App from "../../src/App.vue";
import ArchiveStatus from "../../src/components/ArchiveStatus.vue";
import CoverCarousel from "../../src/components/CoverCarousel.vue";
import WallpaperCard from "../../src/components/WallpaperCard.vue";
import WallpaperImage from "../../src/components/WallpaperImage.vue";
import WallpaperViewer from "../../src/components/WallpaperViewer.vue";
import { router as appRouter } from "../../src/router";
import { createMemoryHistory, createRouter } from "vue-router";
import { ApiError, type Wallpaper } from "../../src/services/wallpapers";

const sampleWallpaper: Wallpaper = {
  id: "wall-1",
  date: "2026-10-18",
  title: "<b>Mountain Peak</b>",
  imageUrl: "https://example.com/peak.jpg",
  downloadUrl: null,
  copyright: "© Photographer",
  copyrightLink: "https://example.com/copyright",
};

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("WallpaperImage states and cached image handling", () => {
  it("transitions to loaded when complete with naturalWidth or on load event, and resets on src change", async () => {
    const wrapper = mount(WallpaperImage, {
      props: { src: "https://example.com/1.jpg", alt: "First", kind: "hero" },
    });
    expect(wrapper.text()).toContain("正在加载图片…");

    await wrapper.get("img").trigger("load");
    expect(wrapper.find(".photo-feedback").exists()).toBe(false);

    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(1920);
    await wrapper.setProps({ src: "https://example.com/2.jpg" });
    await flushPromises();
    expect(wrapper.find(".photo-feedback").exists()).toBe(false);
    wrapper.unmount();
  });
});

describe("CoverCarousel controls and focus/hover events", () => {
  it("handles play/pause, prev/next, open emit and focusin/focusout/mouseenter/mouseleave", async () => {
    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }));
    const items = [sampleWallpaper, { ...sampleWallpaper, id: "wall-2", title: "Second" }];
    const wrapper = mount(CoverCarousel, {
      props: { items, modalOpen: false },
      attachTo: document.body,
    });

    const section = wrapper.get("section.hero");
    await section.trigger("mouseenter");
    await section.trigger("mouseleave");
    await section.trigger("focusin");

    const playBtn = wrapper.get("#cover-play");
    await section.trigger("focusout", { relatedTarget: playBtn.element });
    await section.trigger("focusout", { relatedTarget: document.body });

    await playBtn.trigger("click");
    expect(playBtn.attributes("aria-label")).toBe("播放轮播");
    await playBtn.trigger("click");
    expect(playBtn.attributes("aria-label")).toBe("暂停轮播");

    await wrapper.get('[aria-label="下一张封面"]').trigger("click");
    expect(wrapper.get("#cover-title").text()).toBe("Second");
    await wrapper.get('[aria-label="上一张封面"]').trigger("click");
    expect(wrapper.get("#cover-title").text()).toBe("<b>Mountain Peak</b>");

    await wrapper.get(".hero-image-button").trigger("click");
    expect(wrapper.emitted("open")?.[0]?.[0]).toEqual(sampleWallpaper);
    wrapper.unmount();
  });
});

describe("WallpaperViewer modal behavior", () => {
  it("renders literal text, disables missing download, traps Tab focus and restores scroll/focus", async () => {
    vi.spyOn(window, "scrollX", "get").mockReturnValue(0);
    vi.spyOn(window, "scrollY", "get").mockReturnValue(240);

    const fallbackHeading = document.createElement("h2");
    fallbackHeading.id = "collection-title";
    fallbackHeading.tabIndex = -1;
    const triggerButton = document.createElement("button");
    document.body.append(fallbackHeading, triggerButton);

    const wrapper = mount(WallpaperViewer, {
      props: { wallpaper: sampleWallpaper, trigger: triggerButton },
      attachTo: document.body,
    });
    await flushPromises();

    expect(wrapper.get("#detail-title").text()).toBe("<b>Mountain Peak</b>");
    expect(wrapper.find("#detail-title b").exists()).toBe(false);
    expect(wrapper.get("[data-download]").attributes("disabled")).toBeDefined();
    expect(wrapper.get("[data-download]").text()).toBe("下载暂不可用");
    expect(document.activeElement?.getAttribute("aria-label")).toBe("关闭壁纸");

    await wrapper.get("dialog").trigger("keydown", { key: "ArrowRight" });
    expect(wrapper.get("img").attributes("src")).toBe(sampleWallpaper.imageUrl);
    const dlBtn = wrapper.get("[data-download]").element as HTMLButtonElement;
    dlBtn.removeAttribute("disabled");
    dlBtn.click();
    dlBtn.setAttribute("disabled", "");

    const closeBtn = wrapper.get('[aria-label="关闭壁纸"]');
    const copyrightLink = wrapper.get(".detail-foot a");
    const origLink = wrapper.get(".detail-actions a");

    (origLink.element as HTMLElement).focus();
    await origLink.trigger("keydown", { key: "Tab" });

    (closeBtn.element as HTMLElement).focus();
    await closeBtn.trigger("keydown", { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(copyrightLink.element);
    await copyrightLink.trigger("keydown", { key: "Tab" });
    expect(document.activeElement).toBe(closeBtn.element);

    await wrapper.get("dialog").trigger("cancel");
    expect(wrapper.emitted("close")).toHaveLength(1);
    await closeBtn.trigger("click");
    expect(wrapper.emitted("close")).toHaveLength(2);
    await wrapper.get("dialog").trigger("keydown", { key: "Escape" });
    expect(wrapper.emitted("close")).toHaveLength(3);

    wrapper.unmount();
    expect(document.activeElement).toBe(triggerButton);

    const wrapperFallback = mount(WallpaperViewer, {
      props: {
        wallpaper: { ...sampleWallpaper, copyright: null, copyrightLink: null },
        trigger: triggerButton,
      },
      attachTo: document.body,
    });
    expect(wrapperFallback.get(".detail-foot").text()).toContain("图片版权归原权利人所有。");
    triggerButton.remove();
    wrapperFallback.unmount();
    expect(document.activeElement).toBe(fallbackHeading);
    expect(window.scrollTo).toHaveBeenCalledWith({ left: 0, top: 240, behavior: "instant" });
  });

  it("handles image load failure and retry while keeping the original link accessible", async () => {
    const wrapper = mount(WallpaperViewer, {
      props: { wallpaper: sampleWallpaper, trigger: null },
      attachTo: document.body,
    });
    await flushPromises();

    await wrapper.get("img").trigger("error");
    expect(wrapper.text()).toContain("图片暂时无法加载");
    expect(wrapper.get(".detail-actions a").attributes("href")).toBe(sampleWallpaper.imageUrl);

    await wrapper.get("button.image-retry").trigger("click");
    expect(wrapper.text()).toContain("正在加载图片…");
    wrapper.unmount();
  });

  it("completes blob downloads, revokes object URLs, prevents duplicates and shows fallback on failure", async () => {
    vi.useFakeTimers();
    const downloadable = { ...sampleWallpaper, downloadUrl: "https://example.com/uhd.jpg" };
    let urlCounter = 0;
    const createUrlSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockImplementation(() => `blob:test-url-${++urlCounter}`);
    const revokeUrlSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(new Uint8Array([1, 2, 3]), {
            status: 200,
            headers: { "Content-Type": "image/jpeg" },
          }),
        ),
      ),
    );

    const wrapperSuccess = mount(WallpaperViewer, {
      props: { wallpaper: downloadable, trigger: null },
      attachTo: document.body,
    });
    await flushPromises();
    await wrapperSuccess.get("[data-download]").trigger("click");
    await flushPromises();
    expect(wrapperSuccess.get(".download-message").text()).toBe("已交给浏览器保存");
    expect(createUrlSpy).toHaveBeenCalledTimes(1);
    expect(revokeUrlSpy).not.toHaveBeenCalled();

    // Repeated download before 60s revokes the first object URL immediately
    await wrapperSuccess.get("[data-download]").trigger("click");
    await flushPromises();
    expect(createUrlSpy).toHaveBeenCalledTimes(2);
    expect(revokeUrlSpy).toHaveBeenCalledTimes(1);
    expect(revokeUrlSpy).toHaveBeenNthCalledWith(1, "blob:test-url-1");

    // 60-second timer revokes the second object URL
    await vi.advanceTimersByTimeAsync(60000);
    expect(revokeUrlSpy).toHaveBeenCalledTimes(2);
    expect(revokeUrlSpy).toHaveBeenNthCalledWith(2, "blob:test-url-2");

    // Third download revoked on component unmount before the 60s delay expires
    await wrapperSuccess.get("[data-download]").trigger("click");
    await flushPromises();
    expect(createUrlSpy).toHaveBeenCalledTimes(3);
    expect(revokeUrlSpy).toHaveBeenCalledTimes(2);
    wrapperSuccess.unmount();
    expect(revokeUrlSpy).toHaveBeenCalledTimes(3);
    expect(revokeUrlSpy).toHaveBeenNthCalledWith(3, "blob:test-url-3");

    const wrapperNoUrl = mount(WallpaperViewer, {
      props: { wallpaper: sampleWallpaper, trigger: null },
      attachTo: document.body,
    });
    await flushPromises();
    const noUrlBtn = wrapperNoUrl.get("[data-download]").element as HTMLButtonElement;
    noUrlBtn.removeAttribute("disabled");
    noUrlBtn.click();
    wrapperNoUrl.unmount();

    let capturedSignal: AbortSignal | undefined;
    const fetchMock = vi.fn((_url: string, init: RequestInit) => {
      capturedSignal = init.signal as AbortSignal;
      return new Promise<Response>((_resolve, reject) => {
        capturedSignal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const wrapperAbort = mount(WallpaperViewer, {
      props: { wallpaper: downloadable, trigger: null },
      attachTo: document.body,
    });
    await flushPromises();
    await wrapperAbort.get("[data-download]").trigger("click");
    expect(wrapperAbort.get("[data-download]").text()).toBe("正在准备…");
    const abortDlBtn = wrapperAbort.get("[data-download]").element as HTMLButtonElement;
    abortDlBtn.removeAttribute("disabled");
    abortDlBtn.click();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30000);
    expect(capturedSignal?.aborted).toBe(true);
    wrapperAbort.unmount();

    let resolveLateDownload!: (res: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveLateDownload = resolve;
          }),
      ),
    );
    const wrapperDisposedSuccess = mount(WallpaperViewer, {
      props: { wallpaper: downloadable, trigger: null },
      attachTo: document.body,
    });
    await flushPromises();
    await wrapperDisposedSuccess.get("[data-download]").trigger("click");
    wrapperDisposedSuccess.unmount();
    resolveLateDownload(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "Content-Type": "image/jpeg" },
      }),
    );
    await flushPromises();

    let rejectLateDownload!: (err: Error) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((_resolve, reject) => {
            rejectLateDownload = reject;
          }),
      ),
    );
    const wrapperDisposedError = mount(WallpaperViewer, {
      props: { wallpaper: downloadable, trigger: null },
      attachTo: document.body,
    });
    await flushPromises();
    await wrapperDisposedError.get("[data-download]").trigger("click");
    wrapperDisposedError.unmount();
    rejectLateDownload(new Error("late failure"));
    await flushPromises();

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("CORS error")));
    const retryWrapper = mount(WallpaperViewer, {
      props: { wallpaper: downloadable, trigger: null },
      attachTo: document.body,
    });
    await flushPromises();
    await retryWrapper.get("[data-download]").trigger("click");
    await flushPromises();

    expect(retryWrapper.get("[data-download]").text()).toBe("重试下载 ↓");
    expect(retryWrapper.get(".download-message").text()).toContain("下载未能开始");
    expect(retryWrapper.get(".browser-download").attributes("href")).toBe(downloadable.downloadUrl);
    retryWrapper.unmount();
  });
});

describe("ArchiveStatus and WallpaperCard states", () => {
  it("renders skeleton loading, empty states, timeout/server/rate errors and retry actions", async () => {
    vi.useFakeTimers();
    const wrapper = mount(ArchiveStatus, { props: { loading: true } });
    expect(wrapper.findAll(".skeleton.photo")).toHaveLength(6);

    await wrapper.setProps({ loading: false, filtered: true });
    expect(wrapper.text()).toContain("这一天没有壁纸");
    await wrapper.get("button").trigger("click");
    expect(wrapper.emitted("clear")).toHaveLength(1);

    await wrapper.setProps({ filtered: false, error: new ApiError("timeout") });
    expect(wrapper.text()).toContain("加载时间较长");
    await wrapper.get("button").trigger("click");
    expect(wrapper.emitted("retry")).toHaveLength(1);

    await wrapper.setProps({ error: new ApiError("server") });
    expect(wrapper.text()).toContain("请检查网络连接");

    await wrapper.setProps({ error: new ApiError("rate", Date.now() + 2000) });
    expect(wrapper.text()).toContain("等待 2 秒");
    expect(wrapper.get("button").attributes("disabled")).toBeDefined();

    await vi.advanceTimersByTimeAsync(2000);
    expect(wrapper.text()).toContain("请稍后重试。");
    expect(wrapper.get("button").attributes("disabled")).toBeUndefined();
    wrapper.unmount();
  });

  it("keeps card image and title interactive and handles thumbnail failure", async () => {
    const wrapper = mount(WallpaperCard, { props: { wallpaper: sampleWallpaper } });
    await wrapper.get(".card-image").trigger("click");
    expect(wrapper.emitted("open")?.[0]?.[0]).toEqual(sampleWallpaper);

    await wrapper.get("img").trigger("error");
    expect(wrapper.text()).toContain("预览暂不可用");

    await wrapper.get("h3 button").trigger("click");
    expect(wrapper.emitted("open")?.[1]?.[0]).toEqual(sampleWallpaper);
    wrapper.unmount();
  });
});

describe("ArchivePage, App and router integration", () => {
  async function mountArchive(initialPath = "/") {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: appRouter.options.routes,
    });
    await router.push(initialPath);
    await router.isReady();
    const wrapper = mount(App, {
      global: { plugins: [router] },
      attachTo: document.body,
    });
    await flushPromises();
    return { wrapper, router };
  }

  beforeEach(() => {
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener() {},
      removeEventListener() {},
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        const params = new URL(url, "https://frontend.test").searchParams;
        const date = params.get("date");
        const from = params.get("from");
        const to = params.get("to");
        const data = Array.from({ length: date ? 1 : 14 }, (_, index) => ({
          id: `${date || "range"}-${index}`,
          source: "bing",
          market: "en-US",
          sourceDate: date || to || "2026-10-18",
          title: `Photo ${index}`,
          copyright: null,
          copyrightLink: null,
          imageUrl: `https://example.com/${index}.jpg`,
          downloadUrl: null,
        }));
        return Promise.resolve(
          new Response(
            JSON.stringify({ data, meta: { count: data.length, query: { date, from, to } } }),
            { status: 200 },
          ),
        );
      }),
    );
  });

  it("loads batches, opens/closes viewer, filters dates, clears input and redirects unknown paths", async () => {
    const { wrapper, router } = await mountArchive("/unknown-route");
    expect(router.currentRoute.value.path).toBe("/");
    expect(wrapper.findAll(".wallpaper-card")).toHaveLength(6);

    await wrapper.get(".collection-end button").trigger("click", { detail: 0 });
    await flushPromises();
    expect(wrapper.findAll(".wallpaper-card")).toHaveLength(12);
    expect(document.activeElement).toBe(wrapper.findAll(".card-image")[6]?.element);

    await wrapper.get(".collection-end button").trigger("click", { detail: 1 });
    await flushPromises();
    expect(wrapper.findAll(".wallpaper-card")).toHaveLength(14);

    await wrapper.get(".hero-image-button").trigger("click");
    await flushPromises();
    expect(wrapper.find("dialog.wallpaper-viewer").exists()).toBe(true);
    await wrapper.get('[aria-label="关闭壁纸"]').trigger("click");
    await flushPromises();
    expect(wrapper.find("dialog.wallpaper-viewer").exists()).toBe(false);

    const input = wrapper.get('input[type="date"]');
    await wrapper.get("form.filters").trigger("submit");
    const inputEl = input.element as HTMLInputElement;
    Object.defineProperty(inputEl, "validity", {
      value: { badInput: true },
      configurable: true,
    });
    await input.trigger("change");
    expect(wrapper.get("#date-error").text()).toBe("请选择有效日期。");
    Object.defineProperty(inputEl, "validity", {
      value: { badInput: false },
      configurable: true,
    });

    await input.setValue("2026-10-18");
    await flushPromises();
    expect(router.currentRoute.value.query.date).toBe("2026-10-18");

    await input.setValue("");
    await flushPromises();
    expect(router.currentRoute.value.query.date).toBeUndefined();

    const appDiv = document.createElement("div");
    appDiv.id = "app";
    document.body.append(appDiv);
    await import("../../src/main");
    appDiv.remove();
    wrapper.unmount();
  });

  it("handles array query parameters, hero rate-limit reload and HTTP 422 validation errors", async () => {
    const { wrapper } = await mountArchive("/?date=2026-10-18&date=2026-10-19");
    expect(wrapper.get("#date-error").text()).toBe("请选择有效日期。");

    await wrapper.get(".reset-filter").trigger("click");
    await flushPromises();
    expect(wrapper.findAll(".wallpaper-card")).toHaveLength(6);

    vi.mocked(fetch).mockResolvedValueOnce(new Response("{}", { status: 422 }));
    await wrapper.get('input[type="date"]').setValue("2026-10-17");
    await flushPromises();
    expect(wrapper.get("#date-error").text()).toBe("请选择有效日期。");
    expect(wrapper.findAll(".wallpaper-card")).toHaveLength(6);
    wrapper.unmount();

    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("{}", { status: 429, headers: { "Retry-After": "1" } }))
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              data: [],
              meta: {
                count: 0,
                query: { date: null, from: "2026-09-20", to: "2026-10-19" },
              },
            }),
            { status: 200 },
          ),
        ),
    );
    const { wrapper: heroErrWrapper } = await mountArchive("/");
    const reloadHeroBtn = heroErrWrapper.get(".hero .action");
    expect(reloadHeroBtn.attributes("disabled")).toBeDefined();
    await vi.advanceTimersByTimeAsync(1000);
    expect(reloadHeroBtn.attributes("disabled")).toBeUndefined();
    await reloadHeroBtn.trigger("click");
    await flushPromises();
    heroErrWrapper.unmount();
  });

  it("consolidates an empty initial archive into a single empty state without hero controls", async () => {
    vi.mocked(fetch).mockImplementation((url: string | URL | Request) => {
      const params = new URL(String(url), "https://frontend.test").searchParams;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            data: [],
            meta: {
              count: 0,
              query: {
                date: params.get("date"),
                from: params.get("from"),
                to: params.get("to"),
              },
            },
          }),
          { status: 200 },
        ),
      );
    });

    const { wrapper } = await mountArchive("/");
    expect(wrapper.find(".hero-controls").exists()).toBe(false);
    expect(wrapper.find(".hero-image-button").exists()).toBe(false);
    expect(wrapper.get("h1.sr-only").text()).toBe("Bing 壁纸归档");
    expect(wrapper.findAll(".empty-state")).toHaveLength(1);
    expect(wrapper.get(".empty-state h3").text()).toBe("暂时没有壁纸");
    wrapper.unmount();
  });
});
