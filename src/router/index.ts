import { createRouter, createWebHashHistory } from 'vue-router'
import DashboardView from '@/views/DashboardView.vue'
import InvoicesView from '@/views/InvoicesView.vue'
import InvoiceDetailView from '@/views/InvoiceDetailView.vue'
import InvoiceEditorView from '@/views/InvoiceEditorView.vue'
import ClientsView from '@/views/ClientsView.vue'
import CatalogView from '@/views/CatalogView.vue'
import SettingsView from '@/views/SettingsView.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: DashboardView },
    { path: '/invoices', name: 'invoices', component: InvoicesView },
    { path: '/invoices/new', name: 'invoice-new', component: InvoiceEditorView, meta: { hideNav: true } },
    { path: '/invoices/:id', name: 'invoice-detail', component: InvoiceDetailView, props: true },
    { path: '/invoices/:id/edit', name: 'invoice-edit', component: InvoiceEditorView, props: true, meta: { hideNav: true } },
    { path: '/clients', name: 'clients', component: ClientsView },
    { path: '/catalog', name: 'catalog', component: CatalogView },
    { path: '/settings', name: 'settings', component: SettingsView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

export default router
