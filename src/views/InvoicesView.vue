<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { Plus, Search } from '@lucide/vue'
import Money from '@/components/Money.vue'
import StatusPill from '@/components/StatusPill.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useDataStore } from '@/stores/data'
import { useSettingsStore } from '@/stores/settings'
import { displayStatus } from '@/lib/calc'
import { formatDate, monthKey, monthLabel, relativeDueLabel } from '@/lib/dates'

type Filter = 'all' | 'unpaid' | 'overdue' | 'paid' | 'draft'

const router = useRouter()
const data = useDataStore()
const settings = useSettingsStore()
const filter = ref<Filter>('all')
const query = ref('')

const filters: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unpaid', label: 'Unpaid' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'paid', label: 'Paid' },
  { key: 'draft', label: 'Drafts' },
]

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return data.invoices.filter((inv) => {
    if (q) {
      const haystack = [
        inv.number,
        inv.clientSnapshot.name,
        inv.total.toString(),
        inv.poNumber,
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(q)) return false
    }
    const status = displayStatus(inv)
    if (filter.value === 'all') return true
    if (filter.value === 'unpaid') return status === 'sent' || status === 'partial' || status === 'overdue'
    if (filter.value === 'overdue') return status === 'overdue'
    if (filter.value === 'paid') return status === 'paid'
    return status === 'draft'
  })
})

const groups = computed(() => {
  const map = new Map<string, typeof data.invoices>()
  for (const inv of filtered.value) {
    const key = monthKey(inv.issueDate)
    const list = map.get(key) ?? []
    list.push(inv)
    map.set(key, list)
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, list]) => ({
      key,
      label: monthLabel(`${key}-01`, settings.locale),
      total: list.reduce((sum, i) => sum + i.total, 0),
      list,
    }))
})

const totals = computed(() => ({
  count: data.invoices.length,
  value: data.invoices.filter((i) => i.status !== 'void').reduce((a, i) => a + i.total, 0),
}))
</script>

<template>
  <div class="content">
    <div class="page-head">
      <div>
        <h1 class="page-title">Invoices</h1>
        <div class="page-sub">
          {{ totals.count }} records · <Money :amount="totals.value" /> billed
        </div>
      </div>
      <RouterLink to="/invoices/new" class="fab" aria-label="New invoice"><Plus :size="20" /></RouterLink>
    </div>

    <div class="segmented" style="margin-bottom: 10px">
      <button v-for="f in filters" :key="f.key" type="button" :class="{ on: filter === f.key }" @click="filter = f.key">
        {{ f.label }}
      </button>
    </div>

    <label class="search-box">
      <Search :size="15" />
      <input v-model="query" type="search" placeholder="Search client, number, amount…" />
    </label>

    <div v-if="!filtered.length" class="mt-14">
      <EmptyState
        title="Nothing here"
        :message="query ? 'No invoice matches that search.' : 'Invoices you create will show up here, grouped by month.'"
      >
        <RouterLink to="/invoices/new" class="btn primary sm">Create invoice</RouterLink>
      </EmptyState>
    </div>

    <div v-for="group in groups" :key="group.key">
      <div class="month-head">
        <span>{{ group.label }}</span>
        <span><Money :amount="group.total" /></span>
      </div>
      <button
        v-for="inv in group.list"
        :key="inv.id"
        class="inv-card"
        :class="`s-${displayStatus(inv)}`"
        type="button"
        @click="router.push(`/invoices/${inv.id}`)"
      >
        <span class="row-main">
          <span class="row-title">{{ inv.clientSnapshot.name }}</span>
          <span class="row-sub">
            <span class="mono">{{ inv.number }}</span>
            <span class="pill neutral" style="font-size: 7.5px">{{ inv.currency }}</span>
            <span>· {{ relativeDueLabel(inv.dueDate) }}</span>
          </span>
          <span v-if="inv.payments.length && displayStatus(inv) !== 'paid'" class="pay-hint">
            <Money :amount="inv.payments.reduce((a, p) => a + p.amount, 0)" /> paid of
            <Money :amount="inv.total" />
          </span>
        </span>
        <span class="row-right">
          <span class="row-amount"><Money :amount="inv.total" /></span>
          <span style="display: block; margin-top: 5px"><StatusPill :status="displayStatus(inv)" /></span>
        </span>
      </button>
    </div>

    <div v-if="filtered.length" class="tiny dim" style="text-align: center; margin-top: 18px">
      {{ filtered.length }} shown · sorted newest first
    </div>
  </div>
</template>
