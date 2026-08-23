'use client';
import { useState, useEffect } from 'react';

/**
 * PushNotificationPrompt — A dismissible banner that asks the patient to
 * enable browser push notifications on their first login.
 *
 * – Shows only once per browser (via localStorage flag).
 * – Detects Notification API support.
 * – Gracefully degrades on unsupported browsers.
 */
const STORAGE_KEY = 'pillsync_push_prompt_dismissed';

export default function PushNotificationPrompt() {
  const [visible, setVisible] = useState(false);
  const [permState, setPermState] = useState('default'); // 'default'|'granted'|'denied'

  useEffect(() => {
    // Only run client-side
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    const dismissed = localStorage.getItem(STORAGE_KEY);
    const perm = Notification.permission;
    setPermState(perm);

    // Show prompt only if not yet dismissed AND permission not already granted/denied
    if (!dismissed && perm === 'default') {
      setVisible(true);
    }
  }, []);

  const handleEnable = async () => {
    try {
      const result = await Notification.requestPermission();
      setPermState(result);
      if (result === 'granted') {
        // Show a test notification
        new Notification('🎉 PillSync Notifications Enabled!', {
          body: 'You\'ll receive timely medication reminders right here.',
          icon: '/favicon.ico',
        });
      }
    } catch {
      // Fallback for older browsers
    }
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-r from-primary-container/60 to-tertiary-container/30 p-5 mb-lg animate-in slide-in-from-top-3 duration-500"
      role="alert"
      aria-label="Enable push notifications"
    >
      {/* Decorative dot pattern */}
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />

      <div className="relative flex items-start gap-4">
        {/* Icon */}
        <div className="shrink-0 w-11 h-11 bg-primary/15 rounded-full flex items-center justify-center">
          <span
            className="material-symbols-outlined text-primary text-[22px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            notifications_active
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-title-sm font-semibold text-on-surface mb-0.5">
            Never miss a dose ⏰
          </h3>
          <p className="text-body-sm text-on-surface-variant leading-relaxed">
            Enable browser notifications to get real-time medication reminders,
            refill alerts, and appointment updates — even when this tab is in the background.
          </p>

          {/* Actions */}
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={handleEnable}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-label-md font-semibold text-on-primary bg-primary rounded-full hover:bg-primary/90 transition-colors shadow-sm active:scale-[0.97]"
            >
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              Enable Notifications
            </button>
            <button
              onClick={handleDismiss}
              className="text-label-md text-on-surface-variant hover:text-on-surface transition-colors px-2 py-1"
            >
              Not now
            </button>
          </div>
        </div>

        {/* Close */}
        <button
          onClick={handleDismiss}
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center hover:bg-on-surface/8 transition-colors"
          aria-label="Dismiss"
        >
          <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
            close
          </span>
        </button>
      </div>
    </div>
  );
}
