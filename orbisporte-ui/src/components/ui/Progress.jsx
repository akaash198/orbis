import React from 'react';
import { cn } from '../../lib/utils';

export function Progress({ value = 0, max = 100, size = 'md', variant = 'default', showLabel = false, className }) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const sizes = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  const variants = {
    default: 'from-primary-500 to-primary-400',
    success: 'from-success to-emerald-400',
    warning: 'from-warning to-amber-400',
    error: 'from-error to-red-400',
  };

  return (
    <div className={cn('w-full', className)}>
      <div className={cn('w-full bg-surface-glass rounded-full overflow-hidden', sizes[size])}>
        <div
          className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-500', variants[variant])}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && <span className="text-xs text-text-muted mt-1">{Math.round(percentage)}%</span>}
    </div>
  );
}