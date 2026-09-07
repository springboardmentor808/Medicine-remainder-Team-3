'use client';

import React, { useState, useCallback } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import { supportAPI } from '@/lib/api';
import { useLanguage } from '@/context/LanguageContext';
import {
  Send,
  Paperclip,
  X,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  HeartHandshake,
  Clock,
  ShieldCheck,
  HelpCircle,
} from 'lucide-react';

/**
 * SupportTicketForm — PillSync Patient & Caregiver Assistance Desk
 * Replaces developer/IT jargon ("Raise a ticket", "Bug report") with empathetic clinical care terminology.
 *
 * Props:
 *   onSuccess(ticket)  — callback after successful submission
 *   onCancel()         — callback to dismiss form
 *   compact            — if true, uses a smaller layout
 */

const CATEGORIES = [
  {
    value: 'reminder_problem',
    label_en: 'Alarm / Reminder Problem (Didn’t ring or incorrect time)',
    label_hi: 'अलार्म / रिमाइंडर समस्या (समय पर नहीं बजा या गलत समय)',
    short_en: 'Alarm / Reminder Issue',
    short_hi: 'अलार्म या रिमाइंडर में दिक्कत',
  },
  {
    value: 'scan_issue',
    label_en: 'Prescription Scanner Issue (Trouble reading Rx or upload)',
    label_hi: 'पर्ची स्कैनिंग में समस्या (पर्ची पढ़ने या अपलोड में दिक्कत)',
    short_en: 'Prescription Scanner Issue',
    short_hi: 'पर्ची स्कैनिंग में परेशानी',
  },
  {
    value: 'medication_query',
    label_en: 'Medicine & Dosage Question (Clarification on doses or timings)',
    label_hi: 'दवाई व खुराक संबंधी प्रश्न (खुराक या समय समझने में सहायता)',
    short_en: 'Medicine / Dose Question',
    short_hi: 'दवाई या खुराक का सवाल',
  },
  {
    value: 'caregiver_issue',
    label_en: 'Caregiver & Family Sync (Connecting family or alerts)',
    label_hi: 'केयरगिवर व परिवार सहायता (परिवार को जोड़ने या अलर्ट में दिक्कत)',
    short_en: 'Caregiver & Family Sync',
    short_hi: 'केयरगिवर व परिवार सहायता',
  },
  {
    value: 'account_help',
    label_en: 'Login & Profile Help (Password, phone, or settings)',
    label_hi: 'लॉगिन व प्रोफाइल सहायता (पासवर्ड, फोन नंबर या खाता सेटिंग्स)',
    short_en: 'Login & Profile Help',
    short_hi: 'लॉगिन या प्रोफाइल सहायता',
  },
  {
    value: 'other',
    label_en: 'Other Healthcare / General Assistance',
    label_hi: 'अन्य स्वास्थ्य या सामान्य सहायता',
    short_en: 'Other Assistance',
    short_hi: 'अन्य कोई सहायता',
  },
];

const PRIORITIES = [
  { value: 'low', label_en: 'Routine', label_hi: 'सामान्य (Routine)' },
  { value: 'medium', label_en: 'Needs Attention', label_hi: 'जरूरी (Needs Attention)' },
  { value: 'high', label_en: 'High Priority', label_hi: 'अति आवश्यक (High)' },
  { value: 'urgent', label_en: 'Urgent Care', label_hi: 'तत्काल सहायता (Urgent)' },
];

const MAX_DESCRIPTION_LENGTH = 2000;

