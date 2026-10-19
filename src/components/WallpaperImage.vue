<script setup lang="ts">
import { useLocalization } from "../i18n";
import { nextTick, onMounted, ref, watch } from "vue";
const { t } = useLocalization();
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
            ? t("image.loading")
            : kind === "viewer"
              ? t("image.unavailable")
              : t("image.previewUnavailable")
        }}
      </p>
      <button
        v-if="state === 'error' && kind === 'viewer'"
        class="image-retry stage-button"
        type="button"
        @click="retry"
      >
        {{ t("image.retry") }}
      </button>
    </div>
  </div>
</template>
