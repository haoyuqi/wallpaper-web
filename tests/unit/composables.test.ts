import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { flushPromises, mount } from "@vue/test-utils";
import { computed, defineComponent, nextTick, ref } from "vue";
import { useArchive } from "../../src/composables/useArchive";
import { useCarousel } from "../../src/composables/useCarousel";
import { useRetryAfter } from "../../src/composables/useRetryAfter";
import { ApiError, type Wallpaper, type WallpaperQuery } from "../../src/services/wallpapers";

function makeWallpaper(id: string, date = "2026-10-18"): Wallpaper {
  return {
    id,
    date,
    title: `Title ${id}`,
    imageUrl: `https://example.com/${id}.jpg`,
    downloadUrl: `https://example.com/${id}-dl.jpg`,
    copyright: null,
    copyrightLink: null,
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useArchive state and concurrency", () => {
  it("shares one initial default request for hero and gallery and reveals gallery items in batches of 6", async () => {
    const date = ref<string | null>(null);
    const dataset = Array.from({ length: 14 }, (_, index) => makeWallpaper(`w-${index}`));
    const loader = vi.fn().mockResolvedValue(dataset);

    let archive!: ReturnType<typeof useArchive>;
    const wrapper = mount(
      defineComponent({
        setup() {
          archive = useArchive(date, loader);
          return () => null;
        },
      }),
    );

    await flushPromises();
    expect(loader).toHaveBeenCalledTimes(1);
    expect(archive.hero.value).toHaveLength(8);
    expect(archive.visible.value).toHaveLength(6);
    expect(archive.hasMore.value).toBe(true);

    archive.more();
    expect(archive.visible.value).toHaveLength(12);
    expect(archive.hasMore.value).toBe(true);

    archive.more();
    expect(archive.visible.value).toHaveLength(14);
    expect(archive.hasMore.value).toBe(false);
    wrapper.unmount();
  });

  it("loads hero and filtered gallery separately when an initial date is provided", async () => {
    const date = ref<string | null>("2026-10-17");
    const loader = vi.fn((query: WallpaperQuery) => {
      if ("date" in query) {
        return Promise.resolve([makeWallpaper("filtered", query.date)]);
      }
      return Promise.resolve([makeWallpaper("hero-0"), makeWallpaper("hero-1")]);
    });

    let archive!: ReturnType<typeof useArchive>;
    const wrapper = mount(
      defineComponent({
        setup() {
          archive = useArchive(date, loader);
          return () => null;
        },
      }),
    );

    await flushPromises();
    expect(loader).toHaveBeenCalledTimes(2);
    expect(archive.hero.value.map((item) => item.id)).toEqual(["hero-0", "hero-1"]);
    expect(archive.visible.value.map((item) => item.id)).toEqual(["filtered"]);

    // Clearing back to default window reloads gallery without re-fetching hero.
    date.value = null;
    await nextTick();
    await flushPromises();
    expect(loader).toHaveBeenCalledTimes(3);
    expect(archive.visible.value.map((item) => item.id)).toEqual(["hero-0", "hero-1"]);
    wrapper.unmount();
  });

  it("discards stale out-of-order responses, aborts superseded/disposed requests and handles non-ApiError rejections", async () => {
    const date = ref<string | null>(null);
    let resolveSlowDate!: (items: Wallpaper[]) => void;
    let rejectSlowError!: (reason: unknown) => void;
    const signals: Array<{ query: WallpaperQuery; signal: AbortSignal | undefined }> = [];

    const loader = vi.fn((query: WallpaperQuery, signal?: AbortSignal) => {
      signals.push({ query, signal });
      if ("date" in query && query.date === "2026-10-15") {
        return new Promise<Wallpaper[]>((_resolve, reject) => {
          rejectSlowError = reject;
        });
      }
      if ("date" in query && query.date === "2026-10-16") {
        return new Promise<Wallpaper[]>((resolve) => {
          resolveSlowDate = resolve;
        });
      }
      if ("date" in query && query.date === "2026-10-17") {
        return Promise.resolve([makeWallpaper("oct-17", "2026-10-17")]);
      }
      if ("date" in query && query.date === "2026-10-14") {
        return Promise.reject(new Error("raw failure"));
      }
      return Promise.resolve([makeWallpaper("hero-0"), makeWallpaper("hero-1")]);
    });

    let archive!: ReturnType<typeof useArchive>;
    const wrapper = mount(
      defineComponent({
        setup() {
          archive = useArchive(date, loader);
          return () => null;
        },
      }),
    );

    await flushPromises();
    expect(archive.hero.value[0]?.id).toBe("hero-0");
    const sharedInitialSignal = signals[0]?.signal;
    expect(signals).toHaveLength(1);
    expect(sharedInitialSignal?.aborted).toBe(false);

    // Changing date releases gallery ownership of the shared request, but hero still holds it.
    date.value = "2026-10-15";
    await nextTick();
    expect(sharedInitialSignal?.aborted).toBe(false);
    const oct15Signal = signals[1]?.signal;
    expect(oct15Signal?.aborted).toBe(false);

    date.value = "2026-10-16";
    await nextTick();
    expect(oct15Signal?.aborted).toBe(true);
    const oct16Signal = signals[2]?.signal;
    expect(oct16Signal?.aborted).toBe(false);

    date.value = "2026-10-17";
    await nextTick();
    expect(oct16Signal?.aborted).toBe(true);
    await flushPromises();

    rejectSlowError(new ApiError("server"));
    resolveSlowDate([makeWallpaper("stale-oct-16", "2026-10-16")]);
    await flushPromises();

    expect(archive.visible.value).toEqual([makeWallpaper("oct-17", "2026-10-17")]);

    date.value = "2026-10-14";
    await nextTick();
    await flushPromises();
    expect(archive.error.value?.kind).toBe("network");

    date.value = "2026-10-16";
    await nextTick();
    const activeBeforeUnmount = signals.at(-1)?.signal;
    expect(activeBeforeUnmount?.aborted).toBe(false);
    expect(sharedInitialSignal?.aborted).toBe(false);

    wrapper.unmount();
    expect(activeBeforeUnmount?.aborted).toBe(true);
    expect(sharedInitialSignal?.aborted).toBe(true);
  });

  it("handles shared and hero failures and ignores results arriving after scope disposal", async () => {
    const date = ref<string | null>(null);
    let resolveHero!: (items: Wallpaper[]) => void;
    let rejectShared!: (err: unknown) => void;
    let resolveShared!: (items: Wallpaper[]) => void;

    const loader = vi
      .fn()
      .mockImplementationOnce(() => Promise.reject(new Error("shared boom")))
      .mockImplementationOnce(() => Promise.reject(new ApiError("server")))
      .mockImplementationOnce(
        () =>
          new Promise<Wallpaper[]>((resolve) => {
            resolveHero = resolve;
          }),
      );

    let archive!: ReturnType<typeof useArchive>;
    const wrapper = mount(
      defineComponent({
        setup() {
          archive = useArchive(date, loader);
          return () => null;
        },
      }),
    );

    await flushPromises();
    expect(archive.error.value?.kind).toBe("network");
    expect(archive.heroError.value?.kind).toBe("network");

    await archive.reloadHero();
    expect(archive.heroError.value?.kind).toBe("server");

    // Non-ApiError rejection in reloadHero maps to network error.
    const rawHeroLoader = vi
      .fn()
      .mockImplementationOnce(() => Promise.resolve([makeWallpaper("initial")]))
      .mockImplementationOnce(() => Promise.reject(new Error("raw hero boom")));
    let rawArchive!: ReturnType<typeof useArchive>;
    const rawWrapper = mount(
      defineComponent({
        setup() {
          rawArchive = useArchive(ref<string | null>(null), rawHeroLoader);
          return () => null;
        },
      }),
    );
    await flushPromises();
    await rawArchive.reloadHero();
    expect(rawArchive.heroError.value?.kind).toBe("network");
    rawWrapper.unmount();

    const reloadPromise = archive.reloadHero();
    wrapper.unmount();
    resolveHero([makeWallpaper("after-dispose")]);
    await reloadPromise;
    expect(archive.hero.value).toEqual([]);

    // Shared initial request resolving after disposal does not write state.
    const wrapper2 = mount(
      defineComponent({
        setup() {
          archive = useArchive(
            date,
            vi.fn(
              () =>
                new Promise<Wallpaper[]>((resolve) => {
                  resolveShared = resolve;
                }),
            ),
          );
          return () => null;
        },
      }),
    );
    wrapper2.unmount();
    resolveShared([makeWallpaper("after-shared-dispose")]);
    await flushPromises();
    expect(archive.hero.value).toEqual([]);
    expect(archive.items.value).toEqual([]);

    // Shared initial request rejecting after disposal does not write errors.
    const wrapper3 = mount(
      defineComponent({
        setup() {
          archive = useArchive(
            date,
            vi.fn(
              () =>
                new Promise<Wallpaper[]>((_resolve, reject) => {
                  rejectShared = reject;
                }),
            ),
          );
          return () => null;
        },
      }),
    );
    wrapper3.unmount();
    rejectShared(new ApiError("server"));
    await flushPromises();
    expect(archive.error.value).toBeNull();
    expect(archive.heroError.value).toBeNull();
  });

  it("keeps shared default request alive for one consumer when only the other supersedes it, and aborts once both leave", async () => {
    const date = ref<string | null>(null);
    const pending: Array<{
      resolve: (items: Wallpaper[]) => void;
      reject: (reason: unknown) => void;
    }> = [];
    const signals: Array<AbortSignal | undefined> = [];
    const loader = vi.fn((_query: WallpaperQuery, signal?: AbortSignal) => {
      signals.push(signal);
      return new Promise<Wallpaper[]>((resolve, reject) => pending.push({ resolve, reject }));
    });

    let archive!: ReturnType<typeof useArchive>;
    const wrapper = mount(
      defineComponent({
        setup() {
          archive = useArchive(date, loader);
          return () => null;
        },
      }),
    );

    // Single shared default request is in flight for both hero and gallery.
    expect(pending).toHaveLength(1);
    expect(signals[0]?.aborted).toBe(false);

    // Navigating to a date supersedes gallery while hero still waits on the shared request.
    date.value = "2026-10-17";
    await nextTick();
    expect(signals[0]?.aborted).toBe(false);
    expect(pending).toHaveLength(2);

    pending[1]?.resolve([makeWallpaper("date-only", "2026-10-17")]);
    await flushPromises();
    expect(archive.visible.value).toEqual([makeWallpaper("date-only", "2026-10-17")]);
    expect(archive.heroLoading.value).toBe(true);

    // Shared default finishes later: hero updates, filtered gallery is untouched.
    pending[0]?.resolve([makeWallpaper("hero-shared")]);
    await flushPromises();
    expect(archive.hero.value).toEqual([makeWallpaper("hero-shared")]);
    expect(archive.heroLoading.value).toBe(false);
    expect(archive.visible.value).toEqual([makeWallpaper("date-only", "2026-10-17")]);

    wrapper.unmount();

    // When a shared request fails after hero was superseded, only gallery receives the error.
    const date2 = ref<string | null>(null);
    const pending2: Array<{
      resolve: (items: Wallpaper[]) => void;
      reject: (reason: unknown) => void;
    }> = [];
    const signals2: Array<AbortSignal | undefined> = [];
    const loader2 = vi.fn((_query: WallpaperQuery, signal?: AbortSignal) => {
      signals2.push(signal);
      return new Promise<Wallpaper[]>((resolve, reject) => pending2.push({ resolve, reject }));
    });
    let archive2!: ReturnType<typeof useArchive>;
    const wrapper2 = mount(
      defineComponent({
        setup() {
          archive2 = useArchive(date2, loader2);
          return () => null;
        },
      }),
    );

    const heroRetry = archive2.reloadHero();
    expect(signals2[0]?.aborted).toBe(false);
    pending2[1]?.resolve([makeWallpaper("hero-retry")]);
    await heroRetry;
    expect(archive2.hero.value).toEqual([makeWallpaper("hero-retry")]);

    pending2[0]?.reject(new ApiError("server"));
    await flushPromises();
    expect(archive2.error.value?.kind).toBe("server");
    expect(archive2.heroError.value).toBeNull();
    expect(archive2.loading.value).toBe(false);
    wrapper2.unmount();

    // When a shared request resolves after hero was superseded, only gallery receives the result.
    const date2b = ref<string | null>(null);
    const pending2b: Array<{ resolve: (items: Wallpaper[]) => void }> = [];
    const loader2b = vi.fn(
      () =>
        new Promise<Wallpaper[]>((resolve) => {
          pending2b.push({ resolve });
        }),
    );
    let archive2b!: ReturnType<typeof useArchive>;
    const wrapper2b = mount(
      defineComponent({
        setup() {
          archive2b = useArchive(date2b, loader2b);
          return () => null;
        },
      }),
    );
    const heroOverride = archive2b.reloadHero();
    pending2b[1]?.resolve([makeWallpaper("hero-newer")]);
    await heroOverride;
    pending2b[0]?.resolve([makeWallpaper("gallery-from-shared")]);
    await flushPromises();
    expect(archive2b.hero.value).toEqual([makeWallpaper("hero-newer")]);
    expect(archive2b.visible.value).toEqual([makeWallpaper("gallery-from-shared")]);
    wrapper2b.unmount();

    // When gallery supersedes the shared request and it fails, only hero receives the error.
    const date3 = ref<string | null>(null);
    const pending3: Array<{
      resolve: (items: Wallpaper[]) => void;
      reject: (reason: unknown) => void;
    }> = [];
    const signals3: Array<AbortSignal | undefined> = [];
    const loader3 = vi.fn((_query: WallpaperQuery, signal?: AbortSignal) => {
      signals3.push(signal);
      return new Promise<Wallpaper[]>((resolve, reject) => pending3.push({ resolve, reject }));
    });
    let archive3!: ReturnType<typeof useArchive>;
    const wrapper3 = mount(
      defineComponent({
        setup() {
          archive3 = useArchive(date3, loader3);
          return () => null;
        },
      }),
    );

    date3.value = "2026-10-18";
    await nextTick();
    expect(signals3[0]?.aborted).toBe(false);
    pending3[1]?.resolve([makeWallpaper("filtered-ok", "2026-10-18")]);
    await flushPromises();
    pending3[0]?.reject(new ApiError("server"));
    await flushPromises();
    expect(archive3.error.value).toBeNull();
    expect(archive3.heroError.value?.kind).toBe("server");
    expect(archive3.heroLoading.value).toBe(false);

    // Hero retries cancel superseded retries and discard stale responses and errors.
    const first = archive3.reloadHero();
    const second = archive3.reloadHero();
    expect(signals3[2]?.aborted).toBe(true);
    pending3[3]?.resolve([makeWallpaper("newest")]);
    await second;
    pending3[2]?.resolve([makeWallpaper("stale")]);
    await first;
    expect(archive3.hero.value).toEqual([makeWallpaper("newest")]);

    const third = archive3.reloadHero();
    const fourth = archive3.reloadHero();
    expect(signals3[4]?.aborted).toBe(true);
    pending3[5]?.resolve([makeWallpaper("final")]);
    await fourth;
    pending3[4]?.reject(new ApiError("server"));
    await third;
    expect(archive3.hero.value).toEqual([makeWallpaper("final")]);
    expect(archive3.heroError.value).toBeNull();
    expect(archive3.heroLoading.value).toBe(false);

    wrapper3.unmount();

    // When both gallery and hero supersede a shared request, the underlying signal aborts.
    const date4 = ref<string | null>(null);
    const signals4: Array<AbortSignal | undefined> = [];
    const loader4 = vi.fn((_query: WallpaperQuery, signal?: AbortSignal) => {
      signals4.push(signal);
      return new Promise<Wallpaper[]>(() => {});
    });
    let archive4!: ReturnType<typeof useArchive>;
    const wrapper4 = mount(
      defineComponent({
        setup() {
          archive4 = useArchive(date4, loader4);
          return () => null;
        },
      }),
    );
    date4.value = "2026-10-19";
    await nextTick();
    expect(signals4[0]?.aborted).toBe(false);
    void archive4.reloadHero();
    expect(signals4[0]?.aborted).toBe(true);
    wrapper4.unmount();
  });
});