export default function SupportTicketForm({ onSuccess, onCancel, compact = false }) {
  const { locale } = useLanguage?.() || { locale: 'en' };
  const isHi = locale === 'hi';

  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('medium');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submittedTicket, setSubmittedTicket] = useState(null);

  // Validation
  const [touched, setTouched] = useState({});

  const validate = useCallback(() => {
    const errors = {};
    if (!subject.trim()) {
      errors.subject = isHi ? 'कृपया मुख्य विषय दर्ज करें' : 'Subject is required';
    } else if (subject.trim().length > 150) {
      errors.subject = isHi ? 'विषय 150 अक्षरों से कम होना चाहिए' : 'Subject must be under 150 characters';
    }
    if (!category) {
      errors.category = isHi ? 'कृपया एक सहायता श्रेणी चुनें' : 'Please select an assistance category';
    }
    if (!description.trim()) {
      errors.description = isHi ? 'कृपया अपनी समस्या का विवरण लिखें' : 'Description is required';
    } else if (description.trim().length < 10) {
      errors.description = isHi ? 'कृपया कम से कम 10 अक्षर लिखें' : 'Please provide at least 10 characters';
    }
    return errors;
  }, [subject, category, description, isHi]);

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
      setError(isHi ? 'कुछ फाइलें छोड़ी गईं (अधिकतम 5MB प्रति फाइल)' : 'Some files were skipped (max 5MB per file)');
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
      const createdItem = res?.data || res || ticketData;
      setSubmittedTicket(createdItem);
      onSuccess?.(createdItem);
    } catch (err) {
      setError(err?.message || (isHi ? 'अनुरोध भेजने में असमर्थ। कृपया पुनः प्रयास करें।' : 'Failed to submit assistance request. Please try again.'));
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
    setSubmittedTicket(null);
    setTouched({});
  };

  // ── Success State ─────────────────────────────────────────────────────
  if (submittedTicket) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center gap-4 animate-in fade-in">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <Badge variant="outline" className="text-xs px-2.5 py-0.5 font-mono border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5">
            {submittedTicket.id || 'REQ-2026-SUBMITTED'}
          </Badge>
          <h3 className="text-xl font-bold text-on-surface">
            {isHi ? 'सहायता अनुरोध दर्ज हो गया है!' : 'Care Request Received!'}
          </h3>
        </div>
        <p className="text-sm text-on-surface-variant max-w-md leading-relaxed">
          {isHi
            ? 'आपका अनुरोध हमारी सपोर्ट और क्लिनिकल टीम को मिल गया है। हम जल्द ही आपकी सहायता करेंगे। आप चिंता न करें।'
            : 'Our care coordination team has received your request and is reviewing it. We aim to respond within 2-4 hours.'}
        </p>
        <div className="flex items-center gap-2 p-3 bg-surface-container rounded-xl border border-outline-variant text-xs text-on-surface-variant max-w-sm">
          <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
          <span>
            {isHi
              ? 'आपकी स्वास्थ्य जानकारी सुरक्षित है और केवल अधिकृत टीम ही इसे देख सकती है।'
              : 'Your health data is confidential and handled under strict healthcare privacy standards.'}
          </span>
        </div>
        <div className="flex gap-3 mt-2">
          <Button variant="secondary" onClick={handleReset}>
            {isHi ? 'नया प्रश्न पूछें' : 'Ask Another Question'}
          </Button>
          {onCancel && (
            <Button variant="primary" onClick={onCancel}>
              {isHi ? 'पूर्ण (Done)' : 'Close Desk'}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      {/* Friendly Care Header */}
      <div className="flex items-start gap-3 p-3.5 rounded-xl bg-primary/5 border border-primary/15 text-on-surface">
        <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
          <HeartHandshake className="w-5 h-5" />
        </div>
        <div className="text-xs space-y-0.5">
          <p className="font-semibold text-sm text-on-surface">
            {isHi ? 'हम आपकी सहायता के लिए यहाँ हैं' : 'Patient & Caregiver Help Desk'}
          </p>
          <p className="text-on-surface-variant">
            {isHi
              ? 'अलार्म, दवाई, पर्ची स्कैनिंग या अकाउंट से जुड़ी किसी भी समस्या के लिए हमें तुरंत लिखें।'
              : 'Experiencing an alarm glitch, scanner question, or dosage doubt? Let our team know below.'}
          </p>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-error-container text-on-error-container text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError('')}
            className="p-1 hover:opacity-70 rounded"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Issue Category */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="ticket-category" className="text-xs font-semibold text-on-surface uppercase tracking-wider">
          {isHi ? 'सहायता की श्रेणी (Category) *' : 'What do you need help with? *'}
        </label>
        <select
          id="ticket-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          onBlur={() => handleBlur('category')}
          className="h-12 px-3 rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary
                     transition-colors duration-200 appearance-none cursor-pointer"
          aria-invalid={touched.category && validationErrors.category ? 'true' : 'false'}
        >
          <option value="" disabled>
            {isHi ? '-- सहायता श्रेणी चुनें --' : '-- Select an issue category --'}
          </option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {isHi ? c.label_hi : c.label_en}
            </option>
          ))}
        </select>
        {touched.category && validationErrors.category && (
          <p className="text-xs text-error font-medium">{validationErrors.category}</p>
        )}
      </div>

      {/* Subject */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="ticket-subject" className="text-xs font-semibold text-on-surface uppercase tracking-wider">
          {isHi ? 'मुख्य विषय / संक्षेप (Subject) *' : 'Summary / Short Subject *'}
        </label>
        <Input
          id="ticket-subject"
          placeholder={isHi ? 'उदा: सुबह का 8 बजे का अलार्म नहीं बजा' : 'e.g. Morning 8 AM reminder was silent'}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          onBlur={() => handleBlur('subject')}
          maxLength={150}
          aria-invalid={touched.subject && validationErrors.subject ? 'true' : 'false'}
        />
        {touched.subject && validationErrors.subject && (
          <p className="text-xs text-error font-medium">{validationErrors.subject}</p>
        )}
      </div>

      {/* Priority Row */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-on-surface uppercase tracking-wider">
          {isHi ? 'प्राथमिकता / तात्कालिकता (Urgency)' : 'Urgency Level'}
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PRIORITIES.map((p) => {
            const isSelected = priority === p.value;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => setPriority(p.value)}
                className={`
                  px-3 py-2 rounded-xl text-xs font-medium border transition-all text-center min-h-[44px] flex items-center justify-center
                  ${isSelected
                    ? 'bg-primary text-on-primary border-primary shadow-sm font-semibold'
                    : 'bg-surface-container-low text-on-surface-variant border-outline-variant hover:border-primary/40'
                  }
                `}
              >
                {isHi ? p.label_hi : p.label_en}
              </button>
            );
          })}
        </div>
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="ticket-description" className="text-xs font-semibold text-on-surface uppercase tracking-wider">
            {isHi ? 'समस्या का विस्तारपूर्वक विवरण (Details) *' : 'Detailed Description *'}
          </label>
          <span className={`text-xs ${description.length > MAX_DESCRIPTION_LENGTH * 0.9 ? 'text-error font-bold' : 'text-on-surface-variant'}`}>
            {description.length}/{MAX_DESCRIPTION_LENGTH}
          </span>
        </div>
        <textarea
          id="ticket-description"
          placeholder={
            isHi
              ? 'कृपया विस्तार से बताएं कि क्या हुआ। क्या कोई त्रुटि संदेश दिखा? कौन सी दवा पर असर पड़ा?'
              : 'Please explain what happened. Did an error message appear? Which medication or schedule is affected?'
          }
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION_LENGTH))}
          onBlur={() => handleBlur('description')}
          rows={compact ? 4 : 5}
          className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface text-sm
                     placeholder:text-on-surface-variant/50 resize-none
                     focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary
                     transition-colors duration-200"
          aria-invalid={touched.description && validationErrors.description ? 'true' : 'false'}
        />
        {touched.description && validationErrors.description && (
          <p className="text-xs text-error font-medium">{validationErrors.description}</p>
        )}
      </div>

      {/* Attachments */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-on-surface uppercase tracking-wider">
          {isHi ? 'स्क्रीनशॉट या पर्ची संलग्न करें (वैकल्पिक)' : 'Attach Screenshot or Prescription (Optional)'}
          <span className="text-on-surface-variant font-normal text-[11px] ml-1.5">(Max 3 files, 5MB each)</span>
        </label>

        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container border border-outline-variant"
              >
                <Paperclip className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-xs text-on-surface truncate max-w-[140px]">{file.name}</span>
                <span className="text-[11px] text-on-surface-variant">
                  ({(file.size / 1024).toFixed(0)}KB)
                </span>
                <button
                  type="button"
                  onClick={() => removeAttachment(idx)}
                  className="p-1 hover:bg-error/10 rounded-full transition-colors ml-1"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="w-3.5 h-3.5 text-error" />
                </button>
              </div>
            ))}
          </div>
        )}

        {attachments.length < 3 && (
          <label className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border-2 border-dashed border-outline-variant
                            hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all duration-200 min-h-[44px]">
            <Paperclip className="w-4 h-4 text-on-surface-variant" />
            <span className="text-xs text-on-surface-variant font-medium">
              {isHi ? 'फोटो या फाइल चुनें (Choose file)' : 'Click to select screenshot or file'}
            </span>
            <input
              type="file"
              className="hidden"
              onChange={handleFileAdd}
              accept="image/*,.pdf,.txt"
            />
          </label>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline-variant">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
            {isHi ? 'रद्द करें' : 'Cancel'}
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          disabled={submitting || !isValid}
          loading={submitting}
          className="min-h-[44px] px-5"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{isHi ? 'भेज रहे हैं...' : 'Sending Request...'}</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>{isHi ? 'सहायता अनुरोध भेजें' : 'Send Help Request'}</span>
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

