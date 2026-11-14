import { useQuery } from '@tanstack/react-query';
import { api, HotIssuesRadarData } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard,
  MessageSquareText,
  Target,
  BellRing,
  Radio,
  FileSpreadsheet,
  Loader2,
  Search,
  Activity,
  Flame,
  ShieldAlert,
  LogOut,
} from 'lucide-react';

export type NavTab = 'overview' | 'hot_issues' | 'bot_radar' | 'mentions' | 'topics' | 'alerts' | 'sources';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onExportCsv: () => void;
  isExporting: boolean;
}

export function Sidebar({ currentTab, onSelectTab, onExportCsv, isExporting }: SidebarProps) {
  const { user, activeWorkspace, workspaces, switchWorkspace, logout, isLoggingOut } = useAuth();
  const workspaceId = activeWorkspace?.id;

  const { data: hotIssuesData } = useQuery({
    queryKey: ['hot-issues-radar', workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const res = await api.get<{ data: HotIssuesRadarData }>('/hot-issues', {
        params: { workspace_id: workspaceId },
      });
      return res.data.data;
    },
    refetchInterval: 60000,
  });

  const hasSurge = (hotIssuesData?.surging_count ?? 0) > 0;

  const operationalNav: Array<{ id: NavTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: string }> = [
    { id: 'overview', label: 'Ruang Intelijen', icon: LayoutDashboard },
    { id: 'hot_issues', label: 'Radar Isu Hangat', icon: Flame, badge: hasSurge ? 'SURGE' : undefined },
    { id: 'bot_radar', label: 'Radar Buzzer & Bot', icon: ShieldAlert },
    { id: 'mentions', label: 'Eksplorasi Sebutan', icon: MessageSquareText },
    { id: 'topics', label: 'Program Prioritas', icon: Target },
  ];

  const systemNav: Array<{ id: NavTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: string }> = [
    { id: 'alerts', label: 'Sinyal & Peringatan', icon: BellRing },
    { id: 'sources', label: 'Konektor Sumber Data', icon: Radio },
  ];

  return (
    <aside className="w-68 border-r border-white/[0.08] bg-[#0a0c12] flex flex-col justify-between shrink-0 select-none transition-colors font-sans-ui">
      <div>
        {/* Brand Header with Transparent Borderless Logo Mark */}
        <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Borderless Transparent Vector Logo Mark (No Box / No Solid Background) */}
            <div className="w-9 h-9 flex items-center justify-center shrink-0">
              <img
                src="/brand/trinetra-logo.svg"
                alt="TRINETRA Sacred Eye Logo"
                className="w-full h-full object-contain filter drop-shadow-[0_0_12px_rgba(212,175,55,0.45)] transition-transform duration-300 hover:scale-110"
              />
            </div>

            <div>
              <div className="font-extrabold text-white text-[15px] tracking-wider flex items-center gap-1.5">
                <span className="bg-gradient-to-r from-white via-zinc-200 to-amber-200 bg-clip-text text-transparent">TRINETRA</span>
                <span className="text-[8.5px] font-mono-code px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold tracking-normal">
                  INTEL
                </span>
              </div>
              <div className="text-[10px] text-zinc-400 font-normal tracking-tight">
                Public Discourse Intelligence
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[10px] font-medium font-mono-code">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>LIVE</span>
          </div>
        </div>

        {/* Global Command / Quick Search Launcher */}
        <div className="px-3 pt-3.5 pb-1">
          <button
            onClick={() => onSelectTab('mentions')}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.18] hover:bg-white/[0.05] transition-all text-xs text-zinc-400 hover:text-zinc-200 group cursor-pointer shadow-xs"
          >
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-zinc-400 group-hover:text-amber-400 transition-colors" />
              <span className="text-[11px]">Cari sebutan / isu...</span>
            </div>
            <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.1] text-[10px] font-mono-code text-zinc-400">
              Ctrl+K
            </kbd>
          </button>
        </div>

        {/* SECTION 1: INTELIJEN OPERASIONAL */}
        <div className="px-5 pt-4 pb-1 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase font-mono-code">
          Intelijen Operasional
        </div>
        <nav className="px-3 space-y-1">
          {operationalNav.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white/[0.08] text-white font-semibold border border-white/[0.14] shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-3 truncate">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      item.id === 'hot_issues'
                        ? 'text-amber-400'
                        : item.id === 'bot_radar'
                        ? isActive
                          ? 'text-rose-400'
                          : 'text-rose-400/80'
                        : isActive
                        ? 'text-amber-400'
                        : 'text-zinc-400'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {item.badge && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono-code font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
                      {item.badge}
                    </span>
                  )}
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400/40" />
                  )}
                </div>
              </button>
            );
          })}
        </nav>

        {/* SECTION 2: SISTEM & RISIKO */}
        <div className="px-5 pt-5 pb-1 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase font-mono-code">
          Sistem &amp; Risiko
        </div>
        <nav className="px-3 space-y-1">
          {systemNav.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white/[0.08] text-white font-semibold border border-white/[0.14] shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-3 truncate">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      item.id === 'hot_issues'
                        ? 'text-amber-400'
                        : item.id === 'bot_radar'
                        ? isActive
                          ? 'text-rose-400'
                          : 'text-rose-400/80'
                        : isActive
                        ? 'text-amber-400'
                        : 'text-zinc-400'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {item.badge && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono-code font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
                      {item.badge}
                    </span>
                  )}
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400/40" />
                  )}
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Area: Live Telemetry Mini Dock & Profile */}
      <div className="p-4 border-t border-white/[0.08] space-y-3 bg-[#0a0c12]">
        {/* Mini Live Telemetry Dock */}
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2 text-xs">
          <div className="flex items-center justify-between text-[10px] font-mono-code text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3 h-3 text-amber-400" />
              <span>Status Telemetri</span>
            </span>
            <span className="text-emerald-400 font-semibold">99.8%</span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] text-zinc-400">Sentimen Terkendali</span>
            <span className="font-mono-code font-bold text-white text-[11px]">78% Kondusif</span>
          </div>

          <div className="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-amber-400 to-emerald-500 w-[78%] rounded-full" />
          </div>
        </div>

        {/* CSV Export Action */}
        <button
          onClick={onExportCsv}
          disabled={isExporting}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/[0.18] text-zinc-200 hover:text-white transition-all disabled:opacity-50 shadow-xs cursor-pointer"
        >
          {isExporting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
              <span>Mengekspor data...</span>
            </>
          ) : (
            <>
              <FileSpreadsheet className="w-3.5 h-3.5 text-zinc-400" />
              <span>Unduh Laporan CSV</span>
            </>
          )}
        </button>

        {/* Active Workspace, Operator Profile & Logout */}
        <div className="pt-3 space-y-2.5 border-t border-white/[0.06]">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-mono-code text-[#9da3ae]">
              <span>WORKSPACE AKTIF</span>
              {activeWorkspace?.role && (
                <span className="uppercase px-1.5 py-0.5 rounded bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/30 font-semibold">
                  {activeWorkspace.role}
                </span>
              )}
            </div>

            {workspaces.length > 1 ? (
              <div>
                <label htmlFor="sidebar-workspace-select" className="sr-only">
                  Pilih workspace aktif
                </label>
                <select
                  id="sidebar-workspace-select"
                  value={activeWorkspace?.id ?? ''}
                  onChange={(e) => switchWorkspace(Number(e.target.value))}
                  className="w-full min-h-11 rounded-lg bg-[#141822] border border-[#5e6575] px-2.5 py-2 text-xs text-[#f4f5f8] focus:outline-none focus:border-[#d4af37]"
                >
                  {workspaces.map((ws) => (
                    <option key={ws.id} value={ws.id}>
                      {ws.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-[#f4f5f8] font-medium truncate">
                <img
                  src="/brand/trinetra-logo.svg"
                  alt=""
                  aria-hidden="true"
                  width={16}
                  height={16}
                  className="w-4 h-4 object-contain shrink-0"
                />
                <span className="truncate">{activeWorkspace?.name ?? 'Workspace'}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-[#f4f5f8] truncate">
                {user?.name ?? 'Operator'}
              </div>
              <div className="text-[11px] text-[#9da3ae] truncate">
                {user?.email ?? ''}
              </div>
            </div>

            <button
              type="button"
              onClick={() => void logout()}
              disabled={isLoggingOut}
              aria-label="Keluar dari konsol"
              className="min-h-11 px-3 rounded-xl border border-[#5e6575] bg-white/[0.04] hover:bg-rose-500/15 hover:border-rose-400/50 text-xs font-semibold text-[#f4f5f8] hover:text-[#fda4af] flex items-center gap-1.5 shrink-0 transition-colors motion-reduce:transition-none disabled:opacity-50"
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
    </aside>
  );
}
