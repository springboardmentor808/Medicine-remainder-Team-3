'use client';

import React from 'react';

/**
 * Button — Vitality Core Design System
 * Variants: primary | secondary | ghost | danger | outline | icon
 * Sizes: sm | md | lg
 *
 * Usage:
 *   <Button>Primary</Button>
 *   <Button variant="secondary" size="sm">Cancel</Button>
 *   <Button variant="danger" loading>Delete</Button>
 *   <Button variant="icon" aria-label="Add"><span className="material-symbols-outlined">add</span></Button>
 */

const VARIANTS = {
  primary: [
    'bg-primary text-on-primary',
    'hover:bg-primary-container hover:shadow-elevated hover:-translate-y-0.5',
    'active:translate-y-0 active:shadow-sm',
    'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none',
  ].join(' '),

  secondary: [
    'bg-surface-container text-primary border border-primary/25',
    'hover:bg-primary-fixed hover:border-primary/50 hover:shadow-sm',
    'active:bg-primary-fixed/80',
    'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ].join(' '),

  ghost: [
    'bg-transparent text-primary',
    'hover:bg-primary/8',
    'active:bg-primary/12',
    'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ].join(' '),

  danger: [
    'bg-error text-on-error',
    'hover:bg-error/90 hover:shadow-elevated hover:-translate-y-0.5',
    'active:translate-y-0',
    'focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ].join(' '),

  outline: [
    'bg-transparent text-on-surface border border-outline-variant',
    'hover:bg-surface-container hover:border-outline',
    'active:bg-surface-container-high',
    'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ].join(' '),

  icon: [
    'bg-transparent text-on-surface-variant',
    'hover:bg-surface-container hover:text-primary',
    'active:bg-surface-container-high',
    'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
    'rounded-full !p-2',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ].join(' '),
};

const SIZES = {
  sm: 'h-8  px-sm  text-caption  rounded-md  gap-1.5',
  md: 'h-touch-target px-lg text-sm rounded-md gap-2',
  lg: 'h-input-target px-xl text-body-sm rounded-md gap-2',
};

const LoadingSpinner = () => (
  <svg
    className="animate-spin w-4 h-4 shrink-0"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle
      className="opacity-25"
      cx="12" cy="12" r="10"
      stroke="currentColor" strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
    />
  </svg>
);

const Button = React.forwardRef(function Button(
  {
    children,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    fullWidth = false,
    leftIcon,
    rightIcon,
    className = '',
    type = 'button',
    ...props
  },
  ref
) {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={loading}
      className={[
        // Base
        'inline-flex items-center justify-center font-semibold',
        'transition-all duration-200 outline-none select-none',
        'whitespace-nowrap shrink-0',
        // Variant
        VARIANTS[variant] ?? VARIANTS.primary,
        // Size
        SIZES[size] ?? SIZES.md,
        // Full width
        fullWidth ? 'w-full' : '',
        // Custom
        className,
      ].join(' ')}
      {...props}
    >
      {/* Left icon / Loading spinner */}
      {loading ? (
        <LoadingSpinner />
      ) : leftIcon ? (
        <span className="shrink-0 flex items-center" aria-hidden="true">
          {leftIcon}
        </span>
      ) : null}

      {/* Label */}
      {children && <span>{children}</span>}

      {/* Right icon */}
      {!loading && rightIcon && (
        <span className="shrink-0 flex items-center" aria-hidden="true">
          {rightIcon}
        </span>
      )}
    </button>
  );
});

Button.displayName = 'Button';
export default Button;
export { Button };
