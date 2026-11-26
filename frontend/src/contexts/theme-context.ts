import { createContext } from 'react';

export type ThemeMode = 'dark' | 'light';

export interface ChartThemeTokens {
  gridStroke: string;
  axisStroke: string;
  tickFill: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  tooltipMuted: string;
  goldStroke: string;
  posStroke: string;
  neuStroke: string;
  negStroke: string;
}

export interface ThemeContextValue {
  theme: ThemeMode;
  isDark: boolean;
  setTheme: (next: ThemeMode) => void;
  toggleTheme: () => void;
  chartTokens: ChartThemeTokens;
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
