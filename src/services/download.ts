import { httpsUrl } from "./wallpapers";
export const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024;
const formats: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};

export async function fetchDownload(
  url: string,
  signal: AbortSignal,
): Promise<{ blob: Blob; extension: string }> {
  if (!httpsUrl(url)) throw new Error("Invalid download URL");
  const response = await fetch(url, { signal, credentials: "omit" });
  const type = response.headers.get("Content-Type")?.split(";")[0]?.trim().toLowerCase() ?? "";
  const extension = formats[type];
  if (!response.ok || !extension || !response.body) {
    await response.body?.cancel();
    throw new Error("Unavailable image");
  }
  const length = Number(response.headers.get("Content-Length"));
  if (length > MAX_DOWNLOAD_BYTES) {
    await response.body.cancel();
    throw new Error("Image too large");
  }
  const reader = response.body.getReader();
  const chunks: ArrayBuffer[] = [];
  let size = 0;
  let complete = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        complete = true;
        break;
      }
      size += value.byteLength;
      if (size > MAX_DOWNLOAD_BYTES) throw new Error("Image too large");
      chunks.push(value.slice().buffer as ArrayBuffer);
    }
    if (!size) throw new Error("Empty image");
    return { blob: new Blob(chunks, { type }), extension };
  } finally {
    if (!complete) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
