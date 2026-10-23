<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Business, Invoice, PdfTemplate } from '@/types'
import { computeTotals, displayStatus, STATUS_LABEL } from '@/lib/calc'
import { formatDate } from '@/lib/dates'
import { currencySymbol, formatAmount, formatMoney } from '@/lib/money'

const props = defineProps<{
  invoice: Invoice
  business: Business
  locale: string
  dateFormat: 'medium' | 'short' | 'iso'
  template?: PdfTemplate
}>()

const tpl = computed<PdfTemplate>(() => props.template ?? props.invoice.template ?? 'modern')
const totals = computed(() => computeTotals(props.invoice))
const status = computed(() => displayStatus(props.invoice))
const accent = computed(() => props.business.accent || '#7C93FF')
const sym = computed(() => currencySymbol(props.invoice.currency, props.locale))
const money = (minor: number) => formatMoney(minor, props.invoice.currency, props.locale)
const amount = (minor: number) => formatAmount(minor, props.invoice.currency, props.locale)
const dt = (iso: string) => formatDate(iso, props.locale, props.dateFormat)
const dueNow = computed(() => (totals.value.balance > 0 ? totals.value.balance : totals.value.total))
const businessText = computed(() =>
  [
    props.business.address1,
    [props.business.postal, props.business.city].filter(Boolean).join(' '),
    props.business.country,
    props.business.taxId ? `VAT ${props.business.taxId}` : '',
  ]
    .filter(Boolean)
    .join('\n'),
)
const clientText = computed(() =>
  [
    props.invoice.clientSnapshot.address,
    props.invoice.clientSnapshot.email,
    props.invoice.clientSnapshot.taxId ? `VAT ${props.invoice.clientSnapshot.taxId}` : '',
  ]
    .filter(Boolean)
    .join('\n'),
)
const paymentText = computed(() =>
  [
    props.business.iban ? `IBAN ${props.business.iban}` : '',
    props.business.bic ? `BIC ${props.business.bic}` : '',
    props.business.bankName || '',
  ]
    .filter(Boolean)
    .join(' · '),
)

