import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'de.commsconnect.swingandsavor',
  appName: 'Swing & Savor',
  webDir: 'www',
  backgroundColor: '#0A1A12',
  server: {
    url: 'https://app.swingandsavor.at',
    androidScheme: 'https',
    iosScheme: 'https',
    cleartext: false,
  },
  ios: {
    // never = keine impliziten ScrollIndicator-/Top-Insets vom WKWebView.
    // env(safe-area-inset-*) im CSS ist die einzige Quelle der Wahrheit.
    contentInset: 'never',
    limitsNavigationsToAppBoundDomains: true,
    scrollEnabled: true,
  },
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      launchFadeOutDuration: 300,
      backgroundColor: '#0A1A12',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0A1A12',
      // true = WebView nimmt vollen Screen ein, Status-Bar liegt OBEN drauf.
      // CSS env(safe-area-inset-top) gibt den echten Notch/Island-Wert zurück,
      // den BrandHeader als paddingTop konsumiert.
      overlaysWebView: true,
    },
  },
};

export default config;
