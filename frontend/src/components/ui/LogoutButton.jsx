'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';

/**
 * LogoutButton — PillSync
 * Reusable logout button that clears all auth tokens and redirects to login.
 * Supports compact (icon-only) and full variants.
 */
export default function LogoutButton({ variant = 'full', className = '' }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  const handleLogout = useCallback(() => {
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
      return;
    }
    // Clear all auth data
    if (typeof window !== 'undefined') {
      localStorage.removeItem('pillsync_access_token');
      localStorage.removeItem('pillsync_user');
      localStorage.removeItem('pillsync_remember');
      sessionStorage.removeItem('pillsync_selected_role');
    }
    router.push('/login');
  }, [confirming, router]);

  if (variant === 'icon') {
    return (
      <button
        onClick={handleLogout}
        className={`p-2 rounded-lg transition-all duration-200 ${
          confirming
            ? 'bg-error/15 text-error'
            : 'text-on-surface-variant hover:bg-error/10 hover:text-error'
        } ${className}`}
        title={confirming ? 'Click again to confirm logout' : 'Logout'}
        aria-label="Logout"
      >
        <LogOut className="w-5 h-5" />
      </button>
    );
  }

  if (variant === 'sidebar') {
    return (
      <button
        onClick={handleLogout}
        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
          confirming
            ? 'bg-error/15 text-error'
            : 'text-on-surface-variant hover:bg-error/10 hover:text-error'
        } ${className}`}
      >
        <LogOut className="w-5 h-5" />
        <span>{confirming ? 'Click again to confirm' : 'Logout'}</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleLogout}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
        confirming
          ? 'bg-error text-white shadow-sm'
          : 'bg-error/10 text-error hover:bg-error hover:text-white'
      } ${className}`}
    >
      <LogOut className="w-4 h-4" />
      <span>{confirming ? 'Confirm Logout?' : 'Logout'}</span>
    </button>
  );
}
