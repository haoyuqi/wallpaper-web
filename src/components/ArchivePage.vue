<script setup lang="ts">
import { useLocalization } from "../i18n";
import { computed, nextTick, shallowRef, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { isCalendarDate } from "../services/dates";
import type { Wallpaper } from "../services/wallpapers";
import { useArchive } from "../composables/useArchive";
import { useRetryAfter } from "../composables/useRetryAfter";
import CoverCarousel from "./CoverCarousel.vue";
import WallpaperCard from "./WallpaperCard.vue";
import WallpaperViewer from "./WallpaperViewer.vue";
import ArchiveStatus from "./ArchiveStatus.vue";
import LanguageSelect from "./LanguageSelect.vue";
const { t, formatDate } = useLocalization();
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
  announcedCount = ref<number | null>(null);
watch(date, () => {
  announcedCount.value = null;
});
const fieldError = computed(() => inputError.value || error.value?.kind === "validation");
const rangeLabel = computed(() =>
  "date" in loadedQuery.value
    ? formatDate(loadedQuery.value.date)
    : `${formatDate(loadedQuery.value.from)} — ${formatDate(loadedQuery.value.to)}`,
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
  announcedCount.value = visible.value.length - previous;
  if (event.detail === 0)
    document
      .querySelectorAll<HTMLElement>(".wallpaper-card .card-image")
      [previous]?.focus({ preventScroll: true });
}
</script>
<template>
  <a class="skip-link" href="#collection">{{ t("app.skip") }}</a>
  <div class="site-shell">
    <header class="site-header">
      <a class="wordmark" href="#"
        ><span>{{ t("app.brand") }}</span
        ><span class="wordmark-line"></span
        ><span class="wordmark-note">{{ t("app.subtitle") }}</span></a
      >
      <LanguageSelect />
    </header>
    <main id="main">
      <h1 v-if="heroLoading || heroError || !hero.length" class="sr-only">
        {{ t("app.heading") }}
      </h1>
      <div v-if="heroLoading" class="hero" aria-busy="true">
        <div class="skeleton hero-skeleton" :aria-label="t('cover.loading')"></div>
      </div>
      <div v-else-if="heroError" class="hero">
        <div class="notice">
          <p>{{ t("cover.unavailable") }}</p>
          <button class="action" type="button" :disabled="heroWait > 0" @click="state.reloadHero">
            {{ t("cover.retry") }}
          </button>
        </div>
      </div>
      <CoverCarousel v-else :items="hero" :modal-open="!!selected" @open="open" />
      <div class="archive-layout">
        <section id="collection" class="collection" aria-labelledby="collection-title">
          <div class="collection-toolbar">
            <div class="collection-heading">
              <h2 id="collection-title" tabindex="-1">{{ t("archive.title") }}</h2>
              <p class="archive-scope">{{ rangeLabel }}</p>
            </div>
            <form class="filters" @submit.prevent>
              <div class="filter-start">
                <label class="filter-label" for="date-filter">{{ t("archive.date") }}</label
                ><span class="date-field"
                  ><input
                    id="date-filter"
                    type="date"
                    :value="date && isCalendarDate(date) ? date : ''"
                    :aria-invalid="fieldError"
                    :aria-describedby="fieldError ? 'date-error' : 'date-hint'"
                    @change="changeDate" /></span
                ><button v-if="date" type="button" class="reset-filter" @click="clear">
                  {{ t("archive.clear") }}
                </button>
              </div>
            </form>
          </div>
          <span id="date-hint" class="sr-only">{{ t("archive.hint") }}</span>
          <p v-if="fieldError" id="date-error" class="field-error" role="alert">
            {{ t("archive.invalidDate") }}
          </p>
          <p class="sr-only" role="status" aria-live="polite">
            {{ announcedCount === null ? "" : t("archive.added", announcedCount) }}
          </p>
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
              {{ t("archive.more") }}
            </button>
            <p v-else>{{ t("archive.end") }}</p>
          </div>
        </section>
      </div>
    </main>
    <footer>
      <p>{{ t("app.copyright") }}</p>
      <a href="#">{{ t("app.top") }}</a>
    </footer>
  </div>
  <WallpaperViewer
    v-if="selected"
    :wallpaper="selected"
    :trigger="trigger"
    @close="selected = null"
  />
</template>
