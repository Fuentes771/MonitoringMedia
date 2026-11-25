import { RefreshCw, Radio, Bell, ChevronRight, ShieldCheck, LogOut, Loader2, Menu } from 'lucide-react';
import { CoverageInfo } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { NavTab } from './Sidebar';

interface TopbarProps {
  currentTab?: NavTab;
  coverage?: CoverageInfo;
  onRefresh: () => void;
  isRefreshing: boolean;
  days: number;
  onChangeDays: (d: number) => void;
  onNavigateToAlerts?: () => void;
  organicOnly?: boolean;
  onToggleOrganicOnly?: () => void;
  onOpenMobileMenu?: () => void;
  isMobileMenuOpen?: boolean;
}

export function Topbar({
  currentTab = 'overview',
  coverage,
  onRefresh,
  isRefreshing,
  days,
  onChangeDays,
  onNavigateToAlerts,
  organicOnly = false,
  onToggleOrganicOnly,
  onOpenMobileMenu,
  isMobileMenuOpen = false,
}: TopbarProps) {
  const { user, activeWorkspace, logout, isLoggingOut } = useAuth();

  const getTabLabel = (tab: NavTab) => {
    switch (tab) {
      case 'overview':
        return 'Ruang Intelijen';
      case 'hot_issues':
        return 'Radar Isu Hangat';
      case 'bot_radar':
        return 'Radar Buzzer & Bot';
      case 'mentions':
        return 'Eksplorasi Sebutan';
      case 'topics':
        return 'Program Prioritas';
      case 'alerts':
        return 'Sinyal & Peringatan';
      case 'sources':
        return 'Sumber Data';
      default:
        return 'Konsol Utama';
    }
  };

  const formatSyncTime = (iso?: string | null) => {
    if (!iso) return 'Terhubung';
    const date = new Date(iso);
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
  };

  const dayOptions = [
    { shortLabel: '24J', label: '24 Jam', val: 1 },
    { shortLabel: '7H', label: '7 Hari', val: 7 },
    { shortLabel: '30H', label: '30 Hari', val: 30 },
  ];

  return (
    <header className="border-b border-white/[0.08] bg-[#08090d]/92 backdrop-blur-md sticky top-0 z-30 px-3.5 py-2 sm:px-5 sm:py-2.5 lg:px-6 lg:py-3 transition-colors font-sans-ui">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 lg:gap-4">
        {/* Top Row: Mobile Menu + Brand/Page Title + Quick Icon Actions */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            {onOpenMobileMenu && (
              <button
                type="button"
                onClick={onOpenMobileMenu}
                aria-expanded={isMobileMenuOpen}
                aria-controls="mobile-nav-drawer"
                aria-label="Buka menu navigasi"
                className="lg:hidden inline-flex items-center gap-1.5 min-h-11 px-2.5 rounded-xl border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12] text-xs font-semibold text-white shrink-0 transition-colors"
              >
                <Menu className="w-4 h-4 text-[#d4af37]" aria-hidden="true" />
                <span>Menu</span>
              </button>
            )}

            <div className="flex items-center gap-2 min-w-0 text-xs">
              <img
                src="/brand/trinetra-logo.svg"
                alt="TRINETRA"
                width={20}
                height={20}
                className="w-5 h-5 object-contain shrink-0 filter drop-shadow-[0_0_8px_rgba(212,175,55,0.45)]"
              />
              <span className="hidden sm:inline font-bold tracking-wider text-zinc-200 shrink-0">
                TRINETRA
              </span>
              <ChevronRight className="hidden sm:inline w-3.5 h-3.5 text-zinc-500 shrink-0" aria-hidden="true" />
              <span className="font-bold text-white text-sm tracking-tight truncate">
                {getTabLabel(currentTab)}
              </span>
            </div>

            {coverage && (
              <div className="hidden 2xl:flex items-center gap-2.5 shrink-0">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/[0.08] bg-white/[0.03] text-zinc-200 text-xs font-medium">
                  <Radio className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                  <span className="font-mono-code text-[11px] text-zinc-200">
                    Google News ID Live
                  </span>
                </div>

                <div className="text-zinc-400 text-xs flex items-center gap-1.5">
                  <span>Sinkron:</span>
                  <span className="text-zinc-200 font-medium font-mono-code text-[11px] font-tabular">
                    {formatSyncTime(coverage.last_successful_sync_at)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Mobile & Tablet Quick Icon Actions (Row 1 right side) */}
          <div className="flex lg:hidden items-center gap-1.5 shrink-0">
            {onNavigateToAlerts && (
              <button
                type="button"
                onClick={onNavigateToAlerts}
                className="min-w-11 min-h-11 flex items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.08] active:bg-white/[0.12] text-zinc-200 hover:text-white transition-all relative cursor-pointer"
                title="Peringatan Dini"
                aria-label="Peringatan Dini"
              >
                <Bell className="w-4 h-4" aria-hidden="true" />
                <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50" />
              </button>
            )}

            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="min-w-11 min-h-11 flex items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.08] active:bg-white/[0.12] text-zinc-200 hover:text-white transition-all disabled:opacity-50 cursor-pointer"
              title="Segarkan Data Realtime"
              aria-label="Segarkan data realtime"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-amber-300' : ''}`} aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => void logout()}
              disabled={isLoggingOut}
              aria-label="Keluar dari konsol"
              title="Keluar dari konsol"
              className="hidden sm:flex min-h-11 px-3 rounded-xl border border-[#5e6575] bg-white/[0.03] hover:bg-rose-500/15 hover:border-rose-400/50 text-xs font-semibold text-[#f4f5f8] hover:text-[#fda4af] items-center gap-1.5 transition-colors motion-reduce:transition-none disabled:opacity-50"
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

        {/* Utility Controls Row (Row 2 compact bar on mobile/tablet, inline right on desktop) */}
        <div className="flex items-center justify-between lg:justify-end gap-2 pt-2 border-t border-white/[0.06] lg:pt-0 lg:border-t-0 shrink-0">
          {/* Date Window Segmented Control */}
          <div
            role="group"
            aria-label="Rentang waktu data"
            className="flex items-center bg-white/[0.03] border border-white/[0.08] rounded-xl p-0.5 text-xs shadow-xs shrink-0"
          >
            {dayOptions.map((item) => (
              <button
                key={item.val}
                type="button"
                onClick={() => onChangeDays(item.val)}
                aria-pressed={days === item.val}
                className={`min-h-10 lg:min-h-8 px-2.5 sm:px-3 lg:px-2.5 xl:px-3 py-1.5 rounded-lg transition-all text-xs font-semibold cursor-pointer font-tabular whitespace-nowrap ${
                  days === item.val
                    ? 'bg-white text-zinc-950 shadow-xs'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                <span className="sm:hidden lg:inline xl:hidden">{item.shortLabel}</span>
                <span className="hidden sm:inline lg:hidden xl:inline">{item.label}</span>
              </button>
            ))}
          </div>

          {/* Global Organic Voice Filter Toggle */}
          {onToggleOrganicOnly && (
            <button
              type="button"
              onClick={onToggleOrganicOnly}
              aria-pressed={organicOnly}
              className={`min-h-10 lg:min-h-9 flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                organicOnly
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-xs'
                  : 'bg-white/[0.03] border-white/[0.1] text-zinc-300 hover:text-white hover:bg-white/[0.06]'
              }`}
              title="Sembunyikan akun terindikasi bot/buzzer copypasta dari metrik & daftar sebutan"
            >
              <ShieldCheck className={`w-3.5 h-3.5 shrink-0 ${organicOnly ? 'text-emerald-400' : 'text-zinc-400'}`} aria-hidden="true" />
              <span className="sm:hidden lg:inline xl:hidden">{organicOnly ? 'Organik: On' : 'Organik'}</span>
              <span className="hidden sm:inline lg:hidden xl:inline">{organicOnly ? 'Filter Organik: Aktif' : 'Filter Opini Organik'}</span>
            </button>
          )}

          {/* Desktop-only Quick Actions (Bell, Refresh, Account & Logout) */}
          <div className="hidden lg:flex items-center gap-2">
            {onNavigateToAlerts && (
              <button
                type="button"
                onClick={onNavigateToAlerts}
                className="min-w-9 min-h-9 flex items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.08] text-zinc-300 hover:text-white transition-all relative cursor-pointer"
                title="Peringatan Dini"
                aria-label="Peringatan Dini"
              >
                <Bell className="w-4 h-4" aria-hidden="true" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50" />
              </button>
            )}

            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="min-w-9 min-h-9 flex items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.08] text-zinc-300 hover:text-white transition-all disabled:opacity-50 cursor-pointer"
              title="Segarkan Data Realtime"
              aria-label="Segarkan data realtime"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-zinc-400' : ''}`} aria-hidden="true" />
            </button>

            <div className="flex items-center gap-2 pl-2 border-l border-white/10">
              <div className="hidden xl:flex flex-col items-end leading-tight max-w-36">
                <span className="text-xs font-semibold text-[#f4f5f8] truncate max-w-full">
                  {user?.name ?? 'Operator'}
                </span>
                <span className="text-[10px] font-mono-code uppercase text-[#d4af37]">
                  {activeWorkspace?.role ?? 'operator'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void logout()}
                disabled={isLoggingOut}
                aria-label="Keluar dari konsol"
                title="Keluar dari konsol"
                className="min-h-9 px-3 rounded-xl border border-[#5e6575] bg-white/[0.03] hover:bg-rose-500/15 hover:border-rose-400/50 text-xs font-semibold text-[#f4f5f8] hover:text-[#fda4af] flex items-center gap-1.5 transition-colors motion-reduce:transition-none disabled:opacity-50"
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
        </div>
      </div>
    </header>
  );
}
