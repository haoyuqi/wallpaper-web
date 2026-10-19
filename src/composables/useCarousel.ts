import { computed, onMounted, onScopeDispose, ref, watch, type Ref } from "vue";
import type { Wallpaper } from "../services/wallpapers";

export function useCarousel(items: Ref<Wallpaper[]>, modalOpen: Ref<boolean>) {
  const index = ref(0);
  const playing = ref(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const reasons = ref(new Set<string>());
  let timer: ReturnType<typeof setTimeout> | undefined;
  const current = computed(() => items.value[index.value] ?? items.value[0]);
  const advancing = computed(
    () => playing.value && reasons.value.size === 0 && !modalOpen.value && items.value.length > 1,
  );
  function pause(reason: string, active: boolean) {
    const next = new Set(reasons.value);
    if (active) next.add(reason);
    else next.delete(reason);
    reasons.value = next;
  }
  function step(delta: number) {
    if (items.value.length)
      index.value = (index.value + delta + items.value.length) % items.value.length;
    schedule();
  }
  function schedule() {
    clearTimeout(timer);
    if (advancing.value) timer = setTimeout(() => step(1), 5000);
  }
  function visibility() {
    pause("hidden", document.hidden);
  }
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  const reduceMotion = () => {
    if (media.matches) playing.value = false;
  };
  onMounted(() => {
    visibility();
    document.addEventListener("visibilitychange", visibility);
    media.addEventListener("change", reduceMotion);
  });
  watch([advancing, items], schedule, { immediate: true });
  onScopeDispose(() => {
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", visibility);
    media.removeEventListener("change", reduceMotion);
  });
  return {
    index,
    current,
    playing,
    pause,
    step,
    toggle: () => {
      playing.value = !playing.value;
    },
  };
}
