'use client';

import React from 'react';

/**
 * Badge — Vitality Core Design System
 * Pill-shaped status chips for medication states, user roles, alerts.
 *
 * Variants: taken | missed | pending | low-stock | upcoming | default
 *           primary | secondary | tertiary | error | success | warning
 *
 * Usage:
 *   <Badge>Taken</Badge>
 *   <Badge variant="missed">Missed</Badge>
 *   <Badge variant="low-stock" dot>Low Stock</Badge>
 *   <Badge variant="pending" size="sm">Pending</Badge>
 */

const VARIANTS = {
  // Medication-specific states
  taken: [
    'bg-tertiary-container/20 text-tertiary border border-tertiary/20',
  ].join(''),
  missed: [
    'bg-error-container/40 text-error border border-error/20',
  ].join(''),
  pending: [
    'bg-secondary-container/20 text-secondary border border-secondary/20',
  ].join(''),
  'low-stock': [
    'bg-secondary-container/25 text-secondary border border-secondary/30',
  ].join(''),
  upcoming: [
    'bg-surface-container text-on-surface-variant border border-outline-variant/50',
  ].join(''),
  snoozed: [
    'bg-primary-fixed/30 text-primary border border-primary/20',
  ].join(''),

  // Role badges
  patient: [
    'bg-primary-fixed/30 text-primary border border-primary/20',
  ].join(''),
  caregiver: [
    'bg-tertiary-fixed/30 text-tertiary border border-tertiary/20',
  ].join(''),
  admin: [
    'bg-surface-container-high text-on-surface border border-outline-variant',
  ].join(''),

  // Generic semantic
  primary: [
    'bg-primary/10 text-primary border border-primary/20',
  ].join(''),
  secondary: [
    'bg-secondary/10 text-secondary border border-secondary/20',
  ].join(''),
  tertiary: [
    'bg-tertiary/10 text-tertiary border border-tertiary/20',
  ].join(''),
  error: [
    'bg-error/10 text-error border border-error/20',
  ].join(''),
  success: [
    'bg-tertiary/10 text-tertiary border border-tertiary/20',
  ].join(''),
  warning: [
    'bg-secondary/10 text-secondary border border-secondary/20',
  ].join(''),

  // Default neutral
  default: [
    'bg-surface-container text-on-surface-variant border border-outline-variant/50',
  ].join(''),
};

const SIZES = {
  xs: 'px-1.5 py-0.5 text-[10px] leading-[14px] rounded-full',
  sm: 'px-xs py-0.5 text-label-caps rounded-full',
  md: 'px-sm py-1  text-label-caps rounded-full',
  lg: 'px-sm py-1.5 text-caption rounded-full',
};

/** Dot indicator colors */
const DOT_COLORS = {
  taken:      'bg-tertiary',
  missed:     'bg-error',
  pending:    'bg-secondary',
  'low-stock':'bg-secondary',
  upcoming:   'bg-on-surface-variant',
  snoozed:    'bg-primary',
  primary:    'bg-primary',
  secondary:  'bg-secondary',
  tertiary:   'bg-tertiary',
  error:      'bg-error',
  success:    'bg-tertiary',
  warning:    'bg-secondary',
  default:    'bg-on-surface-variant',
};

/** Pulse (live indicator) variants */
const PULSE_VARIANTS = ['pending', 'upcoming', 'snoozed'];

const Badge = React.forwardRef(function Badge(
  {
    children,
    variant = 'default',
    size = 'md',
    dot = false,
    pulse = false,
    icon,
    removable = false,
    onRemove,
    className = '',
    as: Tag = 'span',
    ...props
  },
  ref
) {
  const shouldPulse = pulse || (dot && PULSE_VARIANTS.includes(variant));
  const dotColor = DOT_COLORS[variant] ?? 'bg-on-surface-variant';

  return (
    <Tag
      ref={ref}
      className={[
        // Base
        'inline-flex items-center gap-1 font-semibold uppercase tracking-wide',
        'whitespace-nowrap select-none',
        // Variant
        VARIANTS[variant] ?? VARIANTS.default,
        // Size
        SIZES[size] ?? SIZES.md,
        // Custom
        className,
      ].join(' ')}
      {...props}
    >
      {/* Dot indicator */}
      {dot && (
        <span className="relative flex items-center shrink-0">
          {shouldPulse && (
            <span
              className={`absolute inline-flex w-2 h-2 rounded-full opacity-60 animate-ping ${dotColor}`}
              aria-hidden="true"
            />
          )}
          <span className={`relative inline-flex w-2 h-2 rounded-full ${dotColor}`} />
        </span>
      )}

      {/* Left icon */}
      {icon && !dot && (
        <span className="shrink-0 flex items-center text-[14px]" aria-hidden="true">
          {icon}
        </span>
      )}

      {/* Label */}
      <span>{children}</span>

      {/* Remove button */}
      {removable && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove"
          className="ml-0.5 shrink-0 hover:opacity-70 transition-opacity focus:outline-none rounded-full"
        >
          <span className="material-symbols-outlined text-[12px]">close</span>
        </button>
      )}
    </Tag>
  );
});

Badge.displayName = 'Badge';
export default Badge;
export { Badge };
