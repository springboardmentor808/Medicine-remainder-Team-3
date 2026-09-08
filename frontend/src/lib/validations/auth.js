import { z } from 'zod';

/**
 * Frontend Zod Authentication Schemas (Mirroring Backend Pydantic v2).
 * Provides instantaneous inline client feedback before network dispatch.
 */

export const phoneRegex = /^[6-9]\d{9}$/;
export const nameRegex = /^[a-zA-Z\s.'-]{2,100}$/;
export const passwordSpecialRegex = /[!@#$%^&*(),.?":{}|<>]/;

export const registerSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name cannot exceed 100 characters')
    .regex(nameRegex, 'Name can only contain letters, spaces, dots, and hyphens')
    .refine((val) => !/<script|<|>|javascript:/i.test(val), 'Invalid characters detected'),

  email: z
    .string()
    .email('Please enter a valid email address')
    .transform((val) => val.trim().toLowerCase()),

  phone: z
    .string()
    .optional()
    .refine((val) => {
      if (!val) return true;
      const digits = val.replace(/\D/g, '');
      const clean = digits.startsWith('91') && digits.length === 12 ? digits.slice(2) : digits;
      return phoneRegex.test(clean);
    }, 'Phone must be a valid 10-digit number starting with 6-9'),

  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .max(128, 'Password cannot exceed 128 characters')
    .refine((val) => /[A-Z]/.test(val), 'Password must contain at least one uppercase letter (A-Z)')
    .refine((val) => /[a-z]/.test(val), 'Password must contain at least one lowercase letter (a-z)')
    .refine((val) => /[0-9]/.test(val), 'Password must contain at least one number (0-9)')
    .refine((val) => passwordSpecialRegex.test(val), 'Password must contain at least one special character (!@#$%^&* etc.)'),

  role: z.enum(['patient', 'caregiver', 'admin']).default('patient'),
});

export const loginSchema = z.object({
  username: z.string().min(1, 'Please enter your username or email'),
  password: z.string().min(1, 'Please enter your password'),
});

export const otpSchema = z.object({
  otp: z
    .string()
    .length(6, 'OTP must be exactly 6 digits')
    .regex(/^\d{6}$/, 'OTP must contain numbers only'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid registered email address'),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20, 'Invalid or expired password reset token'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .refine((val) => /[A-Z]/.test(val), 'Must contain at least 1 uppercase letter')
      .refine((val) => /[a-z]/.test(val), 'Must contain at least 1 lowercase letter')
      .refine((val) => /[0-9]/.test(val), 'Must contain at least 1 number')
      .refine((val) => passwordSpecialRegex.test(val), 'Must contain at least 1 special character'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
