/**
 * OrbisPorté Theme — Dark Aurora Design System
 * Deep space aesthetic with electric blue aurora accents
 *   • App background  : #04060f (near-black)
 *   • Cards           : rgba(255,255,255,0.05) glassmorphism
 *   • Sidebar         : deep royal-blue gradient (#0f2569 → #1a4fd8)
 *   • Primary         : #3B82F6 / #60a5fa (aurora blue)
 *   • Headings        : rgba(255,255,255,0.9)
 *   • Body text       : rgba(255,255,255,0.9)
 */

export const theme = {
  colors: {
    // Primary — aurora blue
    primary: {
      main:       '#3B82F6',
      light:      '#60A5FA',
      dark:       '#2563EB',
      navy:       '#1e3a8a',
      cyan:       '#06B6D4',
      contrast:   '#ffffff',
      gradient:   'linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)',
      gradient3D: 'linear-gradient(145deg, #60A5FA 0%, #3B82F6 50%, #2563EB 100%)',
    },

    // Secondary — medium blue
    secondary: {
      main:       '#3b82f6',
      light:      '#60a5fa',
      dark:       '#2563eb',
      contrast:   '#ffffff',
      gradient:   'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
      gradient3D: 'linear-gradient(145deg, #60a5fa 0%, #3b82f6 50%, #2563eb 100%)',
    },

    // Success — green
    success: {
      main:       '#10b981',
      light:      '#34d399',
      dark:       '#059669',
      gradient:   'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      gradient3D: 'linear-gradient(145deg, #34d399 0%, #10b981 50%, #059669 100%)',
    },

    // UI Colors — driven by CSS variables (dark/light via [data-theme] on <html>)
    ui: {
      background:      'var(--t-bg)',
      backgroundSolid: 'var(--t-bg)',
      backgroundLight: 'var(--t-bg-light)',
      backgroundDark:  'var(--t-bg-dark)',
      heroBackground:  'var(--t-hero-bg)',

      // Cards — glassmorphism
      card:         'var(--t-card)',
      cardHover:    'var(--t-card-hover)',
      cardElevated: 'var(--t-card-elevated)',
      cardGradient: 'var(--t-card-gradient)',
      cardGlow:     'linear-gradient(145deg, rgba(59,130,246,0.08) 0%, rgba(6,182,212,0.05) 100%)',

      // Borders
      border:      'var(--t-border)',
      borderLight: 'var(--t-border-light)',
      borderGlow:  'rgba(59,130,246,0.5)',

      // Hover / active
      hover:      'var(--t-hover)',
      hoverDark:  'var(--t-hover-dark)',
      active:     'rgba(59,130,246,0.15)',
      activeDark: 'rgba(59,130,246,0.25)',

      // Sidebar — deep space aurora (always dark — brand identity)
      sidebar:       'linear-gradient(160deg, #04060f 0%, #060d1f 30%, #080e22 60%, #050b18 100%)',
      sidebarSolid:  '#04060f',
      sidebarDark:   '#020408',
      sidebarHover:  'rgba(59,130,246,0.12)',
      sidebarActive: 'rgba(59,130,246,0.22)',
      sidebarGlow:   'radial-gradient(circle at 20% 20%, rgba(59,130,246,0.2) 0%, transparent 70%)',

      // Glass
      glass:      'var(--t-glass)',
      glassLight: 'var(--t-glass-light)',
      glassDark:  'var(--t-glass-dark)',
      glassBlur:  'blur(20px)',
      overlay:    'var(--t-overlay)',
    },

    // Text colors — driven by CSS variables
    text: {
      primary:   'var(--t-text)',
      secondary: 'var(--t-text-sub)',
      tertiary:  'var(--t-text-ter)',
      hint:      'var(--t-text-hint)',
      disabled:  'var(--t-text-dis)',
      link:      '#60a5fa',
      linkHover: '#93c5fd',

      // Sidebar text — white on deep blue (always)
      sidebarPrimary:   '#ffffff',
      sidebarSecondary: 'rgba(255,255,255,0.88)',
      sidebarActive:    '#ffffff',
    },

    // Status
    status: {
      success:           '#10b981',
      successLight:      'rgba(16,185,129,0.15)',
      successDark:       '#059669',
      successGradient:   'linear-gradient(135deg, #34d399 0%, #10b981 100%)',

      warning:           '#f59e0b',
      warningLight:      'rgba(245,158,11,0.15)',
      warningDark:       '#d97706',
      warningGradient:   'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',

      error:             '#ef4444',
      errorLight:        'rgba(239,68,68,0.15)',
      errorDark:         '#dc2626',
      errorGradient:     'linear-gradient(135deg, #f87171 0%, #ef4444 100%)',

      info:              '#3B82F6',
      infoLight:         'rgba(59,130,246,0.15)',
      infoDark:          '#2563EB',
      infoGradient:      'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',

      processing:        '#7c3aed',
      processingLight:   'rgba(124,58,237,0.15)',
      processingGradient:'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)',

      cleared:  '#10b981',
      pending:  '#f59e0b',
      amber:    '#f59e0b',
      red:      '#ef4444',
      purple:   '#7c3aed',
    },

    // Feature badge colors (dark aurora pill tags)
    feature: {
      badge:       'rgba(59,130,246,0.2)',
      badgeText:   '#60a5fa',
      badgeBorder: 'rgba(59,130,246,0.35)',
      bcd:         'linear-gradient(145deg, #60a5fa 0%, #3b82f6 100%)',
      igst:        'linear-gradient(145deg, #34d399 0%, #10b981 100%)',
      cess:        'linear-gradient(145deg, #fbbf24 0%, #f59e0b 100%)',
      sws:         'linear-gradient(145deg, #f87171 0%, #ef4444 100%)',
      cyan:        '#06B6D4',
      green:       '#10b981',
      blue:        '#3B82F6',
    },
  },

  // Spacing
  spacing: {
    xs:   4,
    sm:   8,
    md:   16,
    lg:   24,
    xl:   32,
    xxl:  48,
    xxxl: 64,
  },

  // Border radius
  radius: {
    sm:   6,
    md:   10,
    lg:   14,
    xl:   18,
    xxl:  24,
    pill: 9999,
  },

  // Shadows — deep for dark bg
  shadows: {
    none: 'none',
    xs:   '0 1px 2px rgba(0,0,0,0.3)',
    sm:   '0 2px 6px rgba(0,0,0,0.35), 0 1px 2px rgba(0,0,0,0.25)',
    md:   '0 4px 12px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.3)',
    lg:   '0 8px 24px rgba(0,0,0,0.45), 0 4px 8px rgba(0,0,0,0.3)',
    xl:   '0 16px 40px rgba(0,0,0,0.5), 0 8px 16px rgba(0,0,0,0.35)',
    xxl:  '0 24px 60px rgba(0,0,0,0.55), 0 12px 24px rgba(0,0,0,0.4)',

    // Card — deep shadow for dark bg
    card:      '0 4px 20px rgba(0,0,0,0.5)',
    cardHover: '0 8px 32px rgba(0,0,0,0.6), 0 0 20px rgba(59,130,246,0.15)',
    cardActive:'0 1px 3px rgba(0,0,0,0.4)',

    // Sidebar
    sidebar: '4px 0 24px rgba(0,0,0,0.5)',

    // Buttons
    button:      '0 4px 16px rgba(59,130,246,0.3)',
    buttonHover: '0 8px 28px rgba(59,130,246,0.4)',
    buttonActive:'0 1px 3px rgba(59,130,246,0.2)',

    // Glow
    glowBlue:      '0 0 20px rgba(59,130,246,0.4), 0 0 40px rgba(59,130,246,0.2)',
    glowBlueLarge: '0 0 24px rgba(59,130,246,0.5), 0 0 48px rgba(59,130,246,0.25)',
    glowCyan:      '0 0 16px rgba(6,182,212,0.4)',
    glowPurple:    '0 0 16px rgba(124,58,237,0.35)',
    glowGreen:     '0 0 16px rgba(16,185,129,0.35)',
    glowAmber:     '0 0 16px rgba(245,158,11,0.35)',
    glowWhite:     '0 0 16px rgba(255,255,255,0.25)',

    inner:      'inset 0 1px 3px rgba(0,0,0,0.3)',
    innerGlow:  'inset 0 1px 2px rgba(255,255,255,0.08)',
    innerDeep:  'inset 0 2px 6px rgba(0,0,0,0.4)',
  },

  // Typography
  typography: {
    fontFamily: {
      main:    'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      mono:    '"JetBrains Mono", monospace',
      heading: 'Inter, sans-serif',
    },
    fontSize: {
      xs:      '0.75rem',
      sm:      '0.875rem',
      md:      '1rem',
      lg:      '1.125rem',
      xl:      '1.25rem',
      xxl:     '1.5rem',
      '3xl':   '1.875rem',
      '4xl':   '2.25rem',
      '5xl':   '3rem',
      heading: '1.75rem',
    },
    fontWeight: {
      light:     300,
      regular:   400,
      medium:    500,
      semibold:  600,
      bold:      700,
      extrabold: 800,
    },
    textShadow: {
      sm:  'none',
      md:  'none',
      glow:'0 0 10px rgba(59,130,246,0.4)',
    },
  },

  // Transitions
  transitions: {
    fast:     '0.15s',
    normal:   '0.25s',
    slow:     '0.4s',
    verySlow: '0.6s',
    easing: {
      default: 'cubic-bezier(0.4, 0, 0.2, 1)',
      in:      'cubic-bezier(0.4, 0, 1, 1)',
      out:     'cubic-bezier(0, 0, 0.2, 1)',
      inOut:   'cubic-bezier(0.4, 0, 0.2, 1)',
      bounce:  'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    },
  },

  // Z-index
  zIndex: {
    base:          0,
    dropdown:      1000,
    sticky:        1100,
    fixed:         1200,
    modalBackdrop: 1300,
    modal:         1400,
    popover:       1500,
    tooltip:       1600,
    toast:         1700,
    navbar:        100,
    sidebar:       50,
    chat:          2000,
  },

  // Transforms
  transforms: {
    card3D:        'translateZ(0)',
    cardHover3D:   'translateY(-3px)',
    cardActive3D:  'translateY(0px)',
    button3D:      'translateY(0)',
    buttonHover3D: 'translateY(-2px)',
    buttonActive3D:'translateY(1px)',
    float:         'translateY(0px)',
    floatUp:       'translateY(-6px)',
    floatHover:    'translateY(-8px)',
    elevate1:      'translateY(-2px)',
    elevate2:      'translateY(-4px)',
    elevate3:      'translateY(-6px)',
    elevate4:      'translateY(-8px)',
    perspective:   'perspective(1200px)',
  },
};

export default theme;
