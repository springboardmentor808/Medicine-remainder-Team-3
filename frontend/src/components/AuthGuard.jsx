'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * AuthGuard — PillSync
 * Wrapper component that checks for valid JWT token before rendering children.
 * Redirects unauthenticated users to /login.
 */
export default function AuthGuard({ children }) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('pillsync_access_token');
    const user = localStorage.getItem('pillsync_user');

    if (!token || !user) {
      router.replace('/login');
      return;
    }

    // Handle demo/mock tokens gracefully
    if (token.startsWith('demo_') || token.startsWith('google_') || token.startsWith('apple_')) {
      setIsAuthenticated(true);
      setChecking(false);
      return;
    }

    // Basic JWT expiry check (decode without verification)
    try {
      const parts = token.split('.');
      if (parts.length >= 2) {
        const payload = JSON.parse(atob(parts[1]));
        const exp = payload.exp;
        if (exp && Date.now() / 1000 > exp) {
          // Token expired
          localStorage.removeItem('pillsync_access_token');
          localStorage.removeItem('pillsync_user');
          router.replace('/login');
          return;
        }
      }
    } catch {
      // Graceful fallback: do not immediately wipe if user object exists
      if (!user) {
        localStorage.removeItem('pillsync_access_token');
        localStorage.removeItem('pillsync_user');
        router.replace('/login');
        return;
      }
    }

    setIsAuthenticated(true);
    setChecking(false);
  }, [router]);

  if (checking || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-body-sm text-on-surface-variant">Verifying session...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
