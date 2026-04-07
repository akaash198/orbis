import React, { useId, useState } from 'react';
import ReactDOM from 'react-dom';
import { cn } from '../../lib/utils';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * Lightweight tooltip for hover/focus help text.
 */
export function Tooltip({ content, children, placement = 'top' }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  const placements = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <span className="relative inline-flex">
      {React.cloneElement(children, {
        onMouseEnter: () => setOpen(true),
        onMouseLeave: () => setOpen(false),
        onFocus: () => setOpen(true),
        onBlur: () => setOpen(false),
        'aria-describedby': tooltipId,
      })}
      {open
        ? ReactDOM.createPortal(
            <span
              id={tooltipId}
              role="tooltip"
              className={cn(
                'pointer-events-none fixed z-50 max-w-xs rounded-lg border border-border bg-background-secondary px-3 py-2 text-tiny text-text-primary shadow-xl',
                placements[placement]
              )}
            >
              {content}
            </span>,
            document.body
          )
        : null}
    </span>
  );
}
