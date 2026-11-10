import {
  attachThemeLoaded,
  detachThemeLoaded,
} from '@ui5/webcomponents-base/dist/theming/ThemeLoaded.js';

export interface ChartThemeColors {
  text: string;
  label: string;
  grid: string;
  surface: string;
}

const FALLBACKS: ChartThemeColors = {
  text: '#1d2d3e',
  label: '#64748b',
  grid: '#d9d9d9',
  surface: '#ffffff',
};

function readCssVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

/** Resolves the active UI5 theme's colours so canvas / SVG charts can follow light and dark themes. */
export function readChartThemeColors(): ChartThemeColors {
  return {
    text: readCssVar('--sapTextColor', FALLBACKS.text),
    label: readCssVar('--sapContent_LabelColor', FALLBACKS.label),
    grid: readCssVar('--sapList_BorderColor', FALLBACKS.grid),
    surface: readCssVar('--sapGroup_ContentBackground', FALLBACKS.surface),
  };
}

/**
 * Invokes `listener` once the UI5 theme CSS of a theme switch has been applied
 * (CSS variables are only valid from that moment). Returns the unsubscribe function.
 */
export function onChartThemeChange(listener: () => void): () => void {
  const handler = () => listener();
  attachThemeLoaded(handler);
  return () => detachThemeLoaded(handler);
}
