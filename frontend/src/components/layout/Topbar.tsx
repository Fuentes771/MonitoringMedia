import { RefreshCw, Radio, Bell, ChevronRight, ShieldCheck, LogOut, Loader2 } from 'lucide-react';
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
}: TopbarProps) {
  const { user, activeWorkspace, logout, isLoggingOut } = useAuth();
  const getTabLabel = (tab: NavTab) => {
    switch (tab) {
      case 'overview':
        return 'Ruang Intelijen';
      case 'hot_issues':
        return 'Radar Isu Hangat';
      case 'bot_radar':
        return 'Radar Buzzer & Jaringan Bot';
      case 'mentions':
        return 'Eksplorasi Sebutan';
      case 'topics':
        return 'Radar Topik Isu';
      case 'alerts':
        return 'Sinyal & Peringatan';
      case 'sources':
        return 'Konektor Sumber Data';
      default:
        return 'Konsol Utama';
    }
  };

  const formatSyncTime = (iso?: string | null) => {
    if (!iso) return 'Terhubung';
    const date = new Date(iso);
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
  };

  return (
    <header className="border-b border-white/[0.08] bg-[#08090d]/85 backdrop-blur-xl sticky top-0 z-30 px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors font-sans-ui">
      {/* Context & Location Breadcrumb */}
      <div className="flex items-center flex-wrap gap-3.5 text-xs">
        <div className="flex items-center gap-2 text-zinc-400">
          <img
            src="/brand/trinetra-logo.svg"
            alt="TRINETRA"
            className="w-5 h-5 object-contain filter drop-shadow-[0_0_8px_rgba(212,175,55,0.45)]"
          />
          <span className="font-bold tracking-wider text-zinc-200">TRINETRA</span>
          <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
          <span className="font-bold text-white text-sm tracking-tight">
            {getTabLabel(currentTab)}
          </span>
        </div>

        {coverage && (
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/[0.08] bg-white/[0.03] text-zinc-300 text-xs font-medium">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span className="font-mono-code text-[11px] text-zinc-200">
                Google News ID Live
              </span>
            </div>

            <div className="text-zinc-400 text-xs hidden md:flex items-center gap-1.5">
              <span>Sinkron:</span>
              <span className="text-zinc-300 font-medium font-mono-code text-[11px]">
                {formatSyncTime(coverage.last_successful_sync_at)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Date Switchers, Organic Filter, Alert Bell & Actions */}
      <div className="flex items-center flex-wrap gap-2.5">
        {/* Global Organic Voice Filter Toggle */}
        {onToggleOrganicOnly && (
          <button
            onClick={onToggleOrganicOnly}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              organicOnly
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-xs'
                : 'bg-white/[0.03] border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
            }`}
            title="Sembunyikan akun terindikasi bot/buzzer copypasta dari metrik & daftar sebutan"
          >
            <ShieldCheck className={`w-3.5 h-3.5 ${organicOnly ? 'text-emerald-400' : 'text-zinc-500'}`} />
            <span>{organicOnly ? 'Filter Organik: Aktif' : 'Filter Opini Organik'}</span>
          </button>
        )}

        {/* Quick Alert Bell */}
        {onNavigateToAlerts && (
          <button
            onClick={onNavigateToAlerts}
            className="p-2 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.08] text-zinc-300 hover:text-white transition-all relative cursor-pointer"
            title="Peringatan Dini"
            aria-label="Peringatan Dini"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50" />
          </button>
        )}

        {/* Date Window Segmented Control */}
        <div className="flex items-center bg-white/[0.03] border border-white/[0.08] rounded-xl p-0.5 text-xs shadow-xs">
          {[
            { label: '24 Jam', val: 1 },
            { label: '7 Hari', val: 7 },
            { label: '30 Hari', val: 30 },
          ].map((item) => (
            <button
              key={item.val}
              onClick={() => onChangeDays(item.val)}
              className={`px-3 py-1.5 rounded-lg transition-all text-xs font-semibold cursor-pointer ${
                days === item.val
                  ? 'bg-white text-zinc-950 shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Refresh Action */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-2 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.08] text-zinc-300 hover:text-white transition-all disabled:opacity-50 cursor-pointer"
          title="Segarkan Data Realtime"
          aria-label="Segarkan data realtime"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-zinc-400' : ''}`} />
        </button>

        {/* Compact Account & Logout Control (always accessible on desktop and narrow screens) */}
        <div className="flex items-center gap-2 pl-2 border-l border-white/10">
          <div className="hidden md:flex flex-col items-end leading-tight max-w-36">
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
            className="min-h-11 sm:min-h-9 px-3 rounded-xl border border-[#5e6575] bg-white/[0.03] hover:bg-rose-500/15 hover:border-rose-400/50 text-xs font-semibold text-[#f4f5f8] hover:text-[#fda4af] flex items-center gap-1.5 transition-colors motion-reduce:transition-none disabled:opacity-50"
          >
            {isLoggingOut ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">{isLoggingOut ? 'Keluar...' : 'Keluar'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
