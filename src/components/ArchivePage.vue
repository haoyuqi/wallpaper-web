<script setup lang="ts">
import { computed, nextTick, shallowRef, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { isCalendarDate, displayDate } from "../services/dates";
import type { Wallpaper } from "../services/wallpapers";
import { useArchive } from "../composables/useArchive";
import { useRetryAfter } from "../composables/useRetryAfter";
import CoverCarousel from "./CoverCarousel.vue";
import WallpaperCard from "./WallpaperCard.vue";
import WallpaperViewer from "./WallpaperViewer.vue";
import ArchiveStatus from "./ArchiveStatus.vue";
const route = useRoute(),
  router = useRouter();
const date = computed(() =>
  route.query.date === undefined
    ? null
    : typeof route.query.date === "string"
      ? route.query.date
      : "invalid",
);
const state = useArchive(date);
const { hero, heroLoading, heroError, visible, hasMore, loading, error, loadedQuery } = state;
const heroWait = useRetryAfter(computed(() => heroError.value?.retryAt ?? null));
const selected = shallowRef<Wallpaper | null>(null);
const trigger = shallowRef<HTMLElement | null>(null);
const inputError = ref(false),
  announcement = ref("");
watch(date, () => {
  announcement.value = "";
});
const fieldError = computed(() => inputError.value || error.value?.kind === "validation");
const rangeLabel = computed(() =>
  "date" in loadedQuery.value
    ? displayDate(loadedQuery.value.date)
    : `${displayDate(loadedQuery.value.from)} — ${displayDate(loadedQuery.value.to)}`,
);
const showCards = computed(
  () =>
    !loading.value &&
    (!error.value || error.value.kind === "validation") &&
    visible.value.length > 0,
);
function open(wallpaper: Wallpaper, event: MouseEvent) {
  trigger.value = event.currentTarget as HTMLElement;
  selected.value = wallpaper;
}
function clear() {
  inputError.value = false;
  void router.push({ path: "/", query: { ...route.query, date: undefined } });
}
function changeDate(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.validity.badInput || (input.value && !isCalendarDate(input.value))) {
    inputError.value = true;
    return;
  }
  inputError.value = false;
  if (!input.value) {
    clear();
    return;
  }
  void router.push({ path: "/", query: { ...route.query, date: input.value } });
}
async function more(event: MouseEvent) {
  const previous = visible.value.length;
  state.more();
  await nextTick();
  announcement.value = `已追加 ${visible.value.length - previous} 张壁纸。`;
  if (event.detail === 0)
    document
      .querySelectorAll<HTMLElement>(".wallpaper-card .card-image")
      [previous]?.focus({ preventScroll: true });
}
</script>
<template>
  <a class="skip-link" href="#collection">跳到壁纸列表</a>
  <div class="site-shell">
    <header class="site-header">
      <a class="wordmark" href="#"
        ><span>壁纸</span><span class="wordmark-line"></span
        ><span class="wordmark-note">Bing 影像归档</span></a
      >
    </header>
    <main id="main">
      <h1 v-if="heroLoading || heroError || !hero.length" class="sr-only">Bing 壁纸归档</h1>
      <div v-if="heroLoading" class="hero" aria-busy="true">
        <div class="skeleton hero-skeleton" aria-label="正在加载封面"></div>
      </div>
      <div v-else-if="heroError" class="hero">
        <div class="notice">
          <p>封面暂时无法加载</p>
          <button class="action" type="button" :disabled="heroWait > 0" @click="state.reloadHero">
            重新加载封面
          </button>
        </div>
      </div>
      <CoverCarousel v-else :items="hero" :modal-open="!!selected" @open="open" />
      <div class="archive-layout">
        <section id="collection" class="collection" aria-labelledby="collection-title">
          <div class="collection-toolbar">
            <div class="collection-heading">
              <h2 id="collection-title" tabindex="-1">全部壁纸</h2>
              <p class="archive-scope">{{ rangeLabel }}</p>
            </div>
            <form class="filters" @submit.prevent>
              <div class="filter-start">
                <label class="filter-label" for="date-filter">归档日期</label
                ><span class="date-field"
                  ><input
                    id="date-filter"
                    type="date"
                    :value="date && isCalendarDate(date) ? date : ''"
                    :aria-invalid="fieldError"
                    :aria-describedby="fieldError ? 'date-error' : 'date-hint'"
                    @change="changeDate" /></span
                ><button v-if="date" type="button" class="reset-filter" @click="clear">
                  清除筛选 ×
                </button>
              </div>
            </form>
          </div>
          <span id="date-hint" class="sr-only">支持按日期查找已归档壁纸</span>
          <p v-if="fieldError" id="date-error" class="field-error" role="alert">请选择有效日期。</p>
          <p class="sr-only" role="status" aria-live="polite">{{ announcement }}</p>
          <div v-if="showCards" id="wallpaper-grid" class="wallpaper-grid">
            <WallpaperCard
              v-for="wallpaper in visible"
              :key="wallpaper.id"
              :wallpaper="wallpaper"
              @open="open"
            />
          </div>
          <ArchiveStatus
            v-else-if="!fieldError || loading"
            :error="error"
            :filtered="!!date"
            :loading="loading"
            @retry="state.retry"
            @clear="clear"
          />
          <div v-if="showCards" class="collection-end">
            <button v-if="hasMore" type="button" aria-controls="wallpaper-grid" @click="more">
              加载更多
            </button>
            <p v-else>当前范围已全部显示，可按日期查找其他壁纸</p>
          </div>
        </section>
      </div>
    </main>
    <footer>
      <p>图片版权归原权利人所有</p>
      <a href="#">返回顶部 ↑</a>
    </footer>
  </div>
  <WallpaperViewer
    v-if="selected"
    :wallpaper="selected"
    :trigger="trigger"
    @close="selected = null"
  />
</template>
