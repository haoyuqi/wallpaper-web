import { computed, onScopeDispose, ref, shallowRef, watch, type Ref } from "vue";
import { recentRange } from "../services/dates";
import {
  ApiError,
  loadWallpapers,
  type Wallpaper,
  type WallpaperQuery,
} from "../services/wallpapers";

type Loader = typeof loadWallpapers;
type Cancelable = { abort: () => void };

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
  let active: Cancelable | undefined;
  let heroRequest = 0;
  let heroActive: Cancelable | undefined;
  let disposed = false;
  async function load() {
    const number = ++request;
    active?.abort();
    const controller = new AbortController();
    active = controller;
    const query: WallpaperQuery = date.value ? { date: date.value } : recentRange();
    loading.value = true;
    error.value = null;
    try {
      const result = await loader(query, controller.signal);
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
    const controller = new AbortController();
    heroActive = controller;
    heroLoading.value = true;
    heroError.value = null;
    try {
      const result = await loader(recentRange(), controller.signal);
      if (number !== heroRequest || disposed) return;
      hero.value = result.slice(0, 8);
    } catch (failure) {
      if (number !== heroRequest || disposed) return;
      heroError.value = failure instanceof ApiError ? failure : new ApiError("network");
    } finally {
      if (number === heroRequest && !disposed) heroLoading.value = false;
    }
  }
  async function loadSharedDefault() {
    const galleryNumber = ++request;
    const heroNum = ++heroRequest;
    const controller = new AbortController();
    let owners = 2;
    const release = () => {
      if (--owners === 0) controller.abort();
    };
    active = { abort: release };
    heroActive = { abort: release };
    const query = recentRange();
    loading.value = true;
    heroLoading.value = true;
    error.value = null;
    heroError.value = null;
    try {
      const result = await loader(query, controller.signal);
      if (disposed) return;
      if (galleryNumber === request) {
        items.value = result;
        count.value = 6;
        loadedQuery.value = query;
      }
      if (heroNum === heroRequest) {
        hero.value = result.slice(0, 8);
      }
    } catch (failure) {
      if (disposed) return;
      const apiError = failure instanceof ApiError ? failure : new ApiError("network");
      if (galleryNumber === request) error.value = apiError;
      if (heroNum === heroRequest) heroError.value = apiError;
    } finally {
      if (!disposed) {
        if (galleryNumber === request) loading.value = false;
        if (heroNum === heroRequest) heroLoading.value = false;
      }
    }
  }
  if (date.value) {
    void reloadHero();
    void load();
  } else {
    void loadSharedDefault();
  }
  watch(date, () => {
    void load();
  });
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
