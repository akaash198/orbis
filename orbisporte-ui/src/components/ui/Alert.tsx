import React from 'react';
import { cn } from '../../lib/utils';
import { CheckCircle2, AlertTriangle, AlertCircle, Info } from 'lucide-react';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'success' | 'warning' | 'error' | 'info';
  title?: string;
}

/**
 * Inline status alert with semantic variants.
 */
export function Alert({ className, variant = 'info', title, children, ...props }: AlertProps) {
  const styles = {
    success: 'border-success/30 bg-success/10 text-success',
    warning: 'border-warning/30 bg-warning/10 text-warning',
    error: 'border-error/30 bg-error/10 text-error',
    info: 'border-brand-accent/30 bg-brand-accent/10 text-brand-accent',
  };

  const Icon = {
    success: CheckCircle2,
    warning: AlertTriangle,
    error: AlertCircle,
    info: Info,
  }[variant];

  return (
    <div
      role="alert"
      className={cn('flex gap-3 rounded-xl border px-4 py-3', styles[variant], className)}
      {...props}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        {title ? <div className="text-sm font-semibold">{title}</div> : null}
        <div className="text-sm text-text-secondary">{children}</div>
      </div>
    </div>
  );
}
