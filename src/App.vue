<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import {
  ChartNoAxesCombined,
  FileText,
  Package,
  Settings as SettingsIcon,
  Users,
} from '@lucide/vue'
import ToastHost from '@/components/ToastHost.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useDataStore } from '@/stores/data'
import { useSettingsStore } from '@/stores/settings'
import { useUiStore } from '@/stores/ui'
import { hideSplash, isNative, exitApp, onBackButton, onAppStateChange, writeBackupFile, initNative } from '@/lib/native'
import { debounce } from '@/lib/utils'

const route = useRoute()
const router = useRouter()
const data = useDataStore()
const settings = useSettingsStore()
const ui = useUiStore()

const nav = [
  { to: '/', label: 'Home', icon: ChartNoAxesCombined },
  { to: '/invoices', label: 'Invoices', icon: FileText, badge: () => String(data.openInvoices.length) },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/catalog', label: 'Items', icon: Package },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

const hideNav = computed(() => Boolean(route.meta.hideNav))
const isActive = (to: string) => (to === '/' ? route.path === '/' : route.path.startsWith(to))

let removeBack: (() => void) | undefined
let removeState: (() => void) | undefined
onMounted(async () => {
  removeBack = onBackButton(() => {
    if (ui.closeTopSheet()) return
    if (route.meta.hideNav) {
      if (window.history.length > 1) router.back()
      else router.replace('/invoices')
      return
    }
    if (route.path !== '/') router.push('/')
    else void exitApp()
  })
  removeState = onAppStateChange((isActive) => {
    if (!isActive) void autoBackup()
  })
  await nextTick()
  await hideSplash()
})

onBeforeUnmount(() => {
  removeBack?.()
  removeState?.()
})

const autoBackup = debounce(async () => {
  if (!isNative || !settings.settings.autoBackup) return
  const payload = {
    app: 'billfold' as const,
    version: 1 as const,
    exportedAt: new Date().toISOString(),
    ...settings.snapshot(),
  }
  await writeBackupFile(JSON.stringify(payload))
}, 4000)

watch(() => [data.revision, settings.settings.autoBackup], autoBackup)

// Re-assert the status bar colour when the shell boots (Android can reset it on rotation).
onMounted(() => void initNative())
</script>

<template>
  <div class="shell">
    <aside class="sidebar">
      <div class="brand-block">
        <div class="brand-mark">B</div>
        <div>
          <div class="brand-name">Billfold</div>
          <div class="brand-sub">{{ settings.business.name || 'Invoicing, offline' }}</div>
        </div>
      </div>
      <RouterLink v-for="item in nav" :key="item.to" :to="item.to" class="nav-item" :class="{ on: isActive(item.to) }">
        <component :is="item.icon" :size="17" />
        <span>{{ item.label }}</span>
        <span v-if="item.badge && item.badge() !== '0'" class="badge">{{ item.badge() }}</span>
      </RouterLink>
      <div class="sidebar-foot">
        <div>Offline-first · local device storage</div>
        <div style="margin-top: 4px">v1.0.0</div>
      </div>
    </aside>

    <main class="main">
      <RouterView v-slot="{ Component }">
        <component :is="Component" :key="route.fullPath" />
      </RouterView>
    </main>

    <nav v-if="!hideNav" class="tabbar">
      <RouterLink v-for="item in nav" :key="item.to" :to="item.to" class="tab" :class="{ on: isActive(item.to) }">
        <span class="tab-ic"><component :is="item.icon" :size="19" /></span>
        <span>{{ item.label }}</span>
      </RouterLink>
    </nav>

    <ToastHost />
    <ConfirmDialog />
  </div>
</template>
