'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authAPI } from '@/lib/api';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

/**
 * Login Page — PillSync
 * Design: Stitch screen "Login Page" (72eb2f57d2ba48d8818a68f982264a16)
 * Split-layout: Left hero panel + Right auth card
 */

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '', remember: false });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const isRegistered = searchParams?.get('registered');
    const emailParam = searchParams?.get('email');
    if (emailParam) {
      setForm((prev) => ({ ...prev, email: emailParam }));
    }
    if (isRegistered === '1') {
      setSuccessMessage('Account created successfully! Please sign in with your credentials.');
    }
  }, [searchParams]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
    setServerError('');
  };

  const validate = () => {
    const errs = {};
    if (!form.email.trim()) errs.email = 'Email address is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = 'Please enter a valid email address';
    if (!form.password) errs.password = 'Password is required';
    else if (form.password.length < 6)
      errs.password = 'Password must be at least 6 characters';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      const response = await authAPI.login({ email: form.email, password: form.password });
      const payload = response?.data || response;
      const { access_token, refresh_token, user } = payload;

      if (!access_token || !user) {
        throw new Error('Authentication succeeded but invalid token received.');
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('pillsync_access_token', access_token);
        localStorage.setItem('access_token', access_token);
        localStorage.setItem('token', access_token);
        if (refresh_token) localStorage.setItem('pillsync_refresh_token', refresh_token);
        localStorage.setItem('pillsync_user', JSON.stringify(user));
        sessionStorage.setItem('pillsync_selected_role', user.role || 'patient');
        if (form.remember) localStorage.setItem('pillsync_remember', '1');
      }

      // Route by role
      const role = (user.role || 'patient').toLowerCase();
      router.replace(`/dashboard/${role}`);
    } catch (err) {
      setServerError(err.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };




  return (
    <main className="relative min-h-screen flex">
      {/* ── Left Hero Panel (desktop only) ──────────────────────────── */}
      <aside className="hidden lg:flex w-1/2 relative bg-surface-container-low items-center justify-center p-12 overflow-hidden">
        {/* Decorative gradient blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-[120%] h-[120%] bg-gradient-to-br from-primary/10 via-surface to-primary/5 rounded-full blur-3xl opacity-60" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-secondary-container/20 rounded-full blur-3xl mix-blend-multiply opacity-50" />

        <div className="relative z-10 max-w-lg w-full flex flex-col items-center gap-section-gap">
          {/* Brand */}
          <div className="text-center">
            <div className="inline-flex items-center gap-xs p-3 rounded-xl bg-primary/10 mb-md">
              <span className="material-symbols-outlined text-primary text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                medical_services
              </span>
            </div>
            <h1 className="text-display-lg font-bold text-primary leading-tight tracking-tight">
              PillSync
            </h1>
            <p className="text-body-md text-on-surface-variant mt-sm max-w-xs mx-auto">
              AI-powered medication management platform for patients, caregivers & clinics.
            </p>
          </div>

          {/* Stats row */}
          <div className="flex gap-md w-full justify-center">
            {[
              { icon: 'group',            stat: '50K+',  label: 'Active Users' },
              { icon: 'health_and_safety', stat: '99.9%', label: 'Uptime' },
              { icon: 'medication',        stat: '98%',   label: 'Adherence' },
            ].map(({ icon, stat, label }) => (
              <div
                key={label}
                className="bg-surface-container-lowest px-md py-sm rounded-xl border border-surface-variant flex items-center gap-xs hover:-translate-y-1 transition-transform duration-300 shadow-sm"
              >
                <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[18px]">{icon}</span>
                </div>
                <div>
                  <p className="text-body-sm font-bold text-primary leading-none">{stat}</p>
                  <p className="text-caption text-on-surface-variant leading-none mt-0.5">{label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Feature list */}
          <div className="w-full space-y-xs">
            {[
              { icon: 'camera_alt',       text: 'OCR Prescription Scanner' },
              { icon: 'notifications',    text: 'Push, SMS & WhatsApp Reminders' },
              { icon: 'insights',         text: 'AI Adherence Analytics' },
              { icon: 'local_pharmacy',   text: 'Nearby Pharmacy Finder' },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-xs text-body-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-primary text-[18px] shrink-0">{icon}</span>
                {text}
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* ── Right Auth Card ──────────────────────────────────────────── */}
      <section className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-surface">
        <div className="max-w-md w-full bg-surface-container-lowest rounded-lg shadow-modal border border-outline-variant/30 p-8 sm:p-10">
          {/* Card Header */}
          <div className="text-center mb-section-gap">
            {/* Mobile brand mark */}
            <div className="lg:hidden inline-flex items-center gap-xs mb-md">
              <span className="material-symbols-outlined text-primary text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                medical_services
              </span>
              <span className="text-headline-sm font-bold text-primary">PillSync</span>
            </div>
            <h2 className="text-headline-md font-bold text-on-surface mb-xs tracking-tight">
              Welcome Back
            </h2>
            <p className="text-body-sm text-on-surface-variant">
              Sign in to manage your health journey securely.
            </p>
          </div>

          {/* Registration success message */}
          {successMessage && (
            <div
              role="status"
              className="mb-md p-sm rounded-md bg-tertiary/10 border border-tertiary/30 flex items-start gap-xs text-tertiary"
            >
              <span className="material-symbols-outlined text-tertiary text-[18px] shrink-0 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>
                check_circle
              </span>
              <p className="text-caption font-semibold">{successMessage}</p>
            </div>
          )}

          {/* Server error */}
          {serverError && (
            <div
              role="alert"
              className="mb-md p-sm rounded-md bg-error-container/50 border border-error/30 flex items-start gap-xs"
            >
              <span className="material-symbols-outlined text-error text-[18px] shrink-0 mt-0.5">error</span>
              <p className="text-caption text-error">{serverError}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-md">
            <Input
              label="Email Address"
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              error={errors.email}
              required
              autoComplete="email"
              leftIcon={<span className="material-symbols-outlined text-[20px]">mail</span>}
            />

            <Input
              label="Password"
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange}
              error={errors.password}
              required
              autoComplete="current-password"
              leftIcon={<span className="material-symbols-outlined text-[20px]">lock</span>}
              rightIcon={
                <Link
                  href="/forgot-password"
                  className="text-caption text-primary hover:underline whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                >
                  Forgot?
                </Link>
              }
            />

            {/* Remember me */}
            <div className="flex items-center gap-xs">
              <input
                type="checkbox"
                id="remember"
                name="remember"
                checked={form.remember}
                onChange={handleChange}
                className="peer w-4 h-4 cursor-pointer appearance-none rounded-sm border-2 border-outline-variant bg-surface-container-lowest checked:border-primary checked:bg-primary transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
              />
              <label htmlFor="remember" className="text-body-sm text-on-surface cursor-pointer">
                Remember me for 30 days
              </label>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              fullWidth
              loading={loading}
              size="lg"
              rightIcon={
                !loading && (
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                )
              }
            >
              Sign In
            </Button>
          </form>

          {/* Sign up link */}
          <p className="text-center text-body-sm text-on-surface-variant mt-section-gap">
            Don&apos;t have an account?{' '}
            <Link
              href="/register"
              className="text-primary font-semibold hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded px-0.5"
            >
              Create Account
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-on-surface-variant">Loading...</div>}>
      <LoginFormContent />
    </Suspense>
  );
}
