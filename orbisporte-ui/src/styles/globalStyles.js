/**
 * Global Styles â€” OrbisportÃ© Dark Aurora Theme
 * Deep space aesthetic with electric blue aurora accents
 * Supports dark / light mode via [data-theme] on <html>
 */

import { createGlobalStyle } from 'styled-components';
import theme from './theme';

const GlobalStyles = createGlobalStyle`

  /* â”€â”€â”€ Theme CSS custom properties â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  :root,
  [data-theme="dark"] {
    --t-bg:              #0A0D14;
    --t-bg-light:        #111620;
    --t-bg-dark:         #0D1020;
    --t-hero-bg:         radial-gradient(ellipse at 18% 82%, rgba(201,165,32,0.10) 0%, transparent 55%),
                         radial-gradient(ellipse at 82% 18%, rgba(107,188,212,0.08) 0%, transparent 50%),
                         #0A0D14;
    --t-card:            #161D2C;
    --t-card-hover:      #1C2438;
    --t-card-elevated:   #1E2638;
    --t-card-gradient:   linear-gradient(135deg, rgba(22,29,44,0.96) 0%, rgba(28,36,56,0.92) 100%);
    --t-border:          #1E2638;
    --t-border-light:    #141A28;
    --t-hover:           rgba(201,165,32,0.06);
    --t-hover-dark:      rgba(201,165,32,0.10);
    --t-glass:           rgba(22,29,44,0.72);
    --t-glass-light:     rgba(28,36,56,0.84);
    --t-glass-dark:      rgba(10,13,20,0.56);
    --t-overlay:         rgba(4,6,14,0.72);
    --t-text:            #E2E8F5;
    --t-text-sub:        #8B97AE;
    --t-text-ter:        #4A5A72;
    --t-text-hint:       #566478;
    --t-text-dis:        #7A8EAA;
    --t-input-bg:        #0D1020;
    --t-input-border:    #273047;
    --t-input-bg-focus:  #111620;
    --t-scrollbar:       rgba(201,165,32,0.45);
    --t-panel-bg:        radial-gradient(ellipse at 18% 82%, rgba(201,165,32,0.10) 0%, transparent 55%),
                         radial-gradient(ellipse at 85% 15%, rgba(107,188,212,0.08) 0%, transparent 50%),
                         radial-gradient(ellipse at 50% 50%, rgba(17,24,58,0.80)  0%, transparent 80%),
                         #0A0D14;
    --t-card-shadow:     0 2px 8px rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.03);
    --t-card-shadow-hov: 0 8px 28px rgba(0,0,0,0.62), 0 0 20px rgba(201,165,32,0.12);
    --t-btn-bg:          rgba(201,165,32,0.10);
    --t-btn-border:      rgba(201,165,32,0.32);
    --t-btn-color:       #E8C84A;
    --t-btn-bg-hov:      rgba(201,165,32,0.18);
    --t-btn-border-hov:  rgba(201,165,32,0.48);
    --t-btn-dis-bg:      rgba(255,255,255,0.04);
    --t-btn-dis-color:   rgba(139,151,174,0.55);
    --t-btn-dis-border:  rgba(30,38,56,0.90);
    --t-badge-bg:        rgba(201,165,32,0.12);
    --t-badge-color:     #E8C84A;
    --t-badge-border:    rgba(201,165,32,0.30);
    --t-skeleton-a:      rgba(255,255,255,0.04);
    --t-skeleton-b:      rgba(255,255,255,0.08);
    --t-divider:         linear-gradient(90deg, rgba(201,165,32,0.35) 0%, rgba(255,255,255,0.08) 50%, transparent 100%);
  }

  [data-theme="light"] {
    --t-bg:              #f0f5ff;
    --t-bg-light:        #e4edff;
    --t-bg-dark:         rgba(201,165,32,0.04);
    --t-hero-bg:         radial-gradient(ellipse at 15% 85%, rgba(201,165,32,0.10) 0%, transparent 55%),
                         radial-gradient(ellipse at 85% 15%, rgba(107,188,212,0.08)  0%, transparent 50%),
                         #f0f5ff;
    --t-card:            rgba(255,255,255,0.92);
    --t-card-hover:      #ffffff;
    --t-card-elevated:   rgba(255,255,255,0.97);
    --t-card-gradient:   linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.88) 100%);
    --t-border:          rgba(15,23,42,0.12);
    --t-border-light:    rgba(15,23,42,0.07);
    --t-hover:           rgba(201,165,32,0.05);
    --t-hover-dark:      rgba(201,165,32,0.08);
    --t-glass:           rgba(255,255,255,0.80);
    --t-glass-light:     rgba(255,255,255,0.92);
    --t-glass-dark:      rgba(15,23,42,0.08);
    --t-overlay:         rgba(255,255,255,0.70);
    --t-text:            rgba(15,23,42,0.90);
    --t-text-sub:        rgba(15,23,42,0.60);
    --t-text-ter:        rgba(15,23,42,0.40);
    --t-text-hint:       rgba(15,23,42,0.25);
    --t-text-dis:        rgba(15,23,42,0.30);
    --t-input-bg:        rgba(255,255,255,0.80);
    --t-input-border:    rgba(201,165,32,0.22);
    --t-input-bg-focus:  #ffffff;
    --t-scrollbar:       rgba(201,165,32,0.35);
    --t-panel-bg:        radial-gradient(ellipse at 15% 85%, rgba(201,165,32,0.08) 0%, transparent 55%),
                         radial-gradient(ellipse at 85% 15%, rgba(107,188,212,0.06)  0%, transparent 50%),
                         #f0f5ff;
    --t-card-shadow:     0 2px 12px rgba(15,23,42,0.08), 0 1px 3px rgba(15,23,42,0.05);
    --t-card-shadow-hov: 0 8px 28px rgba(15,23,42,0.12), 0 0 20px rgba(201,165,32,0.08);
    --t-btn-bg:          rgba(201,165,32,0.08);
    --t-btn-border:      rgba(201,165,32,0.35);
    --t-btn-color:       #876E12;
    --t-btn-bg-hov:      rgba(201,165,32,0.18);
    --t-btn-border-hov:  rgba(201,165,32,0.38);
    --t-btn-dis-bg:      rgba(15,23,42,0.05);
    --t-btn-dis-color:   rgba(15,23,42,0.30);
    --t-btn-dis-border:  rgba(15,23,42,0.12);
    --t-badge-bg:        rgba(201,165,32,0.10);
    --t-badge-color:     #876E12;
    --t-badge-border:    rgba(201,165,32,0.26);
    --t-skeleton-a:      rgba(15,23,42,0.05);
    --t-skeleton-b:      rgba(15,23,42,0.10);
    --t-divider:         linear-gradient(90deg, rgba(201,165,32,0.35) 0%, rgba(15,23,42,0.08) 50%, transparent 100%);
  }

  /* â”€â”€â”€ Reset â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  html {
    scroll-behavior: smooth;
  }

  body {
    font-family: ${theme.typography.fontFamily.main};
    background: var(--t-bg);
    color: var(--t-text);
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    font-feature-settings: 'cv03', 'cv04', 'cv11';
    overflow-x: hidden;
    min-height: 100vh;
    text-rendering: optimizeLegibility;
    font-weight: ${theme.typography.fontWeight.regular};
    transition: background 0.3s ease, color 0.3s ease;
  }

  pre, code {
    font-family: ${theme.typography.fontFamily.mono};
    font-size: 0.9em;
  }

  h1, h2, h3, h4, h5, h6 {
    font-weight: ${theme.typography.fontWeight.bold};
    margin-bottom: ${theme.spacing.md}px;
    letter-spacing: -0.02em;
    line-height: 1.25;
    color: var(--t-text);
  }

  h1 { font-size: ${theme.typography.fontSize['4xl']}; font-weight: ${theme.typography.fontWeight.extrabold}; }
  h2 { font-size: ${theme.typography.fontSize['3xl']}; font-weight: ${theme.typography.fontWeight.bold}; }
  h3 { font-size: ${theme.typography.fontSize.xxl};   font-weight: ${theme.typography.fontWeight.semibold}; }

  p {
    margin-bottom: ${theme.spacing.md}px;
    line-height: 1.65;
    color: ${theme.colors.text.primary};
  }

  a {
    color: var(--t-btn-color);
    text-decoration: none;
    transition: color ${theme.transitions.fast};
    &:hover { color: var(--t-btn-color); opacity: 0.8; }
  }

  button {
    font-family: inherit;
    font-size: inherit;
    line-height: inherit;
    color: inherit;
    background: transparent;
    border: 0;
    padding: 0;
    margin: 0;
    cursor: pointer;
  }

  input, textarea, select {
    width: 100%;
    padding: ${theme.spacing.sm}px ${theme.spacing.md}px;
    background: var(--t-input-bg);
    border: 1px solid var(--t-input-border);
    border-radius: ${theme.radius.md}px;
    font-family: ${theme.typography.fontFamily.main};
    font-size: ${theme.typography.fontSize.sm};
    font-weight: ${theme.typography.fontWeight.regular};
    color: var(--t-text);
    transition: all ${theme.transitions.normal} ${theme.transitions.easing.default};
    box-shadow: ${theme.shadows.inner};

    &::placeholder {
      color: var(--t-text-hint);
    }

    &:focus {
      outline: none;
      border-color: #C9A520;
      box-shadow: 0 0 0 3px rgba(201,165,32,0.2);
      background: var(--t-input-bg-focus);
    }

    &:hover:not(:focus) {
      border-color: var(--t-border);
    }

    &:disabled {
      background: var(--t-bg-dark);
      color: var(--t-text-dis);
      cursor: not-allowed;
      opacity: 0.6;
    }
  }

  textarea {
    min-height: 100px;
    resize: vertical;
    line-height: 1.5;
  }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: var(--t-bg-dark); }
  ::-webkit-scrollbar-thumb {
    background: var(--t-scrollbar);
    border-radius: 10px;
  }
  ::-webkit-scrollbar-thumb:hover { background: #C9A520; }

  /* Keyframe animations */
  @keyframes spin {
    0%   { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @keyframes slideInRight {
    from { opacity: 0; transform: translateX(24px); }
    to   { opacity: 1; transform: translateX(0); }
  }

  @keyframes slideInLeft {
    from { opacity: 0; transform: translateX(-24px); }
    to   { opacity: 1; transform: translateX(0); }
  }

  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.92); }
    to   { opacity: 1; transform: scale(1); }
  }

  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(201,165,32,0.35); }
    50%       { box-shadow: 0 0 0 8px rgba(201,165,32,0); }
  }

  @keyframes shimmer {
    0%   { background-position: -400px 0; }
    100% { background-position: calc(400px + 100%) 0; }
  }

  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50%       { transform: translateY(-8px); }
  }

  @keyframes bgShift {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.85; }
  }

  /* Utility classes */
  .animate-fade-in       { animation: fadeIn 0.4s ease-out; }
  .animate-slide-in-right{ animation: slideInRight 0.4s ease-out; }
  .animate-slide-in-left { animation: slideInLeft 0.4s ease-out; }
  .animate-scale-in      { animation: scaleIn 0.3s ease-out; }
  .animate-pulse         { animation: pulse 2s infinite; }

  /* Glassmorphism card â€” theme-aware */
  .card-brochure {
    background: var(--t-card);
    border-radius: ${theme.radius.lg}px;
    border: 1px solid var(--t-border);
    border-left: 4px solid #C9A520;
    box-shadow: var(--t-card-shadow);
    backdrop-filter: blur(20px);
    transition: box-shadow ${theme.transitions.normal}, transform ${theme.transitions.normal};

    &:hover {
      box-shadow: var(--t-card-shadow-hov);
      transform: ${theme.transforms.cardHover3D};
    }
  }

  /* Loading skeleton */
  .loading-skeleton {
    background: linear-gradient(90deg,
      var(--t-skeleton-a) 25%,
      var(--t-skeleton-b) 50%,
      var(--t-skeleton-a) 75%
    );
    background-size: 400px 100%;
    animation: shimmer 1.5s infinite;
  }

  /* Badge / pill tag */
  .badge {
    display: inline-flex;
    align-items: center;
    padding: 3px 10px;
    border-radius: ${theme.radius.pill}px;
    font-size: ${theme.typography.fontSize.xs};
    font-weight: ${theme.typography.fontWeight.semibold};
    background: var(--t-badge-bg);
    color: var(--t-badge-color);
    border: 1px solid var(--t-badge-border);
  }

  /* Section divider */
  .section-divider {
    height: 1px;
    background: var(--t-divider);
    border: none;
    margin: ${theme.spacing.md}px 0 ${theme.spacing.lg}px;
  }

  /* Focus ring */
  .focus-ring:focus {
    outline: none;
    box-shadow: 0 0 0 3px rgba(201,165,32,0.3);
  }

  .transition-all {
    transition: all ${theme.transitions.normal} ${theme.transitions.easing.default};
  }
`;

export default GlobalStyles;
