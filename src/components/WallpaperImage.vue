<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from "vue";
const props = withDefaults(
  defineProps<{ src: string; alt: string; kind?: "hero" | "card" | "viewer" }>(),
  { kind: "card" },
);
const image = ref<HTMLImageElement>();
const state = ref<"loading" | "loaded" | "error">("loading");
const attempt = ref(0);
function cached() {
  if (image.value?.complete && image.value.naturalWidth > 0) state.value = "loaded";
}
function retry() {
  state.value = "loading";
  attempt.value++;
}
watch(
  () => props.src,
  async () => {
    retry();
    await nextTick();
    cached();
  },
);
onMounted(cached);
</script>
<template>
  <div class="photo" :class="`photo-${kind}`" :aria-busy="state === 'loading'">
    <img
      ref="image"
      :key="attempt"
      :src="src"
      :alt="alt"
      :loading="kind === 'card' ? 'lazy' : 'eager'"
      :fetchpriority="kind === 'hero' ? 'high' : 'auto'"
      decoding="async"
      width="1920"
      height="1080"
      :class="{ unloaded: state !== 'loaded' }"
      @load="state = 'loaded'"
      @error="state = 'error'"
    />
    <div
      v-if="state !== 'loaded'"
      class="photo-feedback"
      :role="kind === 'viewer' ? 'status' : undefined"
    >
      <p>
        {{
          state === "loading"
            ? "正在加载图片…"
            : kind === "viewer"
              ? "图片暂时无法加载"
              : "预览暂不可用"
        }}
      </p>
      <button
        v-if="state === 'error' && kind === 'viewer'"
        class="image-retry stage-button"
        type="button"
        @click="retry"
      >
        重新加载
      </button>
    </div>
  </div>
</template>
