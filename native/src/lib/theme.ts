import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';

// Colors mirror global.css variables exactly (Seeora 靛紫 + 真实深色)
export const THEME = {
  light: {
    background: 'hsl(240 33% 99%)',
    foreground: 'hsl(240 24% 12%)',
    card: 'hsl(0 0% 100%)',
    cardForeground: 'hsl(240 24% 12%)',
    popover: 'hsl(0 0% 100%)',
    popoverForeground: 'hsl(240 24% 12%)',
    primary: 'hsl(240 60% 60%)',
    primaryForeground: 'hsl(0 0% 100%)',
    secondary: 'hsl(240 16% 94%)',
    secondaryForeground: 'hsl(240 24% 12%)',
    muted: 'hsl(240 16% 95%)',
    mutedForeground: 'hsl(240 9% 46%)',
    accent: 'hsl(240 60% 95%)',
    accentForeground: 'hsl(240 60% 38%)',
    destructive: 'hsl(0 84% 60%)',
    destructiveForeground: 'hsl(0 0% 100%)',
    border: 'hsl(240 14% 91%)',
    input: 'hsl(240 14% 86%)',
    ring: 'hsl(240 60% 60%)',
    radius: '1rem',
  },
  dark: {
    background: 'hsl(0 0% 7%)',
    foreground: 'hsl(0 0% 96%)',
    card: 'hsl(0 0% 11%)',
    cardForeground: 'hsl(0 0% 96%)',
    popover: 'hsl(0 0% 11%)',
    popoverForeground: 'hsl(0 0% 96%)',
    primary: 'hsl(240 60% 64%)',
    primaryForeground: 'hsl(0 0% 100%)',
    secondary: 'hsl(0 0% 16%)',
    secondaryForeground: 'hsl(0 0% 96%)',
    muted: 'hsl(0 0% 16%)',
    mutedForeground: 'hsl(0 0% 62%)',
    accent: 'hsl(240 40% 22%)',
    accentForeground: 'hsl(240 80% 86%)',
    destructive: 'hsl(0 72% 51%)',
    destructiveForeground: 'hsl(0 0% 100%)',
    border: 'hsl(0 0% 18%)',
    input: 'hsl(0 0% 22%)',
    ring: 'hsl(240 60% 64%)',
    radius: '1rem',
  },
};

export const NAV_THEME: Record<'light' | 'dark', Theme> = {
  light: {
    ...DefaultTheme,
    colors: {
      background: THEME.light.background,
      border: THEME.light.border,
      card: THEME.light.card,
      notification: THEME.light.destructive,
      primary: THEME.light.primary,
      text: THEME.light.foreground,
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      background: THEME.dark.background,
      border: THEME.dark.border,
      card: THEME.dark.card,
      notification: THEME.dark.destructive,
      primary: THEME.dark.primary,
      text: THEME.dark.foreground,
    },
  },
};
