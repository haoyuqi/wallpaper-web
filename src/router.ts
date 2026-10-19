import { createRouter, createWebHistory } from "vue-router";
import ArchivePage from "./components/ArchivePage.vue";
export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/", component: ArchivePage },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});
