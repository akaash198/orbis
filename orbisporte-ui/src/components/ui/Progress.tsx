import React from 'react';
import { cn } from '../../lib/utils';
import { uiStyles } from './styles';

interface ProgressProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'warning' | 'error';
  showLabel?: boolean;
  className?: string;
}

export function Progress({
  value,
  max = 100,
  size = 'md',
  variant = 'default',
  showLabel = false,
  className,
}: ProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className={cn('w-full', className)}>
      <div
        className={cn('w-full', uiStyles.progress.track, uiStyles.progress.sizes[size])}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.round(percentage)}
        aria-valuetext={`${Math.round(percentage)}%`}
      >
        <div
          className={cn(
            'h-full rounded-full bg-gradient-to-r transition-all duration-300',
            uiStyles.progress.variants[variant]
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <span className={uiStyles.progress.label}>{Math.round(percentage)}%</span>
      )}
    </div>
  );
}
