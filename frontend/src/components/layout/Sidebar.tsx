import {
  LayoutDashboard,
  MessageSquareText,
  Target,
  BellRing,
  Radio,
  FileSpreadsheet
} from 'lucide-react';

export type NavTab = 'overview' | 'mentions' | 'topics' | 'alerts' | 'sources';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onExportCsv: () => void;
  isExporting: boolean;
}

export function Sidebar({ currentTab, onSelectTab, onExportCsv, isExporting }: SidebarProps) {
  const navItems: Array<{ id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'overview', label: 'Ringkasan', icon: LayoutDashboard },
    { id: 'mentions', label: 'Eksplorasi Mention', icon: MessageSquareText },
    { id: 'topics', label: 'Topik Monitor', icon: Target },
    { id: 'alerts', label: 'Alert & Isu', icon: BellRing },
    { id: 'sources', label: 'Sumber Data', icon: Radio },
  ];

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-950 flex flex-col justify-between p-4 shrink-0">
      <div>
        {/* Brand Logo & Tagline */}
        <div className="flex items-center gap-3 px-2 py-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black tracking-tight text-sm shadow-md shadow-indigo-600/20">
            PS
          </div>
          <div>
            <div className="font-bold text-white text-base tracking-tight leading-tight">
              PulseScope
            </div>
            <div className="text-[11px] text-slate-400 font-medium">
              Social Listening Hub
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/20 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer / Quick Actions */}
      <div className="space-y-3 pt-4 border-t border-slate-800/80">
        <button
          onClick={onExportCsv}
          disabled={isExporting}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-slate-700 bg-slate-900/80 hover:bg-slate-850 text-slate-300 transition-colors disabled:opacity-50"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
          <span>{isExporting ? 'Mengekspor CSV...' : 'Ekspor Laporan CSV'}</span>
        </button>

        <div className="px-2 text-[11px] text-slate-500 leading-normal">
          <div>Bahasa: Indonesia (ID)</div>
          <div>Zona: Asia/Jakarta (WIB)</div>
        </div>
      </div>
    </aside>
  );
}
