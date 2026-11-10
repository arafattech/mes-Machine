/** Text colour for the amCharts-based charts: white on the dark themes, `light` otherwise. */
export function chartTextColor(isDark: boolean, light = '#556b82'): string {
  return isDark ? '#ffffff' : light;
}
