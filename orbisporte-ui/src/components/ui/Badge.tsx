import React from 'react';
import { cn } from '../../lib/utils';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', dot = false, children, ...props }, ref) => {
    const variants: Record<BadgeVariant, string> = {
      default: 'bg-surface-glass border-border text-text-secondary',
      success: 'bg-success/15 border-success/30 text-success',
      warning: 'bg-warning/15 border-warning/30 text-warning',
      error: 'bg-error/15 border-error/30 text-error',
      info: 'bg-primary-500/15 border-primary-500/30 text-primary-400',
      purple: 'bg-purple-500/15 border-purple-500/30 text-purple-400',
    };

    const dotColors: Record<BadgeVariant, string> = {
      default: 'bg-text-muted',
      success: 'bg-success',
      warning: 'bg-warning',
      error: 'bg-error',
      info: 'bg-primary-400',
      purple: 'bg-purple-400',
    };

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border',
          variants[variant],
          className
        )}
        {...props}
      >
        {dot && (
          <span className={cn('w-1.5 h-1.5 rounded-full', dotColors[variant])} />
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export { Badge };