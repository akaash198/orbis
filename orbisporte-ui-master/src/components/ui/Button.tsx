import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';
import { uiStyles } from './styles';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, icon, iconPosition = 'left', children, disabled, ...props }, ref) => {
    const classes = cn(
      uiStyles.button.base,
      uiStyles.button.variants[variant],
      uiStyles.button.sizes[size],
      className
    );

    return (
      <button
        ref={ref}
        type={props.type || 'button'}
        className={classes}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        aria-disabled={disabled || loading || undefined}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : icon && iconPosition === 'left' ? (
          icon
        ) : null}
        {children}
        {!loading && icon && iconPosition === 'right' ? (
          icon
        ) : null}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
