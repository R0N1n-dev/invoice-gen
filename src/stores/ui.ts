import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Toast {
  id: number
  message: string
  tone: 'ok' | 'err' | 'info'
}

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

let toastSeq = 0

export const useUiStore = defineStore('ui', () => {
  const toasts = ref<Toast[]>([])
  const sheetClosers = ref<(() => void)[]>([])

  function toast(message: string, tone: Toast['tone'] = 'ok', ms = 2600) {
    const id = ++toastSeq
    toasts.value.push({ id, message, tone })
    setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id)
    }, ms)
  }

  const confirmState = ref<{
    open: boolean
    options: ConfirmOptions
    resolve: ((v: boolean) => void) | null
  }>({ open: false, options: { title: '' }, resolve: null })

  function confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      confirmState.value = { open: true, options, resolve }
    })
  }

  function resolveConfirm(value: boolean) {
    confirmState.value.resolve?.(value)
    confirmState.value = { open: false, options: { title: '' }, resolve: null }
  }

  /** Sheets register a closer so the Android back button can dismiss them. */
  function registerSheet(close: () => void): () => void {
    sheetClosers.value = [...sheetClosers.value, close]
    return () => {
      sheetClosers.value = sheetClosers.value.filter((c) => c !== close)
    }
  }

  function closeTopSheet(): boolean {
    const top = sheetClosers.value[sheetClosers.value.length - 1]
    if (!top) return false
    top()
    return true
  }

  return {
    toasts,
    toast,
    confirm,
    resolveConfirm,
    confirmState,
    sheetClosers,
    registerSheet,
    closeTopSheet,
  }
})