const wrap = ref<HTMLElement | null>(null)
const scale = ref(1)
let observer: ResizeObserver | undefined
function measure() {
  if (wrap.value) scale.value = Math.max(0.2, wrap.value.clientWidth / 620)
}
onMounted(() => {
  observer = new ResizeObserver(measure)
  if (wrap.value) observer.observe(wrap.value)
  measure()
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div ref="wrap" class="pv-wrap" :style="{ height: `${Math.round(877 * scale)}px` }">
    <div class="inv-doc" :class="tpl" :style="{ transform: `scale(${scale})`, '--accent': accent }">
      <header v-if="tpl === 'modern'" class="hdr band">
        <div class="band-blob"></div>
        <div class="hdr-top">
          <div class="brand">
            <img v-if="business.logo" :src="business.logo" alt="" />
            <div v-else>
              <div class="bname">{{ business.name }}</div>
              <div class="btag">{{ business.website || business.email }}</div>
            </div>
          </div>
          <div class="doc">
            <div class="dlab">INVOICE</div>
            <div class="dnum">{{ invoice.number }}</div>
            <div class="ddate">{{ dt(invoice.issueDate) }}</div>
          </div>
        </div>
        <div class="hdr-bottom">
          <div>
            <div class="tlab">{{ totals.paid >= totals.total && totals.total ? 'PAID' : 'TOTAL DUE' }}</div>
            <div class="tval">{{ money(dueNow) }}</div>
          </div>
          <div class="hstatus">{{ STATUS_LABEL[status] }}</div>
        </div>
      </header>
      <header v-else-if="tpl === 'classic'" class="hdr plain">
        <div class="brand">
          <img v-if="business.logo" :src="business.logo" alt="" />
          <div v-else>
            <div class="bname">{{ business.name }}</div>
            <div class="btag">{{ business.website || business.email }}</div>
          </div>
        </div>
        <div class="doc">
          <div class="dlab">INVOICE</div>
          <div class="dnum">{{ invoice.number }}</div>
        </div>
      </header>

      <header v-else class="hdr mini">
        <div class="topline"></div>
        <div>
          <div class="dlab">INVOICE</div>
          <div class="dnum">{{ invoice.number }}</div>
        </div>
        <div class="doc">
          <div class="bname">{{ business.name }}</div>
          <div class="ddate">{{ dt(invoice.issueDate) }}</div>
        </div>
      </header>

      <div class="doc-body">
        <section class="cols">
          <div>
            <div class="clab">BILL TO</div>
            <div class="cname">{{ invoice.clientSnapshot.name }}</div>
            <div class="ctext">{{ clientText }}</div>
          </div>
          <div>
            <div class="clab">FROM</div>
            <div class="cname">{{ business.name }}</div>
            <div class="ctext">{{ businessText }}</div>
          </div>
          <div>
            <div class="clab">DETAILS</div>
            <div class="ctext">
              Issued {{ dt(invoice.issueDate) }}<br />
              Due {{ dt(invoice.dueDate) }}<br />
              <span v-if="invoice.poNumber">PO {{ invoice.poNumber }}<br /></span>
              {{ invoice.currency }}
            </div>
          </div>
        </section>

        <table class="items">
          <thead>
            <tr>
              <th>DESCRIPTION</th>
              <th class="r">QTY</th>
              <th class="r">RATE</th>
              <th class="r">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(line, i) in invoice.items" :key="line.id">
              <td>
                <div class="idesc">{{ line.description || 'Item' }}</div>
                <div v-if="line.details" class="idetail">{{ line.details }}</div>
              </td>
              <td class="r">{{ Number.isInteger(line.qty) ? line.qty : Number(line.qty.toFixed(2)) }}</td>
              <td class="r">{{ amount(line.unitPrice) }}</td>
              <td class="r strong">{{ amount(totals.lines[i]?.total ?? 0) }}</td>
            </tr>
          </tbody>
        </table>

        <section class="totals">
          <div class="trows">
            <div class="trow"><span>Subtotal</span><span>{{ amount(totals.subtotal) }}</span></div>
            <div v-if="totals.invoiceDiscount" class="trow">
              <span>Discount</span><span>−{{ amount(totals.invoiceDiscount) }}</span>
            </div>
            <div v-if="totals.shipping" class="trow">
              <span>Shipping</span><span>{{ amount(totals.shipping) }}</span>
            </div>
            <div v-for="rate in totals.taxByRate" :key="rate.rate" class="trow">
              <span>Tax {{ rate.rate }}%</span><span>{{ amount(rate.amount) }}</span>
            </div>
            <div v-if="totals.paid" class="trow"><span>Paid</span><span>−{{ amount(totals.paid) }}</span></div>
          </div>
          <div class="tbox">
            <span>{{ totals.paid >= totals.total && totals.total ? 'PAID' : 'TOTAL DUE' }}</span>
            <b>{{ sym }}{{ amount(dueNow) }}</b>
          </div>
        </section>

        <footer class="notes">
          <div v-if="paymentText" class="note-block">
            <div class="nlab">PAYMENT</div>
            <div class="ntext">{{ paymentText }}</div>
          </div>
          <div v-if="invoice.notes" class="note-block">
            <div class="nlab">NOTES</div>
            <div class="ntext">{{ invoice.notes }}</div>
          </div>
          <div v-if="invoice.terms" class="note-block">
            <div class="nlab">TERMS</div>
            <div class="ntext faint">{{ invoice.terms }}</div>
          </div>
          <div class="page-foot">
            <span>{{ business.name }}</span>
            <span>{{ invoice.number }} · A4</span>
          </div>
        </footer>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pv-wrap {
  width: 100%;
  min-width: 0;
  overflow: hidden;
}
.inv-doc {
  width: 620px;
  height: 877px;
  background: #fff;
  color: #12141a;
  display: flex;
  flex-direction: column;
  transform-origin: top left;
  border-radius: 2px;
  overflow: hidden;
  box-shadow: 0 24px 60px -30px rgba(0, 0, 0, 0.9);
  --accent: #7c93ff;
}
.hdr.band {
  background: var(--accent);
  color: #fff;
  padding: 34px 38px 24px;
  position: relative;
  overflow: hidden;
  flex: none;
}
.band-blob {
  position: absolute;
  width: 240px;
  height: 240px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.13);
  right: -60px;
  top: -100px;
}
.hdr-top {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  position: relative;
  z-index: 2;
}
.brand img {
  height: 34px;
  max-width: 170px;
  object-fit: contain;
  display: block;
}
.bname {
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
}
.btag {
  font-size: 8px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  opacity: 0.72;
  margin-top: 5px;
}
.doc {
  text-align: right;
}
.dlab {
  font-size: 8px;
  letter-spacing: 0.24em;
  opacity: 0.75;
}
.dnum {
  font-size: 14px;
  font-weight: 600;
  margin-top: 4px;
  letter-spacing: -0.01em;
}
.ddate {
  font-size: 9px;
  opacity: 0.72;
  margin-top: 3px;
}
.hdr-bottom {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-top: 24px;
  position: relative;
  z-index: 2;
}
.tlab {
  font-size: 8px;
  letter-spacing: 0.2em;
  opacity: 0.75;
}
.tval {
  font-size: 33px;
  font-weight: 700;
  letter-spacing: -0.04em;
  margin-top: 2px;
}
.hstatus {
  font-size: 8px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 99px;
  padding: 4px 9px;
}
.classic .hdr.plain {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 38px 38px 16px;
  border-bottom: 1.5px solid #12141a;
  flex: none;
}
.classic .bname {
  font-size: 20px;
}
.classic .btag {
  color: #8b8f98;
  opacity: 1;
}
.classic .dlab {
  color: var(--accent);
  opacity: 1;
  text-align: right;
  letter-spacing: 0.2em;
}
.classic .dnum {
  font-size: 20px;
  margin-top: 5px;
  color: #12141a;
}
.mini .hdr.mini {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 34px 38px 14px;
  border-top: 5px solid #12141a;
  flex: none;
}
.mini .topline {
  display: none;
}
.mini .dlab {
  color: #8b8f98;
  opacity: 1;
  text-align: left;
}
.mini .dnum {
  font-size: 29px;
  letter-spacing: -0.045em;
  margin-top: 5px;
}
.mini .doc {
  text-align: right;
}
.mini .doc .bname {
  font-size: 10px;
}
.mini .doc .ddate {
  color: #8b8f98;
  opacity: 1;
  font-size: 9px;
}
.doc-body {
  padding: 24px 38px 0;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.cols {
  display: grid;
  grid-template-columns: 1fr 1fr 0.9fr;
  gap: 18px;
}
.clab {
  font-size: 7px;
  letter-spacing: 0.18em;
  color: #8b8f98;
  font-weight: 600;
}
.cname {
  font-size: 11.5px;
  font-weight: 600;
  margin-top: 6px;
  letter-spacing: -0.01em;
}
.ctext {
  font-size: 9.5px;
  color: #4b5563;
  line-height: 1.65;
  margin-top: 4px;
  white-space: pre-line;
}
.items {
  width: 100%;
  border-collapse: collapse;
  margin-top: 22px;
}
.items th {
  text-align: left;
  font-size: 7px;
  letter-spacing: 0.16em;
  color: #8b8f98;
  font-weight: 600;
  padding-bottom: 6px;
  border-bottom: 1px solid #12141a;
}
.items td {
  padding: 9px 0;
  border-bottom: 1px solid #e8eaee;
  font-size: 10px;
  color: #2b303a;
  vertical-align: top;
}
.items .r {
  text-align: right;
}
.idesc {
  font-size: 10.5px;
  font-weight: 600;
  color: #12141a;
}
.idetail {
  font-size: 9px;
  color: #8b8f98;
  margin-top: 2px;
}
.strong {
  font-weight: 600;
  color: #12141a;
}
.classic .items th {
  background: #f4f5f8;
  padding: 7px 8px;
  border-bottom: 1px solid #e2e5ea;
  color: #6b7280;
}
.classic .items td {
  padding: 9px 8px;
}
.totals {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-top: 14px;
  gap: 8px;
}
.trows {
  width: 230px;
}
.trow {
  display: flex;
  justify-content: space-between;
  font-size: 9.5px;
  color: #6b7280;
  padding: 2.5px 0;
}
.tbox {
  width: 230px;
  background: var(--accent);
  color: #fff;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 9px 10px;
  border-radius: 2px;
}
.tbox span {
  font-size: 7.5px;
  letter-spacing: 0.16em;
  opacity: 0.85;
}
.tbox b {
  font-size: 17px;
  letter-spacing: -0.03em;
}
.classic .tbox {
  background: transparent;
  color: #12141a;
  border-top: 1.5px solid #12141a;
  padding: 8px 0 0;
  border-radius: 0;
}
.mini .tbox {
  background: #12141a;
}
.notes {
  margin-top: auto;
  padding: 22px 0 16px;
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.nlab {
  font-size: 7px;
  letter-spacing: 0.18em;
  color: #9aa0aa;
}
.ntext {
  font-size: 9px;
  color: #4b5563;
  line-height: 1.65;
  margin-top: 3px;
  white-space: pre-line;
}
.faint {
  color: #8b8f98;
}
.page-foot {
  display: flex;
  justify-content: space-between;
  border-top: 1px solid #e8eaee;
  padding-top: 7px;
  font-size: 7.5px;
  color: #9aa0aa;
  margin-top: 4px;
}
</style>
