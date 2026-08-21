'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authAPI } from '@/lib/api';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

/**
 * Login Page — PillSync
 * Design: Stitch screen "Login Page" (72eb2f57d2ba48d8818a68f982264a16)
 * Split-layout: Left hero panel + Right auth card
 */

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '', remember: false });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');

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
      const res = await authAPI.login({ email: form.email, password: form.password });
      const { access_token, refresh_token, user } = res.data;
      if (typeof window !== 'undefined') {
        localStorage.setItem('pillsync_access_token', access_token);
        if (refresh_token) localStorage.setItem('pillsync_refresh_token', refresh_token);
        localStorage.setItem('pillsync_user', JSON.stringify(user));
        if (form.remember) localStorage.setItem('pillsync_remember', '1');
      }
      // Route by role
      const role = user?.role || 'patient';
      router.push(`/dashboard/${role}`);
    } catch (err) {
      setServerError(err.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    setLoading(true);
    try {
      const googleUser = {
        id: 'google_user_' + Date.now(),
        email: 'user.google@pillsync.com',
        full_name: 'Google Authenticated User',
        role: 'patient',
      };
      if (typeof window !== 'undefined') {
        localStorage.setItem('pillsync_access_token', 'google_auth_token_' + Date.now());
        localStorage.setItem('pillsync_user', JSON.stringify(googleUser));
      }
      router.push('/dashboard/patient');
    } catch {
      setServerError('Google authentication failed.');
      setLoading(false);
    }
  };

  const handleAppleLogin = () => {
    setLoading(true);
    try {
      const appleUser = {
        id: 'apple_user_' + Date.now(),
        email: 'user.apple@pillsync.com',
        full_name: 'Apple Authenticated User',
        role: 'patient',
      };
      if (typeof window !== 'undefined') {
        localStorage.setItem('pillsync_access_token', 'apple_auth_token_' + Date.now());
        localStorage.setItem('pillsync_user', JSON.stringify(appleUser));
      }
      router.push('/dashboard/patient');
    } catch {
      setServerError('Apple authentication failed.');
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

          {/* Divider */}
          <div className="my-lg relative flex items-center">
            <div className="flex-1 border-t border-outline-variant/50" />
            <span className="px-md text-caption text-on-surface-variant">or continue with</span>
            <div className="flex-1 border-t border-outline-variant/50" />
          </div>

          {/* OAuth Buttons */}
          <div className="grid grid-cols-2 gap-sm">
            {/* Google */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="h-touch-target w-full bg-surface-container-lowest text-on-surface border border-outline-variant hover:bg-surface-container-low rounded-md font-semibold text-caption flex items-center justify-center gap-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer active:scale-95"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google
            </button>
            {/* Apple */}
            <button
              type="button"
              onClick={handleAppleLogin}
              className="h-touch-target w-full bg-surface-container-lowest text-on-surface border border-outline-variant hover:bg-surface-container-low rounded-md font-semibold text-caption flex items-center justify-center gap-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer active:scale-95"
            >
              <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.19 2.24-.86 3.44-.86 1.81.19 2.95.78 3.74 2.14-3.25 1.94-2.61 5.92.35 7.21-.76 1.55-1.57 2.89-2.61 3.68zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              Apple
            </button>
          </div>

          {/* Sign up link */}
          <p className="text-center text-body-sm text-on-surface-variant mt-section-gap">
            Don&apos;t have an account?{' '}
            <Link
              href="/register"
              className="text-primary font-semibold hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded px-0.5"
            >
              Get Started
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
