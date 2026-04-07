import React from 'react';
import { cn } from '../../lib/utils';
import { uiStyles } from './styles';

const Card = React.forwardRef(
  ({ className, variant = 'default', hover = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          uiStyles.card.base,
          uiStyles.card.variants[variant],
          hover && uiStyles.card.hover,
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
    <div ref={ref} className={cn(uiStyles.card.header, className)} {...props} />
  )
);

CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef(
  ({ className, children, ...props }, ref) => (
    <h3 ref={ref} className={cn(uiStyles.card.title, className)} {...props}>
      {children}
    </h3>
  )
);

CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn(uiStyles.card.description, className)} {...props} />
  )
);

CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn(uiStyles.card.content, className)} {...props} />
  )
);

CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn(uiStyles.card.footer, className)} {...props} />
  )
);

CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
