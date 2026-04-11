import React, { forwardRef, useId } from 'react';
import { cn } from '../../lib/utils';

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  description?: string;
  error?: string;
}

/**
 * Radio button primitive with helper text and error support.
 */
export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  ({ className, label, description, error, id, ...props }, ref) => {
    const generatedId = useId();
    const radioId = id || generatedId;
    const descriptionId = description ? `${radioId}-description` : undefined;
    const errorId = error ? `${radioId}-error` : undefined;

    return (
      <div className="flex items-start gap-3">
        <input
          ref={ref}
          id={radioId}
          type="radio"
          className={cn(
            'mt-0.5 h-5 w-5 cursor-pointer appearance-none rounded-full border border-border bg-surface transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background-primary checked:border-brand-accent checked:bg-brand-accent',
            error && 'border-error focus-visible:ring-error',
            className
          )}
          aria-describedby={[descriptionId, errorId].filter(Boolean).join(' ') || undefined}
          {...props}
        />
        <div className="min-w-0">
          {label ? (
            <label htmlFor={radioId} className="block cursor-pointer text-sm font-medium text-text-primary">
              {label}
            </label>
          ) : null}
          {description ? (
            <p id={descriptionId} className="mt-0.5 text-sm text-text-secondary">
              {description}
            </p>
          ) : null}
          {error ? (
            <p id={errorId} className="mt-0.5 text-sm text-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    );
  }
);

Radio.displayName = 'Radio';
