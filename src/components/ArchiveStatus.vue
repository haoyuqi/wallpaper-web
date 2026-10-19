<script setup lang="ts">
import { computed } from "vue";
import { useRetryAfter } from "../composables/useRetryAfter";
import type { ApiError } from "../services/wallpapers";
const props = defineProps<{ error?: ApiError | null; filtered?: boolean; loading?: boolean }>();
const emit = defineEmits<{ retry: []; clear: [] }>();
const seconds = useRetryAfter(computed(() => props.error?.retryAt ?? null));
const title = computed(() =>
  props.error?.kind === "rate"
    ? "请求有些频繁"
    : props.error
      ? "暂时无法加载壁纸"
      : props.filtered
        ? "这一天没有壁纸"
        : "暂时没有壁纸",
);
const description = computed(() =>
  props.error?.kind === "rate"
    ? seconds.value
      ? `请等待 ${seconds.value} 秒后重试。`
      : "请稍后重试。"
    : props.error?.kind === "timeout"
      ? "加载时间较长，请稍后重试。"
      : props.error
        ? "请检查网络连接，然后重新加载。"
        : props.filtered
          ? "没有找到这一天的壁纸，请选择其他日期。"
          : "当前范围暂无已归档壁纸，也可以按日期查找。",
);
</script>
<template>
  <div v-if="loading" class="wallpaper-grid" aria-busy="true" aria-label="正在加载壁纸">
    <div v-for="n in 6" :key="n" aria-hidden="true">
      <div class="skeleton photo"></div>
      <div class="skeleton line"></div>
      <div class="skeleton short"></div>
    </div>
    <p class="sr-only" role="status">正在加载壁纸…</p>
  </div>
  <div v-else class="empty-state" :class="{ error }" role="status">
    <span aria-hidden="true">□</span>
    <h3>{{ title }}</h3>
    <p>{{ description }}</p>
    <button v-if="filtered && !error" type="button" @click="emit('clear')">查看全部壁纸 →</button>
    <button v-else type="button" :disabled="seconds > 0" @click="emit('retry')">重新加载</button>
  </div>
</template>
