import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { displayDate, isCalendarDate, recentRange } from "../../src/services/dates";
import { fetchDownload, MAX_DOWNLOAD_BYTES } from "../../src/services/download";
import {
  ApiError,
  httpsUrl,
  loadWallpapers,
  normalizeResponse,
  retryDeadline,
  type WallpaperQuery,
} from "../../src/services/wallpapers";

const sampleRecord = {
  id: "bing-2026-10-18",
  source: "bing",
  market: "en-US",
  sourceDate: "2026-10-18",
  title: "  Autumn valley in morning mist  ",
  copyright: "  © Example Photographer / Getty Images  ",
  copyrightLink: "https://www.bing.com/search?q=autumn+valley",
  imageUrl: "https://www.bing.com/th?id=OHR.AutumnValley_1920x1080.jpg",
  downloadUrl: "https://www.bing.com/th?id=OHR.AutumnValley_UHD.jpg",
};

const dateQuery: WallpaperQuery = { date: "2026-10-18" };
const rangeQuery: WallpaperQuery = { from: "2026-09-20", to: "2026-10-19" };

function buildEnvelope(
  records: unknown[] = [sampleRecord],
  query: WallpaperQuery = dateQuery,
): Record<string, unknown> {
  return {
    data: records,
    meta: {
      count: records.length,
      query:
        "date" in query
          ? { date: query.date, from: null, to: null }
          : { date: null, from: query.from, to: query.to },
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("calendar date utilities", () => {
  it.each(["2024-02-29", "2026-10-18", "0001-01-01", "9999-12-31"])(
    "accepts canonical calendar date %s",
    (value) => {
      expect(isCalendarDate(value)).toBe(true);
    },
  );

  it.each([
    "2023-02-29",
    "2026-04-31",
    "2026-13-01",
    "2026-00-10",
    "0000-01-01",
    "2026/10/18",
    "2026-1-05",
    "",
    null,
    undefined,
    20261018,
  ])("rejects invalid date input %s", (value) => {
    expect(isCalendarDate(value)).toBe(false);
  });

  it("computes an inclusive 30-day UTC window across month and leap boundaries", () => {
    expect(recentRange()).toHaveProperty("from");
    expect(recentRange(new Date("2024-03-01T23:59:59Z"))).toEqual({
      from: "2024-02-01",
      to: "2024-03-01",
    });
    expect(recentRange(new Date("2026-10-19T02:00:00Z"))).toEqual({
      from: "2026-09-20",
      to: "2026-10-19",
    });
  });

  it("formats calendar dates directly without timezone shifts", () => {
    expect(displayDate("2026-10-18")).toBe("2026.10.18");
    expect(displayDate("2026-10-18", " / ")).toBe("2026 / 10 / 18");
  });
});

describe("HTTPS URL validation and response normalization", () => {
  it("accepts only credential-free HTTPS URLs", () => {
    expect(httpsUrl("https://example.com/image.jpg")).toBe(true);
    expect(httpsUrl("http://example.com/image.jpg")).toBe(false);
    expect(httpsUrl("javascript:alert(1)")).toBe(false);
    expect(httpsUrl("data:image/png;base64,AAAA")).toBe(false);
    expect(httpsUrl("https://user:pass@example.com/image.jpg")).toBe(false);
    expect(httpsUrl("https://user@example.com/image.jpg")).toBe(false);
    expect(httpsUrl("not-a-url")).toBe(false);
    expect(httpsUrl(123)).toBe(false);
  });

  it("trims text, falls back empty titles, deduplicates by id and ignores extra fields", () => {
    const payload = buildEnvelope(
      [
        { ...sampleRecord, extraField: "ignored" },
        { ...sampleRecord, title: "Duplicate id should be skipped" },
        {
          ...sampleRecord,
          id: "bing-2026-10-17",
          sourceDate: "2026-10-17",
          title: "   ",
          copyright: "   ",
          copyrightLink: null,
          downloadUrl: null,
        },
      ],
      rangeQuery,
    );

    const normalized = normalizeResponse(payload, rangeQuery);
    expect(normalized).toEqual([
      {
        id: "bing-2026-10-18",
        date: "2026-10-18",
        title: "Autumn valley in morning mist",
        copyright: "© Example Photographer / Getty Images",
        copyrightLink: "https://www.bing.com/search?q=autumn+valley",
        imageUrl: "https://www.bing.com/th?id=OHR.AutumnValley_1920x1080.jpg",
        downloadUrl: "https://www.bing.com/th?id=OHR.AutumnValley_UHD.jpg",
      },
      {
        id: "bing-2026-10-17",
        date: "2026-10-17",
        title: "2026.10.17 壁纸",
        copyright: null,
        copyrightLink: null,
        imageUrl: "https://www.bing.com/th?id=OHR.AutumnValley_1920x1080.jpg",
        downloadUrl: null,
      },
    ]);
  });

  it("preserves literal HTML characters in metadata without interpretation", () => {
    const normalized = normalizeResponse(
      buildEnvelope([{ ...sampleRecord, title: "<img src=x onerror=alert(1)>" }]),
      dateQuery,
    );
    expect(normalized[0]?.title).toBe("<img src=x onerror=alert(1)>");
  });

  it.each([
    ["non-object root", null],
    ["array root", []],
    [
      "non-array data",
      { data: {}, meta: { count: 0, query: { date: "2026-10-18", from: null, to: null } } },
    ],
    [
      "count mismatch",
      {
        ...buildEnvelope(),
        meta: { count: 2, query: { date: "2026-10-18", from: null, to: null } },
      },
    ],
    ["query echo mismatch for date", buildEnvelope([sampleRecord], rangeQuery)],
    ["non-object row", buildEnvelope([null])],
    ["blank id", buildEnvelope([{ ...sampleRecord, id: "   " }])],
    ["blank source", buildEnvelope([{ ...sampleRecord, source: "   " }])],
    ["blank market", buildEnvelope([{ ...sampleRecord, market: "   " }])],
    ["invalid sourceDate", buildEnvelope([{ ...sampleRecord, sourceDate: "2026-02-30" }])],
    ["unsafe imageUrl", buildEnvelope([{ ...sampleRecord, imageUrl: "javascript:alert(1)" }])],
    ["invalid title type", buildEnvelope([{ ...sampleRecord, title: 123 }])],
    ["invalid copyright type", buildEnvelope([{ ...sampleRecord, copyright: 123 }])],
    [
      "unsafe downloadUrl",
      buildEnvelope([{ ...sampleRecord, downloadUrl: "http://example.com/a.jpg" }]),
    ],
    [
      "unsafe copyrightLink",
      buildEnvelope([{ ...sampleRecord, copyrightLink: "data:text/html,hi" }]),
    ],
    [
      "out-of-range sourceDate for exact date",
      buildEnvelope([{ ...sampleRecord, sourceDate: "2026-10-17" }], dateQuery),
    ],
  ])("rejects malformed contract response (%s)", (_label, invalidPayload) => {
    expect(() => normalizeResponse(invalidPayload, dateQuery)).toThrowError(
      expect.objectContaining({ kind: "response" }),
    );
  });

  it("rejects range query echo mismatch and out-of-range dates in range mode", () => {
    expect(() => normalizeResponse(buildEnvelope([sampleRecord], dateQuery), rangeQuery)).toThrow(
      ApiError,
    );
    expect(() =>
      normalizeResponse(
        buildEnvelope([{ ...sampleRecord, sourceDate: "2026-08-01" }], rangeQuery),
        rangeQuery,
      ),
    ).toThrow(ApiError);
    expect(() =>
      normalizeResponse(
        buildEnvelope([{ ...sampleRecord, sourceDate: "2026-11-01" }], rangeQuery),
        rangeQuery,
      ),
    ).toThrow(ApiError);
  });
});

describe("Retry-After parsing and loadWallpapers HTTP boundary", () => {
  it("parses positive delta-seconds and RFC HTTP-date headers", () => {
    const now = Date.parse("2026-10-18T12:00:00Z");
    expect(retryDeadline("15")).toBeGreaterThan(0);
    expect(retryDeadline("15", now)).toBe(now + 15000);
    expect(retryDeadline("9".repeat(400), now)).toBeNull();
    expect(retryDeadline("Sun, 18 Oct 2026 12:00:30 GMT", now)).toBe(now + 30000);
    expect(retryDeadline("Sun, 18 Oct 2026 11:59:00 GMT", now)).toBe(now);
    expect(retryDeadline("Sun, 99 Oct 2026 99:99:99 GMT", now)).toBeNull();
    expect(retryDeadline("-5", now)).toBeNull();
    expect(retryDeadline("invalid", now)).toBeNull();
    expect(retryDeadline(null, now)).toBeNull();
  });

  it("rejects invalid queries locally before calling fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(loadWallpapers({ date: "2026-02-30" })).rejects.toMatchObject({
      kind: "validation",
    });
    await expect(loadWallpapers({ from: "2026-10-19", to: "2026-10-18" })).rejects.toMatchObject({
      kind: "validation",
    });
    await expect(loadWallpapers({ from: "invalid", to: "2026-10-18" })).rejects.toMatchObject({
      kind: "validation",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("propagates pre-aborted and in-flight aborted signals", async () => {
    const preAborted = new AbortController();
    preAborted.abort();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => {
        if (init.signal?.aborted) {
          return Promise.reject(new DOMException("Aborted", "AbortError"));
        }
        return Promise.resolve(new Response("{}"));
      }),
    );

    await expect(loadWallpapers(dateQuery, preAborted.signal)).rejects.toBeDefined();

    const emptyReasonController = new AbortController();
    Object.defineProperty(emptyReasonController.signal, "reason", { value: undefined });
    emptyReasonController.abort();
    await expect(loadWallpapers(dateQuery, emptyReasonController.signal)).rejects.toThrow(
      "Cancelled",
    );

    let inFlightFetchSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => {
        inFlightFetchSignal = init.signal as AbortSignal;
        return new Promise<Response>((_resolve, reject) => {
          inFlightFetchSignal?.addEventListener("abort", () =>
            reject(inFlightFetchSignal?.reason ?? new DOMException("Aborted", "AbortError")),
          );
        });
      }),
    );

    const inFlightController = new AbortController();
    const inFlightPromise = loadWallpapers(dateQuery, inFlightController.signal);
    expect(inFlightFetchSignal?.aborted).toBe(false);
    inFlightController.abort(new Error("user cancelled in-flight"));
    expect(inFlightFetchSignal?.aborted).toBe(true);
    await expect(inFlightPromise).rejects.toThrow("user cancelled in-flight");
  });

  it("requests exact-date and range queries with credentials omitted", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(buildEnvelope([], rangeQuery)), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchSpy);

    const items = await loadWallpapers(rangeQuery);
    expect(items).toEqual([]);
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/v1/wallpapers?from=2026-09-20&to=2026-10-19",
      expect.objectContaining({
        credentials: "omit",
        headers: { Accept: "application/json" },
      }),
    );
  });

  it.each([
    [422, "validation"],
    [429, "rate"],
    [500, "server"],
    [503, "server"],
  ])("classifies HTTP %i as %s error", async (status, expectedKind) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("{}", {
          status,
          headers: status === 429 ? { "Retry-After": "8" } : {},
        }),
      ),
    );

    await expect(loadWallpapers(dateQuery)).rejects.toMatchObject({
      kind: expectedKind,
    });
  });

  it("classifies network rejection and invalid JSON payloads", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(loadWallpapers(dateQuery)).rejects.toMatchObject({ kind: "network" });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not-json", { status: 200 })));
    await expect(loadWallpapers(dateQuery)).rejects.toMatchObject({ kind: "response" });
  });

  it("aborts after 15 seconds with a timeout error", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
          }),
      ),
    );

    const pending = loadWallpapers(dateQuery);
    const assertion = expect(pending).rejects.toMatchObject({ kind: "timeout" });
    await vi.advanceTimersByTimeAsync(15000);
    await assertion;
  });
});

