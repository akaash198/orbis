import React, { createContext, useContext, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

type AccordionContextValue = {
  openItems: string[];
  toggleItem: (value: string) => void;
};

const AccordionContext = createContext<AccordionContextValue | null>(null);

export interface AccordionProps {
  type?: 'single' | 'multiple';
  value?: string | string[];
  defaultValue?: string | string[];
  onValueChange?: (value: string | string[]) => void;
  children: React.ReactNode;
}

export function Accordion({
  type = 'single',
  value,
  defaultValue,
  onValueChange,
  children,
}: AccordionProps) {
  const initial = Array.isArray(defaultValue) ? defaultValue : defaultValue ? [defaultValue] : [];
  const [internalOpen, setInternalOpen] = useState<string[]>(initial);
  const controlled = value !== undefined;

  const context = useMemo(
    () => {
      const openItems = controlled ? (Array.isArray(value) ? value : [value]) : internalOpen;

      return {
        openItems,
      toggleItem: (itemValue: string) => {
        let next: string[];
        if (type === 'single') {
          next = openItems[0] === itemValue ? [] : [itemValue];
        } else {
          next = openItems.includes(itemValue)
            ? openItems.filter((item) => item !== itemValue)
            : [...openItems, itemValue];
        }

        if (!controlled) setInternalOpen(next);
        onValueChange?.(type === 'single' ? next[0] || '' : next);
      },
      };
    },
    [controlled, internalOpen, onValueChange, type, value]
  );

  return <AccordionContext.Provider value={context}>{children}</AccordionContext.Provider>;
}

export function AccordionItem({ value, className, children }: React.HTMLAttributes<HTMLDivElement> & { value: string }) {
  return (
    <div className={cn('border-b border-border last:border-b-0', className)} data-accordion-item={value}>
      {children}
    </div>
  );
}

export function AccordionTrigger({
  value,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) {
  const context = useContext(AccordionContext);
  if (!context) throw new Error('AccordionTrigger must be used within Accordion');
  const open = context.openItems.includes(value);

  return (
    <button
      type="button"
      onClick={() => context.toggleItem(value)}
      aria-expanded={open}
      className={cn(
        'flex w-full items-center justify-between gap-4 py-4 text-left text-sm font-medium text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background-primary',
        className
      )}
      {...props}
    >
      <span>{children}</span>
      <ChevronDown className={cn('h-4 w-4 text-text-tertiary transition-transform duration-200', open && 'rotate-180')} aria-hidden="true" />
    </button>
  );
}

export function AccordionContent({
  value,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { value: string }) {
  const context = useContext(AccordionContext);
  if (!context) throw new Error('AccordionContent must be used within Accordion');
  const open = context.openItems.includes(value);
  if (!open) return null;

  return (
    <div className={cn('pb-4 text-body-sm text-text-secondary', className)} {...props}>
      {children}
    </div>
  );
}
