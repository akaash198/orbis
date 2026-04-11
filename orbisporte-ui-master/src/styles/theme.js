/**
 * Orbisporte Theme — HARFIX Dark (Gold Edition) v1.0
 * Premium dark surfaces with gold signature accent.
 */

export const theme = {
  colors: {
    // ── LAYOUT STACK ───────────────────────────────────────────────────────────
    page:    '#0A0D14',   // Abyss — body backdrop
    panel:   '#111620',   // Sidebar / navbar base
    surface: '#161D2C',   // Raised cards / active panels
    overlay: '#1C2438',   // Modal scrim / hover tint
    inset:   '#0D1020',   // Input bg / table head / code blocks

    // ── PRIMARY BRAND ──────────────────────────────────────────────────────────
    primary: {
      main:     '#C9A520', // Gold — brand standard
      light:    '#E8C84A', // Text highlight / active state
      dark:     '#A88A18', // Hover / interaction
      contrast: '#0A0D14', // Text color on gold elements
    },

    // ── TEXT HIERARCHY ─────────────────────────────────────────────────────────
    text: {
      primary:   '#E2E8F5', // Headings / KPI numbers / active
      secondary: '#8B97AE', // Body / descriptions / row data
      tertiary:  '#4A5A72', // Timestamps / disabled / overlines
      gold:      '#E8C84A', // Links / active nav / highlights
      inverse:   '#0A0D14', // Used over brand gold surfaces
    },

    // ── BORDERS ────────────────────────────────────────────────────────────────
    border: {
      dim:      '#141A28', // Barely there — within panels
      subtle:   '#1E2638', // Standard divider
      default:  '#273047', // Inputs / table borders
      strong:   '#344060', // Hover / focus adjacent
      accent:   '#C9A520', // Focused / active gold
    },

    // ── SEMANTIC STATUS ────────────────────────────────────────────────────────
    status: {
      success:   '#3DBE7E',
      warning:   '#E8934A',
      error:     '#E05656',
      info:      '#6BBCD4',
      purple:    '#9A8CE8',
    },

    // ── DATA CHARTING ──────────────────────────────────────────────────────────
    chart: [
      '#C9A520', // Gold
      '#6BBCD4', // Cyan
      '#3DBE7E', // Teal
      '#9A8CE8', // Purple
      '#E87A5A', // Coral
      '#E8934A', // Amber
    ],
  },

  // ── 8PX GRID SPACING ─────────────────────────────────────────────────────────
  spacing: {
    1:  '4px',   // 0.25rem
    2:  '8px',   // 0.5rem
    3:  '12px',  // 0.75rem
    4:  '16px',  // 1rem
    5:  '20px',  // 1.25rem
    6:  '24px',  // 1.5rem
    8:  '32px',  // 2rem
    10: '40px',  // 2.5rem
    12: '48px',  // 3rem
    16: '64px',  // 4rem
    20: '80px',  // 5rem
  },

  // ── RADIUS SYSTEM ───────────────────────────────────────────────────────────
  radius: {
    xs:   '3px',    // Micro — internal badge / chip
    sm:   '5px',    // Small — button / input
    md:   '7px',    // Standard — Workhorse UI
    lg:   '10px',   // Large — Cards / modules
    xl:   '14px',   // Extra Large — Modals / sheets
    pill: '9999px', // Circular — Status badges / avatars
  },

  shadows: {
    card: '0 4px 12px rgba(0,0,0,0.40)',
    modal: '0 32px 64px rgba(0,0,0,0.85)',
    glowGold: '0 0 20px rgba(201,165,32,0.25)',
    ringGold: '0 0 0 3px rgba(201,165,32,0.30)',
  },

  typography: {
    fontSans: '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontMono: '"DM Mono", "SF Mono", monospace',
  },

  transitions: {
    smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
};

export default theme;
