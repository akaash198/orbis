/** @type {import('tailwindcss').Config} */

const defaultTheme = require('tailwindcss/defaultTheme')

// ─── ORBISPORTÉ — HARFIX Dark (Gold Edition) ─────────────────────────────────
//  Background:      #0A0D14  Abyss
//  Surface:         #111620  Panel
//  Raised Surface:  #161D2C  Card
//  Border:          #1E2638  Subtle
//  Accent:          #C9A520  Gold
//  Typography:      DM Sans + DM Mono
// ─────────────────────────────────────────────────────────────────────────────

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
        mono: ['"DM Mono"', ...defaultTheme.fontFamily.mono],
      },

      // ── TYPE SCALE ───────────────────────────────────────────────────────────
      fontSize: {
        '2xs':  ['0.6875rem', { lineHeight: '1rem',     letterSpacing: '0.05em'  }],  // 11px  overlines, table headers
        'xs':   ['0.75rem',   { lineHeight: '1rem',     letterSpacing: '0.02em'  }],  // 12px  captions, badges
        'sm':   ['0.8125rem', { lineHeight: '1.25rem',  letterSpacing: '0.01em'  }],  // 13px  labels, helper text
        'base': ['0.9375rem', { lineHeight: '1.6rem',   letterSpacing: '0'       }],  // 15px  body
        'md':   ['1rem',      { lineHeight: '1.6rem',   letterSpacing: '0'       }],  // 16px  large body
        'lg':   ['1.125rem',  { lineHeight: '1.4rem',   letterSpacing: '-0.01em' }],  // 18px  card title (H4)
        'xl':   ['1.25rem',   { lineHeight: '1.35rem',  letterSpacing: '-0.015em'}],  // 20px
        '2xl':  ['1.5rem',    { lineHeight: '1.3rem',   letterSpacing: '-0.02em' }],  // 24px  H3
        '3xl':  ['2rem',      { lineHeight: '1.2rem',   letterSpacing: '-0.025em'}],  // 32px  H2
        '4xl':  ['2.5rem',    { lineHeight: '1.15rem',  letterSpacing: '-0.03em' }],  // 40px  H1
        '5xl':  ['3rem',      { lineHeight: '1.1rem',   letterSpacing: '-0.035em'}],  // 48px  hero display
        '6xl':  ['3.75rem',   { lineHeight: '1.05rem',  letterSpacing: '-0.04em' }],  // 60px  KPI mega-numbers
      },

      fontWeight: {
        light:    '300',
        regular:  '400',
        medium:   '500',
        semibold: '600',
        bold:     '700',
      },

      // ── COLORS ───────────────────────────────────────────────────────────────
      colors: {

        // ·· Layout backgrounds ················································
        page:    '#0A0D14',   // body / outermost shell
        panel:   '#111620',   // sidebar, header, bottom bars
        surface: '#161D2C',   // cards, raised panels
        overlay: '#1C2438',   // hover tint, modal scrim base
        inset:   '#0D1020',   // table headers, code blocks, input bg

        // ·· Border ramp ··················································
        border: {
          dim:      '#141A28',   // barely-there — within panels
          subtle:   '#1E2638',   // default card/section border
          default:  '#273047',   // inputs, table rows
          strong:   '#344060',   // hover / focus-adjacent
          accent:   '#C9A520',   // gold — focused, active
        },

        // ·· Gold — primary accent ·············································
        gold: {
          DEFAULT: '#C9A520',
          50:      'rgba(201,165,32,0.06)',
          100:     'rgba(201,165,32,0.12)',
          200:     'rgba(201,165,32,0.20)',
          300:     'rgba(201,165,32,0.30)',
          400:     '#C9A520',
          500:     '#A88A18',   // hover
          600:     '#876E12',   // pressed
          700:     '#64520D',
          light:   '#E8C84A',   // lighter gold for text on dark
          glow:    'rgba(201,165,32,0.25)',
        },

        // ·· Text hierarchy ····················································
        text: {
          primary:   '#E2E8F5',   // headings, numbers, primary data
          secondary: '#8B97AE',   // body, descriptions, row data
          tertiary:  '#4A5A72',   // timestamps, disabled, hints
          inverse:   '#0A0D14',   // text on bright surfaces
          gold:      '#E8C84A',   // active nav, highlights, links
          danger:    '#F07070',   // inline error text
          success:   '#5AD49A',   // inline success text
          warning:   '#F5A96A',   // inline warning text
          info:      '#8DD4EC',   // inline info text
        },

        // ·· Chart / data-vis palette ··········································
        chart: {
          1: '#C9A520',   // gold    — primary series
          2: '#6BBCD4',   // cyan    — secondary series
          3: '#3DBE82',   // teal    — tertiary series
          4: '#9A8CE8',   // purple  — quaternary series
          5: '#E87A5A',   // coral   — fifth series
          6: '#E8934A',   // amber   — sixth / warning series
        },

        // ·· Status — Success ··················································
        success: {
          DEFAULT: '#3DBE7E',
          dim:     'rgba(61,190,126,0.12)',
          border:  'rgba(61,190,126,0.28)',
          text:    '#5AD49A',
          strong:  '#2A9060',
        },

        // ·· Status — Warning ··················································
        warning: {
          DEFAULT: '#E8934A',
          dim:     'rgba(232,147,74,0.12)',
          border:  'rgba(232,147,74,0.28)',
          text:    '#F5A96A',
          strong:  '#C07030',
        },

        // ·· Status — Error ····················································
        error: {
          DEFAULT: '#E05656',
          dim:     'rgba(224,86,86,0.12)',
          border:  'rgba(224,86,86,0.28)',
          text:    '#F07070',
          strong:  '#B83030',
        },

        // ·· Status — Info ·····················································
        info: {
          DEFAULT: '#6BBCD4',
          dim:     'rgba(107,188,212,0.12)',
          border:  'rgba(107,188,212,0.28)',
          text:    '#8DD4EC',
          strong:  '#4A96B0',
        },

        // ·· Status — Purple ···················································
        purple: {
          DEFAULT: '#9A8CE8',
          dim:     'rgba(154,140,232,0.12)',
          border:  'rgba(154,140,232,0.28)',
          text:    '#B8AEFF',
          strong:  '#7060C0',
        },

        // ·· Neutral cool ramp (utility) ·······································
        neutral: {
          50:  '#F0F4FA',
          100: '#D8E0EE',
          200: '#A8B8CC',
          300: '#7A8EAA',
          400: '#566478',
          500: '#3C4A60',
          600: '#2A3448',
          700: '#1E2638',
          800: '#141A28',
          900: '#0A0D14',
        },
      },

      // ── SPACING (8px base) ────────────────────────────────────────────────────
      spacing: {
        px:  '1px',
        0:   '0px',
        0.5: '2px',
        1:   '4px',
        1.5: '6px',
        2:   '8px',
        2.5: '10px',
        3:   '12px',
        3.5: '14px',
        4:   '16px',
        5:   '20px',
        6:   '24px',
        7:   '28px',
        8:   '32px',
        9:   '36px',
        10:  '40px',
        11:  '44px',  // minimum touch target
        12:  '48px',
        14:  '56px',
        16:  '64px',  // sidebar logo zone, large gaps
        18:  '72px',
        20:  '80px',
        24:  '96px',
        28:  '112px',
        32:  '128px',
        36:  '144px',
        40:  '160px',
        48:  '192px',
        56:  '224px',
        64:  '256px',
        72:  '288px',
        80:  '320px',
        96:  '384px',
      },

      // ── BORDER RADIUS ─────────────────────────────────────────────────────────
      borderRadius: {
        none:   '0px',
        xs:     '3px',    // micro — inner elements, tiny badges
        sm:     '5px',    // small — buttons, inputs
        DEFAULT:'7px',
        md:     '7px',    // standard — most UI components
        lg:     '10px',   // cards, dropdowns, panels
        xl:     '14px',   // modals, sidesheets
        '2xl':  '18px',   // hero cards, feature panels
        full:   '9999px', // pills, avatars, toggles
      },

      // ── SHADOWS ───────────────────────────────────────────────────────────────
      // Dark theme uses deep alpha shadows — barely any ambient light
      boxShadow: {
        'xs':       '0 1px 2px rgba(0,0,0,0.50)',
        'sm':       '0 2px 4px rgba(0,0,0,0.60), 0 1px 2px rgba(0,0,0,0.40)',
        DEFAULT:    '0 4px 10px rgba(0,0,0,0.60), 0 2px 4px rgba(0,0,0,0.40)',
        'md':       '0 6px 18px rgba(0,0,0,0.70), 0 3px 6px rgba(0,0,0,0.40)',
        'lg':       '0 12px 32px rgba(0,0,0,0.75), 0 6px 12px rgba(0,0,0,0.50)',
        'xl':       '0 20px 48px rgba(0,0,0,0.85), 0 10px 20px rgba(0,0,0,0.55)',
        '2xl':      '0 32px 72px rgba(0,0,0,0.90), 0 16px 32px rgba(0,0,0,0.65)',

        // Semantic
        'card':     '0 2px 8px rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.03)',
        'modal':    '0 40px 80px rgba(0,0,0,0.95), 0 16px 40px rgba(0,0,0,0.70)',
        'dropdown': '0 12px 36px rgba(0,0,0,0.85), 0 4px 12px rgba(0,0,0,0.60)',
        'sidebar':  '6px 0 32px rgba(0,0,0,0.70)',
        'header':   '0 1px 0 rgba(255,255,255,0.04), 0 4px 16px rgba(0,0,0,0.50)',
        'kpi':      '0 2px 8px rgba(0,0,0,0.50), inset 0 1px 0 rgba(255,255,255,0.04)',

        // Glow — gold brand signature
        'glow-gold':     '0 0 24px rgba(201,165,32,0.30), 0 0 8px rgba(201,165,32,0.18)',
        'glow-gold-sm':  '0 0 12px rgba(201,165,32,0.22)',
        'glow-success':  '0 0 20px rgba(61,190,126,0.22)',
        'glow-error':    '0 0 20px rgba(224,86,86,0.22)',
        'glow-info':     '0 0 20px rgba(107,188,212,0.22)',

        // Focus rings
        'focus':         '0 0 0 3px rgba(201,165,32,0.35)',
        'focus-error':   '0 0 0 3px rgba(224,86,86,0.30)',
        'focus-info':    '0 0 0 3px rgba(107,188,212,0.30)',
        'focus-success': '0 0 0 3px rgba(61,190,126,0.30)',

        'none': 'none',
      },

      // ── TRANSITIONS ───────────────────────────────────────────────────────────
      transitionDuration: {
        fast:   '150ms',
        normal: '250ms',
        slow:   '350ms',
        modal:  '400ms',
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'out':    'cubic-bezier(0, 0, 0.2, 1)',
        'in':     'cubic-bezier(0.4, 0, 1, 1)',
      },

      // ── ANIMATIONS ────────────────────────────────────────────────────────────
      animation: {
        'fade-in':    'fadeIn 0.25s cubic-bezier(0.4,0,0.2,1) both',
        'fade-out':   'fadeOut 0.2s cubic-bezier(0.4,0,0.2,1) both',
        'slide-up':   'slideUp 0.3s cubic-bezier(0.4,0,0.2,1) both',
        'slide-down': 'slideDown 0.3s cubic-bezier(0.4,0,0.2,1) both',
        'slide-left': 'slideLeft 0.3s cubic-bezier(0.4,0,0.2,1) both',
        'scale-in':   'scaleIn 0.25s cubic-bezier(0.34,1.56,0.64,1) both',
        'scale-out':  'scaleOut 0.2s cubic-bezier(0.4,0,0.2,1) both',
        'shimmer':    'shimmer 1.8s ease-in-out infinite',
        'spin':       'spin 1s linear infinite',
        'pulse-gold': 'pulseGold 2.5s ease-in-out infinite',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'bar-grow':   'barGrow 0.6s cubic-bezier(0.34,1.56,0.64,1) both',
        'toast-in':   'toastIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both',
        'toast-out':  'toastOut 0.25s cubic-bezier(0.4,0,1,1) both',
        'count-up':   'countUp 0.5s cubic-bezier(0.4,0,0.2,1) both',
      },
      keyframes: {
        fadeIn:    { from:{opacity:'0'},                                             to:{opacity:'1'}                                             },
        fadeOut:   { from:{opacity:'1'},                                             to:{opacity:'0'}                                             },
        slideUp:   { from:{opacity:'0',transform:'translateY(12px)'},                to:{opacity:'1',transform:'translateY(0)'}                   },
        slideDown: { from:{opacity:'0',transform:'translateY(-10px)'},               to:{opacity:'1',transform:'translateY(0)'}                   },
        slideLeft: { from:{opacity:'0',transform:'translateX(-16px)'},               to:{opacity:'1',transform:'translateX(0)'}                   },
        scaleIn:   { from:{opacity:'0',transform:'scale(0.94)'},                     to:{opacity:'1',transform:'scale(1)'}                        },
        scaleOut:  { from:{opacity:'1',transform:'scale(1)'},                        to:{opacity:'0',transform:'scale(0.94)'}                     },
        shimmer: {
          '0%':   { backgroundPosition: '-800px 0' },
          '100%': { backgroundPosition:  '800px 0' },
        },
        pulseGold: {
          '0%,100%': { boxShadow: '0 0 8px  rgba(201,165,32,0.15)' },
          '50%':     { boxShadow: '0 0 28px rgba(201,165,32,0.45)' },
        },
        pulseSoft: {
          '0%,100%': { opacity: '1' },
          '50%':     { opacity: '0.45' },
        },
        barGrow: {
          from: { transform:'scaleY(0)', transformOrigin:'bottom' },
          to:   { transform:'scaleY(1)', transformOrigin:'bottom' },
        },
        toastIn:  { from:{opacity:'0',transform:'translateX(24px) scale(0.96)'}, to:{opacity:'1',transform:'translateX(0) scale(1)'}           },
        toastOut: { from:{opacity:'1',transform:'translateX(0)'},                 to:{opacity:'0',transform:'translateX(24px)'}                 },
        countUp:  { from:{opacity:'0',transform:'translateY(6px)'},               to:{opacity:'1',transform:'translateY(0)'}                   },
      },

      // ── LAYOUT TOKENS ─────────────────────────────────────────────────────────
      maxWidth: {
        'content':  '1440px',
        'prose':    '68ch',
        'modal-xs': '360px',
        'modal-sm': '440px',
        'modal-md': '560px',
        'modal-lg': '740px',
        'modal-xl': '960px',
      },
      width: {
        'sidebar':           '280px',
        'sidebar-collapsed': '64px',
      },
      height: {
        'header':  '52px',
        'kpi-pip': '3px',
      },

      // ── SCREENS ───────────────────────────────────────────────────────────────
      screens: {
        'xs':  '375px',
        'sm':  '640px',
        'md':  '768px',
        'lg':  '1024px',
        'xl':  '1280px',
        '2xl': '1440px',
        '3xl': '1600px',
      },

      // ── Z-INDEX ───────────────────────────────────────────────────────────────
      zIndex: {
        base:     '0',
        raised:   '10',
        sticky:   '20',
        dropdown: '30',
        header:   '40',
        overlay:  '50',
        modal:    '60',
        toast:    '70',
        tooltip:  '80',
      },

      backdropBlur: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '20px',
      },
    },
  },

  plugins: [],
}
