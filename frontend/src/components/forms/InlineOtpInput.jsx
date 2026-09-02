'use client';

import React, { useState, useEffect, useRef } from 'react';
import { authAPI, emitToast } from '@/lib/api';

/**
 * InlineOtpInput — Dual Email & Phone Verification Component
 *
 * Provides inline "Verify" trigger, 6-digit OTP input with countdown timer,
 * attempt tracking, and green verified badge states with locked inputs.
 */
export default function InlineOtpInput({
  label,
  id,
  name,
  type = 'text',
  value = '',
  onChange,
  placeholder,
  required = false,
  error,
  helper,
  leftIcon,
  channel = 'email', // 'email' | 'phone'
  isVerified = false,
  onVerified,
  onResetVerification,
  disabled = false,
}) {
  const [showOtpBox, setShowOtpBox] = useState(false);
  const [otp, setOtp] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [devOtpHint, setDevOtpHint] = useState('');

  const otpInputRef = useRef(null);

  // Countdown timer handler
  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  // Focus OTP input when opened
  useEffect(() => {
    if (showOtpBox && otpInputRef.current) {
      otpInputRef.current.focus();
    }
  }, [showOtpBox]);

  // Validate format before allowing "Verify"
  const isValidFormat = () => {
    const val = (value || '').trim();
    if (!val) return false;
    if (channel === 'email') {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
    }
    if (channel === 'phone') {
      // 10 digits or E.164
      const digits = val.replace(/\D/g, '');
      return digits.length >= 10 && digits.length <= 13;
    }
    return val.length >= 3;
  };

  // Trigger Send OTP
  const handleSendOtp = async (isResend = false) => {
    if (!isValidFormat()) {
      emitToast(`Please enter a valid ${channel === 'email' ? 'email address' : 'phone number'}.`, 'error');
      return;
    }

    setSending(true);
    setOtpError('');
    try {
      const res = await authAPI.sendOtp({
        channel,
        destination: value.trim(),
        purpose: 'REGISTRATION',
      });

      setShowOtpBox(true);
      setCountdown(60); // 60s cooldown
      setOtp('');

      if (res?.data?.debug_otp) {
        setDevOtpHint(`Dev Code: ${res.data.debug_otp}`);
      }

      emitToast(`Verification code dispatched to your ${channel}.`, 'success');
    } catch (err) {
      const msg = err.message || 'Failed to dispatch verification code.';
      setOtpError(msg);
      emitToast(msg, 'error');
    } finally {
      setSending(false);
    }
  };

  // Confirm 6-Digit OTP
  const handleConfirmOtp = async (e) => {
    if (e) e.preventDefault();
    if (otp.length !== 6) {
      setOtpError('Please enter all 6 numeric digits.');
      return;
    }

    setVerifying(true);
    setOtpError('');
    try {
      await authAPI.verifyOtp({
        channel,
        destination: value.trim(),
        otp: otp.trim(),
        purpose: 'REGISTRATION',
      });

      setShowOtpBox(false);
      setDevOtpHint('');
      if (onVerified) {
        onVerified(channel, value.trim());
      }
      emitToast(`${channel === 'email' ? 'Email' : 'Phone'} verified successfully!`, 'success');
    } catch (err) {
      const msg = err.message || 'Invalid or expired verification code.';
      setOtpError(msg);
      emitToast(msg, 'error');
    } finally {
      setVerifying(false);
    }
  };

  // Reset verification to allow editing
  const handleEdit = () => {
    setShowOtpBox(false);
    setOtp('');
    setOtpError('');
    setDevOtpHint('');
    if (onResetVerification) {
      onResetVerification();
    }
  };

  return (
    <div className="space-y-1.5">
      {/* Label and Verified Badge Header */}
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="block text-body-sm font-semibold text-on-surface">
          {label} {required && <span className="text-error font-normal">*</span>}
        </label>
        {isVerified && (
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-tertiary/15 text-tertiary border border-tertiary/30">
              <span className="material-symbols-outlined text-[14px]">verified</span>
              Verified
            </span>
            <button
              type="button"
              onClick={handleEdit}
              className="text-[11px] text-primary hover:underline font-medium ml-1"
            >
              Change
            </button>
          </div>
        )}
      </div>

      {/* Input Field Container */}
      <div className="relative flex items-center">
        {leftIcon && (
          <span className="absolute left-3.5 text-on-surface-variant/70 pointer-events-none flex items-center justify-center">
            {leftIcon}
          </span>
        )}

        <input
          id={id}
          name={name}
          type={type}
          value={value}
          onChange={(e) => {
            if (isVerified) return; // Prevent edits when verified
            onChange(e);
          }}
          placeholder={placeholder}
          disabled={disabled || isVerified}
          readOnly={isVerified}
          required={required}
          className={`w-full py-3 ${leftIcon ? 'pl-11' : 'pl-4'} pr-24 rounded-xl border text-body-md transition-all outline-none ${
            isVerified
              ? 'bg-surface-container-low/70 border-tertiary/40 text-on-surface font-medium cursor-default'
              : error
              ? 'border-error bg-error-container/20 text-on-surface focus:ring-2 focus:ring-error'
              : 'border-outline-variant/50 bg-surface-container-lowest text-on-surface focus:border-primary focus:ring-2 focus:ring-primary/20'
          }`}
        />

        {/* Inline Action Button */}
        {!isVerified && (
          <div className="absolute right-2">
            <button
              type="button"
              onClick={() => handleSendOtp(false)}
              disabled={sending || !isValidFormat() || showOtpBox}
              className={`px-3 py-1.5 rounded-lg text-caption font-bold transition-all flex items-center gap-1 ${
                !isValidFormat() || showOtpBox
                  ? 'bg-surface-container text-on-surface-variant/50 cursor-not-allowed'
                  : 'bg-primary text-on-primary hover:bg-primary/90 shadow-sm active:scale-95'
              }`}
            >
              {sending ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span>Sending</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[14px]">send</span>
                  <span>Verify</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Error or Helper message */}
      {!isVerified && !showOtpBox && (
        <>
          {error ? (
            <p role="alert" className="text-caption text-error">
              {error}
            </p>
          ) : helper ? (
            <p className="text-caption text-on-surface-variant">{helper}</p>
          ) : null}
        </>
      )}

      {/* Collapsible 6-Digit OTP Box */}
      {showOtpBox && !isVerified && (
        <div className="mt-2 p-3.5 rounded-xl bg-surface-container-low border border-primary/30 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-caption font-semibold text-primary flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">lock</span>
              Enter 6-Digit Verification Code
            </span>
            <button
              type="button"
              onClick={() => setShowOtpBox(false)}
              className="text-[12px] text-on-surface-variant hover:text-on-surface"
            >
              Cancel
            </button>
          </div>

          <p className="text-[12px] text-on-surface-variant mb-2.5">
            We sent a security code to <strong className="text-on-surface font-medium">{value}</strong>.
          </p>

          {devOtpHint && (
            <div className="mb-2.5 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-600 text-[11px] font-mono">
              💡 {devOtpHint}
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              ref={otpInputRef}
              type="text"
              maxLength={6}
              value={otp}
              onChange={(e) => {
                const numeric = e.target.value.replace(/\D/g, '').slice(0, 6);
                setOtp(numeric);
                if (numeric.length === 6) setOtpError('');
              }}
              placeholder="123456"
              className="w-36 px-3 py-2 text-center text-title-md font-mono tracking-widest rounded-lg border border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
            />

            <button
              type="button"
              onClick={handleConfirmOtp}
              disabled={verifying || otp.length !== 6}
              className={`flex-1 py-2 px-3 rounded-lg text-body-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                otp.length === 6
                  ? 'bg-primary text-on-primary hover:bg-primary/90 shadow-sm'
                  : 'bg-surface-container text-on-surface-variant/40 cursor-not-allowed'
              }`}
            >
              {verifying ? (
                <>
                  <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span>Checking...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">check</span>
                  <span>Confirm Code</span>
                </>
              )}
            </button>
          </div>

          {/* OTP Error Feedback */}
          {otpError && (
            <p role="alert" className="text-caption text-error mt-2 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">error</span>
              {otpError}
            </p>
          )}

          {/* Resend Link & Countdown */}
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-on-surface-variant">
            <span>Didn&apos;t receive the code?</span>
            {countdown > 0 ? (

              <span className="text-primary font-medium">
                Resend in {countdown}s
              </span>
            ) : (
              <button
                type="button"
                onClick={() => handleSendOtp(true)}
                disabled={sending}
                className="text-primary font-bold hover:underline"
              >
                {sending ? 'Sending...' : 'Resend Code'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