describe("streamed image download boundary", () => {
  it.each([
    ["image/jpeg; charset=binary", "jpg"],
    ["image/png", "png"],
    ["image/webp", "webp"],
  ])("streams valid %s responses and derives .%s extension", async (contentType, ext) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(new Uint8Array([137, 80, 78, 71]), {
          status: 200,
          headers: { "Content-Type": contentType },
        }),
      ),
    );

    const result = await fetchDownload(
      "https://example.com/wallpaper",
      new AbortController().signal,
    );
    expect(result.extension).toBe(ext);
    expect(result.blob.size).toBe(4);
  });

  it("rejects non-HTTPS URLs, missing/invalid content types and empty bodies", async () => {
    await expect(
      fetchDownload("http://example.com/wallpaper", new AbortController().signal),
    ).rejects.toThrow("Invalid download URL");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    await expect(
      fetchDownload("https://example.com/wallpaper", new AbortController().signal),
    ).rejects.toThrow("Unavailable image");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(new Uint8Array(0), {
          status: 200,
          headers: { "Content-Type": "image/jpeg" },
        }),
      ),
    );
    await expect(
      fetchDownload("https://example.com/wallpaper", new AbortController().signal),
    ).rejects.toThrow("Empty image");
  });

  it("cancels streams exceeding MAX_DOWNLOAD_BYTES and tolerates reader.cancel rejections", async () => {
    const headerCancel = vi.fn();
    const headerStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
      },
      cancel: headerCancel,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(headerStream, {
          status: 200,
          headers: {
            "Content-Type": "image/jpeg",
            "Content-Length": String(MAX_DOWNLOAD_BYTES + 100),
          },
        }),
      ),
    );
    await expect(
      fetchDownload("https://example.com/wallpaper", new AbortController().signal),
    ).rejects.toThrow("Image too large");
    expect(headerCancel).toHaveBeenCalled();

    const streamCancel = vi.fn().mockRejectedValue(new Error("cancel failed"));
    const unheaderedStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_DOWNLOAD_BYTES + 1));
      },
      cancel: streamCancel,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(unheaderedStream, {
          status: 200,
          headers: { "Content-Type": "image/png" },
        }),
      ),
    );
    await expect(
      fetchDownload("https://example.com/wallpaper", new AbortController().signal),
    ).rejects.toThrow("Image too large");
    expect(streamCancel).toHaveBeenCalled();
  });

  it("constructs ApiError with default and explicit retryAt", () => {
    const err = new ApiError("rate");
    expect(err.kind).toBe("rate");
    expect(err.retryAt).toBeNull();
  });
});
