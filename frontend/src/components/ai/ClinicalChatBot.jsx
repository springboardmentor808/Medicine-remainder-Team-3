'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';

// Dynamically import MedicalAssistantWidget with SSR disabled to ensure client-side isolation
const MedicalAssistantWidget = dynamic(
  () => import('@/components/chat/MedicalAssistantWidget'),
  { ssr: false }
);

/**
 * ClinicalChatBot
 * ═══════════════════════════════════════════════════════════════════
 * Globally mounted floating clinical assistant companion.
 * Automatically appears at the bottom-right corner across all authenticated pages.
 * Seamlessly connects to backend RAG /assistant/chat and /chat endpoints.
 */
export default function ClinicalChatBot() {
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
      if (typeof window === 'undefined') return;
      const token = localStorage.getItem('pillsync_access_token');
      const isAuthRoute =
        pathname?.startsWith('/login') ||
        pathname?.startsWith('/register') ||
        pathname?.startsWith('/forgot-password') ||
        pathname?.startsWith('/reset-password') ||
        pathname === '/';

      setIsAuthenticated(Boolean(token) && !isAuthRoute);
    };

    checkAuth();
    window.addEventListener('storage', checkAuth);
    // Custom event dispatched on login/logout
    window.addEventListener('pillsync:auth-change', checkAuth);

    return () => {
      window.removeEventListener('storage', checkAuth);
      window.removeEventListener('pillsync:auth-change', checkAuth);
    };
  }, [pathname]);

  if (!isAuthenticated) return null;

  return <MedicalAssistantWidget />;
}
