import {
  RefreshCw,
  Bell,
  ShieldCheck,
  LogOut,
  Loader2,
  Menu,
  Search,
  Sun,
  Moon,
} from 'lucide-react';
import { CoverageInfo } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { NavTab } from './Sidebar';

interface TopbarProps {
  currentTab?: NavTab;
  coverage?: CoverageInfo;
  onRefresh: () => void;
  isRefreshing: boolean;
  days: number;
  onChangeDays: (d: number) => void;
  onNavigateToAlerts?: () => void;
  onQuickSearch?: () => void;
  organicOnly?: boolean;
  onToggleOrganicOnly?: () => void;
  onOpenMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
  hasAlertIndicator?: boolean;
}

const TAB_TITLES: Record<NavTab, string> = {
  overview: 'Ruang Intelijen',
  hot_issues: 'Radar Isu Hangat',
  bot_radar: 'Radar Buzzer & Bot',
  mentions: 'Eksplorasi Sebutan',
  topics: 'Program Prioritas',
  alerts: 'Sinyal & Peringatan',
  sources: 'Konektor Sumber Data',
};

export function Topbar({
  currentTab = 'overview',
  coverage,
  onRefresh,
  isRefreshing,
  days,
  onChangeDays,
  onNavigateToAlerts,
  onQuickSearch,
  organicOnly = false,
  onToggleOrganicOnly,
  onOpenMobileMenu,
  isMobileMenuOpen = false,
  hasAlertIndicator = false,
}: TopbarProps) {
  const { logout, isLoggingOut } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const formatSyncTime = (iso?: string | null) => {
    if (!iso) return null;
    try {
      const date = new Date(iso);
      return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
    } catch {
      return null;
    }
  };

  const syncLabel = formatSyncTime(coverage?.last_successful_sync_at);

  const dayOptions = [
    { shortLabel: '24J', label: '24 Jam', val: 1 },
    { shortLabel: '7H', label: '7 Hari', val: 7 },
    { shortLabel: '30H', label: '30 Hari', val: 30 },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--bg-topbar)] backdrop-blur-md px-4 py-2.5 sm:px-6 lg:px-8 lg:py-3.5 transition-colors font-sans-ui">
      <div className="max-w-[1440px] mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5 lg:gap-4">
        {/* Left: Mobile Trigger + Clean Section Heading + Real Sync Timestamp */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
            {onOpenMobileMenu && (
              <button
                type="button"
                onClick={onOpenMobileMenu}
                aria-expanded={isMobileMenuOpen}
                aria-controls="mobile-nav-drawer"
                aria-label="Buka menu navigasi"
                className="lg:hidden inline-flex items-center gap-1.5 min-h-11 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] text-xs font-semibold text-[var(--text-primary)] shrink-0 transition-colors"
              >
                <Menu className="w-4 h-4 text-[var(--accent-gold-text)]" aria-hidden="true" />
                <span>Menu</span>
              </button>
            )}

            <div className="flex items-center gap-2.5 min-w-0">
              <span className="lg:hidden w-7 h-7 rounded-full bg-[#181614] dark:bg-transparent flex items-center justify-center shrink-0">
                <img
                  src="/brand/trinetra-logo.svg"
                  alt=""
                  aria-hidden="true"
                  width={20}
                  height={20}
                  className="w-5 h-5 object-contain shrink-0"
                />
              </span>
              <span className="font-semibold text-[var(--text-primary)] text-base sm:text-lg lg:text-[21px] tracking-tight truncate">
                {TAB_TITLES[currentTab]}
              </span>
            </div>

            {syncLabel && (
              <span className="hidden xl:inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] shrink-0 pl-2 border-l border-[var(--border-subtle)]">
                <span>Sinkron</span>
                <span className="font-mono-code font-tabular text-[var(--text-secondary)]">
                  {syncLabel}
                </span>
              </span>
            )}
          </div>

          {/* Mobile & Tablet Quick Icon Actions */}
          <div className="flex lg:hidden items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
              title={isDark ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
              className="min-w-11 min-h-11 flex items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] transition-colors"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-[var(--accent-gold-text)]" aria-hidden="true" />
              ) : (
                <Moon className="w-4 h-4 text-[var(--text-primary)]" aria-hidden="true" />
              )}
            </button>

            {onNavigateToAlerts && (
              <button
                type="button"
                onClick={onNavigateToAlerts}
                aria-label="Peringatan Dini"
                title="Peringatan Dini"
                className="min-w-11 min-h-11 flex items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] transition-colors relative"
              >
                <Bell className="w-4 h-4" aria-hidden="true" />
                {hasAlertIndicator && (
                  <span
                    aria-hidden="true"
                    className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[var(--sentiment-neg)]"
                  />
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              aria-label="Segarkan data"
              title="Segarkan data"
              className="min-w-11 min-h-11 flex items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[var(--accent-gold-text)]' : ''}`}
                aria-hidden="true"
              />
            </button>

            <button
              type="button"
              onClick={() => void logout()}
              disabled={isLoggingOut}
              aria-label="Keluar dari konsol"
              className="hidden sm:flex min-h-11 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--sentiment-neg-subtle)] hover:border-[var(--sentiment-neg-border)] text-xs font-semibold text-[var(--text-primary)] hover:text-[var(--sentiment-neg)] items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {isLoggingOut ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>{isLoggingOut ? 'Keluar...' : 'Keluar'}</span>
            </button>
          </div>
        </div>

        {/* Right: Utility Controls (Single clean row on desktop, compact 2nd row on mobile) */}
        <div className="flex items-center justify-between lg:justify-end gap-2 pt-2 border-t border-[var(--border-subtle)] lg:pt-0 lg:border-t-0 shrink-0">
          {/* Date Window Segmented Pill Control (Ref 2 inspired) */}
          <div
            role="group"
            aria-label="Rentang waktu data"
            className="inline-flex items-center bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-full p-1 shrink-0"
          >
            {dayOptions.map((item) => {
              const active = days === item.val;
              return (
                <button
                  key={item.val}
                  type="button"
                  onClick={() => onChangeDays(item.val)}
                  aria-pressed={active}
                  className={`min-h-9 lg:min-h-8 px-3 sm:px-3.5 rounded-full text-xs font-semibold font-tabular whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-[var(--action-contrast-bg)] text-[var(--action-contrast-fg)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span className="sm:hidden">{item.shortLabel}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Organic Filter Pill */}
          {onToggleOrganicOnly && (
            <button
              type="button"
              onClick={onToggleOrganicOnly}
              aria-pressed={organicOnly}
              title="Sembunyikan akun terindikasi bot atau buzzer copypasta"
              className={`min-h-10 lg:min-h-9 inline-flex items-center gap-1.5 px-3 sm:px-3.5 rounded-full border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                organicOnly
                  ? 'bg-[var(--sentiment-pos-subtle)] border-[var(--sentiment-pos-border)] text-[var(--sentiment-pos)]'
                  : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-medium)]'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="sm:hidden">{organicOnly ? 'Organik: On' : 'Organik'}</span>
              <span className="hidden sm:inline">{organicOnly ? 'Organik Aktif' : 'Filter Organik'}</span>
            </button>
          )}

          {/* Desktop Action Cluster */}
          <div className="hidden lg:flex items-center gap-1.5 pl-2 border-l border-[var(--border-subtle)]">
            {onQuickSearch && (
              <button
                type="button"
                onClick={onQuickSearch}
                aria-label="Cari sebutan (Ctrl+K)"
                title="Cari sebutan (Ctrl+K)"
                className="min-h-9 px-3 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] hover:border-[var(--border-medium)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center gap-2 transition-colors"
              >
                <Search className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden xl:inline">Cari</span>
                <kbd className="font-mono-code text-[10px] text-[var(--text-muted)]">Ctrl+K</kbd>
              </button>
            )}

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
              title={isDark ? 'Mode Terang (Alabaster)' : 'Mode Gelap (Obsidian)'}
              className="min-w-9 min-h-9 flex items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] hover:border-[var(--border-medium)] text-[var(--text-primary)] transition-colors"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-[var(--accent-gold-text)]" aria-hidden="true" />
              ) : (
                <Moon className="w-4 h-4 text-[var(--text-primary)]" aria-hidden="true" />
              )}
            </button>

            {onNavigateToAlerts && (
              <button
                type="button"
                onClick={onNavigateToAlerts}
                aria-label="Peringatan Dini"
                title="Peringatan Dini"
                className="min-w-9 min-h-9 flex items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] hover:border-[var(--border-medium)] text-[var(--text-primary)] transition-colors relative"
              >
                <Bell className="w-4 h-4" aria-hidden="true" />
                {hasAlertIndicator && (
                  <span
                    aria-hidden="true"
                    className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--sentiment-neg)]"
                  />
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              aria-label="Segarkan data"
              title="Segarkan data"
              className="min-w-9 min-h-9 flex items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] hover:border-[var(--border-medium)] text-[var(--text-primary)] transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[var(--accent-gold-text)]' : ''}`}
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
