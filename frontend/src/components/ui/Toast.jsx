'use client';

import React, { useEffect, useRef, useCallback, useState, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { playNotificationChime } from '@/lib/alarm_service';

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

  // CodeRabbit Review Note: Toast Deduplication
  // Deduplicates identical incoming notifications (matching title + variant) to prevent
  // simultaneous network retry storms from stacking identical banners on top of each other.
  const addToast = useCallback(
    ({ title, description, variant = 'default', duration = 4000, action, silent = false }) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((prev) => {
        // Drop duplicate toast if an identical banner is already active in viewport
        if (prev.some((t) => t.title === title && t.variant === variant)) {
          return prev;
        }
        // Play audio alert chime only when the toast is genuinely added and not silent
        if (!silent) {
          try {
            playNotificationChime();
          } catch (_) {}
        }
        return [
          { id, title, description, variant, duration, action },
          ...prev.slice(0, maxToasts - 1),
        ];
      });
      return id;
    },
    [maxToasts]
  );

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Listen for global window 'pillsync:toast' events
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleCustomToast = (event) => {
      const detail = event?.detail || {};
      const title = detail.message || detail.title || detail.text || '';
      const variant = detail.type || detail.variant || 'default';
      if (title) {
        addToast({
          title,
          description: detail.description,
          variant,
          duration: detail.duration || 4000,
        });
      }
    };

    window.addEventListener('pillsync:toast', handleCustomToast);
    return () => window.removeEventListener('pillsync:toast', handleCustomToast);
  }, [addToast]);

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
    bg:   'bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 shadow-[0_12px_32px_rgba(15,23,42,0.5)]',
    text: 'text-slate-100',
    icon: 'notifications',
    iconColor: 'text-teal-400',
    bar:  'bg-gradient-to-r from-teal-400 to-emerald-400',
  },
  success: {
    bg:   'bg-slate-900/95 backdrop-blur-xl border border-emerald-500/40 shadow-[0_12px_36px_rgba(16,185,129,0.35)]',
    text: 'text-emerald-50',
    icon: 'check_circle',
    iconColor: 'text-emerald-400',
    bar:  'bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400',
  },
  error: {
    bg:   'bg-slate-900/95 backdrop-blur-xl border border-rose-500/40 shadow-[0_12px_36px_rgba(244,63,94,0.35)]',
    text: 'text-rose-50',
    icon: 'error',
    iconColor: 'text-rose-400',
    bar:  'bg-gradient-to-r from-rose-500 to-amber-500',
  },
  warning: {
    bg:   'bg-slate-900/95 backdrop-blur-xl border border-amber-500/40 shadow-[0_12px_36px_rgba(245,158,11,0.35)]',
    text: 'text-amber-50',
    icon: 'warning',
    iconColor: 'text-amber-400',
    bar:  'bg-gradient-to-r from-amber-400 to-orange-400',
  },
  info: {
    bg:   'bg-slate-900/95 backdrop-blur-xl border border-cyan-500/40 shadow-[0_12px_36px_rgba(6,182,212,0.35)]',
    text: 'text-cyan-50',
    icon: 'info',
    iconColor: 'text-cyan-400',
    bar:  'bg-gradient-to-r from-cyan-400 to-teal-300',
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
    onDismiss(id);
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
        'relative overflow-hidden w-full max-w-sm rounded-xl shadow-2xl ring-1 ring-white/10',
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
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            dismiss();
          }}
          type="button"
          aria-label="Dismiss notification"
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-black/15 dark:hover:bg-white/15 transition-colors focus:outline-none cursor-pointer mt-0.5 z-10"
        >
          <X className="w-3.5 h-3.5" />
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
