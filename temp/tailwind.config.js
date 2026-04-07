/** @type {import('tailwindcss').Config} */

const defaultTheme = require('tailwindcss/defaultTheme')

// ─── ORBISPORTÉ Design Tokens — Warm Sage ────────────────────────────────────
// Primary:  #2D4A3E  (Deep Forest)
// Accent:   #2D9D78  (Sage Green)
// BG:       #F8F7F4  (Warm Linen)
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './pages/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './app/**/*.{js,jsx,ts,tsx}',
  ],

  theme: {
    extend: {

      // ── FONTS ───────────────────────────────────────────────────────────────
      fontFamily: {
        sans: ['"DM Sans"', ...defaultTheme.fontFamily.sans],
        mono: ['"DM Mono"', ...defaultTheme.fontFamily.mono],
      },

      // ── FONT SIZES (matches type scale) ─────────────────────────────────────
      fontSize: {
        'xs':   ['0.75rem',   { lineHeight: '1rem',    letterSpacing: '0.005em' }],   // 12px · captions, tiny labels
        'sm':   ['0.8125rem', { lineHeight: '1.125rem', letterSpacing: '0.005em' }],  // 13px · labels, helper text
        'base': ['0.9375rem', { lineHeight: '1.5rem',  letterSpacing: '0' }],         // 15px · body copy
        'md':   ['1rem',      { lineHeight: '1.5rem',  letterSpacing: '0' }],         // 16px · large body
        'lg':   ['1.125rem',  { lineHeight: '1.4rem',  letterSpacing: '-0.01em' }],   // 18px · card titles (H4)
        'xl':   ['1.25rem',   { lineHeight: '1.35rem', letterSpacing: '-0.015em' }],  // 20px · section labels
        '2xl':  ['1.5rem',    { lineHeight: '1.3rem',  letterSpacing: '-0.02em' }],   // 24px · H3
        '3xl':  ['2rem',      { lineHeight: '1.2rem',  letterSpacing: '-0.025em' }],  // 32px · H2
        '4xl':  ['2.5rem',    { lineHeight: '1.15rem', letterSpacing: '-0.03em' }],   // 40px · H1
        '5xl':  ['3rem',      { lineHeight: '1.1rem',  letterSpacing: '-0.035em' }],  // 48px · hero
      },

      // ── FONT WEIGHTS ─────────────────────────────────────────────────────────
      fontWeight: {
        light:    '300',
        regular:  '400',
        medium:   '500',
        semibold: '600',
        bold:     '700',
      },

      // ── COLORS ───────────────────────────────────────────────────────────────
      colors: {

        // ·· Brand / Primary ···················································
        primary: {
          DEFAULT: '#2D4A3E',   // Deep forest green · main CTA, nav active, headings
          50:  '#EBF2EF',       // Tint · subtle backgrounds, hover chips
          100: '#C8DDDA',       // Light · selected row bg
          200: '#9DC0B9',       // Soft · borders on hover
          300: '#6BA29A',       // Medium-light
          400: '#4A7A72',       // Medium
          500: '#2D4A3E',       // Base (DEFAULT)
          600: '#24392F',       // Pressed state
          700: '#1A2A23',       // Deep pressed
          800: '#111C17',       // Near-black variant
          900: '#080E0C',       // Darkest
        },

        // ·· Accent / Sage ·····················································
        accent: {
          DEFAULT: '#2D9D78',   // Sage green · links, badges, focus rings, highlights
          50:  '#E8F7F2',       // Tint · alert backgrounds, tag chips
          100: '#C2EBDC',       // Light · hover on chip
          200: '#8DD4BA',       // Soft
          300: '#5ABE9A',       // Medium-light
          400: '#3AAD87',       // Medium
          500: '#2D9D78',       // Base (DEFAULT)
          600: '#228060',       // Hover/pressed
          700: '#196348',       // Deep
          800: '#104030',       // Darker
          900: '#082018',       // Darkest
        },

        // ·· Neutral / Warm Gray ···············································
        neutral: {
          0:   '#FFFFFF',       // Pure white · card surfaces
          50:  '#F8F7F4',       // Warm linen · page background (DEFAULT bg)
          100: '#F0EDE8',       // Off-white · secondary surfaces, hover bg
          150: '#E8E4DE',       // Dividers on surfaces
          200: '#DDD8D0',       // Borders default
          300: '#C8C0B6',       // Borders on hover, strong dividers
          400: '#A89E92',       // Tertiary text, placeholders
          500: '#7A7068',       // Secondary text, labels
          600: '#55504A',       // Readable body
          700: '#352F2A',       // Strong body text
          800: '#1E1A16',       // Headings
          900: '#100D0A',       // Near-black
        },

        // ·· Text Scale (semantic aliases) ·····································
        text: {
          primary:   '#1C2820',   // Darkest — headings, important data
          secondary: '#546358',   // Body copy, descriptions
          tertiary:  '#8FA091',   // Muted — captions, placeholders, disabled
          inverse:   '#FFFFFF',   // On dark/colored surfaces
          accent:    '#2D9D78',   // Links, active items
          danger:    '#C0392B',   // Error text
        },

        // ·· Surface / Background ··············································
        surface: {
          page:     '#F8F7F4',   // Page background (linen)
          default:  '#FFFFFF',   // Card / panel background
          raised:   '#FFFFFF',   // Elevated cards (with shadow)
          sunken:   '#F0EDE8',   // Inset areas, table headers, code bg
          overlay:  'rgba(18, 24, 20, 0.45)', // Modal backdrop
        },

        // ·· Border Scale ······················································
        border: {
          subtle:  '#E4DFD8',   // Default — cards, sections
          default: '#D0C9BF',   // Inputs, tables
          strong:  '#B8B0A5',   // Hover borders, focused inputs (non-accent)
          accent:  '#2D9D78',   // Focus ring base color
        },

        // ·· Status / Semantic ·················································
        success: {
          DEFAULT: '#2D9D78',   // Same as accent for this palette
          bg:      '#E8F7F2',
          border:  '#9DD4BA',
          text:    '#1A6B4A',
        },
        warning: {
          DEFAULT: '#C97A1A',
          bg:      '#FEF3E2',
          border:  '#F5CC8A',
          text:    '#7C4A06',
        },
        error: {
          DEFAULT: '#C0392B',
          bg:      '#FDECEA',
          border:  '#F5A89A',
          text:    '#8B1A10',
        },
        info: {
          DEFAULT: '#2563EB',
          bg:      '#EFF4FF',
          border:  '#93B8F8',
          text:    '#1040A0',
        },
      },

      // ── SPACING (8px base grid) ───────────────────────────────────────────────
      spacing: {
        px:   '1px',
        0:    '0px',
        0.5:  '2px',
        1:    '4px',     // xs   — micro gaps, icon padding
        1.5:  '6px',     // —
        2:    '8px',     // sm   — element-to-element spacing
        2.5:  '10px',    // —
        3:    '12px',    // md   — component internal padding
        3.5:  '14px',    // —
        4:    '16px',    // lg   — standard spacing, section dividers
        5:    '20px',    // —
        6:    '24px',    // xl   — card padding, section gaps
        7:    '28px',    // —
        8:    '32px',    // 2xl  — page-level spacing
        9:    '36px',    // —
        10:   '40px',    // —
        11:   '44px',    // touch target minimum
        12:   '48px',    // 3xl  — large section separation
        14:   '56px',    // —
        16:   '64px',    // 4xl  — header height, hero sections
        18:   '72px',    // —
        20:   '80px',    // —
        24:   '96px',    // —
        28:   '112px',   // —
        32:   '128px',   // —
        36:   '144px',   // —
        40:   '160px',   // sidebar icon mode width
        48:   '192px',   // —
        56:   '224px',   // —
        64:   '256px',   // —
        72:   '288px',   // sidebar collapsed
        80:   '320px',   // —
        96:   '384px',   // —
      },

      // ── BORDER RADIUS ─────────────────────────────────────────────────────────
      borderRadius: {
        none:  '0px',
        xs:    '4px',     // tiny — badges small, inner elements
        sm:    '6px',     // small — buttons, inputs
        DEFAULT:'8px',    // standard — most components
        md:    '8px',     // alias
        lg:    '12px',    // cards, panels, modals
        xl:    '16px',    // large panels, sheets
        '2xl': '20px',    // hero cards
        '3xl': '24px',    // decorative only
        full:  '9999px',  // pill — badges, avatars, toggle
      },

      // ── SHADOWS ───────────────────────────────────────────────────────────────
      boxShadow: {
        // Functional elevations
        'xs':    '0 1px 2px rgba(0, 0, 0, 0.04)',
        'sm':    '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
        DEFAULT: '0 2px 8px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04)',
        'md':    '0 4px 12px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.04)',
        'lg':    '0 8px 24px rgba(0, 0, 0, 0.08), 0 4px 8px rgba(0, 0, 0, 0.04)',
        'xl':    '0 16px 40px rgba(0, 0, 0, 0.10), 0 8px 16px rgba(0, 0, 0, 0.05)',
        '2xl':   '0 24px 56px rgba(0, 0, 0, 0.12), 0 12px 24px rgba(0, 0, 0, 0.06)',

        // Semantic
        'card':  '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'modal': '0 24px 56px rgba(0, 0, 0, 0.14), 0 8px 24px rgba(0, 0, 0, 0.08)',
        'dropdown': '0 8px 24px rgba(0, 0, 0, 0.10), 0 2px 6px rgba(0, 0, 0, 0.06)',

        // Focus rings
        'focus':         '0 0 0 3px rgba(45, 157, 120, 0.25)',
        'focus-error':   '0 0 0 3px rgba(192, 57, 43, 0.20)',
        'focus-warning': '0 0 0 3px rgba(201, 122, 26, 0.20)',

        // Interactive states
        'hover-card': '0 4px 16px rgba(0, 0, 0, 0.09), 0 2px 6px rgba(0, 0, 0, 0.05)',
        'none': 'none',
      },

      // ── TRANSITIONS ───────────────────────────────────────────────────────────
      transitionDuration: {
        fast:   '150ms',    // hover states, micro-interactions
        normal: '250ms',    // standard — button clicks, inputs
        slow:   '350ms',    // page transitions, modals
        modal:  '400ms',    // heavy animations
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',    // Material standard
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)', // Bouncy / entrance
        'out':    'cubic-bezier(0, 0, 0.2, 1)',       // Ease out
        'in':     'cubic-bezier(0.4, 0, 1, 1)',       // Ease in
      },

      // ── ANIMATIONS ────────────────────────────────────────────────────────────
      animation: {
        'fade-in':    'fadeIn 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        'fade-out':   'fadeOut 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        'slide-up':   'slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        'slide-down': 'slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        'scale-in':   'scaleIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'shimmer':    'shimmer 1.6s ease-in-out infinite',
        'spin-slow':  'spin 1s linear infinite',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%':   { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%':   { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%':   { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.5' },
        },
      },

      // ── LAYOUT ────────────────────────────────────────────────────────────────
      maxWidth: {
        'content': '1400px',    // max content width
        'prose':   '68ch',      // readable text column
        'sidebar': '280px',     // fixed sidebar width
        'modal-sm': '400px',
        'modal-md': '520px',
        'modal-lg': '720px',
        'modal-xl': '920px',
      },

      // ── SCREENS ───────────────────────────────────────────────────────────────
      screens: {
        'xs':  '375px',   // iPhone SE
        'sm':  '640px',   // Mobile landscape / small tablet
        'md':  '768px',   // Tablet portrait
        'lg':  '1024px',  // Desktop (sidebar appears)
        'xl':  '1280px',  // Wide desktop
        '2xl': '1536px',  // Ultra-wide
      },

      // ── Z-INDEX ───────────────────────────────────────────────────────────────
      zIndex: {
        base:     '0',
        raised:   '10',
        dropdown: '30',
        sticky:   '40',    // sticky header
        overlay:  '50',    // modal backdrop
        modal:    '60',    // modal content
        toast:    '70',    // notifications
        tooltip:  '80',    // tooltips (above everything)
      },
    },
  },

  plugins: [],
}
