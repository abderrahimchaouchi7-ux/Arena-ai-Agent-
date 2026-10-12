/**
 * Service-worker registration + install/update prompts.
 *
 * `vite-plugin-pwa` injects the registration; this module wraps the update
 * lifecycle so Settings can tell the user when a new version has downloaded
 * instead of silently swapping it under them.
 */
import { useCallback, useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

export interface PwaRegistration {
  /** True once the service worker is controlling the page. */
  registered: boolean;
  /** True when a new version has finished downloading. */
  needsRefresh: boolean;
  /** True when the browser supports installation. */
  canInstall: boolean;
  /** Fires the browser install prompt (Android/Chrome). Returns false if unavailable. */
  install: () => Promise<boolean>;
  /** Applies the downloaded update, reloading the page. */
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
  /** Re-checks the server for a new service worker. */
  checkForUpdates: () => Promise<void>;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let updateSw: ((reloadPage?: boolean) => Promise<void>) | null = null;
let offlineReady: ((ready: boolean) => void) | null = null;
let needRefresh: ((reload: boolean) => void) | null = null;
let initialised = false;

function init() {
  if (initialised) return;
  initialised = true;
  try {
    const sw = registerSW({
      onOfflineReady: () => offlineReady?.(true),
      onNeedRefresh: () => needRefresh?.(true),
      onRegisterError: (error: unknown) => {
        console.warn('[pwa] service worker registration failed', error);
      },
    });
    updateSw = sw;
  } catch (error) {
    console.warn('[pwa] registration unavailable', error);
  }
}

export function useRegistration(): PwaRegistration & { registration: ServiceWorkerRegistration | null } {
  const [registered, setRegistered] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    init();

    offlineReady = (ready) => setRegistered(ready);
    needRefresh = (reload) => setNeedsRefresh(reload);

    const onInstalled = (event: Event) => {
      event.preventDefault();
      setCanInstall(true);
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onInstalled);

    void navigator.serviceWorker?.getRegistration().then((reg) => {
      if (reg) {
        setRegistration(reg);
        setRegistered(true);
      }
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', onInstalled);
      offlineReady = null;
      needRefresh = null;
    };
  }, []);

  const install = useCallback(async () => {
    if (!promptEvent) return false;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    setCanInstall(false);
    setPromptEvent(null);
    return choice.outcome === 'accepted';
  }, [promptEvent]);

  const updateServiceWorker = useCallback(async (reloadPage = true) => {
    if (updateSw) await updateSw(reloadPage);
  }, []);

  const checkForUpdates = useCallback(async () => {
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update();
  }, []);

  return {
    registered,
    needsRefresh,
    canInstall,
    install,
    updateServiceWorker,
    checkForUpdates,
    registration,
  };
}
