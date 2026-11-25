import {
  LayoutDashboard,
  Flame,
  MessageSquareText,
  ShieldAlert,
  Menu,
} from 'lucide-react';
import type { NavTab } from './Sidebar';

interface MobileBottomNavProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenMenu: () => void;
  isMenuOpen: boolean;
  hasSurge?: boolean;
}

const SECONDARY_TABS: NavTab[] = ['topics', 'alerts', 'sources'];

export function MobileBottomNav({
  currentTab,
  onSelectTab,
  onOpenMenu,
  isMenuOpen,
  hasSurge = false,
}: MobileBottomNavProps) {
  const isSecondaryActive = SECONDARY_TABS.includes(currentTab);

  const primaryItems: Array<{
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    showSurgeDot?: boolean;
  }> = [
    { id: 'overview', label: 'Ringkasan', icon: LayoutDashboard },
    { id: 'hot_issues', label: 'Isu Hangat', icon: Flame, showSurgeDot: hasSurge },
    { id: 'mentions', label: 'Sebutan', icon: MessageSquareText },
    { id: 'bot_radar', label: 'Buzzer', icon: ShieldAlert },
  ];

  return (
    <nav
      aria-label="Navigasi utama mobile"
      className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-white/[0.1] bg-[#0a0c12]/96 backdrop-blur-md pb-[env(safe-area-inset-bottom,0px)] select-none font-sans-ui"
    >
      <div className="grid grid-cols-5 items-stretch">
        {primaryItems.map((item) => {
          const Icon = item.icon;
          const isActive = !isMenuOpen && currentTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center gap-1 min-h-14 py-1.5 px-1 transition-colors active:bg-white/[0.08] ${
                isActive ? 'text-[#f4f5f8]' : 'text-[#a1a1aa] hover:text-[#f4f5f8]'
              }`}
            >
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-7 h-0.5 rounded-b-full bg-[#d4af37]"
                />
              )}
              <span className="relative flex items-center justify-center">
                <Icon
                  className={`w-5 h-5 ${
                    isActive
                      ? item.id === 'bot_radar'
                        ? 'text-rose-400'
                        : 'text-[#d4af37]'
                      : item.id === 'bot_radar'
                        ? 'text-rose-400/80'
                        : ''
                  }`}
                  aria-hidden="true"
                />
                {item.showSurgeDot && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-[#0a0c12]"
                  />
                )}
              </span>
              <span className={`text-[10.5px] leading-none truncate max-w-full ${isActive ? 'font-bold text-[#f4f5f8]' : 'font-medium'}`}>
                {item.label}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={onOpenMenu}
          aria-expanded={isMenuOpen}
          aria-controls="mobile-nav-drawer"
          className={`relative flex flex-col items-center justify-center gap-1 min-h-14 py-1.5 px-1 transition-colors active:bg-white/[0.08] ${
            isMenuOpen || isSecondaryActive
              ? 'text-[#f4f5f8]'
              : 'text-[#a1a1aa] hover:text-[#f4f5f8]'
          }`}
        >
          {(isMenuOpen || isSecondaryActive) && (
            <span
              aria-hidden="true"
              className="absolute top-0 left-1/2 -translate-x-1/2 w-7 h-0.5 rounded-b-full bg-[#d4af37]"
            />
          )}
          <Menu
            className={`w-5 h-5 ${isMenuOpen || isSecondaryActive ? 'text-[#d4af37]' : ''}`}
            aria-hidden="true"
          />
          <span className={`text-[10.5px] leading-none ${isMenuOpen || isSecondaryActive ? 'font-bold text-[#f4f5f8]' : 'font-medium'}`}>
            Menu
          </span>
        </button>
      </div>
    </nav>
  );
}
