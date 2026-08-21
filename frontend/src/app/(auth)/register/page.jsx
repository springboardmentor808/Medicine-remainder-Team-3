'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authAPI } from '@/lib/api';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

/**
 * Register Page — PillSync
 * Design: Stitch screen "Registration - Step 1" (036684dd96a64b4f9e626397481ed04e)
 * Full-width centered registration form with role pre-configured from onboarding.
 */

function RegisterFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'patient',
    agree: false,
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    const roleParam =
      searchParams?.get('role') ||
      (typeof window !== 'undefined' ? sessionStorage.getItem('pillsync_selected_role') : null) ||
      'patient';
    setForm((prev) => ({ ...prev, role: roleParam }));
  }, [searchParams]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
    setServerError('');
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim() || form.name.trim().length < 2)
      errs.name = 'Full name must be at least 2 characters';
    if (!form.email.trim())
      errs.email = 'Email address is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = 'Please enter a valid email address';
    if (!form.phone.trim())
      errs.phone = 'Phone number is required';
    else if (!/^\+?[\d\s\-()]{7,15}$/.test(form.phone))
      errs.phone = 'Please enter a valid phone number';
    if (!form.password)
      errs.password = 'Password is required';
    else if (form.password.length < 8)
      errs.password = 'Password must be at least 8 characters';
    else if (!/(?=.*[A-Z])(?=.*[0-9])/.test(form.password))
      errs.password = 'Must contain at least 1 uppercase letter and 1 number';
    if (!form.confirmPassword)
      errs.confirmPassword = 'Please confirm your password';
    else if (form.password !== form.confirmPassword)
      errs.confirmPassword = 'Passwords do not match';
    if (!form.agree)
      errs.agree = 'You must accept the terms to continue';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      await authAPI.register({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        role: form.role || 'patient',
      });
      router.push(`/login?registered=1&email=${encodeURIComponent(form.email)}`);
    } catch (err) {
      setServerError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Password strength indicator
  const passStrength = (() => {
    const p = form.password;
    if (!p) return 0;
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    return score;
  })();
  const passStrengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][passStrength];
  const passStrengthColor = [
    '',
    'bg-error',
    'bg-secondary',
    'bg-tertiary',
    'bg-tertiary',
  ][passStrength];

  return (
    <main className="relative min-h-screen flex items-center justify-center p-md py-xl">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-section-gap">
          <Link href="/" className="inline-flex items-center gap-xs mb-md group">
            <span
              className="material-symbols-outlined text-primary text-[28px] group-hover:scale-110 transition-transform"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              medical_services
            </span>
            <span className="text-headline-sm font-bold text-primary">PillSync</span>
          </Link>
          <h1 className="text-headline-md font-bold text-on-surface tracking-tight">
            Create your account
          </h1>
          <p className="text-body-sm text-on-surface-variant mt-xs">
            Already have an account?{' '}
            <Link
              href="/login"
              className="text-primary font-semibold hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
            >
              Sign in
            </Link>
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface-container-lowest rounded-lg shadow-modal border border-outline-variant/30 p-8">
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

          <form onSubmit={handleSubmit} noValidate>
            <div className="space-y-md">
              {/* Full name */}
              <Input
                label="Full Name"
                id="name"
                name="name"
                type="text"
                placeholder="Dr. Ananya Sharma"
                value={form.name}
                onChange={handleChange}
                error={errors.name}
                required
                autoComplete="name"
                leftIcon={<span className="material-symbols-outlined text-[20px]">badge</span>}
              />

              {/* Email */}
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

              {/* Phone */}
              <Input
                label="Phone Number"
                id="phone"
                name="phone"
                type="tel"
                placeholder="+91 98765 43210"
                value={form.phone}
                onChange={handleChange}
                error={errors.phone}
                required
                autoComplete="tel"
                leftIcon={<span className="material-symbols-outlined text-[20px]">phone</span>}
                helper="For SMS reminders and OTP verification"
              />

              {/* Password */}
              <div>
                <Input
                  label="Password"
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Minimum 8 characters"
                  value={form.password}
                  onChange={handleChange}
                  error={errors.password}
                  required
                  autoComplete="new-password"
                  leftIcon={<span className="material-symbols-outlined text-[20px]">lock</span>}
                />
                {/* Strength bar */}
                {form.password && (
                  <div className="mt-xs flex gap-1 items-center">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={[
                          'h-1 flex-1 rounded-full transition-all duration-300',
                          i <= passStrength ? passStrengthColor : 'bg-surface-container-high',
                        ].join(' ')}
                      />
                    ))}
                    <span className={`text-label-caps ml-xs ${
                      passStrength <= 1 ? 'text-error' :
                      passStrength === 2 ? 'text-secondary' : 'text-tertiary'
                    }`}>
                      {passStrengthLabel}
                    </span>
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <Input
                label="Confirm Password"
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Repeat password"
                value={form.confirmPassword}
                onChange={handleChange}
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

              {/* Terms */}
              <div>
                <div className="flex items-start gap-xs">
                  <input
                    type="checkbox"
                    id="agree"
                    name="agree"
                    checked={form.agree}
                    onChange={handleChange}
                    className="mt-0.5 peer w-4 h-4 cursor-pointer appearance-none rounded-sm border-2 border-outline-variant bg-surface-container-lowest checked:border-primary checked:bg-primary transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                  />
                  <label htmlFor="agree" className="text-caption text-on-surface-variant leading-relaxed">
                    I agree to the{' '}
                    <Link href="/terms" className="text-primary hover:underline font-medium">Terms of Service</Link>
                    {' '}and{' '}
                    <Link href="/privacy" className="text-primary hover:underline font-medium">Privacy Policy</Link>
                    . Medical disclaimer: This app does not replace professional medical advice.
                  </label>
                </div>
                {errors.agree && (
                  <p role="alert" className="text-caption text-error mt-xs">{errors.agree}</p>
                )}
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
                Create Account
              </Button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-caption text-on-surface-variant mt-lg px-md">
          By creating an account, you acknowledge this is a digital health tool and does not replace
          medical advice from a licensed healthcare professional.
        </p>
      </div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-on-surface-variant">Loading...</div>}>
      <RegisterFormContent />
    </Suspense>
  );
}
