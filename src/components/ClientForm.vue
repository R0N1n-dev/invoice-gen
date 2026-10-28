<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Client } from '@/types'
import { CURRENCIES } from '@/lib/money'
import AppSelect from './AppSelect.vue'

const props = defineProps<{ client?: Client | null }>()
const emit = defineEmits<{ save: [Partial<Client>]; cancel: [] }>()

const form = ref<Partial<Client>>({ paymentTerms: 14, country: '', currency: '' })
const error = ref('')

const currencyOptions = [
  { value: '', label: 'Business default' },
  ...CURRENCIES.map((c) => ({ value: c, label: c })),
]
const termsOptions = [
  { value: 0, label: 'Due on receipt' },
  { value: 7, label: 'Net 7' },
  { value: 14, label: 'Net 14' },
  { value: 30, label: 'Net 30' },
  { value: 45, label: 'Net 45' },
  { value: 60, label: 'Net 60' },
]

watch(
  () => props.client,
  (c) => {
    form.value = c ? { ...c } : { paymentTerms: 14, country: '', currency: '' }
    error.value = ''
  },
  { immediate: true },
)

function submit() {
  if (!form.value.name?.trim()) {
    error.value = 'A client name is required.'
    return
  }
  emit('save', { ...form.value })
}
</script>

<template>
  <form @submit.prevent="submit">
    <label class="field">
      <span class="label">Client / company name *</span>
      <input v-model="form.name" type="text" placeholder="Halcyon Coffee" autocomplete="organization" />
    </label>
    <div class="grid-2">
      <label class="field">
        <span class="label">Contact person</span>
        <input v-model="form.contact" type="text" placeholder="Marta Silva" />
      </label>
      <label class="field">
        <span class="label">Email</span>
        <input v-model="form.email" type="email" placeholder="billing@client.com" inputmode="email" />
      </label>
    </div>
    <div class="grid-2">
      <label class="field">
        <span class="label">Phone</span>
        <input v-model="form.phone" type="tel" placeholder="+351 900 000 000" />
      </label>
      <label class="field">
        <span class="label">Tax / VAT ID</span>
        <input v-model="form.taxId" type="text" placeholder="PT509887341" />
      </label>
    </div>
    <label class="field">
      <span class="label">Address</span>
      <input v-model="form.address1" type="text" placeholder="Rua do Alecrim 44" />
    </label>
    <div class="grid-3">
      <label class="field">
        <span class="label">City</span>
        <input v-model="form.city" type="text" placeholder="Lisbon" />
      </label>
      <label class="field">
        <span class="label">Postal code</span>
        <input v-model="form.postal" type="text" placeholder="1200-018" />
      </label>
      <label class="field">
        <span class="label">Country</span>
        <input v-model="form.country" type="text" placeholder="Portugal" />
      </label>
    </div>
    <div class="grid-3">
      <label class="field">
        <span class="label">Currency</span>
        <AppSelect
          :model-value="form.currency ?? ''"
          label="Currency"
          :options="currencyOptions"
          @update:model-value="(v) => (form.currency = String(v))"
        />
      </label>
      <label class="field">
        <span class="label">Payment terms</span>
        <AppSelect
          :model-value="form.paymentTerms ?? 14"
          label="Payment terms"
          :options="termsOptions"
          @update:model-value="(v) => (form.paymentTerms = Number(v))"
        />
      </label>
      <label class="field">
        <span class="label">Notes</span>
        <input v-model="form.notes" type="text" placeholder="Internal note" />
      </label>
    </div>

    <p v-if="error" class="tiny" style="color: var(--danger)">{{ error }}</p>

    <div class="sheet-foot">
      <button class="btn ghost grow" type="button" @click="emit('cancel')">Cancel</button>
      <button class="btn primary grow" type="submit">Save client</button>
    </div>
  </form>
</template>
