/**
 * Brand Guidelines — Intervals Coach
 *
 * Persona: Technical, highly analytical, objective, yet deeply motivating.
 * Tone:    Scientific, structured, performance-focused, crystal clear.
 *
 * Typography: Plus Jakarta Sans
 *   — Geometric sans-serif with tabular numerals for data-dense dashboards.
 *   — Hero KPI:      700 (Bold),     36–48px, orange     (text-orange)
 *   — Section heads: 600 (SemiBold), 18px,    teal        (text-teal)
 *   — Body copy:     400 (Regular),  14–16px, dark text   (text-text)
 *   — Muted labels:  500 (Medium),   11–12px, dark muted  (text-muted)
 *
 * Accessibility (WCAG AA):
 *   All text must meet minimum contrast ratios on their backgrounds.
 *   Raw brand teal (#2EC4B6) fails on white (2.78:1) — use semantic tokens:
 *     --text:       #0E2B28  body text, ~18:1 on white
 *     --text-muted: #2D5C56  secondary,  ~5.2:1 on white
 *     --teal:       #0D7A72  headings,   ~4.8:1 on white (light mode)
 *                   #2EC4B6  headings   (dark mode — vibrant on dark bg)
 *
 * Chat bubbles:
 *   User bubbles: orange background (#FF9F1C). White text on orange = ~2:1 contrast
 *   (low). Compensate with text-base + font-semibold (16px bold, WCAG large-text
 *   threshold). For future improvement consider dark text (#0E2B28) on orange
 *   which achieves ~9.4:1.
 *
 *   Assistant bubbles: bg-bg-assistant / text-text. Full WCAG AA compliant.
 *
 * Dashboard health metrics card:
 *   Layout: grid grid-cols-2 sm:grid-cols-4, gap-4, inside rounded-2xl card.
 *   Each metric tile: space-y-1 with three layers —
 *     1. Label:  text-[10px] font-semibold tracking-[0.12em] uppercase text-muted
 *     2. Value:  text-3xl font-bold tabular-nums text-orange or text-teal
 *                + trend arrow (↑↓→) text-sm font-semibold, teal=good orange=bad
 *     3. Unit:   text-xs text-muted (e.g. "ms", "bpm", "/100", "hours")
 *   Fallback pattern: when a field is null, fall back to the next-best available
 *   field (e.g. raw HRV ms when hrv_score absent). Never show "–" if any
 *   related value exists. Unavailable tiles render at opacity-40 with "not synced".
 *   Trend colors: higher-is-better → teal↑ orange↓; lower-is-better → teal↓ orange↑.
 *
 * Dark mode:
 *   All semantic tokens invert via CSS custom properties. Vibrant #2EC4B6 teal
 *   is used for headings on dark backgrounds (~4.5:1 on #0A1A19). Body text
 *   is #E8F9F8 (near-mint, high contrast on dark).
 */

export const brand = {
  persona: {
    tone: "Technical, highly analytical, objective, yet deeply motivating",
    voice: "Scientific, structured, performance-focused, crystal clear",
  },

  colors: {
    /** Primary brand accent — CTAs, KPI numbers, user chat bubbles */
    orange: "#FF9F1C",
    /** Secondary / warning — high workload, hover states */
    peach: "#FFBF69",
    /** Light mode page/card backgrounds */
    white: "#FFFFFF",
    /** Borders, assistant bubble backgrounds, subtle accents */
    mint: "#CBF3F0",
    /** Brand teal — use only decoratively or on dark surfaces */
    tealBrand: "#2EC4B6",
    /** Accessible teal for headings in light mode (~4.8:1 on white) */
    tealLight: "#0D7A72",
    /** Accessible body text in light mode (~18:1 on white) */
    textLight: "#0E2B28",
    /** Accessible muted text in light mode (~5.2:1 on white) */
    textMuted: "#2D5C56",
  },

  /** Tailwind-compatible inline style helpers */
  css: {
    heroKpi: { fontWeight: 700, fontSize: "42px", color: "#FF9F1C" },
    sectionHead: { fontWeight: 600, fontSize: "18px", color: "#0D7A72" },
    body: { fontWeight: 400, fontSize: "14px", color: "#0E2B28" },
    axisLabel: { fontWeight: 500, fontSize: "11px", color: "#2D5C56" },
    chatUser: { fontWeight: 600, fontSize: "16px", color: "#FFFFFF" }, // bold compensates for orange bg contrast
  },
} as const;
