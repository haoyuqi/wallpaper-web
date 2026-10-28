<script setup lang="ts">
import { useLocalization } from "../i18n";
import { toRef } from "vue";
import type { Wallpaper } from "../services/wallpapers";
import { useCarousel } from "../composables/useCarousel";
import WallpaperImage from "./WallpaperImage.vue";
const { t, formatDate, wallpaperTitle } = useLocalization();
const props = defineProps<{ items: Wallpaper[]; modalOpen: boolean }>();
const emit = defineEmits<{ open: [wallpaper: Wallpaper, event: MouseEvent] }>();
const { index, current, playing, pause, step, toggle } = useCarousel(
  toRef(props, "items"),
  toRef(props, "modalOpen"),
);
function focusOut(event: FocusEvent) {
  if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null))
    pause("focus", false);
}
</script>
<template>
  <section
    v-if="current"
    class="hero"
    :aria-label="t('cover.label')"
    :aria-roledescription="t('cover.carousel')"
    @mouseenter="pause('hover', true)"
    @mouseleave="pause('hover', false)"
    @focusin="pause('focus', true)"
    @focusout="focusOut"
  >
    <button
      class="hero-image-button"
      type="button"
      :aria-label="t('image.viewTitle', { title: wallpaperTitle(current) })"
      @click="emit('open', current, $event)"
    >
      <WallpaperImage :src="current.imageUrl" :alt="wallpaperTitle(current)" kind="hero" />
      <span class="hero-open-label">{{ t("image.view") }} <span aria-hidden="true">↗</span></span>
    </button>
    <div class="hero-caption">
      <div>
        <span class="eyebrow">{{ formatDate(current.date) }}</span>
        <h1 id="cover-title">{{ wallpaperTitle(current) }}</h1>
      </div>
      <div v-if="items.length > 1" class="hero-controls">
        <button
          id="cover-play"
          type="button"
          :aria-label="playing ? t('cover.pause') : t('cover.play')"
          @click="toggle"
        >
          <span aria-hidden="true">{{ playing ? "Ⅱ" : "▷" }}</span>
        </button>
        <button type="button" :aria-label="t('cover.previous')" @click="step(-1)">
          <span aria-hidden="true">←</span>
        </button>
        <button type="button" :aria-label="t('cover.next')" @click="step(1)">
          <span aria-hidden="true">→</span>
        </button>
        <span id="cover-position"
          >{{ String(index + 1).padStart(2, "0") }} /
          {{ String(items.length).padStart(2, "0") }}</span
        >
      </div>
    </div>
  </section>
</template>
