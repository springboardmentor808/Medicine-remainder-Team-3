'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * BottomSheet — Vitality Core Design System
 * Mobile action sheet overlay from screen bottom.
 * 24px top-corner radius, grab bar, backdrop, ESC/swipe close.
 *
 * Usage:
 *   <BottomSheet isOpen={open} onClose={() => setOpen(false)} title="Log Dose">
 *     <p>Content here</p>
 *   </BottomSheet>
 */

function BottomSheet({
  isOpen,
  onClose,
  title,
  description,
  children,
  showGrabBar = true,
  closeOnBackdrop = true,
  closeOnEscape = true,
  snapPoints,          // Future: e.g. ['50%', '90%']
  className = '',
  'aria-label': ariaLabel,
}) {
  const overlayRef = useRef(null);
  const sheetRef  = useRef(null);
  const previousFocusRef = useRef(null);

  // ── Touch swipe-to-close ─────────────────────────────────────────────────
  const touchStart = useRef(null);

  const handleTouchStart = (e) => {
    touchStart.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e) => {
    if (touchStart.current === null) return;
    const delta = e.changedTouches[0].clientY - touchStart.current;
    if (delta > 80) onClose?.();  // Swipe down 80px → close
    touchStart.current = null;
  };

  // ── Keyboard handler ─────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape' && closeOnEscape) {
        e.preventDefault();
        onClose?.();
      }
      if (e.key === 'Tab' && sheetRef.current) {
        const focusable = sheetRef.current.querySelectorAll(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last  = focusable[focusable.length - 1];
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first?.focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last?.focus();
        }
      }
    },
    [isOpen, closeOnEscape, onClose]
  );

  // ── Open / Close effects ─────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement;
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleKeyDown);
      requestAnimationFrame(() => {
        const el = sheetRef.current?.querySelector(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        el?.focus();
      });
    } else {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    }
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (closeOnBackdrop && e.target === overlayRef.current) onClose?.();
  };

  const content = (
    <div
      ref={overlayRef}
      onClick={handleBackdropClick}
      className={[
        'fixed inset-0 z-50 flex items-end justify-center',
        'bg-inverse-surface/40 backdrop-blur-sm',
        // Fade in backdrop
        'animate-fade-in',
      ].join(' ')}
      aria-modal="true"
      role="dialog"
      aria-label={ariaLabel ?? title ?? 'Bottom sheet'}
    >
      <div
        ref={sheetRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={[
          // Base
          'relative w-full max-w-lg bg-surface-container-lowest',
          // 24px top-corner radius per design spec
          'rounded-t-[24px]',
          // Shadow
          'shadow-modal',
          // Slide up animation
          'animate-slide-up',
          // Max height with scroll
          'max-h-[90vh] flex flex-col',
          // Custom
          className,
        ].join(' ')}
      >
        {/* ── Grab bar ──────────────────────────────────────────────── */}
        {showGrabBar && (
          <div className="flex justify-center pt-sm pb-xs shrink-0">
            <div
              className="w-8 h-1 rounded-full bg-outline-variant"
              aria-hidden="true"
            />
          </div>
        )}

        {/* ── Header ────────────────────────────────────────────────── */}
        {(title || description) && (
          <div className="px-lg pt-xs pb-md flex items-start justify-between gap-sm border-b border-outline-variant/40 shrink-0">
            <div>
              {title && (
                <h2 className="text-headline-sm font-semibold text-on-surface leading-snug">
                  {title}
                </h2>
              )}
              {description && (
                <p className="text-caption text-on-surface-variant mt-1">
                  {description}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              type="button"
              aria-label="Close"
              className={[
                'shrink-0 w-8 h-8 flex items-center justify-center rounded-full',
                'text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
                'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              ].join(' ')}
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        )}

        {/* ── Scrollable Content ─────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-lg py-md">
          {children}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(content, document.body)
    : null;
}

// ── BottomSheet.Footer ────────────────────────────────────────────────────────
BottomSheet.Footer = function BottomSheetFooter({ children, className = '' }) {
  return (
    <div
      className={[
        'px-lg py-md border-t border-outline-variant/40',
        'flex flex-col gap-sm shrink-0',
        // Safe area for iOS
        'pb-[max(16px,env(safe-area-inset-bottom))]',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
};

// ── BottomSheet.Action ────────────────────────────────────────────────────────
BottomSheet.Action = function BottomSheetAction({
  icon,
  label,
  description: desc,
  destructive = false,
  onClick,
  disabled = false,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'w-full flex items-center gap-md px-sm py-sm rounded-lg',
        'transition-colors duration-150 text-left',
        destructive
          ? 'text-error hover:bg-error/8 active:bg-error/12'
          : 'text-on-surface hover:bg-surface-container active:bg-surface-container-high',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      {icon && (
        <div
          className={[
            'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
            destructive
              ? 'bg-error/10 text-error'
              : 'bg-surface-container text-on-surface-variant',
          ].join(' ')}
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-body-sm font-medium leading-tight">{label}</p>
        {desc && (
          <p className="text-caption text-on-surface-variant mt-0.5 leading-tight">
            {desc}
          </p>
        )}
      </div>
    </button>
  );
};

BottomSheet.displayName = 'BottomSheet';
export default BottomSheet;
export { BottomSheet };
