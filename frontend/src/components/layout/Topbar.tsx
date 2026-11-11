import { RefreshCw, Radio, Bell, ChevronRight } from 'lucide-react';
import { CoverageInfo } from '@/lib/api';
import { NavTab } from './Sidebar';

interface TopbarProps {
  currentTab?: NavTab;
  coverage?: CoverageInfo;
  onRefresh: () => void;
  isRefreshing: boolean;
  days: number;
  onChangeDays: (d: number) => void;
  onNavigateToAlerts?: () => void;
}

export function Topbar({
  currentTab = 'overview',
  coverage,
  onRefresh,
  isRefreshing,
  days,
  onChangeDays,
  onNavigateToAlerts,
}: TopbarProps) {
  const getTabLabel = (tab: NavTab) => {
    switch (tab) {
      case 'overview':
        return 'Ruang Intelijen';
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

      {/* Date Switchers, Alert Bell & Actions */}
      <div className="flex items-center gap-2.5">
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
      </div>
    </header>
  );
}
