<script setup lang="ts">
import { locales, useLocalization } from "../i18n";
const { t, locale, setLocale } = useLocalization();
</script>

<template>
  <label class="language-select" for="language-select">
    <span class="sr-only">{{ t("app.language") }}</span>
    <select
      id="language-select"
      name="language"
      :value="locale"
      @change="setLocale(($event.target as HTMLSelectElement).value)"
    >
      <option v-for="language in locales" :key="language.value" :value="language.value">
        {{ language.label }}
      </option>
    </select>
  </label>
</template>
