import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Home,
  Clock3,
  AudioLines,
  BookOpen,
  HandHeart,
  Repeat,
  ScrollText,
  Compass,
  Settings as SettingsIcon,
  Search,
  Bookmark,
  Menu,
  X,
  WifiOff,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { useOnline } from '@/hooks';
import { useSettings } from '@/state/settings';
import { IconButton } from './ui';

interface NavItem {
  to: string;
  key: string;
  icon: typeof Home;
  /** Shown in the mobile bottom bar. */
  primary: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', key: 'nav.home', icon: Home, primary: true },
  { to: '/prayer-times', key: 'nav.prayerTimes', icon: Clock3, primary: true },
  { to: '/quran', key: 'nav.quran', icon: BookOpen, primary: true },
  { to: '/qibla', key: 'nav.qibla', icon: Compass, primary: true },
  { to: '/adhan', key: 'nav.adhan', icon: AudioLines, primary: false },
  { to: '/dua', key: 'nav.dua', icon: HandHeart, primary: false },
  { to: '/adhkar', key: 'nav.adhkar', icon: Repeat, primary: false },
  { to: '/hadith', key: 'nav.hadith', icon: ScrollText, primary: false },
  { to: '/search', key: 'nav.search', icon: Search, primary: false },
  { to: '/bookmarks', key: 'bookmarks.title', icon: Bookmark, primary: false },
  { to: '/settings', key: 'nav.settings', icon: SettingsIcon, primary: false },
];

function MobileBottomNav() {
  const { t } = useTranslation();
  const items = NAV_ITEMS.filter((i) => i.primary);

  return (
    <nav
      aria-label={t('a11y.mainNavigation')}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur-md md:hidden safe-bottom no-print"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  clsx(
                    'flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-[10px] font-medium transition-colors duration-150 active:scale-95',
                    isActive ? 'text-accent' : 'text-muted hover:text-fg',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={clsx(
                        'flex h-7 w-12 items-center justify-center rounded-full transition-colors duration-200',
                        isActive && 'bg-accent/15',
                      )}
                    >
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="truncate">{t(item.key)}</span>
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function DesktopSideNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('a11y.mainNavigation')} className="flex flex-col gap-0.5">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              clsx(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                isActive
                  ? 'bg-accent/12 text-accent'
                  : 'text-muted hover:bg-surface-2 hover:text-fg',
              )
            }
          >
            <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
            <span className="truncate">{t(item.key)}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const online = useOnline();
  const location = useLocation();
  const language = useSettings((s) => s.language);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close the drawer whenever navigation happens.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-fg"
      >
        {t('a11y.skipToContent')}
      </a>

      {/* Top bar: brand + offline badge + drawer trigger on small screens. */}
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur-md no-print">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-2.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-fg"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <path d="M15.5 2a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 1 0-19Z" opacity=".9" />
                <path d="m19.4 4.6.9 2.2 2.2.9-2.2.9-.9 2.2-.9-2.2-2.2-.9 2.2-.9.9-2.2Z" />
              </svg>
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-bold">{t('app.name')}</p>
              <p className="truncate text-[11px] text-muted">{t('app.tagline')}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {!online ? (
              <span
                className="chip gap-1.5 border-warning/40 bg-warning/10 text-warning"
                title={t('common.offlineNotice')}
              >
                <WifiOff className="h-3.5 w-3.5" aria-hidden />
                <span className="hidden sm:inline">{t('common.offline')}</span>
              </span>
            ) : null}
            <IconButton
              className="md:hidden"
              label={drawerOpen ? t('a11y.closeMenu') : t('a11y.openMenu')}
              onClick={() => setDrawerOpen((v) => !v)}
              aria-expanded={drawerOpen}
            >
              {drawerOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
            </IconButton>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-3 sm:px-5">
        {/* Desktop rail */}
        <aside className="sticky top-[60px] hidden h-[calc(100dvh-76px)] w-56 shrink-0 flex-col overflow-y-auto py-5 md:flex no-print">
          <DesktopSideNav />
          <div className="mt-auto pt-4 text-[11px] leading-relaxed text-muted">
            <p>{t('prayers.calculatedLocally')}</p>
            <p className="mt-1" lang={language === 'ar' ? 'ar' : undefined}>
              {t('quran.attribution')}
            </p>
          </div>
        </aside>

        <main id="main" className="min-w-0 flex-1 py-4 md:py-6">
          <div key={location.pathname} className="page-enter">
            {children}
          </div>
        </main>
      </div>

      <MobileBottomNav />

      {/* Mobile drawer for the secondary destinations. */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-40 md:hidden no-print">
          <button
            type="button"
            aria-label={t('a11y.closeMenu')}
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/50 animate-fade-in"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('a11y.menu')}
            className={clsx(
              'absolute inset-y-0 w-72 max-w-[85%] overflow-y-auto border-border bg-surface p-4 shadow-pop animate-slide-up',
              'ltr:left-0 ltr:border-e rtl:right-0 rtl:border-s',
            )}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="font-bold">{t('nav.more')}</p>
              <IconButton label={t('a11y.closeMenu')} onClick={() => setDrawerOpen(false)}>
                <X className="h-5 w-5" aria-hidden />
              </IconButton>
            </div>
            <DesktopSideNav onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
