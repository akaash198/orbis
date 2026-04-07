/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        sm: '1.5rem',
        lg: '2rem',
        xl: '2rem',
        '2xl': '2rem',
      },
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        // Brand palette from the design guide
        brand: {
          DEFAULT: '#0F3460',
          light: '#2563EB',
          dark: '#0B1F3A',
          accent: '#0EA5E9',
        },
        // Semantic backgrounds and surfaces
        background: {
          primary: '#F7FAFF',
          secondary: '#EEF4FF',
          tertiary: '#E5EEF9',
          elevated: '#FFFFFF',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          subtle: '#F4F7FB',
          raised: '#EDF3FA',
          glass: 'rgba(255, 255, 255, 0.78)',
        },
        border: {
          DEFAULT: '#D8E2F0',
          accent: '#3B82F6',
          subtle: '#E3EAF4',
        },
        text: {
          primary: '#0F172A',
          secondary: '#475569',
          tertiary: '#64748B',
          muted: '#94A3B8',
          inverse: '#FFFFFF',
        },
        status: {
          success: '#10B981',
          warning: '#F59E0B',
          error: '#EF4444',
          info: '#00D9FF',
        },
        // Compatibility aliases for existing code paths
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        accent: {
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
        },
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#00D9FF',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'monospace'],
      },
      spacing: {
        xs: '0.25rem', // 4px
        sm: '0.5rem', // 8px
        md: '0.75rem', // 12px
        lg: '1rem', // 16px
        xl: '1.5rem', // 24px
        '2xl': '2rem', // 32px
        '3xl': '3rem', // 48px
        '4xl': '4rem', // 64px
        '18': '4.5rem',
        '22': '5.5rem',
      },
      borderRadius: {
        none: '0px',
        sm: '0.25rem',
        DEFAULT: '0.5rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
        pill: '9999px',
        '4xl': '2rem',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
        md: '0 4px 6px rgba(0, 0, 0, 0.1)',
        lg: '0 10px 15px rgba(0, 0, 0, 0.2)',
        xl: '0 20px 25px rgba(0, 0, 0, 0.3)',
        glow: '0 0 20px rgba(0, 217, 255, 0.3)',
        'glow-lg': '0 0 40px rgba(0, 217, 255, 0.45)',
        'glow-cyan': '0 0 20px rgba(0, 217, 255, 0.3)',
        glass: '0 4px 30px rgba(0, 0, 0, 0.3)',
        card: '0 4px 20px rgba(0, 0, 0, 0.4)',
        'card-hover': '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(0, 217, 255, 0.15)',
      },
      backdropBlur: {
        'xs': '2px',
      },
      fontSize: {
        display: ['2.5rem', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
        h1: ['2.5rem', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
        h2: ['2rem', { lineHeight: '1.3', letterSpacing: '-0.01em' }],
        h3: ['1.5rem', { lineHeight: '1.3', letterSpacing: '-0.01em' }],
        h4: ['1.125rem', { lineHeight: '1.4' }],
        h5: ['1rem', { lineHeight: '1.4' }],
        body: ['0.9375rem', { lineHeight: '1.6', letterSpacing: '0' }],
        'body-sm': ['0.875rem', { lineHeight: '1.5' }],
        label: ['0.8125rem', { lineHeight: '1.4' }],
        tiny: ['0.75rem', { lineHeight: '1.2' }],
      },
      transitionDuration: {
        fast: '150ms',
        normal: '250ms',
        slow: '350ms',
        modal: '400ms',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        'slide-down': 'slideDown 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        'slide-in-left': 'slideInLeft 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        glow: 'glow 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        elevation: 'elevation 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        'pulse-slow': 'pulse 3s infinite',
        shimmer: 'shimmer 2s linear infinite',
        'float-slow': 'float 6s ease-in-out infinite',
        'fade-rise': 'fadeRise 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
        'panel-enter': 'panelEnter 0.55s cubic-bezier(0.22, 1, 0.36, 1)',
        'stagger-in': 'staggerIn 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
        'glow-pulse': 'glowPulse 2.8s ease-in-out infinite',
        'shine-sweep': 'shineSweep 2.8s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        glow: {
          '0%': { boxShadow: 'none' },
          '100%': { boxShadow: '0 0 20px rgba(0, 217, 255, 0.3)' },
        },
        elevation: {
          '0%': { transform: 'translateY(0)', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' },
          '100%': { transform: 'translateY(-2px)', boxShadow: '0 10px 15px rgba(0, 0, 0, 0.2)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        fadeRise: {
          '0%': { opacity: '0', transform: 'translateY(18px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        panelEnter: {
          '0%': { opacity: '0', transform: 'translateY(24px) scale(0.985)', filter: 'blur(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)', filter: 'blur(0px)' },
        },
        staggerIn: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 0 rgba(0, 217, 255, 0)' },
          '50%': { boxShadow: '0 0 28px rgba(0, 217, 255, 0.22)' },
        },
        shineSweep: {
          '0%': { backgroundPosition: '-120% 0' },
          '100%': { backgroundPosition: '220% 0' },
        },
      },
    },
  },
  plugins: [],
}
