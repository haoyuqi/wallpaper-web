<script setup lang="ts">
import { useLocalization } from "../i18n";
import type { Wallpaper } from "../services/wallpapers";
import WallpaperImage from "./WallpaperImage.vue";
const { t, formatDate, wallpaperTitle } = useLocalization();
defineProps<{ wallpaper: Wallpaper }>();
const emit = defineEmits<{ open: [wallpaper: Wallpaper, event: MouseEvent] }>();
</script>
<template>
  <article class="wallpaper-card" :data-wallpaper-id="wallpaper.id">
    <button
      type="button"
      class="card-image"
      :aria-label="t('image.viewTitle', { title: wallpaperTitle(wallpaper) })"
      @click="emit('open', wallpaper, $event)"
    >
      <WallpaperImage :src="wallpaper.imageUrl" :alt="wallpaperTitle(wallpaper)" /><span
        class="card-open"
        aria-hidden="true"
        >{{ t("image.view") }} ↗</span
      >
    </button>
    <time class="card-meta" :datetime="wallpaper.date">{{ formatDate(wallpaper.date) }}</time>
    <h3>
      <button type="button" @click="emit('open', wallpaper, $event)">
        {{ wallpaperTitle(wallpaper) }}
      </button>
    </h3>
  </article>
</template>
