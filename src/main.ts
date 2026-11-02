import { createApp, nextTick } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/app.css'
import { useSettingsStore } from './stores/settings'
import { useDataStore } from './stores/data'
import { requestPersistentStorage } from './db/db'
import { initNative } from './lib/native'
import { applyAppearance } from './lib/themes'

/** Hand off from the boot splash to the real UI once the first screen is painted. */
function dismissBootSplash(): void {
  const el = document.getElementById('boot-splash')
  if (!el) return
  el.classList.add('bs-out')
  window.setTimeout(() => el.remove(), 320)
}

async function bootstrap() {
  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)
  app.use(router)

  await initNative()
  void requestPersistentStorage()

  const settings = useSettingsStore(pinia)
  try {
    await settings.load()
  } catch {
    // First run on a fresh WebView, or storage blocked: keep the defaults.
  }
  applyAppearance(settings.settings)

  // The app starts empty: sample data is opt-in from Settings (or the dashboard prompt).
  try {
    await useDataStore(pinia).load()
  } catch {
    // Never let a storage hiccup leave the boot splash on screen forever.
  }

  await router.isReady()
  app.mount('#app')
  await nextTick()
  dismissBootSplash()
}

void bootstrap()
