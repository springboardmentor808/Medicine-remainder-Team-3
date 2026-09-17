'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authAPI, emitToast } from '@/lib/api';
import Button from '@/components/ui/Button';

/**
 * Verify OTP Page — PillSync
 * Dedicated standalone verification handshake screen.
 * Dispatches POST /api/v1/auth/verify-otp with { email, otp }
 * On HTTP 200, marks email as verified in PostgreSQL and transitions user to dashboard.
 */
function VerifyOtpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const inputRefs = useRef([]);


  // Initialize email from query param or session storage
  useEffect(() => {
    const qEmail = searchParams?.get('email');
    const storedEmail = typeof window !== 'undefined' ? sessionStorage.getItem('pillsync_verify_email') : '';
    const targetEmail = (qEmail || storedEmail || '').trim().toLowerCase();
    
    if (targetEmail) {
      setEmail(targetEmail);
    }
  }, [searchParams]);

  // Focus first input box on load
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  // 60-second cooldown timer
  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  const otpCode = digits.join('');

  // Handle individual digit change
  const handleDigitChange = (index, value) => {
    // Only allow single numeric character
    const cleaned = value.replace(/\D/g, '');
    if (!cleaned) {
      const nextDigits = [...digits];
      nextDigits[index] = '';
      setDigits(nextDigits);
      return;
    }

    const nextDigits = [...digits];
    // Handle pasting multi-digit string into any box
    if (cleaned.length > 1) {
      const chars = cleaned.slice(0, 6).split('');
      for (let i = 0; i < 6; i++) {
        nextDigits[i] = chars[i] || '';
      }
      setDigits(nextDigits);
      const nextFocus = Math.min(chars.length, 5);
      if (inputRefs.current[nextFocus]) {
        inputRefs.current[nextFocus].focus();
      }
      return;
    }

    nextDigits[index] = cleaned;
    setDigits(nextDigits);
    setError('');

    // Auto-advance to next box
    if (index < 5 && cleaned) {
      if (inputRefs.current[index + 1]) {
        inputRefs.current[index + 1].focus();
      }
    }
  };

  // Handle backspace and navigation keys
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      if (inputRefs.current[index - 1]) {
        inputRefs.current[index - 1].focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1].focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1].focus();
    }
  };

  // Handle clipboard paste across inputs
  const handlePaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasteData) return;

    const nextDigits = [...digits];
    for (let i = 0; i < 6; i++) {
      nextDigits[i] = pasteData[i] || '';
    }
    setDigits(nextDigits);
    setError('');

    const focusIdx = Math.min(pasteData.length, 5);
    if (inputRefs.current[focusIdx]) {
      inputRefs.current[focusIdx].focus();
    }
  };

  // Resend OTP trigger
  const handleResendOtp = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please provide a valid email address.');
      return;
    }

    setSendingOtp(true);
    setError('');
    setSuccess('');
    try {
      const res = await authAPI.sendOtp({
        destination: email.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        channel: 'email',
        purpose: 'VERIFY',
      });

      setCountdown(60);
      setDigits(['', '', '', '', '', '']);
      if (inputRefs.current[0]) inputRefs.current[0].focus();

      setSuccess('A fresh 6-digit security code has been sent to your email.');
      emitToast('Verification code resent successfully.', 'success');

    } catch (err) {
      const msg = err.message || 'Failed to resend verification code.';
      setError(msg);
      emitToast(msg, 'error');
    } finally {
      setSendingOtp(false);
    }
  };

  // Verify OTP & Transition to Dashboard
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (otpCode.length !== 6) {
      setError('Please enter the complete 6-digit code.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await authAPI.verifyOtp({
        destination: email.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        otp: otpCode.trim(),
        channel: 'email',
        purpose: 'VERIFY',
      });

      const payload = response?.data || response;
      setSuccess('Email verified successfully! Loading your dashboard...');
      emitToast('Email verified successfully!', 'success');

      // Store tokens and user if returned
      if (payload?.access_token && typeof window !== 'undefined') {
        localStorage.setItem('access_token', payload.access_token);
        localStorage.setItem('token', payload.access_token);
        localStorage.setItem('pillsync_access_token', payload.access_token);
        if (payload.refresh_token) {
          localStorage.setItem('pillsync_refresh_token', payload.refresh_token);
        }
        if (payload.user) {
          localStorage.setItem('pillsync_user', JSON.stringify(payload.user));
          sessionStorage.setItem('pillsync_selected_role', payload.user.role || 'patient');
        }
      }

      // Determine target role for dashboard transition
      let targetRole = 'patient';
      if (payload?.role) {
        targetRole = payload.role.toLowerCase();
      } else if (payload?.user?.role) {
        targetRole = payload.user.role.toLowerCase();
      } else if (typeof window !== 'undefined') {
        const storedUser = localStorage.getItem('pillsync_user');
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            if (parsed?.role) targetRole = parsed.role.toLowerCase();
          } catch {
            // ignore
          }
        }
      }

      // Clean transition delay for UI feedback
      setTimeout(() => {
        router.replace(`/dashboard/${targetRole}`);
      }, 1000);
    } catch (err) {
      const msg = err.message || 'Invalid or expired verification code. Please try again.';
      setError(msg);
      emitToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-surface-container-lowest">
      {/* Decorative backdrop blobs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-secondary/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        {/* Brand header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4 group">
            <span
              className="material-symbols-outlined text-primary text-[32px] group-hover:scale-110 transition-transform"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              medical_services
            </span>
            <span className="text-headline-sm font-bold text-primary tracking-tight">PillSync</span>
          </Link>
          <h1 className="text-headline-md font-bold text-on-surface tracking-tight">
            Verify Your Email
          </h1>
          <p className="text-body-sm text-on-surface-variant mt-2">
            Enter the 6-digit code sent to your email to verify your account and proceed to your dashboard.
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-surface-container-low/90 backdrop-blur-md rounded-2xl shadow-modal border border-outline-variant/40 p-6 sm:p-8">
          {/* Email target indicator */}
          <div className="mb-6 p-3 rounded-xl bg-surface-container border border-outline-variant/30 flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <span className="material-symbols-outlined text-primary text-[20px] shrink-0">mail</span>
              <span className="text-body-sm font-medium text-on-surface truncate">
                {email || 'No email specified'}
              </span>
            </div>
            <Link
              href="/login"
              className="text-caption font-semibold text-primary hover:underline shrink-0 ml-2"
            >
              Change
            </Link>
          </div>

          {/* Error Banner */}
          {error && (
            <div
              role="alert"
              className="mb-5 p-3 rounded-xl bg-error-container/40 border border-error/30 flex items-start gap-2 text-error text-caption animate-shake"
            >
              <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">error</span>
              <p className="flex-1">{error}</p>
            </div>
          )}

          {/* Success Banner */}
          {success && (
            <div
              role="status"
              className="mb-5 p-3 rounded-xl bg-tertiary-container/40 border border-tertiary/40 flex items-start gap-2 text-tertiary text-caption"
            >
              <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">check_circle</span>
              <p className="flex-1 font-medium">{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* 6 Digit OTP Inputs */}
            <div className="mb-6">
              <label className="block text-caption font-semibold text-on-surface-variant uppercase tracking-wider mb-3 text-center">
                Security Verification Code
              </label>
              <div className="flex items-center justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
                {digits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (inputRefs.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    disabled={loading}
                    className={`w-11 h-13 sm:w-12 sm:h-14 text-center text-title-lg font-bold font-mono rounded-xl border bg-surface-container-lowest text-on-surface transition-all outline-none ${
                      digit
                        ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                        : error
                        ? 'border-error ring-1 ring-error/30'
                        : 'border-outline-variant/60 hover:border-outline focus:border-primary focus:ring-2 focus:ring-primary/20'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Verify & Continue Button */}
            <Button
              type="submit"
              fullWidth
              loading={loading}
              disabled={loading || otpCode.length !== 6}
              size="lg"
              className="mb-4 shadow-md"
              rightIcon={
                !loading && (
                  <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                )
              }
            >
              Verify &amp; Continue
            </Button>

            {/* Resend OTP Section */}
            <div className="text-center text-body-sm text-on-surface-variant pt-2 border-t border-outline-variant/20">
              <p className="mb-1">Didn&apos;t receive the code?</p>
              {countdown > 0 ? (
                <span className="text-caption font-semibold text-primary/80">
                  Resend available in <span className="font-mono font-bold">{countdown}s</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={sendingOtp}
                  className="text-caption font-bold text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded disabled:opacity-50"
                >
                  {sendingOtp ? 'Sending code...' : 'Resend Verification Code'}
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Footer Navigation */}
        <div className="text-center mt-6">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-caption font-semibold text-on-surface-variant hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to Sign In
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-on-surface-variant">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <VerifyOtpContent />
    </Suspense>
  );
}
