import React from 'react';
import { cn } from '../../lib/utils';
import { uiStyles } from './styles';

const Badge = React.forwardRef(
  ({ className, variant = 'brand', dot = false, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          uiStyles.badge.base,
          uiStyles.badge.variants[variant],
          className
        )}
        {...props}
      >
        {dot && (
          <span className={cn('h-1.5 w-1.5 rounded-full', uiStyles.badge.dots[variant])} />
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export { Badge };
