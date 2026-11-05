import { Sun, Moon, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { CoverageInfo } from '@/lib/api';

interface TopbarProps {
  isDark: boolean;
  onToggleTheme: () => void;
  coverage?: CoverageInfo;
  onRefresh: () => void;
  isRefreshing: boolean;
  days: number;
  onChangeDays: (d: number) => void;
}

export function Topbar({
  isDark,
  onToggleTheme,
  coverage,
  onRefresh,
  isRefreshing,
  days,
  onChangeDays,
}: TopbarProps) {
  const formatSyncTime = (iso?: string | null) => {
    if (!iso) return 'Belum pernah sinkron';
    const date = new Date(iso);
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
  };

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30 px-6 py-3.5 flex flex-col md:flex-row items-center justify-between gap-4">
      {/* Coverage & Provenance Strip */}
      <div className="flex items-center flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300">
          <span className="text-slate-400">Workspace:</span>
          <span className="font-semibold text-slate-200">PulseScope Hub</span>
        </div>

        {coverage && (
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium ${
              coverage.partial_data
                ? 'bg-amber-950/40 border-amber-800/60 text-amber-300'
                : 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
            }`}>
              {coverage.partial_data ? (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>{coverage.connected_providers}/{coverage.total_configured_providers} Konektor Aktif</span>
            </div>

            <div className="text-slate-400 text-xs hidden lg:inline">
              Sinkron terakhir: <span className="text-slate-200">{formatSyncTime(coverage.last_successful_sync_at)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Controls & Actions */}
      <div className="flex items-center gap-3">
        {/* Date Range Selector */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
          {[
            { label: '7 Hari', val: 7 },
            { label: '14 Hari', val: 14 },
            { label: '30 Hari', val: 30 },
          ].map((item) => (
            <button
              key={item.val}
              onClick={() => onChangeDays(item.val)}
              className={`px-3 py-1 rounded-md transition-colors ${
                days === item.val
                  ? 'bg-indigo-600 text-white font-medium shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Live Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 transition-colors disabled:opacity-50"
          title="Sinkronkan data terbaru"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
          <span className="hidden sm:inline">Refresh Data</span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          aria-label="Ganti Tema Tampilan"
          className="p-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 transition-colors"
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
        </button>
      </div>
    </header>
  );
}
