<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { ArrowRight, Building2, Clock, Plus, UserPlus } from '@/components/icons'
import Money from '@/components/Money.vue'
import Sparkline from '@/components/Sparkline.vue'
import StatusPill from '@/components/StatusPill.vue'
import { useDataStore } from '@/stores/data'
import { useSettingsStore } from '@/stores/settings'
import { useUiStore } from '@/stores/ui'
import { displayStatus } from '@/lib/calc'
import { relativeDueLabel } from '@/lib/dates'
import { initials } from '@/lib/utils'

const router = useRouter()
const data = useDataStore()
const settings = useSettingsStore()
const ui = useUiStore()

const hour = new Date().getHours()
const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

const spark = computed(() => data.monthly.map((m) => m.total))
const mom = computed(() => {
  const values = data.monthly
  if (values.length < 2) return 0
  const prev = values[values.length - 2].total
  const cur = values[values.length - 1].total
  if (!prev) return cur ? 100 : 0
  return Math.round(((cur - prev) / prev) * 100)
})

const dueThisWeek = computed(() => {
  const today = new Date()
  const in7 = new Date(today.getTime() + 7 * 86_400_000).toISOString().slice(0, 10)
  const start = today.toISOString().slice(0, 10)
  return data.openInvoices.filter((i) => i.dueDate >= start && i.dueDate <= in7)
})

const dueThisWeekTotal = computed(() =>
  dueThisWeek.value.reduce((sum, i) => {
    const paid = i.payments.reduce((a, p) => a + p.amount, 0)
    return sum + (i.total - paid)
  }, 0),
)

const isEmpty = computed(() => data.invoices.length === 0)
const needsBusiness = computed(() => !settings.business.name.trim())

async function loadSample() {
  const ok = await ui.confirm({
    title: 'Load sample data?',
    message:
      'Adds a demo studio with 10 invoices, 5 clients and 6 catalog items so you can try every screen. You can remove it later in Settings → Erase all data.',
    confirmLabel: 'Load sample',
  })
  if (!ok) return
  await settings.loadDemo()
  ui.toast('Sample data loaded — explore freely')
}

function openInvoice(id: string) {
  router.push(`/invoices/${id}`)
}
</script>

