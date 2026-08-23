'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * /admin route redirect — automatically forwards to /dashboard/admin
 */
export default function AdminIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/admin');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-body-sm text-on-surface-variant font-medium">
          Redirecting to Admin Dashboard...
        </p>
      </div>
    </div>
  );
}
