<script setup lang="ts">
import { useLocalization } from "../i18n";
import { computed } from "vue";
import { useRetryAfter } from "../composables/useRetryAfter";
import type { ApiError } from "../services/wallpapers";
const { t } = useLocalization();
const props = defineProps<{ error?: ApiError | null; filtered?: boolean; loading?: boolean }>();
const emit = defineEmits<{ retry: []; clear: [] }>();
const seconds = useRetryAfter(computed(() => props.error?.retryAt ?? null));
const title = computed(() =>
  props.error?.kind === "rate"
    ? t("archive.rate")
    : props.error
      ? t("archive.unavailable")
      : props.filtered
        ? t("archive.emptyDate")
        : t("archive.empty"),
);
const description = computed(() =>
  props.error?.kind === "rate"
    ? seconds.value
      ? t("archive.wait", seconds.value)
      : t("archive.retryLater")
    : props.error?.kind === "timeout"
      ? t("archive.timeout")
      : props.error
        ? t("archive.network")
        : props.filtered
          ? t("archive.anotherDate")
          : t("archive.emptyRange"),
);
</script>
<template>
  <div v-if="loading" class="wallpaper-grid" aria-busy="true" :aria-label="t('archive.loading')">
    <div v-for="n in 6" :key="n" aria-hidden="true">
      <div class="skeleton photo"></div>
      <div class="skeleton line"></div>
      <div class="skeleton short"></div>
    </div>
    <p class="sr-only" role="status">{{ t("archive.loading") }}</p>
  </div>
  <div v-else class="empty-state" :class="{ error }" role="status">
    <span aria-hidden="true">□</span>
    <h3>{{ title }}</h3>
    <p>{{ description }}</p>
    <button v-if="filtered && !error" type="button" @click="emit('clear')">
      {{ t("archive.all") }}
    </button>
    <button v-else type="button" :disabled="seconds > 0" @click="emit('retry')">
      {{ t("image.retry") }}
    </button>
  </div>
</template>
