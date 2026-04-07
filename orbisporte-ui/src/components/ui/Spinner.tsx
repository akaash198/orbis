import React from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';
import { uiStyles } from './styles';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <Loader2
      className={cn('animate-spin text-brand-accent', uiStyles.spinner.sizes[size], className)}
      aria-hidden="true"
    />
  );
}

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

export function Skeleton({ className, variant = 'rectangular', width, height }: SkeletonProps) {
  const variants = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  return (
    <div
      className={cn('skeleton', variants[variant], className)}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className={uiStyles.emptyState.container}>
      {icon && (
        <div className={uiStyles.emptyState.icon}>
          {icon}
        </div>
      )}
      <h3 className={uiStyles.emptyState.title}>{title}</h3>
      {description && (
        <p className={uiStyles.emptyState.description}>{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}
