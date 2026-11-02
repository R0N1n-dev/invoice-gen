import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/app.css'
import { useSettingsStore } from './stores/settings'
import { useDataStore } from './stores/data'
import { requestPersistentStorage } from './db/db'
import { initNative } from './lib/native'
import { applyAppearance } from './lib/themes'

async function bootstrap() {
  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)
  app.use(router)

  await initNative()
  void requestPersistentStorage()

  const settings = useSettingsStore(pinia)
  await settings.load()
  applyAppearance(settings.settings)

  // The app starts empty: sample data is opt-in from Settings.

  await useDataStore(pinia).load()
  await router.isReady()
  app.mount('#app')
}

void bootstrap()
