import React, { forwardRef, useId } from 'react';
import { cn } from '../../lib/utils';
import { ChevronDown } from 'lucide-react';
import { uiStyles } from './styles';

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
  placeholder?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, options, placeholder, ...props }, ref) => {
    const generatedId = useId();
    const selectId = props.id || generatedId;
    const describedBy = [error ? `${selectId}-error` : null, hint ? `${selectId}-hint` : null]
      .filter(Boolean)
      .join(' ') || undefined;

    return (
      <div className={uiStyles.field.wrapper}>
        {label && (
          <label htmlFor={selectId} className={uiStyles.field.label}>
            {label}
          </label>
        )}
        <div className="relative">
          <select
            id={selectId}
            ref={ref}
            className={cn(
              uiStyles.field.input,
              'appearance-none pr-10',
              error && 'border-error focus:border-error',
              className
            )}
            aria-invalid={Boolean(error) || undefined}
            aria-required={props.required || undefined}
            aria-describedby={describedBy}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
        </div>
        {error && (
          <p id={`${selectId}-error`} className="mt-1.5 text-sm text-error" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${selectId}-hint`} className="mt-1.5 text-sm text-text-muted">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

export { Select };
