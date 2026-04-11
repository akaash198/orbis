import { cn } from '../../lib/utils';

export const uiStyles = {
  button: {
    base:
      'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-150 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.97] border',
    variants: {
      primary:
        'bg-[#C9A520] text-[#0A0D14] border-[#C9A520] hover:bg-[#E8C84A] hover:border-[#E8C84A] hover:shadow-[0_0_12px_rgba(201,165,32,0.22)]',
      secondary:
        'bg-transparent text-[#E8C84A] border-[rgba(201,165,32,0.28)] hover:bg-[rgba(201,165,32,0.10)]',
      ghost:
        'bg-transparent text-[#8B97AE] border-transparent hover:bg-[rgba(255,255,255,0.04)] hover:text-[#E2E8F5]',
      outline:
        'bg-transparent text-[#E8C84A] border-[rgba(201,165,32,0.28)] hover:bg-[rgba(201,165,32,0.10)] hover:border-[#C9A520]',
      danger:
        'bg-[rgba(224,86,86,0.12)] text-[#F07070] border-[rgba(224,86,86,0.28)] hover:bg-[rgba(224,86,86,0.22)]',
    },
    sizes: {
      sm: 'h-8 px-3.5 text-[12px]',
      md: 'h-9 px-4 text-[13px]',
      lg: 'h-12 px-6 text-[15px]',
    },
  },
  card: {
    base: 'rounded-xl border border-[#1E2638] bg-[#161D2C] text-[#E2E8F5] shadow-[0_4px_16px_rgba(0,0,0,0.18)] transition-all duration-200 overflow-hidden',
    variants: {
      default: '',
      elevated: 'shadow-[0_8px_24px_rgba(0,0,0,0.22)]',
      glass: 'bg-[rgba(22,29,44,0.85)] backdrop-blur-md',
      dark: 'bg-[#111620] border-[#141A28]',
    },
    hover: 'hover:border-[#273047] hover:shadow-[0_8px_24px_rgba(0,0,0,0.22)] hover:-translate-y-0.5',
    header: 'px-6 pt-6 pb-4 flex flex-col gap-1',
    title: 'text-[16px] font-semibold tracking-tight text-[#E2E8F5]',
    description: 'text-[13px] text-[#8B97AE]',
    content: 'px-6 pb-6',
    footer: 'px-6 py-4 flex items-center gap-3 border-t border-[#1E2638]',
  },
  field: {
    label: 'mb-1.5 block text-[12px] font-semibold text-[#8B97AE]',
    wrapper: 'w-full',
    input:
      'flex w-full rounded-lg border border-[#273047] bg-[#0D1020] px-4 text-[15px] text-[#E2E8F5] placeholder:text-[#4A5A72] transition-all duration-150 focus:border-[#C9A520] focus:outline-none focus:shadow-[0_0_0_3px_rgba(201,165,32,0.20)] h-11',
    error: 'mt-1.5 text-[11px] text-[#F07070]',
    hint: 'mt-1.5 text-[11px] text-[#4A5A72]',
    icon: 'pointer-events-none absolute left-3 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center text-[#4A5A72]',
  },
  badge: {
    base:
      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap',
    variants: {
      brand:   'border-[rgba(201,165,32,0.28)] bg-[rgba(201,165,32,0.10)] text-[#E8C84A]',
      gold:    'border-[rgba(201,165,32,0.28)] bg-[rgba(201,165,32,0.10)] text-[#E8C84A]',
      success: 'border-[rgba(61,190,126,0.28)] bg-[rgba(61,190,126,0.12)] text-[#5AD49A]',
      warning: 'border-[rgba(232,147,74,0.28)] bg-[rgba(232,147,74,0.12)] text-[#F5A96A]',
      error:   'border-[rgba(224,86,86,0.28)] bg-[rgba(224,86,86,0.12)] text-[#F07070]',
      info:    'border-[rgba(107,188,212,0.28)] bg-[rgba(107,188,212,0.12)] text-[#8DD4EC]',
      purple:  'border-[rgba(154,140,232,0.28)] bg-[rgba(154,140,232,0.12)] text-[#B8AEFF]',
    },
    dots: {
      default: 'bg-[#4A5A72]',
      brand:   'bg-[#C9A520]',
      gold:    'bg-[#C9A520]',
      success: 'bg-[#3DBE7E]',
      warning: 'bg-[#E8934A]',
      error:   'bg-[#E05656]',
      info:    'bg-[#6BBCD4]',
      purple:  'bg-[#9A8CE8]',
    },
  },
  progress: {
    track: 'overflow-hidden rounded-full bg-[#1E2638]',
    sizes: {
      sm: 'h-1.5',
      md: 'h-2',
      lg: 'h-3',
    },
    variants: {
      default: 'bg-[#C9A520]',
      success: 'bg-[#3DBE7E]',
      warning: 'bg-[#E8934A]',
      error:   'bg-[#E05656]',
      info:    'bg-[#6BBCD4]',
    },
    label: 'mt-1 text-[10px] uppercase tracking-wider text-[#4A5A72]',
  },
};

export function getButtonClasses(variant = 'primary', size = 'md', className = '') {
  return cn(uiStyles.button.base, uiStyles.button.variants[variant], uiStyles.button.sizes[size], className);
}

export function getCardClasses(variant = 'default', hover = false, className = '') {
  return cn(uiStyles.card.base, uiStyles.card.variants[variant], hover && uiStyles.card.hover, className);
}

export function getFieldClasses({ error = false, className = '' } = {}) {
  return cn(
    uiStyles.field.input,
    error && 'border-[#E05656] focus:shadow-[0_0_0_3px_rgba(224,86,86,0.15)]',
    className
  );
}

export function getBadgeClasses(variant = 'brand', className = '') {
  return cn(uiStyles.badge.base, uiStyles.badge.variants[variant], className);
}
