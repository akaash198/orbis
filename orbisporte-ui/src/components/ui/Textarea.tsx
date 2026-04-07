import React, { forwardRef } from 'react';
import { useId } from 'react';
import { cn } from '../../lib/utils';
import { uiStyles } from './styles';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, ...props }, ref) => {
    const generatedId = useId();
    const textareaId = props.id || generatedId;
    const describedBy = [error ? `${textareaId}-error` : null, hint ? `${textareaId}-hint` : null]
      .filter(Boolean)
      .join(' ') || undefined;

    return (
      <div className={uiStyles.field.wrapper}>
        {label && (
          <label htmlFor={textareaId} className={uiStyles.field.label}>
            {label}
          </label>
        )}
        <textarea
          id={textareaId}
          ref={ref}
          className={cn(
            uiStyles.field.input,
            'min-h-[100px] resize-y',
            error && 'border-error focus:border-error',
            className
          )}
          aria-invalid={Boolean(error) || undefined}
          aria-required={props.required || undefined}
          aria-describedby={describedBy}
          {...props}
        />
        {error && (
          <p id={`${textareaId}-error`} className="mt-1.5 text-sm text-error" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${textareaId}-hint`} className="mt-1.5 text-sm text-text-muted">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export { Textarea };
