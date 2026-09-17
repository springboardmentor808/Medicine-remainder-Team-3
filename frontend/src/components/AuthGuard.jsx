'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

/**
 * AuthGuard — PillSync
 * Wrapper component that checks for valid JWT token before rendering children.
 * Redirects unauthenticated users to /login.
 * Enforces role-based route guarding to prevent privilege escalation.
 */
export default function AuthGuard({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('pillsync_access_token');
    const userStr = localStorage.getItem('pillsync_user');

    if (!token || !userStr) {
      router.replace('/login');
      return;
    }

    // Parse stored user safely
    let user = null;
    try {
      user = JSON.parse(userStr);
    } catch {
      // Corrupt localStorage — clear and redirect
      localStorage.removeItem('pillsync_access_token');
      localStorage.removeItem('pillsync_user');
      router.replace('/login');
      return;
    }

    // Handle demo/mock tokens — they are valid for frontend navigation
    // but API calls will gracefully fail with proper error states
    const isDemoToken = token.startsWith('demo_') || token.startsWith('google_') || token.startsWith('apple_');

    if (!isDemoToken) {
      // Real JWT expiry check (decode without verification)
      try {
        const parts = token.split('.');
        if (parts.length >= 2) {
          const payload = JSON.parse(atob(parts[1]));
          const exp = payload.exp;
          if (exp && Date.now() / 1000 > exp) {
            // Token expired — clear auth and redirect
            localStorage.removeItem('pillsync_access_token');
            localStorage.removeItem('pillsync_user');
            router.replace('/login');
            return;
          }
        }
      } catch {
        // Token malformed but user data exists — allow fallback for demo flow
        if (!user) {
          localStorage.removeItem('pillsync_access_token');
          localStorage.removeItem('pillsync_user');
          router.replace('/login');
          return;
        }
      }
    }

    // ── Role-Based Route Guarding (Issue #5) ─────────────────────────
    // Prevent non-admin users from accessing /dashboard/admin or /admin/*
    // Prevent non-caregiver/non-admin from accessing /dashboard/caregiver
    const userRole = user?.role || 'patient';

    if (pathname) {
      const isAdminRoute = pathname.startsWith('/dashboard/admin') || pathname.startsWith('/admin');
      const isCaregiverRoute = pathname.startsWith('/dashboard/caregiver');

      if (isAdminRoute && userRole !== 'admin') {
        router.replace(`/dashboard/${userRole}`);
        return;
      }

      if (isCaregiverRoute && userRole !== 'caregiver' && userRole !== 'admin') {
        router.replace(`/dashboard/${userRole}`);
        return;
      }
    }

    setIsAuthenticated(true);
    setChecking(false);
  }, [router, pathname]);

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
