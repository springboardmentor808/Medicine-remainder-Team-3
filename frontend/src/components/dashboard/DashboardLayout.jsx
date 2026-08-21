'use client';

import React from 'react';
import AuthGuard from '@/components/AuthGuard';
import Sidebar from '@/components/dashboard/Sidebar';

/**
 * DashboardLayout — PillSync
 * Shared layout wrapper with Sidebar + main content area.
 * Wraps content with AuthGuard for protected routes.
 */
export default function DashboardLayout({ children }) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-y-auto">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
