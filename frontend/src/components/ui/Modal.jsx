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
  'aria-label': ariaLabel,
}) {
  const overlayRef = useRef(null);
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);

  // ── ESC key handler ──────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape' && closeOnEscape) {
        e.preventDefault();
        onClose?.();
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
    [isOpen, closeOnEscape, onClose]
  );

  // ── Open / Close effects ─────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement;
      if (preventScroll) document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleKeyDown);
      // Focus first focusable after paint
      requestAnimationFrame(() => {
        const el = dialogRef.current?.querySelector(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        el?.focus();
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
        'fixed inset-0 z-50 flex items-center justify-center p-4',
        'bg-inverse-surface/40 backdrop-blur-sm',
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
          'relative w-full bg-surface-container-lowest rounded-lg shadow-modal',
          'flex flex-col max-h-[90vh]',
          'animate-fade-in',
          // Size
          SIZES[size] ?? SIZES.md,
          // Custom
          className,
        ].join(' ')}
      >
        {/* ── Header ────────────────────────────────────────────────── */}
        {(title || showCloseButton) && (
          <div className="flex items-start justify-between gap-sm px-lg pt-lg pb-md border-b border-outline-variant/40 shrink-0">
            <div>
              {title && (
                <h2 className="text-headline-sm font-semibold text-on-surface leading-snug">
                  {title}
                </h2>
              )}
              {description && (
                <p id="modal-desc" className="text-caption text-on-surface-variant mt-1">
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
                  'shrink-0 w-8 h-8 flex items-center justify-center rounded-full',
                  'text-on-surface-variant',
                  'hover:bg-surface-container hover:text-on-surface',
                  'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                ].join(' ')}
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            )}
          </div>
        )}

        {/* ── Scrollable body ────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-lg py-md">
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
Modal.Footer = function ModalFooter({ children, className = '', align = 'right' }) {
  return (
    <div
      className={[
        'flex items-center gap-sm pt-md mt-md border-t border-outline-variant/40',
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
