'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authAPI } from '@/lib/api';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

/**
 * Forgot Password Page — PillSync
 * Design: Stitch screen "Forgot Password Flow" (cf610bab308a4b61a5a2687c27f60d41)
 * 3-step flow: Email → OTP → New Password
 */

const STEPS = {
  EMAIL:    'email',
  OTP:      'otp',
  RESET:    'reset',
  SUCCESS:  'success',
};

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step,  setStep]  = useState(STEPS.EMAIL);
  const [email, setEmail] = useState('');
  const [otp,   setOtp]   = useState(['', '', '', '', '', '']);
  const [form,  setForm]  = useState({ password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // ── Step 1 — Send OTP ─────────────────────────────────────────────────
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrors({ email: 'Please enter a valid email address' });
      return;
    }
    setLoading(true);
    setServerError('');
    try {
      await authAPI.forgotPassword({ email: email.trim() });
      setStep(STEPS.OTP);
      startResendCooldown();
    } catch (err) {
      setServerError(err.message || 'Could not send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const startResendCooldown = () => {
    setResendCooldown(60);
    const t = setInterval(() => {
      setResendCooldown((v) => {
        if (v <= 1) { clearInterval(t); return 0; }
        return v - 1;
      });
    }, 1000);
  };

  // ── Step 2 — OTP input ────────────────────────────────────────────────
  const handleOtpChange = (idx, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    // Auto-advance
    if (val && idx < 5) {
      document.getElementById(`otp-${idx + 1}`)?.focus();
    }
    setErrors({});
  };

  const handleOtpKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      document.getElementById(`otp-${idx - 1}`)?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    setOtp([...pasted.padEnd(6, '').split('')].slice(0, 6));
    document.getElementById(`otp-${Math.min(pasted.length, 5)}`)?.focus();
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length < 6) {
      setErrors({ otp: 'Please enter the complete 6-digit code' });
      return;
    }
    setLoading(true);
    setServerError('');
    try {
      await authAPI.verifyOtp({ email, otp: code });
      setStep(STEPS.RESET);
    } catch (err) {
      setServerError(err.message || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    setServerError('');
    try {
      await authAPI.resendOtp({ email });
      startResendCooldown();
      setOtp(['', '', '', '', '', '']);
    } catch (err) {
      setServerError(err.message || 'Could not resend OTP.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3 — New Password ─────────────────────────────────────────────
  const handleResetSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.password || form.password.length < 8)
      errs.password = 'Password must be at least 8 characters';
    if (form.password !== form.confirmPassword)
      errs.confirmPassword = 'Passwords do not match';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    setServerError('');
    try {
      await authAPI.resetPassword({
        email,
        otp: otp.join(''),
        new_password: form.password,
      });
      setStep(STEPS.SUCCESS);
    } catch (err) {
      setServerError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <main className="relative min-h-screen flex items-center justify-center p-md">
      <div className="w-full max-w-md">
        {/* Back link */}
        {step !== STEPS.SUCCESS && (
          <Link
            href="/login"
            className="inline-flex items-center gap-xs text-caption text-on-surface-variant hover:text-primary transition-colors mb-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back to Sign In
          </Link>
        )}

        {/* Card */}
        <div className="bg-surface-container-lowest rounded-lg shadow-modal border border-outline-variant/30 p-8">
          {/* ── Step Indicator ──────────────────────────────────────── */}
          {step !== STEPS.SUCCESS && (
            <div className="flex items-center gap-xs mb-section-gap">
              {[STEPS.EMAIL, STEPS.OTP, STEPS.RESET].map((s, i) => {
                const steps = [STEPS.EMAIL, STEPS.OTP, STEPS.RESET];
                const current = steps.indexOf(step);
                const isDone = i < current;
                const isActive = i === current;
                return (
                  <React.Fragment key={s}>
                    <div
                      className={[
                        'w-7 h-7 rounded-full flex items-center justify-center text-label-caps font-bold transition-colors',
                        isDone   ? 'bg-primary text-on-primary' :
                        isActive ? 'bg-primary text-on-primary ring-2 ring-primary ring-offset-2' :
                                   'bg-surface-container text-on-surface-variant',
                      ].join(' ')}
                    >
                      {isDone
                        ? <span className="material-symbols-outlined text-[14px]">check</span>
                        : i + 1}
                    </div>
                    {i < 2 && (
                      <div
                        className={[
                          'flex-1 h-0.5 rounded-full transition-all duration-500',
                          isDone ? 'bg-primary' : 'bg-surface-container-high',
                        ].join(' ')}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          )}

          {/* Server error */}
          {serverError && (
            <div role="alert" className="mb-md p-sm rounded-md bg-error-container/50 border border-error/30 flex items-start gap-xs">
              <span className="material-symbols-outlined text-error text-[18px] shrink-0 mt-0.5">error</span>
              <p className="text-caption text-error">{serverError}</p>
            </div>
          )}

          {/* ── STEP 1: Email ────────────────────────────────────────── */}
          {step === STEPS.EMAIL && (
            <form onSubmit={handleEmailSubmit} noValidate>
              <div className="text-center mb-section-gap">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-md">
                  <span className="material-symbols-outlined text-primary text-[28px]">lock_reset</span>
                </div>
                <h1 className="text-headline-sm font-bold text-on-surface">Forgot Password?</h1>
                <p className="text-body-sm text-on-surface-variant mt-xs">
                  No worries! Enter your email address and we&apos;ll send you a reset code.
                </p>
              </div>

              <div className="space-y-md">
                <Input
                  label="Email Address"
                  id="reset-email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrors({}); }}
                  error={errors.email}
                  required
                  autoComplete="email"
                  autoFocus
                  leftIcon={<span className="material-symbols-outlined text-[20px]">mail</span>}
                />
                <Button type="submit" fullWidth loading={loading} size="lg"
                  rightIcon={!loading && <span className="material-symbols-outlined text-[18px]">send</span>}
                >
                  Send Reset Code
                </Button>
              </div>
            </form>
          )}

          {/* ── STEP 2: OTP ─────────────────────────────────────────── */}
          {step === STEPS.OTP && (
            <form onSubmit={handleOtpSubmit} noValidate>
              <div className="text-center mb-section-gap">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-tertiary/10 mb-md">
                  <span className="material-symbols-outlined text-tertiary text-[28px]">mark_email_read</span>
                </div>
                <h1 className="text-headline-sm font-bold text-on-surface">Check your inbox</h1>
                <p className="text-body-sm text-on-surface-variant mt-xs">
                  We sent a 6-digit code to{' '}
                  <span className="font-semibold text-on-surface">{email}</span>
                </p>
              </div>

              {/* OTP boxes */}
              <div
                role="group"
                aria-label="One-time password"
                className="flex gap-xs justify-center mb-md"
              >
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`otp-${idx}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    onPaste={idx === 0 ? handleOtpPaste : undefined}
                    aria-label={`Digit ${idx + 1}`}
                    className={[
                      'w-11 h-14 text-center text-headline-sm font-bold',
                      'bg-surface-container-lowest border-2 rounded-md',
                      'transition-all duration-200 outline-none',
                      'focus:border-primary focus:ring-2 focus:ring-primary/20',
                      errors.otp
                        ? 'border-error'
                        : digit
                        ? 'border-primary'
                        : 'border-outline-variant',
                    ].join(' ')}
                  />
                ))}
              </div>
              {errors.otp && (
                <p role="alert" className="text-caption text-error text-center mb-md">{errors.otp}</p>
              )}

              <div className="space-y-sm">
                <Button type="submit" fullWidth loading={loading} size="lg">
                  Verify Code
                </Button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || loading}
                  className="w-full text-caption text-on-surface-variant hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded py-xs"
                >
                  {resendCooldown > 0
                    ? `Resend code in ${resendCooldown}s`
                    : "Didn't receive it? Resend"}
                </button>
              </div>
            </form>
          )}

          {/* ── STEP 3: New Password ─────────────────────────────────── */}
          {step === STEPS.RESET && (
            <form onSubmit={handleResetSubmit} noValidate>
              <div className="text-center mb-section-gap">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-md">
                  <span className="material-symbols-outlined text-primary text-[28px]">lock</span>
                </div>
                <h1 className="text-headline-sm font-bold text-on-surface">Create new password</h1>
                <p className="text-body-sm text-on-surface-variant mt-xs">
                  Your new password must be different from your previous one.
                </p>
              </div>

              <div className="space-y-md">
                <Input
                  label="New Password"
                  id="new-password"
                  name="password"
                  type="password"
                  placeholder="Minimum 8 characters"
                  value={form.password}
                  onChange={(e) => { setForm((f) => ({ ...f, password: e.target.value })); setErrors({}); }}
                  error={errors.password}
                  required
                  autoComplete="new-password"
                  leftIcon={<span className="material-symbols-outlined text-[20px]">lock</span>}
                />
                <Input
                  label="Confirm New Password"
                  id="confirm-new-password"
                  name="confirmPassword"
                  type="password"
                  placeholder="Repeat new password"
                  value={form.confirmPassword}
                  onChange={(e) => { setForm((f) => ({ ...f, confirmPassword: e.target.value })); setErrors({}); }}
                  error={errors.confirmPassword}
                  success={
                    form.confirmPassword && form.password === form.confirmPassword
                      ? 'Passwords match'
                      : ''
                  }
                  required
                  autoComplete="new-password"
                  leftIcon={<span className="material-symbols-outlined text-[20px]">lock_reset</span>}
                />
                <Button type="submit" fullWidth loading={loading} size="lg"
                  rightIcon={!loading && <span className="material-symbols-outlined text-[18px]">check</span>}
                >
                  Reset Password
                </Button>
              </div>
            </form>
          )}

          {/* ── STEP 4: Success ──────────────────────────────────────── */}
          {step === STEPS.SUCCESS && (
            <div className="text-center py-md">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-tertiary/10 mb-md">
                <span
                  className="material-symbols-outlined text-tertiary text-[40px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  check_circle
                </span>
              </div>
              <h1 className="text-headline-sm font-bold text-on-surface mb-xs">
                Password Reset!
              </h1>
              <p className="text-body-sm text-on-surface-variant mb-section-gap">
                Your password has been reset successfully. You can now sign in with your new password.
              </p>
              <Button
                fullWidth
                size="lg"
                onClick={() => router.push('/login')}
                rightIcon={<span className="material-symbols-outlined text-[18px]">arrow_forward</span>}
              >
                Back to Sign In
              </Button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
