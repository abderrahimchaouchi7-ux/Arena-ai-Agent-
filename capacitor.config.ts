import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor configuration for the Android build.
 *
 * The web assets are the plain Vite output in `dist`. There is no server: every
 * feature (prayer times, Qibla, Quran, search) runs offline from bundled data,
 * so `webDir` alone is enough and the APK needs no network permission to work.
 */
const config: CapacitorConfig = {
  appId: 'org.nuraliman.app',
  appName: 'Nur Al-Iman',
  webDir: 'dist',

  android: {
    // The app is a single-page bundle served from assets; allow the WebView to
    // read its own files but nothing else.
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
    backgroundColor: '#0f1720',
  },

  plugins: {
    LocalNotifications: {
      // `smallIcon` must name a drawable that exists in the Android project;
      // res/drawable/ic_stat_notification.xml provides it.
      smallIcon: 'ic_stat_notification',
      iconColor: '#c9a227',
      // No `sound` override: the notification channel's default tone is used,
      // which respects the user's own system notification sound. Bundling a
      // copyrighted adhan as an alert tone is deliberately not done.
    },
  },

  server: {
    androidScheme: 'https',
  },
};

export default config;
