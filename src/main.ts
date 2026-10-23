import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/app.css'
import { useSettingsStore } from './stores/settings'
import { useDataStore } from './stores/data'
import { db, requestPersistentStorage } from './db/db'
import { initNative } from './lib/native'
import { seedDemoData } from './db/seed'

async function bootstrap() {
  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)
  app.use(router)

  await initNative()
  void requestPersistentStorage()

  const settings = useSettingsStore(pinia)
  await settings.load()

  if ((await db.invoices.count()) === 0 && !settings.settings.onboarded) {
    await seedDemoData()
    await settings.load()
  }

  await useDataStore(pinia).load()
  await router.isReady()
  app.mount('#app')
}

void bootstrap()
