import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core'
import { App } from '@capacitor/app'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { SplashScreen } from '@capacitor/splash-screen'
import { Keyboard } from '@capacitor/keyboard'
import { bytesToBase64, downloadBlob } from './utils'

export const isNative = Capacitor.isNativePlatform()

/** Boot the native shell: system bars, splash, keyboard. No haptics anywhere. */
export async function initNative(): Promise<void> {
  if (!isNative) return

  // SystemBars owns edge-to-edge: it pads the window with the real insets and keeps
  // the bars dark. We never touch the window layout from the web layer.
  try {
    await SystemBars.setStyle({ style: SystemBarsStyle.Dark })
  } catch {
    /* plugin missing on this platform build */
  }
  try {
    await Keyboard.setAccessoryBarVisible({ isVisible: false })
  } catch {
    /* optional */
  }
}

/** Switch the status/navigation bar icon colour to match the UI. */
export async function setSystemBarStyle(darkUi: boolean): Promise<void> {
  if (!isNative) return
  try {
    await SystemBars.setStyle({ style: darkUi ? SystemBarsStyle.Dark : SystemBarsStyle.Light })
  } catch {
    /* plugin missing on this platform build */
  }
}

export async function hideSplash(): Promise<void> {
  if (!isNative) return
  try {
    await SplashScreen.hide()
  } catch {
    /* ignore */
  }
}

/** Android hardware back button. Returns an unsubscribe function. */
export function onBackButton(handler: () => void): () => void {
  if (!isNative) return () => undefined
  let remove: (() => void) | undefined
  App.addListener('backButton', () => handler()).then((l) => {
    remove = () => l.remove()
  })
  return () => remove?.()
}

/** Run a callback when the app moves between foreground and background. */
export function onAppStateChange(handler: (isActive: boolean) => void): () => void {
  if (!isNative) return () => undefined
  let remove: (() => void) | undefined
  App.addListener('appStateChange', ({ isActive }) => handler(isActive)).then((l) => {
    remove = () => l.remove()
  })
  return () => remove?.()
}

export async function exitApp(): Promise<void> {
  if (!isNative) return
  try {
    await App.exitApp()
  } catch {
    /* ignore */
  }
}

function pdfBlob(bytes: Uint8Array): Blob {
  const copy = new Uint8Array(bytes)
  return new Blob([copy], { type: 'application/pdf' })
}

export interface SaveResult {
  ok: boolean
  uri?: string
  location?: string
  error?: string
}

/** Write a PDF to the device's Documents/Billfold folder (or download on web). */
export async function savePdf(filename: string, bytes: Uint8Array): Promise<SaveResult> {
  if (!isNative) {
    downloadBlob(pdfBlob(bytes), filename)
    return { ok: true, location: 'Downloads' }
  }
  const base64 = bytesToBase64(bytes)
  try {
    const res = await Filesystem.writeFile({
      path: `Billfold/${filename}`,
      data: base64,
      directory: Directory.Documents,
      recursive: true,
    })
    return { ok: true, uri: res.uri, location: 'Documents/Billfold' }
  } catch (err) {
    try {
      const res = await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Cache,
        recursive: true,
      })
      return { ok: true, uri: res.uri, location: 'App cache' }
    } catch (err2) {
      return { ok: false, error: String(err2 ?? err) }
    }
  }
}

/** Native share sheet with the PDF attached. */
export async function sharePdf(filename: string, bytes: Uint8Array, title: string): Promise<SaveResult> {
  const blob = pdfBlob(bytes)
  if (!isNative) {
    const file = new File([blob], filename, { type: 'application/pdf' })
    const nav = navigator as Navigator & {
      canShare?: (data: { files: File[] }) => boolean
      share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>
    }
    if (nav.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
      try {
        await nav.share({ files: [file], title })
        return { ok: true }
      } catch {
        /* user cancelled, fall through */
      }
    }
    downloadBlob(blob, filename)
    return { ok: true, location: 'Downloads' }
  }
  try {
    const written = await Filesystem.writeFile({
      path: filename,
      data: bytesToBase64(bytes),
      directory: Directory.Cache,
      recursive: true,
    })
    const uri = await Filesystem.getUri({ path: filename, directory: Directory.Cache })
    await Share.share({
      title,
      text: title,
      url: uri.uri || written.uri,
      dialogTitle: 'Share invoice',
    })
    return { ok: true, uri: uri.uri }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

/** Save any text payload (backup, CSV) to Documents/Billfold. */
export async function saveTextFile(filename: string, text: string): Promise<SaveResult> {
  if (!isNative) {
    downloadBlob(new Blob([text], { type: 'application/json' }), filename)
    return { ok: true, location: 'Downloads' }
  }
  try {
    const res = await Filesystem.writeFile({
      path: `Billfold/${filename}`,
      data: text,
      directory: Directory.Documents,
      recursive: true,
    })
    return { ok: true, uri: res.uri, location: 'Documents/Billfold' }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

/** Silent JSON snapshot used by the auto-backup setting. */
export async function writeBackupFile(json: string): Promise<boolean> {
  if (!isNative) return false
  try {
    await Filesystem.writeFile({
      path: 'Billfold/backups/billfold-backup.json',
      data: json,
      directory: Directory.Documents,
      recursive: true,
      encoding: undefined,
    })
    return true
  } catch {
    return false
  }
}
