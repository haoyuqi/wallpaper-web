<script setup lang="ts">
import type { Wallpaper } from "../services/wallpapers";
import { displayDate } from "../services/dates";
import WallpaperImage from "./WallpaperImage.vue";
defineProps<{ wallpaper: Wallpaper }>();
const emit = defineEmits<{ open: [wallpaper: Wallpaper, event: MouseEvent] }>();
</script>
<template>
  <article class="wallpaper-card" :data-wallpaper-id="wallpaper.id">
    <button
      type="button"
      class="card-image"
      :aria-label="`查看壁纸：${wallpaper.title}`"
      @click="emit('open', wallpaper, $event)"
    >
      <WallpaperImage :src="wallpaper.imageUrl" :alt="wallpaper.title" /><span
        class="card-open"
        aria-hidden="true"
        >查看壁纸 ↗</span
      >
    </button>
    <time class="card-meta" :datetime="wallpaper.date">{{ displayDate(wallpaper.date) }}</time>
    <h3>
      <button type="button" @click="emit('open', wallpaper, $event)">{{ wallpaper.title }}</button>
    </h3>
  </article>
</template>
