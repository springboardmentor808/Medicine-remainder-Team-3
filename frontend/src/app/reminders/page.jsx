'use client';

/**
 * Reminders Redirect Route
 * All reminder and schedule features are merged directly into the Patient and Caregiver Dashboards.
 * Direct visits to /reminders automatically redirect to the user's live dashboard.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';

export default function RemindersPage() {
  const router = useRouter();

  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('pillsync_user') : null;
      const user = stored ? JSON.parse(stored) : null;
      const role = (user?.role || 'patient').toLowerCase();
      if (role === 'caregiver') {
        router.replace('/dashboard/caregiver');
      } else {
        router.replace('/dashboard/patient#timeline');
      }
    } catch {
      router.replace('/dashboard/patient#timeline');
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-on-surface p-4">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center animate-bounce">
          <Bell className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h2 className="text-body-lg font-bold text-on-surface">Redirecting to Dashboard...</h2>
          <p className="text-caption text-on-surface-variant">
            Schedules, alarms, and doses are now managed directly within your live Dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}
