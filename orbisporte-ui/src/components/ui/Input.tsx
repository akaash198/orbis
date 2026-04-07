import React, { forwardRef } from 'react';
import { useId } from 'react';
import { cn } from '../../lib/utils';
import { AlertCircle } from 'lucide-react';
import { uiStyles } from './styles';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, icon, type = 'text', ...props }, ref) => {
    const generatedId = useId();
    const inputId = props.id || generatedId;
    const describedBy = [error ? `${inputId}-error` : null, hint ? `${inputId}-hint` : null]
      .filter(Boolean)
      .join(' ') || undefined;

    return (
      <div className={uiStyles.field.wrapper}>
        {label && (
          <label htmlFor={inputId} className={uiStyles.field.label}>
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className={uiStyles.field.icon}>
              {icon}
            </div>
          )}
          <input
            id={inputId}
            type={type}
            ref={ref}
            className={cn(
              uiStyles.field.input,
              icon && '!pl-12',
              error && 'border-error focus:border-error',
              className
            )}
            aria-invalid={Boolean(error) || undefined}
            aria-required={props.required || undefined}
            aria-describedby={describedBy}
            {...props}
          />
        </div>
        {error && (
          <div id={`${inputId}-error`} className={uiStyles.field.error} role="alert">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}
        {hint && !error && (
          <p id={`${inputId}-hint`} className={uiStyles.field.hint}>
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
