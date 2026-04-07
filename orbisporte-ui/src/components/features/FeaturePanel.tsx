import React from 'react';
import { ChevronRight, Clock3 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Card, CardContent } from '../ui/Card';

export type FeaturePanelBreadcrumb = {
  label: string;
  onClick?: () => void;
  href?: string;
};

export type FeaturePanelStat = {
  label: string;
  value: string | number;
  helper?: string;
  tone?: 'brand' | 'success' | 'warning' | 'error' | 'neutral';
};

export interface FeaturePanelProps extends React.HTMLAttributes<HTMLElement> {
  breadcrumbs?: FeaturePanelBreadcrumb[];
  title: string;
  description?: string;
  updatedAt?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  toolbar?: React.ReactNode;
  stats?: FeaturePanelStat[];
  sidebar?: React.ReactNode;
  footer?: React.ReactNode;
  contentClassName?: string;
  sidebarClassName?: string;
}

const toneStyles: Record<NonNullable<FeaturePanelStat['tone']>, string> = {
  brand: 'border-brand/30 bg-brand/10 text-brand',
  success: 'border-success/30 bg-success/10 text-success',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  error: 'border-error/30 bg-error/10 text-error',
  neutral: 'border-border bg-surface text-text-primary',
};

function Breadcrumbs({ items }: { items: FeaturePanelBreadcrumb[] }) {
  if (!items.length) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-text-secondary">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={`${item.label}-${index}`}>
            {index > 0 ? <ChevronRight className="h-3.5 w-3.5 text-text-tertiary" aria-hidden="true" /> : null}
            {item.href ? (
              <a
                href={item.href}
                aria-current={isLast ? 'page' : undefined}
                className={cn(
                  'transition-colors hover:text-text-primary',
                  isLast && 'font-medium text-text-primary'
                )}
              >
                {item.label}
              </a>
            ) : item.onClick ? (
              <button
                type="button"
                onClick={item.onClick}
                aria-current={isLast ? 'page' : undefined}
                className={cn(
                  'transition-colors hover:text-text-primary',
                  isLast && 'font-medium text-text-primary'
                )}
              >
                {item.label}
              </button>
            ) : (
              <span className={isLast ? 'font-medium text-text-primary' : ''}>{item.label}</span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

export function FeaturePanel({
  breadcrumbs = [],
  title,
  description,
  updatedAt,
  badge,
  actions,
  toolbar,
  stats = [],
  sidebar,
  footer,
  contentClassName,
  sidebarClassName,
  className,
  children,
  ...props
}: FeaturePanelProps) {
  const hasSidebar = Boolean(sidebar);

  return (
    <section
      className={cn(
        'space-y-6 overflow-hidden rounded-[var(--radius-3xl)] border border-border bg-gradient-to-br from-surface to-background-secondary p-3 shadow-[var(--shadow-card)] animate-panel-enter sm:p-5 lg:p-8',
        className
      )}
      {...props}
    >
      <header className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3 animate-stagger-in stagger-1">
            {breadcrumbs.length ? <Breadcrumbs items={breadcrumbs} /> : null}
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-display text-text-primary">{title}</h1>
              {badge ? <span className="shrink-0">{badge}</span> : null}
            </div>
            {description ? <p className="max-w-3xl text-body text-text-secondary">{description}</p> : null}
            {updatedAt ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-tiny text-text-secondary">
                <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{updatedAt}</span>
              </div>
            ) : null}
          </div>

          {actions ? <div className="flex flex-wrap items-center gap-2 animate-stagger-in stagger-2">{actions}</div> : null}
        </div>

        {stats.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat, index) => (
              <Card
                key={stat.label}
                hover
                className={cn(
                  'border-border/70 bg-surface/80 animate-stagger-in',
                  index === 0 && 'stagger-1',
                  index === 1 && 'stagger-2',
                  index === 2 && 'stagger-3',
                  index === 3 && 'stagger-4'
                )}
              >
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-label font-medium text-text-secondary">{stat.label}</p>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-tiny font-medium capitalize',
                        toneStyles[stat.tone ?? 'neutral']
                      )}
                    >
                      {stat.tone ?? 'neutral'}
                    </span>
                  </div>
                  <div className="text-2xl font-semibold tracking-tight text-text-primary">{stat.value}</div>
                  {stat.helper ? <p className="text-body-sm text-text-tertiary">{stat.helper}</p> : null}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}

        {toolbar ? (
          <div className="rounded-2xl border border-border bg-background-secondary/70 p-4 shadow-[var(--shadow-sm)] animate-fade-rise">
            {toolbar}
          </div>
        ) : null}
      </header>

      <div
        className={cn(
          'grid gap-6',
          hasSidebar ? 'lg:grid-cols-[minmax(0,1fr)_320px]' : 'grid-cols-1',
          contentClassName
        )}
      >
        <div className="min-w-0 space-y-6">{children}</div>

        {hasSidebar ? (
          <aside className={cn('space-y-4 lg:sticky lg:top-6 lg:self-start animate-fade-rise stagger-2', sidebarClassName)}>
            {sidebar}
          </aside>
        ) : null}
      </div>

      {footer ? <footer className="pt-2">{footer}</footer> : null}
    </section>
  );
}

export default FeaturePanel;
