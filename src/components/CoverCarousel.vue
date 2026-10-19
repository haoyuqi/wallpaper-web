<script setup lang="ts">
import { toRef } from "vue";
import type { Wallpaper } from "../services/wallpapers";
import { displayDate } from "../services/dates";
import { useCarousel } from "../composables/useCarousel";
import WallpaperImage from "./WallpaperImage.vue";
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
    aria-label="封面壁纸"
    aria-roledescription="轮播"
    @mouseenter="pause('hover', true)"
    @mouseleave="pause('hover', false)"
    @focusin="pause('focus', true)"
    @focusout="focusOut"
  >
    <button
      class="hero-image-button"
      type="button"
      :aria-label="`查看壁纸：${current.title}`"
      @click="emit('open', current, $event)"
    >
      <WallpaperImage :src="current.imageUrl" :alt="current.title" kind="hero" />
      <span class="hero-open-label">查看壁纸 <span aria-hidden="true">↗</span></span>
    </button>
    <div class="hero-caption">
      <div>
        <span class="eyebrow">{{ displayDate(current.date, " / ") }}</span>
        <h1 id="cover-title">{{ current.title }}</h1>
      </div>
      <div v-if="items.length > 1" class="hero-controls">
        <button
          id="cover-play"
          type="button"
          :aria-label="playing ? '暂停轮播' : '播放轮播'"
          :aria-pressed="!playing"
          @click="toggle"
        >
          <span aria-hidden="true">{{ playing ? "Ⅱ" : "▷" }}</span>
        </button>
        <button type="button" aria-label="上一张封面" @click="step(-1)">
          <span aria-hidden="true">←</span>
        </button>
        <button type="button" aria-label="下一张封面" @click="step(1)">
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
