import { computed, onScopeDispose, ref, shallowRef, watch, type Ref } from "vue";
import { recentRange } from "../services/dates";
import {
  ApiError,
  loadWallpapers,
  type Wallpaper,
  type WallpaperQuery,
} from "../services/wallpapers";

type Loader = typeof loadWallpapers;
export function useArchive(date: Ref<string | null>, loader: Loader = loadWallpapers) {
  const items = shallowRef<Wallpaper[]>([]);
  const hero = shallowRef<Wallpaper[]>([]);
  const error = shallowRef<ApiError | null>(null);
  const heroError = shallowRef<ApiError | null>(null);
  const loading = ref(true);
  const heroLoading = ref(true);
  const count = ref(6);
  const loadedQuery = shallowRef<WallpaperQuery>(recentRange());
  let request = 0;
  let active: AbortController | undefined;
  let heroRequest = 0;
  let heroActive: AbortController | undefined;
  let disposed = false;
  async function load() {
    const number = ++request;
    active?.abort();
    active = new AbortController();
    const query: WallpaperQuery = date.value ? { date: date.value } : recentRange();
    loading.value = true;
    error.value = null;
    try {
      const result = await loader(query, active.signal);
      if (number !== request || disposed) return;
      items.value = result;
      count.value = 6;
      loadedQuery.value = query;
    } catch (failure) {
      if (number !== request || disposed) return;
      error.value = failure instanceof ApiError ? failure : new ApiError("network");
    } finally {
      if (number === request && !disposed) loading.value = false;
    }
  }
  async function reloadHero() {
    const number = ++heroRequest;
    heroActive?.abort();
    heroActive = new AbortController();
    heroLoading.value = true;
    heroError.value = null;
    try {
      const result = await loader(recentRange(), heroActive.signal);
      if (number !== heroRequest || disposed) return;
      hero.value = result.slice(0, 8);
    } catch (failure) {
      if (number !== heroRequest || disposed) return;
      heroError.value = failure instanceof ApiError ? failure : new ApiError("network");
    } finally {
      if (number === heroRequest && !disposed) heroLoading.value = false;
    }
  }
  void reloadHero();
  watch(
    date,
    () => {
      void load();
    },
    { immediate: true },
  );
  onScopeDispose(() => {
    disposed = true;
    request++;
    heroRequest++;
    active?.abort();
    heroActive?.abort();
  });
  return {
    items,
    hero,
    error,
    heroError,
    loading,
    heroLoading,
    loadedQuery,
    visible: computed(() => items.value.slice(0, count.value)),
    hasMore: computed(() => count.value < items.value.length),
    more: () => {
      count.value += 6;
    },
    retry: load,
    reloadHero,
  };
}
