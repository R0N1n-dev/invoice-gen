<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, Search, Trash2, Users } from '@lucide/vue'
import AppSheet from '@/components/AppSheet.vue'
import ClientForm from '@/components/ClientForm.vue'
import EmptyState from '@/components/EmptyState.vue'
import Money from '@/components/Money.vue'
import { useDataStore } from '@/stores/data'
import { useUiStore } from '@/stores/ui'
import { formatDate } from '@/lib/dates'
import { useSettingsStore } from '@/stores/settings'
import type { Client } from '@/types'

const router = useRouter()
const data = useDataStore()
const ui = useUiStore()
const settings = useSettingsStore()

const query = ref('')
const showForm = ref(false)
const editing = ref<Client | null>(null)

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return data.clients
  return data.clients.filter((c) =>
    [c.name, c.contact, c.email, c.city, c.taxId].filter(Boolean).join(' ').toLowerCase().includes(q),
  )
})

function openNew() {
  editing.value = null
  showForm.value = true
}

function openEdit(client: Client) {
  editing.value = client
  showForm.value = true
}

async function save(payload: Partial<Client>) {
  const created = await data.saveClient({ ...payload, name: payload.name ?? '' } as Client, editing.value?.id)
  showForm.value = false
  ui.toast(editing.value ? 'Client updated' : 'Client added')
  editing.value = null
  return created
}

async function remove(client: Client) {
  const ok = await ui.confirm({
    title: `Delete ${client.name}?`,
    message: 'Existing invoices keep a copy of this client’s details, so your records stay intact.',
    confirmLabel: 'Delete client',
    danger: true,
  })
  if (!ok) return
  await data.deleteClient(client.id)
  showForm.value = false
  ui.toast('Client deleted')
}
</script>

<template>
  <div class="content">
    <div class="page-head">
      <div>
        <h1 class="page-title">Clients</h1>
        <div class="page-sub">{{ data.clients.length }} saved · reused on every invoice</div>
      </div>
      <button class="fab" type="button" aria-label="Add client" @click="openNew"><Plus :size="20" /></button>
    </div>

    <label class="search-box">
      <Search :size="15" />
      <input v-model="query" type="search" placeholder="Search clients" />
    </label>

    <div v-if="!filtered.length" class="mt-14">
      <EmptyState
        title="No clients yet"
        message="Save a client once and their address, tax ID and payment terms fill every invoice."
      >
        <button class="btn primary sm" type="button" @click="openNew">Add your first client</button>
      </EmptyState>
    </div>

    <button v-for="client in filtered" :key="client.id" class="list-row" type="button" @click="openEdit(client)">
      <span class="avatar accent">{{ client.name.slice(0, 2).toUpperCase() }}</span>
      <span class="row-main">
        <span class="row-title">{{ client.name }}</span>
        <span class="row-sub">
          {{ client.contact || client.email || 'No contact' }}
          <template v-if="client.city"> · {{ client.city }}</template>
        </span>
      </span>
      <span class="row-right">
        <span
          v-if="data.clientBalance(client.id) > 0"
          class="row-amount"
          style="color: var(--warn)"
        >
          <Money :amount="data.clientBalance(client.id)" />
        </span>
        <span v-else class="tiny dim">Settled</span>
        <span class="tiny dim" style="display: block; margin-top: 3px">
          {{ data.clientStats(client.id).count }} invoices
        </span>
      </span>
    </button>

    <div style="height: 8px"></div>

    <AppSheet
      :open="showForm"
      :title="editing ? 'Edit client' : 'New client'"
      :subtitle="editing ? `Last invoice ${editing.updatedAt ? formatDate(editing.updatedAt.slice(0, 10), settings.locale, settings.dateFormat) : '—'}` : 'Saved locally on this device'"
      wide
      @close="showForm = false"
    >
      <ClientForm :client="editing" @save="save" @cancel="showForm = false" />
      <button v-if="editing" class="btn danger block" type="button" style="margin-top: 10px" @click="remove(editing)">
        <Trash2 :size="14" /> Delete client
      </button>
      <div v-if="editing" class="mt-14">
        <div class="between" style="margin-bottom: 6px">
          <span class="eyebrow">Invoice history</span>
          <button class="tiny link" type="button" @click="router.push('/invoices')">All invoices</button>
        </div>
        <div v-for="inv in data.invoices.filter((i) => i.clientId === editing?.id).slice(0, 5)" :key="inv.id" class="between" style="padding: 6px 0; border-bottom: 1px solid var(--line)">
          <button class="tiny link mono" type="button" @click="router.push(`/invoices/${inv.id}`)">{{ inv.number }}</button>
          <span class="tiny dim">{{ formatDate(inv.issueDate, settings.locale, settings.dateFormat) }}</span>
          <span class="tiny"><Money :amount="inv.total" :currency="inv.currency" /></span>
        </div>
        <div v-if="!data.invoices.some((i) => i.clientId === editing?.id)" class="tiny dim" style="padding-top: 6px">
          No invoices for this client yet.
        </div>
      </div>
    </AppSheet>

    <button class="quick" type="button" style="margin-top: 16px; width: 100%" @click="openNew">
      <span class="qi a"><Users :size="15" /></span>
      <span class="grow" style="text-align: left">
        <span class="t">Add another client</span>
        <span class="row-sub">Name, address, VAT and terms</span>
      </span>
      <Plus :size="15" class="dim" />
    </button>
  </div>
</template>