<template>
  <div class="content wide">
    <div class="between" style="margin-bottom: 16px">
      <div>
        <div class="eyebrow">{{ settings.business.name || 'Billfold' }}</div>
        <h1 class="page-title" style="margin-top: 5px">{{ greeting }}</h1>
      </div>
      <RouterLink to="/settings" class="avatar accent" style="width: 40px; height: 40px; border-radius: 13px">
        {{ initials(settings.business.name || 'Billfold') }}
      </RouterLink>
    </div>

    <button v-if="needsBusiness" class="setup-card" type="button" @click="router.push('/settings')">
      <span class="setup-ic"><Building2 :size="16" /></span>
      <span class="grow" style="text-align: left">
        <span class="setup-t">Add your business details</span>
        <span class="setup-s">Name, address, VAT and bank details appear on every invoice PDF.</span>
      </span>
      <ArrowRight :size="15" class="dim" />
    </button>

    <div class="dash-grid">
      <div>
        <section class="hero-card">
          <div class="hero-label">Outstanding</div>
          <div class="hero-value"><Money :amount="data.outstanding" /></div>
          <div class="hero-row">
            <div class="hero-sub">
              {{ data.openInvoices.length }} open · {{ data.overdueInvoices.length }} overdue
            </div>
            <div class="hero-badge">{{ mom >= 0 ? '↑' : '↓' }} {{ Math.abs(mom) }}% MoM</div>
          </div>
          <Sparkline :values="spark" />
        </section>

        <div class="stat-grid">
          <div class="stat">
            <div class="k">Paid this year</div>
            <div class="v"><Money :amount="data.paidThisYear" compact /></div>
            <div class="d">{{ data.paidCount }} invoices</div>
          </div>
          <div class="stat">
            <div class="k">Overdue</div>
            <div class="v" style="color: var(--warn)"><Money :amount="data.overdueTotal" compact /></div>
            <div class="d">{{ data.overdueInvoices.length }} invoices</div>
          </div>
          <div class="stat">
            <div class="k">Drafts</div>
            <div class="v"><Money :amount="data.draftTotal" compact /></div>
            <div class="d">{{ data.draftInvoices.length }} unsent</div>
          </div>
        </div>

        <div class="quick-grid mt-14">
          <button class="quick" type="button" @click="router.push('/invoices/new')">
            <span class="qi a"><Plus :size="15" /></span>
            <span class="t">New invoice</span>
          </button>
          <button class="quick" type="button" @click="router.push('/clients')">
            <span class="qi b"><UserPlus :size="15" /></span>
            <span class="t">Add client</span>
          </button>
        </div>


        <div v-if="dueThisWeek.length" class="due-strip mt-14">
          <div class="due-ic"><Clock :size="14" /></div>
          <div class="grow">
            <div class="due-t">{{ dueThisWeek.length }} invoice{{ dueThisWeek.length === 1 ? '' : 's' }} due this week</div>
            <div class="due-s"><Money :amount="dueThisWeekTotal" /> outstanding</div>
          </div>
          <RouterLink to="/invoices" class="due-go">Review <ArrowRight :size="13" /></RouterLink>
        </div>
      </div>

      <div>
        <div class="section-head" style="margin-top: 0">
          <h2>Recent activity</h2>
          <RouterLink to="/invoices" class="section-link">View all</RouterLink>
        </div>
        <div class="list">
          <button
            v-for="inv in data.recent"
            :key="inv.id"
            class="list-row"
            type="button"
            @click="openInvoice(inv.id)"
          >
            <span class="avatar">{{ inv.clientSnapshot.name.slice(0, 2).toUpperCase() }}</span>
            <span class="row-main">
              <span class="row-title">{{ inv.clientSnapshot.name }}</span>
              <span class="row-sub">
                <span class="mono" style="font-size: 9.5px">{{ inv.number }}</span>
                <span>·</span>
                <span>{{ relativeDueLabel(inv.dueDate) }}</span>
              </span>
            </span>
            <span class="row-right">
              <span class="row-amount"><Money :amount="inv.total" /></span>
              <div style="margin-top: 4px"><StatusPill :status="displayStatus(inv)" /></div>
            </span>
          </button>
          <div v-if="!data.recent.length" class="empty" style="border: 0; padding: 26px 0">
            <p>
              No invoices yet — your first one takes about a minute.
              <template v-if="isEmpty"> Or load sample data to see how Billfold works.</template>
            </p>
            <div class="row" style="justify-content: center; gap: 8px">
              <RouterLink to="/invoices/new" class="btn primary sm">Create invoice</RouterLink>
              <button v-if="isEmpty" class="btn ghost sm" type="button" @click="loadSample">Load sample data</button>
            </div>
          </div>
        </div>

        <div class="section-head"><h2>Last 6 months</h2></div>
        <div class="card pad month-chart">
          <div v-for="m in data.monthly" :key="m.key" class="mcol">
            <div class="mbar-wrap">
              <div class="mbar" :style="{ height: `${Math.max(4, (m.total / Math.max(...spark, 1)) * 100)}%` }"></div>
            </div>
            <div class="mlabel">{{ m.label }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.setup-card {
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  margin-bottom: 14px;
  padding: 11px 12px;
  border-radius: 14px;
  border: 1px dashed var(--accent-line);
  background: var(--accent-soft);
  text-align: left;
}
.setup-ic {
  width: 28px;
  height: 28px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  background: var(--surface);
  color: var(--link);
  flex: none;
}
.setup-t {
  display: block;
  font-size: 12px;
  font-weight: 600;
}
.setup-s {
  display: block;
  font-size: 10px;
  color: var(--muted);
  margin-top: 2px;
  line-height: 1.5;
}

.dash-grid {
  display: grid;
  gap: 18px;
}
@media (min-width: 900px) {
  .dash-grid {
    grid-template-columns: 1.05fr 0.95fr;
    align-items: start;
  }
}
.due-strip {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 10px 12px;
}
.due-ic {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background: var(--warn-soft);
  color: var(--warn);
  display: grid;
  place-items: center;
  flex: none;
}
.due-t {
  font-size: 11.5px;
  font-weight: 600;
}
.due-s {
  font-size: 9.5px;
  color: var(--muted);
  margin-top: 2px;
}
.due-go {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 700;
  color: var(--link);
  background: var(--accent-soft);
  border: 1px solid var(--accent-line);
  padding: 5px 9px;
  border-radius: 8px;
  flex: none;
}
.month-chart {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  height: 118px;
  padding: 14px 16px 10px;
}
.mcol {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  height: 100%;
  gap: 6px;
}
.mbar-wrap {
  flex: 1;
  display: flex;
  align-items: flex-end;
}
.mbar {
  width: 100%;
  background: linear-gradient(180deg, var(--accent), rgba(124, 147, 255, 0.28));
  border-radius: 4px 4px 2px 2px;
  min-height: 4px;
}
.mlabel {
  font-size: 8px;
  letter-spacing: 0.1em;
  color: var(--dim);
  text-align: center;
}
</style>
