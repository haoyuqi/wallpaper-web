<script setup lang="ts">
import { useLocalization } from "../i18n";
import { onMounted, onUnmounted, ref } from "vue";
import type { Wallpaper } from "../services/wallpapers";
import { fetchDownload } from "../services/download";
import WallpaperImage from "./WallpaperImage.vue";
const { t, formatDate, wallpaperTitle } = useLocalization();
const props = defineProps<{ wallpaper: Wallpaper; trigger: HTMLElement | null }>();
const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLDialogElement>();
const closeButton = ref<HTMLButtonElement>();
const downloading = ref(false);
const downloadError = ref(false);
const message = ref<"" | "viewer.handedOff" | "viewer.failed">("");
const saved = {
  x: window.scrollX,
  y: window.scrollY,
  position: document.body.style.position,
  top: document.body.style.top,
  width: document.body.style.width,
  overflow: document.body.style.overflow,
};
let controller: AbortController | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let revokeTimer: ReturnType<typeof setTimeout> | undefined;
let objectUrl: string | undefined;
let disposed = false;
function keydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    emit("close");
  }
  if (event.key !== "Tab" || !dialog.value) return;
  const elements = [
    ...dialog.value.querySelectorAll<HTMLElement>(
      'button:not(:disabled),a[href],input:not(:disabled),[tabindex="0"]',
    ),
  ];
  const first = elements[0],
    last = elements.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}
function revoke() {
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = undefined;
  }
  clearTimeout(revokeTimer);
}
async function download() {
  if (downloading.value || !props.wallpaper.downloadUrl) return;
  downloading.value = true;
  downloadError.value = false;
  message.value = "";
  controller = new AbortController();
  timer = setTimeout(() => controller?.abort(), 30000);
  try {
    const result = await fetchDownload(props.wallpaper.downloadUrl, controller.signal);
    if (disposed) return;
    revoke();
    objectUrl = URL.createObjectURL(result.blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `wallpaper-${props.wallpaper.date}.${result.extension}`;
    document.body.append(link);
    link.click();
    link.remove();
    message.value = "viewer.handedOff";
    revokeTimer = setTimeout(revoke, 60000);
  } catch {
    if (!disposed) {
      downloadError.value = true;
      message.value = "viewer.failed";
    }
  } finally {
    clearTimeout(timer);
    if (!disposed) downloading.value = false;
  }
}
onMounted(() => {
  Object.assign(document.body.style, {
    position: "fixed",
    top: `-${saved.y}px`,
    width: "100%",
    overflow: "hidden",
  });
  dialog.value?.showModal();
  closeButton.value?.focus();
});
onUnmounted(() => {
  disposed = true;
  controller?.abort();
  clearTimeout(timer);
  revoke();
  dialog.value?.close();
  Object.assign(document.body.style, {
    position: saved.position,
    top: saved.top,
    width: saved.width,
    overflow: saved.overflow,
  });
  window.scrollTo({ left: saved.x, top: saved.y, behavior: "instant" });
  const target = props.trigger?.isConnected
    ? props.trigger
    : document.getElementById("collection-title");
  target?.focus({ preventScroll: true });
});
</script>
<template>
  <dialog
    ref="dialog"
    class="wallpaper-viewer"
    aria-labelledby="detail-title"
    @cancel.prevent="emit('close')"
    @keydown="keydown"
  >
    <div class="detail-top">
      <span>{{ t("image.view") }}</span
      ><button
        ref="closeButton"
        type="button"
        :aria-label="t('viewer.close')"
        @click="emit('close')"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
    <div class="detail-body">
      <div class="detail-stage">
        <WallpaperImage :src="wallpaper.imageUrl" :alt="wallpaperTitle(wallpaper)" kind="viewer" />
      </div>
      <div class="detail-info">
        <div>
          <span class="eyebrow">{{ formatDate(wallpaper.date) }}</span>
          <h2 id="detail-title">{{ wallpaperTitle(wallpaper) }}</h2>
        </div>
        <div class="download-area">
          <div class="detail-actions">
            <a :href="wallpaper.imageUrl" target="_blank" rel="noopener noreferrer">{{
              t("viewer.original")
            }}</a>
            <button
              data-download
              type="button"
              class="primary-action"
              :disabled="!wallpaper.downloadUrl || downloading"
              :aria-busy="downloading"
              @click="download"
            >
              {{
                !wallpaper.downloadUrl
                  ? t("viewer.unavailable")
                  : downloading
                    ? t("viewer.preparing")
                    : downloadError
                      ? t("viewer.retry")
                      : t("viewer.download")
              }}
            </button>
          </div>
          <p v-if="message" class="download-message" role="status">{{ t(message) }}</p>
          <a
            v-if="downloadError && wallpaper.downloadUrl"
            class="browser-download"
            :href="wallpaper.downloadUrl"
            target="_blank"
            rel="noopener noreferrer"
            >{{ t("viewer.browser") }}</a
          >
        </div>
      </div>
    </div>
    <div class="detail-foot">
      <a
        v-if="wallpaper.copyright && wallpaper.copyrightLink"
        :href="wallpaper.copyrightLink"
        target="_blank"
        rel="noopener noreferrer"
        >{{ wallpaper.copyright }} ↗</a
      ><span v-else>{{ wallpaper.copyright || t("viewer.copyright") }}</span
      ><span class="keyboard-tip">{{ t("viewer.escape") }}</span>
    </div>
  </dialog>
</template>
