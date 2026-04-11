import React from 'react';
import { cn } from '../../lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

/**
 * Animated loading placeholder.
 */
export function Skeleton({ className, variant = 'rectangular', width, height, ...props }: SkeletonProps) {
  const variants = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  return (
    <div
      aria-hidden="true"
      className={cn(
        'skeleton',
        variants[variant],
        className
      )}
      style={{ width, height }}
      {...props}
    />
  );
}
