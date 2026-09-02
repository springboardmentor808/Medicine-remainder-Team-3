'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authAPI } from '@/lib/api';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import InlineOtpInput from '@/components/forms/InlineOtpInput';

// Disposable email domain blacklist (client-side check)
const DISPOSABLE_DOMAINS = new Set([
  'tempmail.com','temp-mail.org','10minutemail.com','guerrillamail.com',
  'mailinator.com','trashmail.com','throwaway.email','fakeinbox.com',
  'sharklasers.com','yopmail.com','yopmail.fr','maildrop.cc',
  'discard.email','getnada.com','mailcatch.com','spam4.me',
  'mohmal.com','burner.kiwi','minutemail.com','emailfake.com',
  'crazymailing.com','armyspy.com','dayrep.com','rhyta.com',
  'superrito.com','teleworm.us','mailnator.com','spambox.us',
  'mytrashmail.com','wegwerfmail.de','guerrillamailblock.com',
  'grr.la','dispostable.com','mailnesia.com','harakirimail.com',
  'tempail.com','tempmailaddress.com','tmpmail.net','tmpmail.org',
  'mailexpire.com','mailforspam.com','safetymail.info',
]);

const FAKE_PHONE_PATTERNS = new Set([
  '0000000000','1111111111','2222222222','3333333333','4444444444',
  '5555555555','6666666666','7777777777','8888888888','9999999999',
  '1234567890','0987654321','0123456789','9876543210',
]);

/**
 * Register Page — PillSync
 * Design: Stitch screen "Registration - Step 1" (036684dd96a64b4f9e626397481ed04e)
 * Full-width centered registration form with inline dual Email & Phone OTP verification.
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
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
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
    let sanitized = type === 'checkbox' ? checked : value;
    // Phone: strip non-numeric except leading +
    if (name === 'phone') {
      const hasPlus = value.startsWith('+');
      const digitsOnly = value.replace(/[^\d]/g, '');
      sanitized = (hasPlus ? '+' : '') + digitsOnly;
      // If phone value changed, reset verification
      if (sanitized !== form.phone && isPhoneVerified) {
        setIsPhoneVerified(false);
      }
    }
    if (name === 'email') {
      // If email value changed, reset verification
      if (sanitized !== form.email && isEmailVerified) {
        setIsEmailVerified(false);
      }
    }
    setForm((prev) => ({ ...prev, [name]: sanitized }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
    setServerError('');
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim() || form.name.trim().length < 2)
      errs.name = 'Full name must be at least 2 characters';
    
    // Email validation
    if (!form.email.trim())
      errs.email = 'Email address is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = 'Please enter a valid email address';
    else {
      const domain = form.email.split('@')[1]?.toLowerCase();
      if (domain && DISPOSABLE_DOMAINS.has(domain))
        errs.email = 'Temporary/disposable email addresses are not permitted. Please use a real email.';
      else if (!isEmailVerified)
        errs.email = 'Please verify your email address using the 6-digit OTP code.';
    }

    // Phone validation
    if (!form.phone.trim())
      errs.phone = 'Phone number is required';
    else {
      const digits = form.phone.replace(/[^\d]/g, '');
      if (digits.length < 7 || digits.length > 15)
        errs.phone = 'Phone number must be 7-15 digits';
      else if (FAKE_PHONE_PATTERNS.has(digits) || new Set(digits).size === 1)
        errs.phone = 'This phone number appears invalid. Please enter a real phone number.';
      else if (!isPhoneVerified)
        errs.phone = 'Please verify your mobile number using the 6-digit OTP code.';
    }

    // Password validation
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
    
    if (!isEmailVerified || !isPhoneVerified) {
      setServerError('Please complete OTP verification for both Email and Phone before creating your account.');
      return;
    }

    setLoading(true);
    try {
      // Derive a clean, valid username from email prefix (at least 3 characters)
      const emailPrefix = form.email.trim().split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const username = emailPrefix.length >= 3 ? emailPrefix.slice(0, 50) : `${emailPrefix}_usr`.slice(0, 50);
      const cleanRole = (form.role || 'patient').toLowerCase();

      // Only pass fields matching the backend Pydantic schema
      const payload = {
        username,
        full_name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: cleanRole,
        phone: form.phone.trim(),
      };

      await authAPI.register(payload);
      router.push(`/login?registered=1&email=${encodeURIComponent(form.email.trim().toLowerCase())}`);
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

  const isFormComplete = isEmailVerified && isPhoneVerified;

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
              {/* Role Selection */}
              <div>
                <label className="block text-body-sm font-semibold text-on-surface mb-2">
                  Account Type (Role) *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'patient', label: 'Patient', icon: 'person', desc: 'Track medicines' },
                    { key: 'caregiver', label: 'Caregiver', icon: 'favorite', desc: 'Monitor patients' },
                    { key: 'admin', label: 'Admin', icon: 'shield_person', desc: 'System ops' },
                  ].map((r) => {
                    const isSelected = form.role === r.key;
                    return (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, role: r.key }))}
                        className={`p-2.5 rounded-xl border text-center transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary'
                            : 'border-outline-variant/40 bg-surface-container-low text-on-surface-variant hover:border-outline hover:bg-surface-container'
                        }`}
                      >
                        <span
                          className={`material-symbols-outlined text-[20px] mx-auto block mb-0.5 ${
                            isSelected ? 'text-primary' : 'text-on-surface-variant'
                          }`}
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          {r.icon}
                        </span>
                        <span className="text-caption font-bold block">{r.label}</span>
                        <span className="text-[10px] opacity-75 hidden sm:block">{r.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

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

              {/* Email Address with Inline OTP Verification */}
              <InlineOtpInput
                label="Email Address"
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                error={errors.email}
                required
                channel="email"
                isVerified={isEmailVerified}
                onVerified={() => {
                  setIsEmailVerified(true);
                  setErrors((prev) => ({ ...prev, email: '' }));
                }}
                onResetVerification={() => setIsEmailVerified(false)}
                leftIcon={<span className="material-symbols-outlined text-[20px]">mail</span>}
              />

              {/* Phone Number with Inline OTP Verification */}
              <InlineOtpInput
                label="Phone Number"
                id="phone"
                name="phone"
                type="tel"
                placeholder="+91 98765 43210"
                value={form.phone}
                onChange={handleChange}
                error={errors.phone}
                required
                channel="phone"
                isVerified={isPhoneVerified}
                onVerified={() => {
                  setIsPhoneVerified(true);
                  setErrors((prev) => ({ ...prev, phone: '' }));
                }}
                onResetVerification={() => setIsPhoneVerified(false)}
                leftIcon={<span className="material-symbols-outlined text-[20px]">phone</span>}
                helper="For SMS dose reminders and clinical alerts"
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

              {/* Verification Readiness Hint */}
              {!isFormComplete && (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-2 text-[12px] text-amber-700 dark:text-amber-400">
                  <span className="material-symbols-outlined text-[16px] shrink-0">info</span>
                  <span>
                    {!isEmailVerified && !isPhoneVerified
                      ? 'Please verify both your Email and Phone Number above to enable account registration.'
                      : !isEmailVerified
                      ? 'Please verify your Email Address with the OTP code to proceed.'
                      : 'Please verify your Phone Number with the OTP code to proceed.'}
                  </span>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                fullWidth
                loading={loading}
                disabled={!isFormComplete || loading}
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
