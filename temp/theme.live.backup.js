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
    // Primary — premium ocean blue
    primary: {
      main:       '#0F3460',
      light:      '#1E5A96',
      dark:       '#051C33',
      navy:       '#0F3460',
      cyan:       '#00D9FF',
      contrast:   '#ffffff',
      gradient:   'linear-gradient(135deg, #0F3460 0%, #00D9FF 100%)',
      gradient3D: 'linear-gradient(145deg, #1E5A96 0%, #0F3460 50%, #051C33 100%)',
    },

    // Secondary — legacy blue alias
    secondary: {
      main:       '#1E5A96',
      light:      '#3B82F6',
      dark:       '#051C33',
      contrast:   '#ffffff',
      gradient:   'linear-gradient(135deg, #1E5A96 0%, #0F3460 100%)',
      gradient3D: 'linear-gradient(145deg, #1E5A96 0%, #0F3460 50%, #051C33 100%)',
    },

    // Success — green
    success: {
      main:       '#10b981',
      light:      '#34d399',
      dark:       '#059669',
      gradient:   'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      gradient3D: 'linear-gradient(145deg, #34d399 0%, #10b981 50%, #059669 100%)',
    },

    // UI Colors — driven by CSS variables
    ui: {
      background:      'var(--color-bg-primary)',
      backgroundSolid: 'var(--color-bg-primary)',
      backgroundLight: 'var(--color-bg-secondary)',
      backgroundDark:  'var(--color-bg-tertiary)',
      heroBackground:  'linear-gradient(180deg, #0a0e27 0%, #0a0e27 100%)',

      // Cards — premium surfaces
      card:         'var(--color-surface)',
      cardHover:    'var(--color-surface-subtle)',
      cardElevated: 'var(--color-surface-raised)',
      cardGradient: 'linear-gradient(145deg, rgba(21,27,63,0.92) 0%, rgba(30,37,82,0.92) 100%)',
      cardGlow:     'linear-gradient(145deg, rgba(0,217,255,0.08) 0%, rgba(59,130,246,0.05) 100%)',

      // Borders
      border:      'var(--color-border)',
      borderLight: 'var(--color-border-subtle)',
      borderGlow:  'rgba(0,217,255,0.5)',

      // Hover / active
      hover:      'rgba(30,37,82,0.7)',
      hoverDark:  'rgba(30,37,82,0.85)',
      active:     'rgba(0,217,255,0.12)',
      activeDark: 'rgba(0,217,255,0.18)',

      // Sidebar — deep space brand identity
      sidebar:       'linear-gradient(160deg, #0a0e27 0%, #0a0e27 100%)',
      sidebarSolid:  '#0a0e27',
      sidebarDark:   '#051c33',
      sidebarHover:  'rgba(0,217,255,0.12)',
      sidebarActive: 'rgba(0,217,255,0.22)',
      sidebarGlow:   'radial-gradient(circle at 20% 20%, rgba(0,217,255,0.2) 0%, transparent 70%)',

      // Glass
      glass:      'rgba(21, 27, 63, 0.72)',
      glassLight: 'rgba(30, 37, 82, 0.88)',
      glassDark:  'rgba(10, 14, 39, 0.88)',
      glassBlur:  'blur(20px)',
      overlay:    'rgba(10, 14, 39, 0.7)',
    },

    // Text colors — driven by CSS variables
    text: {
      primary:   'var(--color-text-primary)',
      secondary: 'var(--color-text-secondary)',
      tertiary:  'var(--color-text-tertiary)',
      hint:      'var(--color-text-muted)',
      disabled:  'rgba(122,131,153,0.7)',
      link:      '#00D9FF',
      linkHover: '#22d3ee',

      // Sidebar text — white on deep blue
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

      info:              '#00d9ff',
      infoLight:         'rgba(0,217,255,0.15)',
      infoDark:          '#00a9c7',
      infoGradient:      'linear-gradient(135deg, #00d9ff 0%, #00a9c7 100%)',

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
      badge:       'rgba(0,217,255,0.2)',
      badgeText:   '#00d9ff',
      badgeBorder: 'rgba(0,217,255,0.35)',
      bcd:         'linear-gradient(145deg, #1e5a96 0%, #0f3460 100%)',
      igst:        'linear-gradient(145deg, #34d399 0%, #10b981 100%)',
      cess:        'linear-gradient(145deg, #fbbf24 0%, #f59e0b 100%)',
      sws:         'linear-gradient(145deg, #f87171 0%, #ef4444 100%)',
      cyan:        '#00D9FF',
      green:       '#10b981',
      blue:        '#0F3460',
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
    sm:   4,
    md:   8,
    lg:   12,
    xl:   12,
    xxl:  16,
    pill: 9999,
  },

  // Shadows — guide aligned
  shadows: {
    none: 'none',
    xs:   '0 1px 2px rgba(0,0,0,0.05)',
    sm:   '0 1px 2px rgba(0,0,0,0.05)',
    md:   '0 4px 6px rgba(0,0,0,0.1)',
    lg:   '0 10px 15px rgba(0,0,0,0.2)',
    xl:   '0 20px 25px rgba(0,0,0,0.3)',
    xxl:  '0 20px 25px rgba(0,0,0,0.3)',

    // Card
    card:      '0 4px 20px rgba(0,0,0,0.4)',
    cardHover: '0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(0,217,255,0.15)',
    cardActive:'0 1px 3px rgba(0,0,0,0.4)',

    // Sidebar
    sidebar: '4px 0 24px rgba(0,0,0,0.5)',

    // Buttons
    button:      '0 4px 16px rgba(0,217,255,0.3)',
    buttonHover: '0 8px 28px rgba(0,217,255,0.4)',
    buttonActive:'0 1px 3px rgba(0,217,255,0.2)',

    // Glow
    glowBlue:      '0 0 20px rgba(0,217,255,0.4), 0 0 40px rgba(0,217,255,0.2)',
    glowBlueLarge: '0 0 24px rgba(0,217,255,0.5), 0 0 48px rgba(0,217,255,0.25)',
    glowCyan:      '0 0 16px rgba(0,217,255,0.4)',
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
      mono:    '"JetBrains Mono", "SF Mono", monospace',
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
