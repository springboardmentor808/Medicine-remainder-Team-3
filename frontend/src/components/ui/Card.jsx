'use client';

import React from 'react';

/**
 * Card — Vitality Core Design System
 * White surface card with 16px radius, 24px padding, subtle shadow.
 *
 * Variants: default | elevated | tonal | outlined | flat
 *
 * Usage:
 *   <Card>...</Card>
 *   <Card variant="elevated" padding="sm">...</Card>
 *   <Card as="article" onClick={fn} hoverable>...</Card>
 */

const VARIANTS = {
  default: [
    'bg-surface-container-lowest',
    'border border-outline-variant/30',
    'shadow-card',
  ].join(' '),

  elevated: [
    'bg-surface-container-lowest',
    'border border-outline-variant/20',
    'shadow-elevated',
  ].join(' '),

  tonal: [
    'bg-surface-container',
    'border border-outline-variant/20',
    'shadow-sm',
  ].join(' '),

  outlined: [
    'bg-surface-container-lowest',
    'border-2 border-outline-variant',
    'shadow-none',
  ].join(' '),

  flat: [
    'bg-surface-container-low',
    'border border-transparent',
    'shadow-none',
  ].join(' '),
};

const PADDING = {
  none: 'p-0',
  xs:   'p-xs',
  sm:   'p-sm',
  md:   'p-md',
  lg:   'p-card-padding',  // 24px — design spec
  xl:   'p-xl',
};

const Card = React.forwardRef(function Card(
  {
    children,
    variant = 'default',
    padding = 'lg',
    hoverable = false,
    clickable = false,
    as: Tag = 'div',
    className = '',
    ...props
  },
  ref
) {
  return (
    <Tag
      ref={ref}
      className={[
        // Base
        'rounded-lg transition-all duration-200',
        // Variant
        VARIANTS[variant] ?? VARIANTS.default,
        // Padding
        PADDING[padding] ?? PADDING.lg,
        // Hover state
        hoverable
          ? 'hover:shadow-elevated hover:-translate-y-0.5 cursor-pointer'
          : '',
        // Clickable (accessible)
        clickable
          ? 'cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none'
          : '',
        // Custom
        className,
      ].join(' ')}
      {...(clickable ? { tabIndex: 0, role: 'button' } : {})}
      {...props}
    >
      {children}
    </Tag>
  );
});

// ── Card Sub-components ───────────────────────────────────────────────────────

/** Card.Header — Title row with optional action */
Card.Header = function CardHeader({
  title,
  subtitle,
  action,
  icon,
  className = '',
  children,
}) {
  return (
    <div className={`flex items-start justify-between gap-sm ${className}`}>
      <div className="flex items-center gap-xs min-w-0">
        {icon && (
          <div className="shrink-0 w-10 h-10 rounded-md flex items-center justify-center bg-primary/10 text-primary">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          {title && (
            <h3 className="text-body-sm font-semibold text-on-surface truncate leading-tight">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-caption text-on-surface-variant truncate mt-0.5">
              {subtitle}
            </p>
          )}
          {children}
        </div>
      </div>
      {action && <div className="shrink-0 ml-auto">{action}</div>}
    </div>
  );
};

/** Card.Body — Content area */
Card.Body = function CardBody({ children, className = '' }) {
  return (
    <div className={`mt-md ${className}`}>
      {children}
    </div>
  );
};

/** Card.Footer — Bottom action row */
Card.Footer = function CardFooter({ children, className = '', divider = false }) {
  return (
    <div
      className={[
        'mt-md flex items-center gap-sm',
        divider ? 'pt-md border-t border-outline-variant/40' : '',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
};

/** Card.Divider — Subtle separator */
Card.Divider = function CardDivider({ className = '' }) {
  return (
    <hr
      className={`my-md border-0 border-t border-outline-variant/40 ${className}`}
    />
  );
};

Card.displayName = 'Card';
export default Card;
export { Card };
