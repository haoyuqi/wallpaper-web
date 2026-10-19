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
  it("loads an 8-item hero snapshot and reveals gallery items in batches of 6", async () => {
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
    const heroSignal = signals[0]?.signal;
    const initialGallerySignal = signals[1]?.signal;
    expect(heroSignal?.aborted).toBe(false);
    expect(initialGallerySignal?.aborted).toBe(false);

    date.value = "2026-10-15";
    await nextTick();
    expect(initialGallerySignal?.aborted).toBe(true);
    const oct15Signal = signals[2]?.signal;
    expect(oct15Signal?.aborted).toBe(false);

    date.value = "2026-10-16";
    await nextTick();
    expect(oct15Signal?.aborted).toBe(true);
    const oct16Signal = signals[3]?.signal;
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
    expect(heroSignal?.aborted).toBe(false);

    wrapper.unmount();
    expect(activeBeforeUnmount?.aborted).toBe(true);
    expect(heroSignal?.aborted).toBe(true);
  });

  it("handles hero failure and ignores results arriving after scope disposal", async () => {
    const date = ref<string | null>(null);
    let resolveHero!: (items: Wallpaper[]) => void;
    let rejectHero!: (err: unknown) => void;

    const loader = vi
      .fn()
      .mockImplementationOnce(() => Promise.reject(new Error("hero boom")))
      .mockImplementationOnce(() => Promise.resolve([makeWallpaper("g-1")]))
      .mockImplementationOnce(() => Promise.reject(new ApiError("server")))
      .mockImplementationOnce(
        () =>
          new Promise<Wallpaper[]>((resolve, reject) => {
            resolveHero = resolve;
            rejectHero = reject;
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
    expect(archive.heroError.value?.kind).toBe("network");

    await archive.reloadHero();
    expect(archive.heroError.value?.kind).toBe("server");

    const reloadPromise = archive.reloadHero();
    wrapper.unmount();
    resolveHero([makeWallpaper("after-dispose")]);
    await reloadPromise;
    expect(archive.hero.value).toEqual([]);

    const wrapper2 = mount(
      defineComponent({
        setup() {
          archive = useArchive(
            date,
            vi
              .fn()
              .mockImplementationOnce(
                () =>
                  new Promise<Wallpaper[]>((_r, rej) => {
                    rejectHero = rej;
                  }),
              )
              .mockImplementationOnce(() => Promise.resolve([])),
          );
          return () => null;
        },
      }),
    );
    await flushPromises();
    wrapper2.unmount();
    rejectHero(new ApiError("server"));
    await flushPromises();
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
