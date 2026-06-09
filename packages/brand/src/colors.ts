/**
 * Chart color utilities
 *
 * Recharts SVG elements don't automatically inherit CSS custom properties,
 * so we need to read them at runtime or provide static values.
 *
 * This helper provides theme-aware colors for charts by reading CSS variables
 * from the document root, which allows proper dark/light mode support.
 */

export function getChartColors() {
  // In SSR context, return light mode defaults
  if (typeof window === "undefined") {
    return {
      teal: "#0D7A72",
      orange: "#E08800",
      orangeBright: "#FF9F1C",
      peach: "#FFBF69",
      text: "#0E2B28",
      muted: "#2D5C56",
      border: "#CBF3F0",
      bg: "#FFFFFF",
      bgCard: "#F8FFFE",
      bgAssistant: "#EAFAF9",
    };
  }

  // In client context, read computed CSS variables
  const root = document.documentElement;
  const style = getComputedStyle(root);

  return {
    teal: style.getPropertyValue("--teal").trim() || "#0D7A72",
    orange: style.getPropertyValue("--orange").trim() || "#E08800",
    orangeBright: style.getPropertyValue("--orange-bright").trim() || "#FF9F1C",
    peach: style.getPropertyValue("--peach").trim() || "#FFBF69",
    text: style.getPropertyValue("--text").trim() || "#0E2B28",
    muted: style.getPropertyValue("--text-muted").trim() || "#2D5C56",
    border: style.getPropertyValue("--border").trim() || "#CBF3F0",
    bg: style.getPropertyValue("--bg").trim() || "#FFFFFF",
    bgCard: style.getPropertyValue("--bg-card").trim() || "#F8FFFE",
    bgAssistant: style.getPropertyValue("--bg-assistant").trim() || "#EAFAF9",
  };
}

/**
 * Static brand colors for charts
 * Use when dynamic theme switching isn't needed
 */
export const chartColors = {
  light: {
    teal: "#0D7A72",
    orange: "#E08800",
    orangeBright: "#FF9F1C",
    peach: "#FFBF69",
    text: "#0E2B28",
    muted: "#2D5C56",
    border: "#CBF3F0",
  },
  dark: {
    teal: "#2EC4B6",
    orange: "#FF9F1C",
    orangeBright: "#FF9F1C",
    peach: "#FFBF69",
    text: "#E8F9F8",
    muted: "rgba(203, 243, 240, 0.65)",
    border: "#1E3D3A",
  },
} as const;
