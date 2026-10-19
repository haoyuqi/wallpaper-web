import "./styles/main.css";
import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./router";
import { createAppI18n } from "./i18n";
createApp(App).use(createAppI18n()).use(router).mount("#app");
