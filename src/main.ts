import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { MotionPlugin } from '@vueuse/motion';
import router from './router';
import App from './App.vue';
import './assets/main.css';

document.documentElement.classList.remove('dark');

const app = createApp(App);

app.use(createPinia());
app.use(MotionPlugin);
app.use(router);

app.mount('#app');
