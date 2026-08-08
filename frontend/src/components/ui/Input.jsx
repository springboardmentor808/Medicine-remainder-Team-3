'use client';

import React, { useState, useId } from 'react';

/**
 * Input — Vitality Core Design System
 * Types: text | email | password | search | tel | number | textarea
 * States: default | focus | error | success | disabled
 *
 * Usage:
 *   <Input label="Email" type="email" placeholder="you@example.com" />
 *   <Input label="Password" type="password" required />
 *   <Input type="search" placeholder="Search medicines..." />
 *   <Input label="Notes" type="textarea" rows={4} />
 *   <Input label="Dosage" error="Please enter a valid dosage" />
 */

const EyeOpenIcon = () => (
  <span className="material-symbols-outlined text-[20px]">visibility</span>
);
const EyeClosedIcon = () => (
  <span className="material-symbols-outlined text-[20px]">visibility_off</span>
);
const SearchIcon = () => (
  <span className="material-symbols-outlined text-[20px]">search</span>
);
const ClearIcon = () => (
  <span className="material-symbols-outlined text-[20px]">close</span>
);
const CheckIcon = () => (
  <span className="material-symbols-outlined text-[18px] text-tertiary">check_circle</span>
);
const ErrorIcon = () => (
  <span className="material-symbols-outlined text-[18px] text-error">error</span>
);

const Input = React.forwardRef(function Input(
  {
    // Label & meta
    label,
    helper,
    error,
    success,
    required = false,

    // Input type
    type = 'text',

    // Icons / Addons
    leftIcon,
    rightIcon,
    prefix,
    suffix,

    // Behavior
    clearable = false,
    onClear,
    showCharCount = false,
    maxLength,

    // Textarea-specific
    rows = 3,
    resize = false,

    // Styling
    size = 'md',
    fullWidth = true,
    className = '',

    // Forwarded
    id: externalId,
    value,
    onChange,
    ...props
  },
  ref
) {
  const generatedId = useId();
  const id = externalId || generatedId;
  const [showPass, setShowPass] = useState(false);
  const [internalValue, setInternalValue] = useState(value ?? '');

  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;
  const isPassword = type === 'password';
  const isSearch = type === 'search';
  const isTextarea = type === 'textarea';
  const hasError = Boolean(error);
  const hasSuccess = Boolean(success) && !hasError;

  const handleChange = (e) => {
    if (!isControlled) setInternalValue(e.target.value);
    onChange?.(e);
  };

  const handleClear = () => {
    if (!isControlled) setInternalValue('');
    onClear?.();
  };

  // ── Border color logic ──
  const borderClass = hasError
    ? 'border-error focus:ring-error'
    : hasSuccess
    ? 'border-tertiary focus:ring-tertiary'
    : 'border-outline-variant focus:ring-primary';

  // ── Size ──
  const heightClass =
    size === 'sm' ? 'h-8' :
    size === 'lg' ? 'h-input-target' :
    'h-touch-target';

  // ── Padding (account for icons) ──
  const paddingLeft  = leftIcon || isSearch || prefix ? 'pl-10' : 'pl-md';
  const paddingRight =
    rightIcon || isPassword || clearable || hasError || hasSuccess || suffix
      ? 'pr-10'
      : 'pr-md';

  const baseInputClass = [
    'w-full bg-surface-container-lowest text-on-surface',
    'text-body-sm font-normal',
    'border rounded-md',
    'transition-all duration-200 outline-none',
    'placeholder:text-on-surface-variant/50',
    'focus:ring-2 focus:border-transparent',
    'disabled:bg-surface-container disabled:text-on-surface-variant disabled:cursor-not-allowed',
    'read-only:bg-surface-container-low',
    borderClass,
    paddingLeft,
    paddingRight,
    isTextarea ? 'py-sm' : heightClass,
    !resize && isTextarea ? 'resize-none' : '',
    className,
  ].join(' ');

  return (
    <div className={`${fullWidth ? 'w-full' : ''} flex flex-col gap-1.5`}>
      {/* Label */}
      {label && (
        <label
          htmlFor={id}
          className="text-label-caps font-semibold text-on-surface uppercase tracking-wider"
        >
          {label}
          {required && (
            <span className="text-error ml-0.5" aria-hidden="true"> *</span>
          )}
        </label>
      )}

      {/* Input Wrapper */}
      <div className="relative flex items-center">
        {/* Left Icon / Search / Prefix */}
        {(leftIcon || isSearch || prefix) && (
          <div className="absolute left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
            {prefix
              ? <span className="text-caption font-medium">{prefix}</span>
              : isSearch
              ? <SearchIcon />
              : leftIcon}
          </div>
        )}

        {/* Actual input / textarea */}
        {isTextarea ? (
          <textarea
            ref={ref}
            id={id}
            rows={rows}
            value={currentValue}
            onChange={handleChange}
            maxLength={maxLength}
            required={required}
            className={baseInputClass}
            aria-describedby={
              [error && `${id}-error`, helper && `${id}-helper`]
                .filter(Boolean)
                .join(' ') || undefined
            }
            aria-invalid={hasError}
            {...props}
          />
        ) : (
          <input
            ref={ref}
            id={id}
            type={isPassword ? (showPass ? 'text' : 'password') : type}
            value={currentValue}
            onChange={handleChange}
            maxLength={maxLength}
            required={required}
            className={baseInputClass}
            aria-describedby={
              [error && `${id}-error`, helper && `${id}-helper`]
                .filter(Boolean)
                .join(' ') || undefined
            }
            aria-invalid={hasError}
            {...props}
          />
        )}

        {/* Right section — stacked priority: error/success → password toggle → clear → suffix/icon */}
        <div className="absolute right-0 pr-3 flex items-center gap-1">
          {/* Status indicators */}
          {hasError  && <ErrorIcon />}
          {hasSuccess && <CheckIcon />}

          {/* Password toggle */}
          {isPassword && !hasError && !hasSuccess && (
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              aria-label={showPass ? 'Hide password' : 'Show password'}
              className="text-on-surface-variant hover:text-primary transition-colors focus:outline-none"
            >
              {showPass ? <EyeOpenIcon /> : <EyeClosedIcon />}
            </button>
          )}

          {/* Clear button */}
          {clearable && currentValue && !isPassword && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear input"
              className="text-on-surface-variant hover:text-on-surface transition-colors focus:outline-none"
            >
              <ClearIcon />
            </button>
          )}

          {/* Suffix or right icon */}
          {(suffix || (rightIcon && !hasError && !hasSuccess && !isPassword)) && (
            <span className="text-on-surface-variant pointer-events-none flex items-center">
              {suffix
                ? <span className="text-caption font-medium">{suffix}</span>
                : rightIcon}
            </span>
          )}
        </div>
      </div>

      {/* Helper / Error / Char count row */}
      <div className="flex items-start justify-between gap-2">
        <div>
          {error && (
            <p id={`${id}-error`} role="alert" className="text-caption text-error leading-tight">
              {error}
            </p>
          )}
          {!error && helper && (
            <p id={`${id}-helper`} className="text-caption text-on-surface-variant leading-tight">
              {helper}
            </p>
          )}
          {success && !error && (
            <p className="text-caption text-tertiary leading-tight">{success}</p>
          )}
        </div>
        {showCharCount && maxLength && (
          <p className="text-caption text-on-surface-variant shrink-0 ml-auto">
            {String(currentValue).length}/{maxLength}
          </p>
        )}
      </div>
    </div>
  );
});

Input.displayName = 'Input';
export default Input;
export { Input };
