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
let exitPromptOpen = false

/**
 * Android back button, in order of precedence:
 * sheet/dialog -> keyboard -> editor -> parent screen -> exit confirmation.
 */
async function handleBack() {
  if (ui.closeTopSheet()) return

  const active = document.activeElement as HTMLElement | null
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
    active.blur()
    return
  }

  if (route.meta.hideNav) {
    // Push (not back) so the editor's async discard guard can finish before the
    // URL changes; history.back() would rewrite the hash while the prompt is open.
    const previous = (window.history.state as { back?: string } | null)?.back
    const target = previous && previous.startsWith('/invoices') ? previous : '/invoices'
    await router.push(target)
    return
  }

  if (route.path !== '/') {
    await router.push(route.path.startsWith('/invoices/') ? '/invoices' : '/')
    return
  }

  if (exitPromptOpen) return
  exitPromptOpen = true
  const leave = await ui.confirm({
    title: 'Exit Billfold?',
    message: 'Everything is saved on this device — your invoices will be here when you come back.',
    confirmLabel: 'Exit',
    cancelLabel: 'Stay',
  })
  exitPromptOpen = false
  if (leave) await exitApp()
}

// Dev-only hook so the Android back flow can be exercised in a desktop browser.
if (import.meta.env.DEV) {
  ;(window as unknown as { __billfoldBack?: () => Promise<void> }).__billfoldBack = handleBack
}

onMounted(async () => {
  removeBack = onBackButton(() => void handleBack())
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
