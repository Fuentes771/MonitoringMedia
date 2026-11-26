import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ThemeContext, type ChartThemeTokens, type ThemeMode } from './theme-context';

const THEME_STORAGE_KEY = 'trinetra_theme';

function readInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
  } catch {
    // ignore storage access errors
  }
  return 'dark';
}

const DARK_CHART_TOKENS: ChartThemeTokens = {
  gridStroke: 'rgba(245, 242, 236, 0.07)',
  axisStroke: 'rgba(245, 242, 236, 0.14)',
  tickFill: '#A39D90',
  tooltipBg: '#0E0D0C',
  tooltipBorder: 'rgba(245, 242, 236, 0.16)',
  tooltipText: '#F5F2EC',
  tooltipMuted: '#B8B2A6',
  goldStroke: '#DFB84F',
  posStroke: '#34D399',
  neuStroke: '#A8A29E',
  negStroke: '#FB7185',
};

const LIGHT_CHART_TOKENS: ChartThemeTokens = {
  gridStroke: 'rgba(24, 22, 20, 0.08)',
  axisStroke: 'rgba(24, 22, 20, 0.16)',
  tickFill: '#666057',
  tooltipBg: '#181614',
  tooltipBorder: 'rgba(24, 22, 20, 0.2)',
  tooltipText: '#F5F2EC',
  tooltipMuted: '#B8B2A6',
  goldStroke: '#9E7818',
  posStroke: '#047857',
  neuStroke: '#78716C',
  negStroke: '#BE123C',
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(readInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    root.classList.add(theme);
    root.dataset.theme = theme;
    root.style.colorScheme = theme;

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'dark' ? '#141311' : '#F6F3EE');
    }

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore storage write errors
    }
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === 'dark',
      setTheme: (next: ThemeMode) => setThemeState(next),
      toggleTheme: () => setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark')),
      chartTokens: theme === 'dark' ? DARK_CHART_TOKENS : LIGHT_CHART_TOKENS,
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
