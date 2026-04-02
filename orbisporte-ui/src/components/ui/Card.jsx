import React from 'react';
import { cn } from '../../lib/utils';

const Card = React.forwardRef(
  ({ className, variant = 'default', hover = false, children, ...props }, ref) => {
    const variants = {
      default: 'bg-surface border border-border',
      elevated: 'bg-surface border border-border shadow-card',
      glass: 'bg-surface-glass/50 backdrop-blur-xl border border-border',
    };

    const hoverStyles = hover ? 'hover:shadow-card-hover hover:border-border-glow hover:-translate-y-0.5 transition-all duration-300' : '';

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-xl p-5',
          variants[variant],
          hoverStyles,
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

const CardHeader = React.forwardRef(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col gap-1.5 mb-4', className)} {...props} />
  )
);

CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('text-lg font-semibold text-text-primary', className)} {...props} />
  )
);

CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-text-secondary', className)} {...props} />
  )
);

CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('', className)} {...props} />
  )
);

CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center gap-3 mt-4 pt-4 border-t border-border', className)} {...props} />
  )
);

CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };