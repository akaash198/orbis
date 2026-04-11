/** @type {import('tailwindcss').Config} */

const defaultTheme = require('tailwindcss/defaultTheme')

module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './pages/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './app/**/*.{js,jsx,ts,tsx}',
  ],

  darkMode: 'class',

  theme: {
    extend: {
      // ── FONTS ────────────────────────────────────────────────────────────────
      fontFamily: {
        sans: ['"DM Sans"', ...defaultTheme.fontFamily.sans],
        mono: ['"DM Mono"', 'ui-monospace', 'Cascadia Code', ...defaultTheme.fontFamily.mono],
      },

      // ── COLORS ───────────────────────────────────────────────────────────────
      colors: {
        // Layout backgrounds
        'bg-page':     '#0A0D14',
        'bg-panel':    '#111620',
        'bg-surface':  '#161D2C',
        'bg-overlay':  '#1C2438',
        'bg-inset':    '#0D1020',

        // Semantic shorthand
        page:    '#0A0D14',
        panel:   '#111620',
        surface: '#161D2C',
        overlay: '#1C2438',
        inset:   '#0D1020',

        // Border scale
        border: {
          dim:     '#141A28',
          subtle:  '#1E2638',
          default: '#273047',
          strong:  '#344060',
          accent:  '#C9A520',
        },

        // Gold brand
        gold: {
          DEFAULT: '#C9A520',
          light:   '#E8C84A',
          hover:   '#A88A18',
          muted:   'rgba(201,165,32,0.10)',
          border:  'rgba(201,165,32,0.28)',
          glow:    'rgba(201,165,32,0.25)',
        },

        // Brand alias
        brand: '#C9A520',
        'brand-accent': '#E8C84A',

        // Text hierarchy — using CSS variables for consistency
        text: {
          primary:   '#E2E8F5',
          secondary: '#8B97AE',
          tertiary:  '#4A5A72',
          inverse:   '#0A0D14',
          gold:      '#E8C84A',
          muted:     '#4A5A72',
        },

        // Background aliases for components
        background: {
          primary:   '#0A0D14',
          secondary: '#111620',
          panel:     '#111620',
        },

        // Semantic status colors
        success: {
          DEFAULT: '#3DBE7E',
          dim:     'rgba(61,190,126,0.12)',
          border:  'rgba(61,190,126,0.28)',
          text:    '#5AD49A',
        },
        warning: {
          DEFAULT: '#E8934A',
          dim:     'rgba(232,147,74,0.12)',
          border:  'rgba(232,147,74,0.28)',
          text:    '#F5A96A',
        },
        error: {
          DEFAULT: '#E05656',
          dim:     'rgba(224,86,86,0.12)',
          border:  'rgba(224,86,86,0.28)',
          text:    '#F07070',
        },
        info: {
          DEFAULT: '#6BBCD4',
          dim:     'rgba(107,188,212,0.12)',
          border:  'rgba(107,188,212,0.28)',
          text:    '#8DD4EC',
        },
        purple: {
          DEFAULT: '#9A8CE8',
          dim:     'rgba(154,140,232,0.12)',
          border:  'rgba(154,140,232,0.28)',
          text:    '#B8AEFF',
        },

        // Surface component shorthands
        'surface-subtle':  '#1C2438',
        'surface-glass':   'rgba(22,29,44,0.80)',
      },

      // ── SPACING ──────────────────────────────────────────────────────────────
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
        '3xl': '32px',
        '4xl': '40px',
        '5xl': '48px',
      },

      // ── RADIUS ───────────────────────────────────────────────────────────────
      borderRadius: {
        xs:   '4px',
        sm:   '8px',
        md:   '8px',
        lg:   '12px',
        xl:   '16px',
        '2xl': '20px',
        full: '9999px',
      },

      // ── FONT SIZES ───────────────────────────────────────────────────────────
      fontSize: {
        'display': ['2.625rem', { lineHeight: '1.05', letterSpacing: '-0.03em', fontWeight: '700' }],
        'h1':      ['2.625rem', { lineHeight: '1.05', letterSpacing: '-0.03em', fontWeight: '700' }],
        'h2':      ['1.75rem',  { lineHeight: '1.2',  letterSpacing: '-0.025em', fontWeight: '700' }],
        'h3':      ['1.25rem',  { lineHeight: '1.3',  letterSpacing: '-0.02em',  fontWeight: '600' }],
        'h4':      ['1rem',     { lineHeight: '1.4',  letterSpacing: '-0.01em',  fontWeight: '600' }],
        'body':    ['0.9375rem',{ lineHeight: '1.6' }],
        'body-lg': ['1rem',     { lineHeight: '1.65' }],
        'body-sm': ['0.8125rem',{ lineHeight: '1.5' }],
        'label':   ['0.75rem',  { lineHeight: '1.4',  fontWeight: '600', letterSpacing: '0.02em' }],
        'caption': ['0.6875rem',{ lineHeight: '1.4' }],
        'tiny':    ['0.6875rem',{ lineHeight: '1.4' }],
        'overline':['0.6875rem',{ lineHeight: '1.4', fontWeight: '700', letterSpacing: '0.10em' }],
      },

      // ── SHADOWS ──────────────────────────────────────────────────────────────
      boxShadow: {
        xs:          '0 1px 2px rgba(0,0,0,0.50)',
        sm:          '0 2px 4px rgba(0,0,0,0.60), 0 1px 2px rgba(0,0,0,0.40)',
        md:          '0 6px 18px rgba(0,0,0,0.70), 0 3px 6px rgba(0,0,0,0.40)',
        lg:          '0 12px 32px rgba(0,0,0,0.75), 0 6px 12px rgba(0,0,0,0.50)',
        xl:          '0 20px 48px rgba(0,0,0,0.85), 0 10px 20px rgba(0,0,0,0.55)',
        card:        '0 4px 16px rgba(0,0,0,0.18)',
        'card-hover':'0 8px 24px rgba(0,0,0,0.22)',
        modal:       '0 16px 48px rgba(0,0,0,0.25)',
        dropdown:    '0 8px 24px rgba(0,0,0,0.20)',
        header:      '0 1px 0 rgba(255,255,255,0.04), 0 4px 16px rgba(0,0,0,0.50)',
        sidebar:     '6px 0 32px rgba(0,0,0,0.70)',
        'glow-gold': '0 0 24px rgba(201,165,32,0.30), 0 0 8px rgba(201,165,32,0.18)',
        'glow-gold-sm':'0 0 12px rgba(201,165,32,0.22)',
        'glow-success':'0 0 20px rgba(61,190,126,0.22)',
        'glow-error':  '0 0 20px rgba(224,86,86,0.22)',
        'ring-gold':   '0 0 0 3px rgba(201,165,32,0.35)',
        'ring-error':  '0 0 0 3px rgba(224,86,86,0.30)',
        'glow-lg':     '0 8px 24px rgba(201,165,32,0.3)',
      },

      // ── ANIMATIONS ───────────────────────────────────────────────────────────
      animation: {
        'fade-in':   'fadeIn 0.25s cubic-bezier(0.4,0,0.2,1) both',
        'slide-up':  'slideUp 0.3s cubic-bezier(0.4,0,0.2,1) both',
        'scale-in':  'scaleIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
        'count-up':  'countUp 0.5s cubic-bezier(0.4,0,0.2,1) both',
        'shimmer':   'shimmer 1.8s ease-in-out infinite',
        'spin':      'spin 0.8s linear infinite',
        'glow-pulse':'glowPulse 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:    { from:{ opacity:'0' }, to:{ opacity:'1' } },
        slideUp:   { from:{ opacity:'0', transform:'translateY(12px)' }, to:{ opacity:'1', transform:'translateY(0)' } },
        scaleIn:   { from:{ opacity:'0', transform:'scale(0.95)' }, to:{ opacity:'1', transform:'scale(1)' } },
        countUp:   { from:{ opacity:'0', transform:'translateY(6px)' }, to:{ opacity:'1', transform:'translateY(0)' } },
        shimmer:   { '0%':{ backgroundPosition:'-800px 0' }, '100%':{ backgroundPosition:'800px 0' } },
        glowPulse: { '0%,100%':{ boxShadow:'0 0 12px rgba(201,165,32,0.20)' }, '50%':{ boxShadow:'0 0 28px rgba(201,165,32,0.50)' } },
      },

      // ── BACKGROUND IMAGES ────────────────────────────────────────────────────
      backgroundImage: {
        'gradient-gold':    'linear-gradient(135deg, #C9A520 0%, #E8C84A 100%)',
        'gradient-surface': 'linear-gradient(180deg, rgba(22,29,44,0.98) 0%, rgba(17,22,32,0.98) 100%)',
        'gradient-radial':  'radial-gradient(circle at center, rgba(201,165,32,0.10) 0%, transparent 70%)',
      },
    },
  },

  plugins: [],
}
