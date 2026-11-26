import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard,
  MessageSquareText,
  Target,
  BellRing,
  Radio,
  FileSpreadsheet,
  Loader2,
  Flame,
  ShieldAlert,
  LogOut,
  X,
  PanelLeftOpen,
  PanelLeftClose,
} from 'lucide-react';

export type NavTab = 'overview' | 'hot_issues' | 'bot_radar' | 'mentions' | 'topics' | 'alerts' | 'sources';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onExportCsv: () => void;
  isExporting: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  hasSurge?: boolean;
}

interface NavEntry {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export function Sidebar({
  currentTab,
  onSelectTab,
  onExportCsv,
  isExporting,
  isExpanded = false,
  onToggleExpand,
  isMobileOpen = false,
  onCloseMobile,
  hasSurge = false,
}: SidebarProps) {
  const { user, activeWorkspace, workspaces, switchWorkspace, logout, isLoggingOut } = useAuth();

  // Escape closes mobile drawer and locks background scroll while open (R-32)
  useEffect(() => {
    if (!isMobileOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseMobile?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileOpen, onCloseMobile]);

  const operationalNav: NavEntry[] = [
    { id: 'overview', label: 'Ruang Intelijen', icon: LayoutDashboard },
    { id: 'hot_issues', label: 'Radar Isu Hangat', icon: Flame, badge: hasSurge ? 'Lonjakan' : undefined },
    { id: 'bot_radar', label: 'Radar Buzzer & Bot', icon: ShieldAlert },
    { id: 'mentions', label: 'Eksplorasi Sebutan', icon: MessageSquareText },
    { id: 'topics', label: 'Program Prioritas', icon: Target },
  ];

  const systemNav: NavEntry[] = [
    { id: 'alerts', label: 'Sinyal & Peringatan', icon: BellRing },
    { id: 'sources', label: 'Konektor Sumber Data', icon: Radio },
  ];

  const handleNavClick = (tab: NavTab) => {
    onSelectTab(tab);
    onCloseMobile?.();
  };

  const userInitial = (user?.name?.trim()?.[0] || 'O').toUpperCase();

  const renderNavList = (items: NavEntry[], label: string, showLabels: boolean) => (
    <nav aria-label={label} className="space-y-1.5">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = currentTab === item.id;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => handleNavClick(item.id)}
            aria-current={isActive ? 'page' : undefined}
            aria-label={!showLabels ? item.label : undefined}
            title={!showLabels ? item.label : undefined}
            className={`group relative w-full min-h-11 rounded-2xl flex items-center transition-colors duration-150 motion-reduce:transition-none ${
              showLabels ? 'justify-between px-3.5 py-2.5 gap-3' : 'justify-center px-0 py-2.5'
            } ${
              isActive
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-semibold border border-[var(--border-medium)] shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)] border border-transparent'
            }`}
          >
            {isActive && (
              <span
                aria-hidden="true"
                className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-[var(--accent-gold)]"
              />
            )}

            <span className={`flex items-center min-w-0 ${showLabels ? 'gap-3' : ''}`}>
              <Icon
                className={`w-[19px] h-[19px] shrink-0 transition-colors ${
                  isActive
                    ? 'text-[var(--accent-gold-text)]'
                    : item.id === 'hot_issues' && hasSurge
                      ? 'text-[var(--sentiment-neg)]'
                      : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'
                }`}
                aria-hidden="true"
              />
              {showLabels && <span className="text-[13px] truncate">{item.label}</span>}
            </span>

            {showLabels && item.badge && (
              <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-[var(--sentiment-neg-subtle)] text-[var(--sentiment-neg)] border border-[var(--sentiment-neg-border)] shrink-0">
                {item.badge}
              </span>
            )}

            {!showLabels && item.badge && (
              <span
                aria-hidden="true"
                className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-[var(--sentiment-neg)] ring-2 ring-[var(--bg-rail)]"
              />
            )}
          </button>
        );
      })}
    </nav>
  );

  const renderSidebarBody = (showLabels: boolean, isDrawer: boolean) => (
    <>
      <div className="flex flex-col">
        {/* Brand Anchor */}
        <div
          className={`flex items-center border-b border-[var(--border-subtle)] ${
            showLabels ? 'justify-between px-4 py-4 gap-3' : 'flex-col justify-center py-4 gap-3 px-2'
          }`}
        >
          <button
            type="button"
            onClick={() => handleNavClick('overview')}
            aria-label="Ke Ruang Intelijen TRINETRA"
            className="flex items-center gap-3 min-w-0 text-left rounded-xl focus-visible:outline-2"
          >
            <span className="w-9 h-9 rounded-full bg-[#181614] dark:bg-transparent border border-[var(--accent-gold-border)] dark:border-transparent flex items-center justify-center shrink-0">
              <img
                src="/brand/trinetra-logo.svg"
                alt="TRINETRA"
                width={28}
                height={28}
                fetchPriority="high"
                className="w-7 h-7 object-contain shrink-0"
              />
            </span>
            {showLabels && (
              <div className="min-w-0">
                <div className="font-bold text-[15px] tracking-[0.06em] text-[var(--text-primary)] leading-tight">
                  TRINETRA
                </div>
                <div className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                  Intelijen Wacana Publik
                </div>
              </div>
            )}
          </button>

          {isDrawer ? (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Tutup menu navigasi"
              className="min-w-11 min-h-11 -mr-1.5 flex items-center justify-center rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)] transition-colors shrink-0"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          ) : (
            onToggleExpand && (
              <button
                type="button"
                onClick={onToggleExpand}
                aria-expanded={isExpanded}
                aria-label={isExpanded ? 'Ciutkan rel navigasi' : 'Perluas rel navigasi'}
                title={isExpanded ? 'Ciutkan sidebar' : 'Perluas sidebar'}
                className="min-w-9 min-h-9 flex items-center justify-center rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)] transition-colors shrink-0"
              >
                {isExpanded ? (
                  <PanelLeftClose className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <PanelLeftOpen className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            )
          )}
        </div>

        {/* Navigation Groups */}
        <div className={`py-4 space-y-5 ${showLabels ? 'px-3' : 'px-2.5'}`}>
          <div>
            {showLabels && (
              <div className="px-3.5 pb-2 text-[11px] font-semibold text-[var(--text-muted)]">
                Operasional
              </div>
            )}
            {renderNavList(operationalNav, 'Navigasi Operasional', showLabels)}
          </div>

          <div className="border-t border-[var(--border-subtle)] pt-4">
            {showLabels && (
              <div className="px-3.5 pb-2 text-[11px] font-semibold text-[var(--text-muted)]">
                Sistem &amp; Sumber
              </div>
            )}
            {renderNavList(systemNav, 'Navigasi Sistem', showLabels)}
          </div>
        </div>
      </div>

      {/* Bottom Dock: Export, Workspace & Operator */}
      <div className={`border-t border-[var(--border-subtle)] py-3.5 space-y-3 ${showLabels ? 'px-3.5' : 'px-2.5'}`}>
        <button
          type="button"
          onClick={() => {
            onExportCsv();
            onCloseMobile?.();
          }}
          disabled={isExporting}
          aria-label="Unduh Laporan CSV"
          title="Unduh Laporan CSV"
          className={`w-full min-h-11 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] hover:border-[var(--border-medium)] text-[var(--text-primary)] text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${
            showLabels ? 'px-3.5' : 'px-0'
          }`}
        >
          {isExporting ? (
            <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-gold-text)] shrink-0" aria-hidden="true" />
          ) : (
            <FileSpreadsheet className="w-4 h-4 text-[var(--text-secondary)] shrink-0" aria-hidden="true" />
          )}
          {showLabels && <span>{isExporting ? 'Mengekspor...' : 'Unduh Laporan CSV'}</span>}
        </button>

        {showLabels ? (
          <div className="pt-2 space-y-2.5 border-t border-[var(--border-subtle)]">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                <span>Workspace</span>
                {activeWorkspace?.role && (
                  <span className="px-1.5 py-0.5 rounded-md bg-[var(--accent-gold-subtle)] text-[var(--accent-gold-text)] border border-[var(--accent-gold-border)] text-[10px] font-semibold capitalize">
                    {activeWorkspace.role}
                  </span>
                )}
              </div>

              {workspaces.length > 1 ? (
                <div>
                  <label
                    htmlFor={isDrawer ? 'drawer-workspace-select' : 'sidebar-workspace-select'}
                    className="sr-only"
                  >
                    Pilih workspace aktif
                  </label>
                  <select
                    id={isDrawer ? 'drawer-workspace-select' : 'sidebar-workspace-select'}
                    value={activeWorkspace?.id ?? ''}
                    onChange={(e) => {
                      switchWorkspace(Number(e.target.value));
                      onCloseMobile?.();
                    }}
                    className="input-field w-full min-h-11 px-3 py-2 text-sm sm:text-xs"
                  >
                    {workspaces.map((ws) => (
                      <option key={ws.id} value={ws.id}>
                        {ws.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
                  {activeWorkspace?.name ?? 'Workspace Aktif'}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  aria-hidden="true"
                  className="w-8 h-8 rounded-full bg-[var(--accent-gold-subtle)] border border-[var(--accent-gold-border)] text-[var(--accent-gold-text)] text-xs font-bold flex items-center justify-center shrink-0"
                >
                  {userInitial}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
                    {user?.name ?? 'Operator'}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] truncate">
                    {user?.email ?? ''}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void logout()}
                disabled={isLoggingOut}
                aria-label="Keluar dari konsol"
                title="Keluar dari konsol"
                className="min-w-10 min-h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--sentiment-neg-subtle)] hover:border-[var(--sentiment-neg-border)] text-[var(--text-secondary)] hover:text-[var(--sentiment-neg)] flex items-center justify-center shrink-0 transition-colors disabled:opacity-50"
              >
                {isLoggingOut ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <LogOut className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 pt-1 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={onToggleExpand}
              aria-label={`Profil ${user?.name ?? 'Operator'} dan pengaturan workspace`}
              title={`${user?.name ?? 'Operator'} (${activeWorkspace?.name ?? 'Workspace'})`}
              className="w-10 h-10 rounded-full bg-[var(--accent-gold-subtle)] border border-[var(--accent-gold-border)] text-[var(--accent-gold-text)] text-xs font-bold flex items-center justify-center hover:bg-[var(--accent-gold)] hover:text-[var(--accent-gold-ink)] transition-colors"
            >
              {userInitial}
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              disabled={isLoggingOut}
              aria-label="Keluar dari konsol"
              title="Keluar dari konsol"
              className="min-w-10 min-h-10 rounded-xl text-[var(--text-secondary)] hover:text-[var(--sentiment-neg)] hover:bg-[var(--sentiment-neg-subtle)] flex items-center justify-center transition-colors disabled:opacity-50"
            >
              {isLoggingOut ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <LogOut className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Slim Expandable Rail (lg and above) */}
      <aside
        aria-label="Navigasi utama"
        className={`hidden lg:flex sticky top-0 h-dvh overflow-y-auto border-r border-[var(--border-subtle)] bg-[var(--bg-rail)] flex-col justify-between shrink-0 select-none transition-[width] duration-200 ease-out motion-reduce:transition-none font-sans-ui ${
          isExpanded ? 'w-[252px]' : 'w-[76px]'
        }`}
      >
        {renderSidebarBody(isExpanded, false)}
      </aside>

      {/* Mobile & Tablet Slide-Over Navigation Drawer (below lg) */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-[var(--bg-backdrop)] backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside
            id="mobile-nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menu navigasi TRINETRA"
            className="relative z-10 w-[min(86vw,310px)] h-dvh overflow-y-auto overscroll-y-contain border-r border-[var(--border-medium)] bg-[var(--bg-rail)] flex flex-col justify-between select-none font-sans-ui shadow-[var(--shadow-elevated)] pb-[env(safe-area-inset-bottom,0px)]"
          >
            {renderSidebarBody(true, true)}
          </aside>
        </div>
      )}
    </>
  );
}