describe("useCarousel 5-second timing and pause reasons", () => {
  it("pauses independently for hover, focus, modal and hidden document, and requires all overlapping reasons to clear", async () => {
    vi.useFakeTimers();
    let mediaChangeListener: (() => void) | undefined;
    const mediaMock = {
      matches: false,
      addEventListener(_event: string, cb: () => void) {
        mediaChangeListener = cb;
      },
      removeEventListener() {},
    };
    vi.stubGlobal("matchMedia", () => mediaMock);
    const hiddenSpy = vi.spyOn(document, "hidden", "get").mockReturnValue(false);

    const modalOpen = ref(false);
    const items = ref<Wallpaper[]>([makeWallpaper("a"), makeWallpaper("b"), makeWallpaper("c")]);
    let carousel!: ReturnType<typeof useCarousel>;
    const wrapper = mount(
      defineComponent({
        setup() {
          carousel = useCarousel(items, modalOpen);
          return () => null;
        },
      }),
    );

    await vi.advanceTimersByTimeAsync(5000);
    expect(carousel.index.value).toBe(1);

    // 1. Independent hover pause
    carousel.pause("hover", true);
    await nextTick();
    await vi.advanceTimersByTimeAsync(10000);
    expect(carousel.index.value).toBe(1);
    carousel.pause("hover", false);
    await nextTick();
    await vi.advanceTimersByTimeAsync(4999);
    expect(carousel.index.value).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(carousel.index.value).toBe(2);

    // 2. Independent focus pause
    carousel.pause("focus", true);
    await nextTick();
    await vi.advanceTimersByTimeAsync(10000);
    expect(carousel.index.value).toBe(2);
    carousel.pause("focus", false);
    await nextTick();
    await vi.advanceTimersByTimeAsync(5000);
    expect(carousel.index.value).toBe(0);

    // 3. Independent modal pause
    modalOpen.value = true;
    await nextTick();
    await vi.advanceTimersByTimeAsync(10000);
    expect(carousel.index.value).toBe(0);
    modalOpen.value = false;
    await nextTick();
    await vi.advanceTimersByTimeAsync(5000);
    expect(carousel.index.value).toBe(1);

    // 4. Independent hidden-page pause
    hiddenSpy.mockReturnValue(true);
    document.dispatchEvent(new Event("visibilitychange"));
    await nextTick();
    await vi.advanceTimersByTimeAsync(10000);
    expect(carousel.index.value).toBe(1);
    hiddenSpy.mockReturnValue(false);
    document.dispatchEvent(new Event("visibilitychange"));
    await nextTick();
    await vi.advanceTimersByTimeAsync(5000);
    expect(carousel.index.value).toBe(2);

    // 5. Overlapping pause conditions: clearing one does not resume until the other clears
    carousel.pause("hover", true);
    carousel.pause("focus", true);
    await nextTick();
    await vi.advanceTimersByTimeAsync(8000);
    expect(carousel.index.value).toBe(2);
    carousel.pause("hover", false);
    await nextTick();
    await vi.advanceTimersByTimeAsync(8000);
    expect(carousel.index.value).toBe(2);
    carousel.pause("focus", false);
    await nextTick();
    await vi.advanceTimersByTimeAsync(4999);
    expect(carousel.index.value).toBe(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(carousel.index.value).toBe(0);

    mediaChangeListener?.();
    expect(carousel.playing.value).toBe(true);
    mediaMock.matches = true;
    mediaChangeListener?.();
    expect(carousel.playing.value).toBe(false);

    items.value = [];
    carousel.step(1);
    expect(carousel.current.value).toBeUndefined();

    wrapper.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("respects initial prefers-reduced-motion and does not schedule timers for 0 or 1 item", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener() {},
      removeEventListener() {},
    }));

    const count = ref(1);
    let carousel!: ReturnType<typeof useCarousel>;
    const wrapper = mount(
      defineComponent({
        setup() {
          carousel = useCarousel(
            computed(() =>
              Array.from({ length: count.value }, (_, i) => makeWallpaper(`item-${i}`)),
            ),
            ref(false),
          );
          return () => null;
        },
      }),
    );

    expect(carousel.playing.value).toBe(false);
    expect(vi.getTimerCount()).toBe(0);

    carousel.toggle();
    await nextTick();
    expect(vi.getTimerCount()).toBe(0);

    count.value = 2;
    await nextTick();
    await vi.advanceTimersByTimeAsync(5000);
    expect(carousel.index.value).toBe(1);

    wrapper.unmount();
  });
});

describe("useRetryAfter countdown", () => {
  it("ticks down every second until the deadline expires", async () => {
    vi.useFakeTimers();
    const deadline = ref<number | null>(Date.now() + 3000);
    let remaining!: ReturnType<typeof useRetryAfter>;

    const wrapper = mount(
      defineComponent({
        setup() {
          remaining = useRetryAfter(deadline);
          return () => null;
        },
      }),
    );

    expect(remaining.value).toBe(3);
    await vi.advanceTimersByTimeAsync(1000);
    expect(remaining.value).toBe(2);
    await vi.advanceTimersByTimeAsync(2000);
    expect(remaining.value).toBe(0);
    expect(vi.getTimerCount()).toBe(0);

    deadline.value = null;
    await nextTick();
    expect(remaining.value).toBe(0);
    wrapper.unmount();
  });
});
