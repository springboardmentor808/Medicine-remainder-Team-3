'use client';

import React, { useEffect, useRef, useCallback, useState, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';

/**
 * Toast — Vitality Core Design System
 * Auto-dismissing notification banners (top or bottom).
 * Variants: default | success | error | warning | info
 *
 * Usage (standalone):
 *   <Toast
 *     toasts={toasts}
 *     onDismiss={(id) => removeToast(id)}
 *     position="top-center"
 *   />
 *
 * Usage (with Context):
 *   // Wrap app:  <ToastProvider><App /></ToastProvider>
 *   // In component:
 *   const { addToast } = useToast();
 *   addToast({ title: 'Saved!', variant: 'success', duration: 3000 });
 */

// ── Toast Context ─────────────────────────────────────────────────────────────
const ToastContext = createContext(null);

export function ToastProvider({ children, position = 'top-center', maxToasts = 5 }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(
    ({ title, description, variant = 'default', duration = 4000, action }) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((prev) => [
        { id, title, description, variant, duration, action },
        ...prev.slice(0, maxToasts - 1),
      ]);
      return id;
    },
    [maxToasts]
  );

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast, toasts }}>
      {children}
      <Toast toasts={toasts} onDismiss={removeToast} position={position} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

// ── Variant config ────────────────────────────────────────────────────────────
const VARIANTS = {
  default: {
    bg:   'bg-inverse-surface',
    text: 'text-inverse-on-surface',
    icon: 'notifications',
    iconColor: 'text-inverse-on-surface/70',
    bar:  'bg-inverse-on-surface/40',
  },
  success: {
    bg:   'bg-tertiary-container/90',
    text: 'text-on-tertiary-container',
    icon: 'check_circle',
    iconColor: 'text-tertiary',
    bar:  'bg-tertiary',
  },
  error: {
    bg:   'bg-error-container/90',
    text: 'text-on-error-container',
    icon: 'error',
    iconColor: 'text-error',
    bar:  'bg-error',
  },
  warning: {
    bg:   'bg-secondary-container/90',
    text: 'text-on-secondary-container',
    icon: 'warning',
    iconColor: 'text-secondary',
    bar:  'bg-secondary',
  },
  info: {
    bg:   'bg-primary-fixed/90',
    text: 'text-on-primary-fixed',
    icon: 'info',
    iconColor: 'text-primary',
    bar:  'bg-primary',
  },
};

// ── Position classes ──────────────────────────────────────────────────────────
const POSITIONS = {
  'top-center':    'top-4 left-1/2 -translate-x-1/2 items-center',
  'top-right':     'top-4 right-4 items-end',
  'top-left':      'top-4 left-4 items-start',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2 items-center',
  'bottom-right':  'bottom-4 right-4 items-end',
  'bottom-left':   'bottom-4 left-4 items-start',
};

// ── Single Toast Item ─────────────────────────────────────────────────────────
function ToastItem({ id, title, description, variant = 'default', duration = 4000, action, onDismiss }) {
  const v = VARIANTS[variant] ?? VARIANTS.default;
  const [progress, setProgress] = useState(100);
  const [exiting, setExiting] = useState(false);
  const intervalRef = useRef(null);
  const startRef = useRef(Date.now());

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss(id), 300);
  }, [id, onDismiss]);

  useEffect(() => {
    if (duration <= 0) return; // Persistent toast

    const tick = 50;
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        clearInterval(intervalRef.current);
        dismiss();
      }
    }, tick);

    return () => clearInterval(intervalRef.current);
  }, [duration, dismiss]);

  return (
    <div
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      className={[
        'relative overflow-hidden w-full max-w-sm rounded-lg shadow-modal',
        'pointer-events-auto',
        'transition-all duration-300',
        v.bg,
        v.text,
        exiting
          ? 'opacity-0 translate-y-[-8px] scale-95'
          : 'opacity-100 translate-y-0 scale-100',
      ].join(' ')}
    >
      {/* Progress bar */}
      {duration > 0 && (
        <div
          className={`absolute top-0 left-0 h-0.5 ${v.bar} transition-all`}
          style={{ width: `${progress}%`, transitionDuration: '50ms' }}
          aria-hidden="true"
        />
      )}

      <div className="flex items-start gap-sm p-sm pr-3">
        {/* Icon */}
        <div className={`shrink-0 mt-0.5 ${v.iconColor}`} aria-hidden="true">
          <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            {v.icon}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 py-0.5">
          {title && (
            <p className="text-body-sm font-semibold leading-tight truncate">
              {title}
            </p>
          )}
          {description && (
            <p className="text-caption leading-tight mt-0.5 opacity-90 line-clamp-2">
              {description}
            </p>
          )}
          {action && (
            <button
              onClick={action.onClick}
              className="mt-sm text-label-caps font-semibold uppercase tracking-wider underline underline-offset-2 hover:opacity-80 transition-opacity focus:outline-none"
            >
              {action.label}
            </button>
          )}
        </div>

        {/* Dismiss */}
        <button
          onClick={dismiss}
          type="button"
          aria-label="Dismiss notification"
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:opacity-70 transition-opacity focus:outline-none mt-0.5"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      </div>
    </div>
  );
}

// ── Toast Container ───────────────────────────────────────────────────────────
function Toast({ toasts = [], onDismiss, position = 'top-center' }) {
  if (!toasts.length) return null;

  const posClass = POSITIONS[position] ?? POSITIONS['top-center'];

  const content = (
    <div
      className={[
        'fixed z-[100] flex flex-col gap-2 pointer-events-none',
        posClass,
      ].join(' ')}
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          {...toast}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(content, document.body)
    : null;
}

Toast.displayName = 'Toast';
export default Toast;
export { Toast };
