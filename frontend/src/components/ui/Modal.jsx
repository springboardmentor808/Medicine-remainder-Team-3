'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * Modal — Vitality Core Design System
 * Accessible backdrop modal with focus-trap, ESC close, scroll-lock.
 * Sizes: sm | md | lg | xl | full
 *
 * Usage:
 *   <Modal isOpen={open} onClose={() => setOpen(false)} title="Add Medicine">
 *     <p>Modal content here</p>
 *     <Modal.Footer>
 *       <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
 *       <Button>Save</Button>
 *     </Modal.Footer>
 *   </Modal>
 */

const SIZES = {
  sm:   'max-w-sm',
  md:   'max-w-md',
  lg:   'max-w-lg',
  xl:   'max-w-xl',
  '2xl':'max-w-2xl',
  full: 'max-w-full m-0 rounded-none min-h-screen',
};

function Modal({
  isOpen,
  onClose,
  title,
  description,
  size = 'md',
  closeOnBackdrop = true,
  closeOnEscape = true,
  showCloseButton = true,
  preventScroll = true,
  children,
  className = '',
  glassmorphic = false,
  'aria-label': ariaLabel,
}) {
  const overlayRef = useRef(null);
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // ── ESC key handler ──────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape' && closeOnEscape) {
        e.preventDefault();
        onCloseRef.current?.();
      }
      // Focus trap
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll(
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
    [isOpen, closeOnEscape]
  );

  // ── Open / Close effects ─────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement;
      if (preventScroll) document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleKeyDown);

      // Only auto-focus on initial open if user is not already typing inside the dialog
      requestAnimationFrame(() => {
        if (!dialogRef.current?.contains(document.activeElement)) {
          const inputEl = dialogRef.current?.querySelector('input:not([type="hidden"]), textarea, select');
          const firstFocusable = dialogRef.current?.querySelector(
            'input, textarea, select, button:not([aria-label="Close modal"]), [href], [tabindex]:not([tabindex="-1"])'
          );
          (inputEl || firstFocusable)?.focus();
        }
      });
    } else {
      if (preventScroll) document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    }
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown, preventScroll]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (closeOnBackdrop && e.target === overlayRef.current) onClose?.();
  };

  const content = (
    <div
      ref={overlayRef}
      onClick={handleBackdropClick}
      className={[
        'fixed inset-0 z-50 flex sm:items-center sm:justify-center items-end justify-center p-0 sm:p-4',
        glassmorphic ? 'bg-black/70 backdrop-blur-md' : 'bg-inverse-surface/40 backdrop-blur-sm',
        'animate-fade-in',
      ].join(' ')}
      aria-modal="true"
      role="dialog"
      aria-label={ariaLabel ?? title}
      aria-describedby={description ? 'modal-desc' : undefined}
    >
      <div
        ref={dialogRef}
        className={[
          // Base
          glassmorphic
            ? 'relative w-full bg-slate-950/85 backdrop-blur-2xl rounded-t-3xl sm:rounded-3xl border border-white/20 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8),0_0_40px_rgba(16,185,129,0.15)] ring-1 ring-white/10 text-white'
            : 'relative w-full bg-surface-container-lowest rounded-t-2xl sm:rounded-lg shadow-modal',
          'flex flex-col max-h-[92dvh] sm:max-h-[90vh] pb-safe sm:pb-0',
          'animate-fade-in',
          // Size
          SIZES[size] ?? SIZES.md,
          // Custom
          className,
        ].join(' ')}
      >
        {/* ── Header ────────────────────────────────────────────────── */}
        {(title || showCloseButton) && (
          <div className={[
            'flex items-start justify-between gap-sm px-md sm:px-lg pt-md sm:pt-lg pb-sm sm:pb-md shrink-0',
            glassmorphic ? 'border-b border-white/10' : 'border-b border-outline-variant/40'
          ].join(' ')}>
            <div>
              {title && (
                <h2 className={[
                  'text-body-lg sm:text-headline-sm font-semibold leading-snug',
                  glassmorphic ? 'text-white' : 'text-on-surface'
                ].join(' ')}>
                  {title}
                </h2>
              )}
              {description && (
                <p id="modal-desc" className={[
                  'text-caption mt-1',
                  glassmorphic ? 'text-slate-300' : 'text-on-surface-variant'
                ].join(' ')}>
                  {description}
                </p>
              )}
            </div>
            {showCloseButton && (
              <button
                onClick={onClose}
                type="button"
                aria-label="Close dialog"
                className={[
                  'shrink-0 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95',
                  glassmorphic
                    ? 'text-white/70 hover:text-white bg-white/10 hover:bg-white/20 border border-white/15'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface active:bg-surface-container-high',
                ].join(' ')}
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            )}
          </div>
        )}

        {/* ── Scrollable body ────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-md sm:px-lg py-sm sm:py-md overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );

  // Render via portal to escape CSS stacking contexts
  return typeof document !== 'undefined'
    ? createPortal(content, document.body)
    : null;
}

// ── Modal.Footer ─────────────────────────────────────────────────────────────
Modal.Footer = function ModalFooter({ children, className = '', align = 'right', glassmorphic = false }) {
  return (
    <div
      className={[
        'flex items-center gap-sm pt-md mt-md shrink-0',
        glassmorphic ? 'border-t border-white/10' : 'border-t border-outline-variant/40',
        align === 'right'  ? 'justify-end' :
        align === 'left'   ? 'justify-start' :
        align === 'center' ? 'justify-center' : 'justify-between',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
};

Modal.displayName = 'Modal';
export default Modal;
export { Modal };
