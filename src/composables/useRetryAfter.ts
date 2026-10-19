import { computed, onScopeDispose, ref, watch, type Ref } from "vue";

export function useRetryAfter(deadline: Ref<number | null>) {
  const now = ref(Date.now());
  let timer: ReturnType<typeof setInterval> | undefined;
  watch(
    deadline,
    (until) => {
      clearInterval(timer);
      now.value = Date.now();
      if (until && until > now.value) {
        timer = setInterval(() => {
          now.value = Date.now();
          if (now.value >= until) clearInterval(timer);
        }, 1000);
      }
    },
    { immediate: true },
  );
  onScopeDispose(() => clearInterval(timer));
  return computed(() => Math.max(0, Math.ceil(((deadline.value ?? 0) - now.value) / 1000)));
}
