'use client';

import React, { useState, useCallback } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import { supportAPI } from '@/lib/api';
import {
  Send,
  Paperclip,
  X,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

/**
 * SupportTicketForm — Vitality Core Design System
 * Reusable form component for creating support tickets.
 *
 * Props:
 *   onSuccess(ticket)  — callback after successful submission
 *   onCancel()         — callback to dismiss form
 *   compact            — if true, uses a smaller layout
 */

const CATEGORIES = [
  { value: 'medication_issue', label: 'Medication Issue' },
  { value: 'reminder_problem', label: 'Reminder Problem' },
  { value: 'account_help', label: 'Account & Login Help' },
  { value: 'bug_report', label: 'Bug Report' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'billing', label: 'Billing & Subscription' },
  { value: 'other', label: 'Other' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'text-on-surface-variant' },
  { value: 'medium', label: 'Medium', color: 'text-secondary' },
  { value: 'high', label: 'High', color: 'text-error' },
  { value: 'urgent', label: 'Urgent', color: 'text-error' },
];

const MAX_DESCRIPTION_LENGTH = 2000;

export default function SupportTicketForm({ onSuccess, onCancel, compact = false }) {
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('medium');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Validation
  const [touched, setTouched] = useState({});

  const validate = useCallback(() => {
    const errors = {};
    if (!subject.trim()) errors.subject = 'Subject is required';
    if (subject.trim().length > 150) errors.subject = 'Subject must be under 150 characters';
    if (!category) errors.category = 'Please select a category';
    if (!description.trim()) errors.description = 'Description is required';
    if (description.trim().length < 10) errors.description = 'Please provide at least 10 characters';
    return errors;
  }, [subject, category, description]);

  const validationErrors = validate();
  const isValid = Object.keys(validationErrors).length === 0;

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleFileAdd = (e) => {
    const files = Array.from(e.target.files || []);
    const maxSize = 5 * 1024 * 1024; // 5MB
    const validFiles = files.filter((f) => f.size <= maxSize);
    if (validFiles.length < files.length) {
      setError('Some files were skipped (max 5MB per file)');
    }
    setAttachments((prev) => [...prev, ...validFiles].slice(0, 3));
    e.target.value = '';
  };

  const removeAttachment = (idx) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ subject: true, category: true, description: true });

    if (!isValid) return;

    setSubmitting(true);
    setError('');

    try {
      const ticketData = {
        subject: subject.trim(),
        category,
        priority,
        description: description.trim(),
      };

      const res = await supportAPI.createTicket(ticketData);
      setSuccess(true);
      onSuccess?.(res.data || ticketData);
    } catch (err) {
      setError(err.message || 'Failed to submit support ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubject('');
    setCategory('');
    setPriority('medium');
    setDescription('');
    setAttachments([]);
    setError('');
    setSuccess(false);
    setTouched({});
  };

  // ── Success State ─────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-xl text-center gap-md">
        <div className="w-16 h-16 rounded-full bg-tertiary/10 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-tertiary" />
        </div>
        <h3 className="text-headline-sm text-on-surface">Ticket Submitted!</h3>
        <p className="text-body-sm text-on-surface-variant max-w-sm">
          Your support ticket has been created. Our team will respond within 24 hours.
          You can track ticket status in the Help Center.
        </p>
        <div className="flex gap-sm mt-md">
          <Button variant="secondary" onClick={handleReset}>
            Submit Another
          </Button>
          {onCancel && (
            <Button variant="primary" onClick={onCancel}>
              Done
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-lg" noValidate>
      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-sm px-md py-sm rounded-md bg-error-container text-on-error-container text-body-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError('')}
            className="ml-auto p-1 hover:opacity-70"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Subject */}
      <div className="flex flex-col gap-xs">
        <label htmlFor="ticket-subject" className="text-caption font-semibold text-on-surface uppercase tracking-wider">
          Subject *
        </label>
        <Input
          id="ticket-subject"
          placeholder="Brief summary of your issue"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          onBlur={() => handleBlur('subject')}
          maxLength={150}
          aria-invalid={touched.subject && validationErrors.subject ? 'true' : 'false'}
        />
        {touched.subject && validationErrors.subject && (
          <p className="text-xs text-error">{validationErrors.subject}</p>
        )}
      </div>

      {/* Category & Priority Row */}
      <div className={`grid gap-md ${compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
        {/* Category */}
        <div className="flex flex-col gap-xs">
          <label htmlFor="ticket-category" className="text-caption font-semibold text-on-surface uppercase tracking-wider">
            Category *
          </label>
          <select
            id="ticket-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            onBlur={() => handleBlur('category')}
            className="h-[48px] px-md rounded-md border border-outline-variant bg-surface-container-lowest text-on-surface text-body-sm
                       focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary
                       transition-colors duration-200 appearance-none cursor-pointer"
            aria-invalid={touched.category && validationErrors.category ? 'true' : 'false'}
          >
            <option value="" disabled>Select category...</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          {touched.category && validationErrors.category && (
            <p className="text-xs text-error">{validationErrors.category}</p>
          )}
        </div>

        {/* Priority */}
        <div className="flex flex-col gap-xs">
          <label className="text-caption font-semibold text-on-surface uppercase tracking-wider">
            Priority
          </label>
          <div className="flex gap-xs flex-wrap">
            {PRIORITIES.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPriority(p.value)}
                className={`
                  px-sm py-xs rounded-full text-caption font-medium border transition-all duration-200
                  ${priority === p.value
                    ? 'bg-primary text-on-primary border-primary shadow-sm'
                    : 'bg-surface-container-low text-on-surface-variant border-outline-variant hover:border-primary/50'
                  }
                `}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="flex flex-col gap-xs">
        <div className="flex items-center justify-between">
          <label htmlFor="ticket-description" className="text-caption font-semibold text-on-surface uppercase tracking-wider">
            Description *
          </label>
          <span className={`text-xs ${description.length > MAX_DESCRIPTION_LENGTH * 0.9 ? 'text-error' : 'text-on-surface-variant'}`}>
            {description.length}/{MAX_DESCRIPTION_LENGTH}
          </span>
        </div>
        <textarea
          id="ticket-description"
          placeholder="Please describe your issue in detail. Include any steps to reproduce, error messages, or relevant context..."
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION_LENGTH))}
          onBlur={() => handleBlur('description')}
          rows={compact ? 4 : 6}
          className="w-full px-md py-sm rounded-md border border-outline-variant bg-surface-container-lowest text-on-surface text-body-sm
                     placeholder:text-on-surface-variant/50 resize-none
                     focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary
                     transition-colors duration-200"
          aria-invalid={touched.description && validationErrors.description ? 'true' : 'false'}
        />
        {touched.description && validationErrors.description && (
          <p className="text-xs text-error">{validationErrors.description}</p>
        )}
      </div>

      {/* Attachments */}
      <div className="flex flex-col gap-xs">
        <label className="text-caption font-semibold text-on-surface uppercase tracking-wider">
          Attachments <span className="text-on-surface-variant font-normal">(Optional, max 3 files, 5MB each)</span>
        </label>

        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-xs">
            {attachments.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center gap-xs px-sm py-xs rounded-md bg-surface-container border border-outline-variant"
              >
                <Paperclip className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs text-on-surface truncate max-w-[140px]">{file.name}</span>
                <span className="text-xs text-on-surface-variant">
                  ({(file.size / 1024).toFixed(0)}KB)
                </span>
                <button
                  type="button"
                  onClick={() => removeAttachment(idx)}
                  className="p-0.5 hover:bg-error/10 rounded-full transition-colors"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="w-3.5 h-3.5 text-error" />
                </button>
              </div>
            ))}
          </div>
        )}

        {attachments.length < 3 && (
          <label className="flex items-center gap-sm px-md py-sm rounded-md border-2 border-dashed border-outline-variant
                            hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all duration-200">
            <Paperclip className="w-4 h-4 text-on-surface-variant" />
            <span className="text-body-sm text-on-surface-variant">Attach a file</span>
            <input
              type="file"
              className="hidden"
              onChange={handleFileAdd}
              accept="image/*,.pdf,.txt,.log"
            />
          </label>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-sm pt-sm border-t border-outline-variant">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          disabled={submitting || !isValid}
          loading={submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Submit Ticket
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
