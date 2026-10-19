import { isCalendarDate } from "./dates";

export interface Wallpaper {
  id: string;
  date: string;
  title: string;
  imageUrl: string;
  downloadUrl: string | null;
  copyright: string | null;
  copyrightLink: string | null;
}
export type WallpaperQuery = { date: string } | { from: string; to: string };
export type ErrorKind = "validation" | "rate" | "server" | "network" | "timeout" | "response";
export class ApiError extends Error {
  constructor(
    public readonly kind: ErrorKind,
    public readonly retryAt: number | null = null,
  ) {
    super(kind);
    this.name = "ApiError";
  }
}
export function httpsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function nullableText(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}
export function normalizeResponse(value: unknown, query: WallpaperQuery): Wallpaper[] {
  const invalid = () => new ApiError("response");
  if (
    !object(value) ||
    !Array.isArray(value.data) ||
    !object(value.meta) ||
    value.meta.count !== value.data.length ||
    !object(value.meta.query)
  )
    throw invalid();
  const echo = value.meta.query;
  if (
    "date" in query
      ? echo.date !== query.date || echo.from !== null || echo.to !== null
      : echo.date !== null || echo.from !== query.from || echo.to !== query.to
  )
    throw invalid();
  const items = new Map<string, Wallpaper>();
  for (const row of value.data) {
    if (
      !object(row) ||
      typeof row.id !== "string" ||
      !row.id.trim() ||
      typeof row.source !== "string" ||
      !row.source.trim() ||
      typeof row.market !== "string" ||
      !row.market.trim() ||
      !isCalendarDate(row.sourceDate) ||
      !httpsUrl(row.imageUrl) ||
      !nullableText(row.title) ||
      !nullableText(row.copyright) ||
      !(row.downloadUrl === null || httpsUrl(row.downloadUrl)) ||
      !(row.copyrightLink === null || httpsUrl(row.copyrightLink))
    )
      throw invalid();
    if (
      "date" in query
        ? row.sourceDate !== query.date
        : row.sourceDate < query.from || row.sourceDate > query.to
    )
      throw invalid();
    if (!items.has(row.id))
      items.set(row.id, {
        id: row.id,
        date: row.sourceDate,
        title: row.title?.trim() || "",
        imageUrl: row.imageUrl,
        downloadUrl: row.downloadUrl,
        copyright: row.copyright?.trim() || null,
        copyrightLink: row.copyrightLink,
      });
  }
  return [...items.values()];
}
export function retryDeadline(header: string | null, now = Date.now()): number | null {
  if (!header) return null;
  if (/^\d+$/.test(header.trim())) {
    const deadline = now + Number(header) * 1000;
    return Number.isFinite(deadline) ? deadline : null;
  }
  // Date.parse accepts surprising non-HTTP strings such as "-2".
  if (!/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), /i.test(header)) return null;
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(now, date) : null;
}
export async function loadWallpapers(
  query: WallpaperQuery,
  signal?: AbortSignal,
): Promise<Wallpaper[]> {
  if (
    "date" in query
      ? !isCalendarDate(query.date)
      : !isCalendarDate(query.from) || !isCalendarDate(query.to) || query.from > query.to
  )
    throw new ApiError("validation");
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) cancel();
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 15000);
  try {
    const base = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
    const response = await fetch(`${base}/api/v1/wallpapers?${new URLSearchParams(query)}`, {
      signal: controller.signal,
      credentials: "omit",
      headers: { Accept: "application/json" },
    });
    if (!response.ok)
      throw new ApiError(
        response.status === 422 ? "validation" : response.status === 429 ? "rate" : "server",
        response.status === 429 ? retryDeadline(response.headers.get("Retry-After")) : null,
      );
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ApiError("response");
    }
    return normalizeResponse(body, query);
  } catch (error) {
    if (signal?.aborted) throw signal.reason ?? new DOMException("Cancelled", "AbortError");
    if (timedOut) throw new ApiError("timeout");
    if (error instanceof ApiError) throw error;
    throw new ApiError("network");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}
