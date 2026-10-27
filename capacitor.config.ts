import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'studio.billfold.app',
  appName: 'Billfold',
  webDir: 'dist',
  android: {
    backgroundColor: '#080B10',
    allowMixedContent: false,
    captureInput: true,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#080B10',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    // Capacitor 8's built-in system bar handling. "native" applies the status bar,
    // navigation bar, cutout and keyboard insets as window padding, so web content
    // can never scroll underneath the system bars on Android 15+ edge-to-edge.
    SystemBars: {
      style: 'DARK',
      insetsHandling: 'native',
    },
    Keyboard: {
      resize: 'native',
    },
  },
}

export default config
