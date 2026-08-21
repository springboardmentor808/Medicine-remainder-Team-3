'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import RoleSelectorForm from '@/components/forms/RoleSelectorForm';

/**
 * Select Role Page — PillSync
 * Design: Stitch screen "Role Selection" (9bc972cf4f0b48e292c40a8f3e5d8206)
 * "Who are you?" — Patient | Caregiver | Admin
 */

export default function SelectRolePage() {
  const router = useRouter();
  const [selected, setSelected] = useState('');

  const handleContinue = () => {
    if (!selected) return;
    // Store role selection and route to login
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('pillsync_selected_role', selected);
    }
    router.push(`/register?role=${selected}`);
  };

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center p-md">
      {/* Background decorative cross */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <svg
          className="absolute top-[-80px] right-[-80px] text-primary opacity-5 w-64 h-64"
          fill="currentColor" viewBox="0 0 100 100"
        >
          <path d="M35 15H65V35H85V65H65V85H35V65H15V35H35V15Z" />
        </svg>
        <svg
          className="absolute bottom-[-60px] left-[-60px] text-secondary opacity-5 w-48 h-48"
          fill="currentColor" viewBox="0 0 100 100"
        >
          <path d="M35 15H65V35H85V65H65V85H35V65H15V35H35V15Z" />
        </svg>
      </div>

      <div className="relative z-10 w-full max-w-[480px]">
        {/* Brand header */}
        <div className="text-center mb-section-gap">
          <Link href="/" className="inline-flex items-center gap-xs group">
            <div className="p-xs rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <span
                className="material-symbols-outlined text-primary text-[24px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                medical_services
              </span>
            </div>
            <span className="text-headline-sm font-bold text-primary">PillSync</span>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-surface-container-lowest rounded-[24px] shadow-modal border border-outline-variant/20 p-10 relative overflow-hidden">
          {/* Decorative corner cross */}
          <div className="absolute -top-16 -right-16 opacity-8 pointer-events-none text-primary" aria-hidden="true">
            <svg fill="currentColor" height="128" width="128" viewBox="0 0 100 100">
              <path d="M35 15H65V35H85V65H65V85H35V65H15V35H35V15Z" />
            </svg>
          </div>

          {/* Header */}
          <div className="text-center mb-section-gap relative z-10">
            <span className="inline-block text-label-caps text-primary uppercase tracking-widest mb-xs font-semibold">
              Welcome
            </span>
            <h1 className="text-headline-md font-bold text-on-surface mb-xs flex items-center justify-center gap-1">
              Who are you? <span className="text-error font-bold" title="Required">*</span>
            </h1>
            <p className="text-body-sm text-on-surface-variant">
              Select your role to personalize your experience. <span className="text-error text-caption font-semibold">*Required</span>
            </p>
          </div>

          {/* Role Selector Form Component */}
          <RoleSelectorForm
            value={selected}
            onChange={setSelected}
          />

          {/* Continue button */}
          <div className="mt-section-gap relative z-10">
            <Button
              id="continue-btn"
              fullWidth
              size="lg"
              disabled={!selected}
              onClick={handleContinue}
              rightIcon={
                <span className="material-symbols-outlined text-[18px] transition-transform group-hover:translate-x-1">
                  arrow_forward
                </span>
              }
              className="group rounded-full"
            >
              Continue
            </Button>
          </div>
        </div>

        {/* Sign in link */}
        <p className="text-center text-caption text-on-surface-variant mt-lg">
          Already have an account?{' '}
          <Link
            href="/login"
            className="text-primary font-semibold hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
