'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Clock,
  XCircle,
  Camera,
  PlusCircle,
  Pill,
  Bell,
  ChevronRight,
  Package,
  AlertTriangle,
  Sunrise,
  Sun,
  Moon,
  TrendingUp,
  Calendar,
  RotateCcw,
  Download,
  Flame,
  Share2,
  HeartPulse,
  ShieldCheck,
  PhoneCall,
  Globe,
  HelpCircle,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import AdherenceRing from '@/components/ui/AdherenceRing';
import LogoutButton from '@/components/ui/LogoutButton';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ReminderWidget from '@/components/dashboard/ReminderWidget';
import PushNotificationPrompt from '@/components/patient/PushNotificationPrompt';
import ExportDataModal from '@/components/dashboard/ExportDataModal';
import SupportTicketForm from '@/components/forms/SupportTicketForm';
import { exportAPI, medicineAPI, patientAPI, analyticsAPI } from '@/lib/api';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import { useLanguage } from '@/context/LanguageContext';

// ── Constants ────────────────────────────────────────────────────────────────

const SNOOZE_MINUTES = 15;

// ── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function formatDate() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const SLOT_META = {
  morning:   { label: 'Morning',   time: '8:00 AM',  Icon: Sunrise, bg: 'bg-secondary/10', text: 'text-secondary',  border: 'border-secondary/20' },
  afternoon: { label: 'Afternoon', time: '1:00 PM',  Icon: Sun,     bg: 'bg-primary/10',   text: 'text-primary',    border: 'border-primary/20' },
  evening:   { label: 'Evening',   time: '8:00 PM',  Icon: Moon,    bg: 'bg-tertiary/10',  text: 'text-tertiary',   border: 'border-tertiary/20' },
};

const COLOR_MAP = {
  primary:   { bg: 'bg-primary/10',   text: 'text-primary',   icon: 'bg-primary/15' },
  tertiary:  { bg: 'bg-tertiary/10',  text: 'text-tertiary',  icon: 'bg-tertiary/15' },
  secondary: { bg: 'bg-secondary/10', text: 'text-secondary', icon: 'bg-secondary/15' },
};

function statusBadge(status) {
  if (status === 'taken')   return { variant: 'taken',   label: 'Taken' };
  if (status === 'skipped') return { variant: 'missed',  label: 'Skipped' };
  if (status === 'snoozed') return { variant: 'snoozed', label: 'Snoozed' };
  return null;
}

// ── Dose Card ─────────────────────────────────────────────────────────────────

function DoseCard({ med, onTaken, onSnooze, onSkip }) {
  const colors = COLOR_MAP[med.color] ?? COLOR_MAP.primary;
  const badge  = statusBadge(med.status);
  const isDone = med.status === 'taken' || med.status === 'skipped';

  return (
    <div
      className={[
        'relative flex items-start gap-md p-md rounded-lg border transition-all duration-300',
        isDone
          ? 'bg-surface-container-low/60 border-outline-variant/30 opacity-70'
          : 'bg-surface-container-lowest border-outline-variant/40 hover:shadow-sm hover:border-outline-variant/70',
      ].join(' ')}
    >
      {/* Pill icon */}
      <div className={`shrink-0 w-10 h-10 rounded-full ${colors.icon} flex items-center justify-center`}>
        <Pill className={`w-5 h-5 ${colors.text}`} />
      </div>

      {/* Medicine info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-sm">
          <div>
            <p className={`text-body-sm font-semibold leading-tight ${isDone ? 'text-on-surface-variant' : 'text-on-surface'}`}>
              {med.name}
              <span className="ml-1.5 text-caption font-normal text-on-surface-variant">
                {med.strength}
              </span>
            </p>
            <p className="text-label-caps text-on-surface-variant mt-0.5">{med.type}</p>
          </div>
          {badge && (
            <Badge variant={badge.variant} size="xs">{badge.label}</Badge>
          )}
        </div>

        <div className="flex items-center gap-1 mt-1">
          <span className="material-symbols-outlined text-[14px] text-on-surface-variant">info</span>
          <p className="text-label-caps text-on-surface-variant">{med.instructions}</p>
        </div>

        {/* Snoozed countdown */}
        {med.status === 'snoozed' && med.snoozedUntil && (
          <p className="text-label-caps text-secondary mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Remind again at {med.snoozedUntil}
          </p>
        )}

        {/* Action buttons — only for pending/snoozed */}
        {(med.status === 'pending' || med.status === 'snoozed') && (
          <div className="flex items-center gap-xs mt-sm flex-wrap">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
              onClick={() => onTaken(med.id)}
              className="h-10 sm:!h-8 min-h-[40px] sm:min-h-0 font-semibold px-3"
            >
              Taken
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Clock className="w-3.5 h-3.5" />}
              onClick={() => onSnooze(med.id)}
              className="h-10 sm:!h-8 min-h-[40px] sm:min-h-0 px-3"
            >
              Snooze {SNOOZE_MINUTES}m
            </Button>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<XCircle className="w-3.5 h-3.5" />}
              onClick={() => onSkip(med.id)}
              className="h-10 sm:!h-8 min-h-[40px] sm:min-h-0 !text-error hover:!bg-error/8 px-3"
            >
              Skip
            </Button>
          </div>
        )}

        {/* Undo for taken/skipped */}
        {isDone && (
          <button
            onClick={() => med.status === 'taken' ? onTaken(med.id, true) : onSkip(med.id, true)}
            className="mt-1.5 min-h-[36px] py-1 text-label-caps text-on-surface-variant hover:text-primary flex items-center gap-1.5 transition-colors active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Undo
          </button>
        )}
      </div>
    </div>
  );
}

// ── Slot Section ──────────────────────────────────────────────────────────────

function SlotSection({ slotKey, meds, onTaken, onSnooze, onSkip }) {
  const meta   = SLOT_META[slotKey];
  const { Icon } = meta;
  const total  = meds.length;
  const done   = meds.filter((m) => m.status === 'taken' || m.status === 'skipped').length;
  const allDone = done === total;

  return (
    <div className="space-y-sm">
      {/* Slot header */}
      <div className="flex items-center gap-sm">
        <div className={`w-8 h-8 rounded-full ${meta.bg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${meta.text}`} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-xs">
            <h3 className="text-caption font-bold text-on-surface">{meta.label}</h3>
            <span className="text-label-caps text-on-surface-variant">· {meta.time}</span>
          </div>
        </div>
        <span className="text-label-caps text-on-surface-variant">
          {done}/{total} done
        </span>
        {allDone && (
          <Badge variant="taken" size="xs" icon={<CheckCircle2 className="w-3 h-3" />}>
            Complete
          </Badge>
        )}
      </div>

      {/* Dose cards */}
      <div className="space-y-xs ml-10">
        {meds.map((med) => (
          <DoseCard
            key={med.id}
            med={med}
            onTaken={onTaken}
            onSnooze={onSnooze}
            onSkip={onSkip}
          />
        ))}
      </div>
    </div>
  );
}

// ── Inventory Widget ──────────────────────────────────────────────────────────

function InventoryWidget({ items }) {
  const LOW_STOCK_THRESHOLD = 3;

  return (
    <Card variant="default" padding="md" className="space-y-sm">
      <Card.Header
        title="Pill Inventory"
        subtitle="Remaining stock overview"
        icon={<Package className="w-5 h-5 text-primary" />}
        action={
          <Link href="/medicines">
            <Button variant="ghost" size="sm" className="!px-xs">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </Link>
        }
      />

      <div className="space-y-sm mt-sm">
        {items.map((item) => {
          const pct        = Math.round((item.remainingDays / item.totalDays) * 100);
          const isLow      = item.remainingDays <= LOW_STOCK_THRESHOLD;
          const isCritical = item.remainingDays <= 1;

          return (
            <div key={item.id} className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-caption font-semibold text-on-surface truncate max-w-[60%]">
                  {item.name}
                </p>
                <div className="flex items-center gap-xs shrink-0">
                  {isLow && (
                    <Badge
                      variant={isCritical ? 'error' : 'warning'}
                      size="xs"
                      icon={<AlertTriangle className="w-2.5 h-2.5" />}
                    >
                      {isCritical ? 'Critical' : 'Low Stock'}
                    </Badge>
                  )}
                  <span className={`text-label-caps font-bold ${isCritical ? 'text-error' : isLow ? 'text-secondary' : 'text-on-surface-variant'}`}>
                    {item.remainingDays}d
                  </span>
                </div>
              </div>

              {/* Stock progress bar */}
              <div className="w-full h-1.5 rounded-full bg-surface-container overflow-hidden">
                <div
                  className={[
                    'h-full rounded-full transition-all duration-700',
                    isCritical ? 'bg-error' : isLow ? 'bg-secondary' : 'bg-tertiary',
                  ].join(' ')}
                  style={{ width: `${Math.max(pct, 2)}%` }}
                  role="progressbar"
                  aria-valuenow={item.remainingDays}
                  aria-valuemin={0}
                  aria-valuemax={item.totalDays}
                  aria-label={`${item.name}: ${item.remainingDays} days remaining`}
                />
              </div>

              <p className="text-[10px] text-on-surface-variant">
                {item.pillsLeft} pills · {item.remainingDays} days remaining
              </p>
            </div>
          );
        })}
      </div>

      {/* Refill CTA */}
      <div className="pt-sm border-t border-outline-variant/40">
        <Link href="/refill">
          <Button variant="secondary" size="sm" fullWidth leftIcon={<Package className="w-4 h-4" />}>
            Manage Refills
          </Button>
        </Link>
      </div>
    </Card>
  );
}

// ── Inner Page (has access to useToast) ──────────────────────────────────────

function PatientDashboardInner() {
  const { addToast } = useToast();
  const { locale, toggleLocale, t } = useLanguage();

  // ── State ──────────────────────────────────────────────────────────────────
  const [schedule, setSchedule] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [weeklyTrends, setWeeklyTrends] = useState([]);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('pillsync_user');
        if (stored) {
          setCurrentUser(JSON.parse(stored));
        }
      } catch (err) {
        console.error('Failed to parse pillsync_user', err);
      }
    }
  }, []);

  // Coordinated Parallel Initial Data Fetching (Zero Waterfalls)
  useEffect(() => {
    let isMounted = true;
    (async () => {
      setScheduleLoading(true);
      try {
        const [scheduleRes, inventoryRes, trendsRes] = await Promise.allSettled([
          patientAPI.getTodaySchedule(),
          medicineAPI.list(),
          analyticsAPI.getTrends({ days: 7 }),
        ]);

        if (!isMounted) return;

        // 1. Process Schedule
        if (scheduleRes.status === 'fulfilled') {
          const data = scheduleRes.value;
          const list = Array.isArray(data) ? data : (data?.schedules || []);
          const slotCycle = ['morning', 'afternoon', 'evening'];
          const colorCycle = ['primary', 'tertiary', 'secondary'];
          const mapped = list.map((s, idx) => ({
            id: s.id || `sched-${idx}`,
            schedule_id: s.id,
            medicine_id: s.medicine_id,
            name: s.medicine_name || s.name || 'Medication',
            strength: s.dosage || s.strength || '',
            type: s.disease_category || s.dose_label || 'Medication',
            instructions: s.notes || s.instructions || '',
            slot: s.dose_label?.toLowerCase().includes('morning')
              ? 'morning'
              : s.dose_label?.toLowerCase().includes('afternoon') || s.dose_label?.toLowerCase().includes('noon')
              ? 'afternoon'
              : s.dose_label?.toLowerCase().includes('evening') || s.dose_label?.toLowerCase().includes('night')
              ? 'evening'
              : slotCycle[idx % 3],
            time: s.scheduled_time || ['08:00 AM', '01:00 PM', '08:00 PM'][idx % 3],
            scheduled_time_24: s.scheduled_time || ['08:00', '13:00', '20:00'][idx % 3],
            status: 'pending',
            snoozedUntil: null,
            color: colorCycle[idx % 3],
          }));

          // ── Reconstruct persisted dose status from PostgreSQL daily-tracking ──
          try {
            const tracking = await patientAPI.getDailyTracking();
            const dbDoses = tracking?.doses || [];
            // Build a fast lookup: schedule_id → DB status string
            const statusMap = {};
            for (const d of dbDoses) {
              if (d.schedule_id) {
                statusMap[d.schedule_id] = d.status; // "Taken", "Missed", "Snoozed", "Pending"
              }
            }
            // Overlay persisted statuses onto the mapped schedule
            const withPersistedStatus = mapped.map((m) => {
              const dbStatus = statusMap[m.schedule_id];
              if (!dbStatus) return m;
              const normalized =
                dbStatus === 'Taken'   ? 'taken'   :
                dbStatus === 'Missed'  ? 'skipped' :
                dbStatus === 'Snoozed' ? 'snoozed' :
                'pending';
              return { ...m, status: normalized };
            });
            setSchedule(withPersistedStatus);
          } catch {
            // If daily-tracking fails (e.g. no logs yet), fall back to all-pending
            setSchedule(mapped);
          }
        } else {
          setSchedule([]);
        }

        // 2. Process Inventory
        if (inventoryRes.status === 'fulfilled') {
          const res = inventoryRes.value;
          const items = Array.isArray(res) ? res : (res?.items || res?.data || []);
          if (Array.isArray(items) && items.length > 0) {
            const mapped = items.map((m, idx) => ({
              id: m.id || `inv-${idx}`,
              name: `${m.name} ${m.dosage || ''}`.trim(),
              totalDays: m.initial_quantity || 30,
              remainingDays: Math.round(m.days_until_empty || 0),
              pillsLeft: m.current_stock || 0,
            }));
            setInventory(mapped);
          } else {
            setInventory([]);
          }
        } else {
          setInventory([]);
        }

        // 3. Process Trends
        if (trendsRes.status === 'fulfilled') {
          const trends = trendsRes.value;
          if (Array.isArray(trends) && trends.length > 0) {
            const todayIso = new Date().toISOString().split('T')[0];
            const mapped = trends.map((t) => {
              const pct = t.is_before_account
                ? 0  // days before account creation: blank/zero bars
                : Math.round(t.adherence_rate ?? 0);
              return {
                // Use day_abbr from backend if available (Sun/Mon/…), else derive from date
                dayLabel: t.day_abbr
                  ? t.day_abbr[0]
                  : new Date(t.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })[0],
                dayName: t.day_name || t.day_abbr || t.date,
                percentage: pct,
                isToday: t.date === todayIso,
                isBeforeAccount: !!t.is_before_account,
              };
            });
            setWeeklyTrends(mapped);
          } else {
            // No trends yet for new accounts — show 7 zero bars (today highlighted)
            const todayIso = new Date().toISOString().split('T')[0];
            const days = [];
            for (let i = 6; i >= 0; i--) {
              const d = new Date();
              d.setDate(d.getDate() - i);
              const iso = d.toISOString().split('T')[0];
              days.push({
                dayLabel: d.toLocaleDateString('en-US', { weekday: 'short' })[0],
                dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
                percentage: 0,
                isToday: iso === todayIso,
                isBeforeAccount: false,
              });
            }
            setWeeklyTrends(days);
          }
        } else {
          // Network/auth error — show 7 zero bars
          const todayIso = new Date().toISOString().split('T')[0];
          const days = [];
          for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const iso = d.toISOString().split('T')[0];
            days.push({
              dayLabel: d.toLocaleDateString('en-US', { weekday: 'short' })[0],
              dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
              percentage: 0,
              isToday: iso === todayIso,
              isBeforeAccount: false,
            });
          }
          setWeeklyTrends(days);
        }
      } catch {
        if (isMounted) {
          setSchedule([]);
          setInventory([]);
        }
      } finally {
        if (isMounted) {
          setScheduleLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);


  const displayName = currentUser?.full_name || currentUser?.name || currentUser?.username || 'Patient';

  // ── Derived Stats ──────────────────────────────────────────────────────────
  const compliance = useMemo(() => {
    const total = schedule.length;
    if (total === 0) return 0;
    const taken = schedule.filter((m) => m.status === 'taken').length;
    return Math.round((taken / total) * 100);
  }, [schedule]);

  const pendingCount = useMemo(
    () => schedule.filter((m) => m.status === 'pending' || m.status === 'snoozed').length,
    [schedule]
  );

  const lowStockCount = useMemo(
    () => inventory.filter((i) => i.remainingDays <= 3).length,
    [inventory]
  );

  // Grouped by slot
  const grouped = useMemo(
    () => ({
      morning:   schedule.filter((m) => m.slot === 'morning'),
      afternoon: schedule.filter((m) => m.slot === 'afternoon'),
      evening:   schedule.filter((m) => m.slot === 'evening'),
    }),
    [schedule]
  );

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleTaken = useCallback(async (id, undo = false) => {
    const med = schedule.find((m) => m.id === id);
    // Optimistic update
    setSchedule((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, status: undo ? 'pending' : 'taken', snoozedUntil: null }
          : m
      )
    );
    if (!undo) {
      addToast({
        title: '✅ Dose Recorded',
        description: `${med?.name} ${med?.strength} marked as taken.`,
        variant: 'success',
        duration: 3500,
      });
      try {
        await patientAPI.recordAction({
          schedule_id: med?.schedule_id,
          medicine_id: med?.medicine_id,
          scheduled_date: new Date().toISOString().split('T')[0],
          scheduled_time: med?.scheduled_time_24 || new Date().toTimeString().slice(0, 5),
          action: 'TAKEN',
        });
      } catch (err) {
        // Revert optimistic update on failure
        setSchedule((prev) =>
          prev.map((m) => (m.id === id ? { ...m, status: 'pending' } : m))
        );
        addToast({ title: 'Error', description: err.message || 'Failed to record dose.', variant: 'error' });
      }
    }
  }, [schedule, addToast]);

  const handleSnooze = useCallback(async (id) => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + SNOOZE_MINUTES);
    const snoozedUntil = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const med = schedule.find((m) => m.id === id);

    // Optimistic update
    setSchedule((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: 'snoozed', snoozedUntil } : m))
    );

    addToast({
      title: '⏰ Snoozed',
      description: `Reminder for ${med?.name} set for ${snoozedUntil}.`,
      variant: 'info',
      duration: 3000,
    });

    try {
      await patientAPI.recordAction({
        schedule_id: med?.schedule_id,
        medicine_id: med?.medicine_id,
        scheduled_date: new Date().toISOString().split('T')[0],
        scheduled_time: med?.scheduled_time_24 || new Date().toTimeString().slice(0, 5),
        action: 'SNOOZE',
        snooze_minutes: SNOOZE_MINUTES,
      });
    } catch {
      // Snooze is best-effort — keep local state even if server fails
    }
  }, [schedule, addToast]);

  const handleSkip = useCallback(async (id, undo = false) => {
    const med = schedule.find((m) => m.id === id);
    // Optimistic update
    setSchedule((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, status: undo ? 'pending' : 'skipped', snoozedUntil: null }
          : m
      )
    );
    if (!undo) {
      addToast({
        title: 'Dose Skipped',
        description: `${med?.name} skipped for this session.`,
        variant: 'warning',
        duration: 3000,
        action: {
          label: 'Undo',
          onClick: () =>
            setSchedule((prev) =>
              prev.map((m) =>
                m.id === id ? { ...m, status: 'pending', snoozedUntil: null } : m
              )
            ),
        },
      });
      try {
        await patientAPI.recordAction({
          schedule_id: med?.schedule_id,
          medicine_id: med?.medicine_id,
          scheduled_date: new Date().toISOString().split('T')[0],
          scheduled_time: med?.scheduled_time_24 || new Date().toTimeString().slice(0, 5),
          action: 'MISSED',
        });
      } catch {
        // Non-critical — keep local state
      }
    }
  }, [schedule, addToast]);

  // ── Auto-Popup for Next Due Medication (Medical Sage Green) ───────────────
  const [dosePopupOpen, setDosePopupOpen] = useState(false);

  // Identify next due medication
  const nextDueMed = useMemo(() => {
    return schedule.find((m) => m.status === 'pending') || schedule.find((m) => m.status === 'snoozed') || null;
  }, [schedule]);

  // Open auto-popup once per session if pending medication exists
  useEffect(() => {
    if (!scheduleLoading && schedule.length > 0) {
      const alreadySeen = typeof window !== 'undefined' ? sessionStorage.getItem('pillsync_patient_popup_seen') : null;
      const hasPending = schedule.some((m) => m.status === 'pending');
      if (!alreadySeen && hasPending) {
        setDosePopupOpen(true);
      }
    }
  }, [scheduleLoading, schedule]);

  const handleModalTaken = useCallback(async () => {
    if (!nextDueMed) return;
    if (typeof window !== 'undefined') sessionStorage.setItem('pillsync_patient_popup_seen', '1');
    await handleTaken(nextDueMed.id);
    setDosePopupOpen(false);
  }, [nextDueMed, handleTaken]);

  const handleModalSnooze = useCallback(async () => {
    if (!nextDueMed) return;
    if (typeof window !== 'undefined') sessionStorage.setItem('pillsync_patient_popup_seen', '1');
    await handleSnooze(nextDueMed.id);
    setDosePopupOpen(false);
  }, [nextDueMed, handleSnooze]);

  const handleModalDismiss = useCallback(() => {
    if (typeof window !== 'undefined') sessionStorage.setItem('pillsync_patient_popup_seen', '1');
    setDosePopupOpen(false);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
        {/* ── Top Actions Bar (Mobile Notch & Hamburger Aware) ────────────────────────── */}
        <div className="border-b border-outline-variant/30 bg-surface-container-lowest/80 backdrop-blur-md px-4 sm:px-gutter py-2.5 sm:py-3 pl-16 lg:pl-gutter transition-all">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="patient" size="sm">Patient Portal</Badge>
              {pendingCount > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/10 border border-secondary/20 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-secondary animate-pulse-slow" />
                  <span className="text-[11px] text-secondary font-semibold">
                    {pendingCount} doses pending today
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none w-full md:w-auto shrink-0">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsExportModalOpen(true)}
                leftIcon={<Download className="w-3.5 h-3.5" />}
                className="bg-[#164234] hover:bg-[#0f2e24] text-white font-semibold min-h-[38px] shrink-0"
              >
                Export Hub
              </Button>
              <Button
                variant="outlined"
                size="sm"
                onClick={() => exportAPI.medicinesPDF()}
                leftIcon={<Download className="w-3.5 h-3.5" />}
                className="min-h-[38px] shrink-0"
              >
                PDF <span className="hidden sm:inline">Report</span>
              </Button>
              <Button
                variant="outlined"
                size="sm"
                onClick={() => exportAPI.allCSV()}
                leftIcon={<Download className="w-3.5 h-3.5" />}
                className="min-h-[38px] shrink-0"
              >
                CSV
              </Button>
              <Button
                variant="outlined"
                size="sm"
                onClick={() => setIsSupportModalOpen(true)}
                leftIcon={<HelpCircle className="w-3.5 h-3.5 text-primary" />}
                className="min-h-[38px] shrink-0 font-medium"
              >
                {locale === "hi" ? "सहायता केंद्र" : "Need Help?"}
              </Button>
              <Button
                variant="outlined"
                size="sm"
                onClick={toggleLocale}
                leftIcon={<Globe className="w-3.5 h-3.5" />}
                title={t("switch_lang")}
                className="min-h-[38px] shrink-0"
              >
                {locale === "hi" ? "हिन्दी (HI)" : "English (EN)"}
              </Button>
              <div className="shrink-0">
                <LogoutButton variant="icon" />
              </div>
            </div>
          </div>
        </div>

      <main className="max-w-7xl mx-auto px-gutter py-lg">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-lg items-start">

          {/* ── Left Column ───────────────────────────────────────────── */}
          <div className="space-y-lg min-w-0">

            {/* Push Notification Prompt (first login only) */}
            <PushNotificationPrompt />

            {/* 1. Welcome Banner ────────────────────────────────────── */}
            <section className="relative bg-[#d8eedf] dark:bg-[#132a22] rounded-2xl p-card-padding overflow-hidden border border-[#bfe3cd] dark:border-[#1e4537] shadow-sm">
              {/* Decorative subtle medical blobs */}
              <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-emerald-400/15 dark:bg-emerald-800/10 blur-xl pointer-events-none" aria-hidden="true" />
              <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full bg-teal-500/10 dark:bg-teal-900/15 blur-xl pointer-events-none" aria-hidden="true" />

              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-lg">
                {/* Greeting */}
                <div>
                  <p className="text-xs sm:text-sm font-extrabold text-[#164234] dark:text-[#a0e5be] tracking-wider uppercase">
                    PILLSYNC CARE SPACE
                  </p>
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-heading text-[#11382d] dark:text-white mt-1 tracking-tight">
                    {getGreeting()}, {displayName}.
                  </h1>
                  <div className="flex items-center gap-2.5 mt-2 text-base sm:text-lg text-[#164234] dark:text-[#c5e6d0] flex-wrap font-medium">
                    <span className="font-bold text-[#11382d] dark:text-white">A calm view of your medicine rhythm today</span>
                    <span className="text-[#a6d8b6] dark:text-[#275949] font-bold">&bull;</span>
                    <span className="flex items-center gap-1.5 font-semibold">
                      <Calendar className="w-4 h-4" />
                      {formatDate()}
                    </span>
                  </div>

                  {/* Quick summary pills */}
                  <div className="flex flex-wrap gap-xs mt-md">
                    <div className="flex items-center gap-1.5 px-sm py-1 rounded-full bg-[#c5e6d0] dark:bg-[#1b3d32] border border-[#a6d8b6] dark:border-[#275949] text-[#164234] dark:text-[#a0e5be]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span className="text-label-caps font-semibold">
                        {schedule.filter((m) => m.status === 'taken').length} taken today
                      </span>
                    </div>
                    {pendingCount > 0 && (
                      <div className="flex items-center gap-1.5 px-sm py-1 rounded-full bg-[#c5e6d0] dark:bg-[#1b3d32] border border-[#a6d8b6] dark:border-[#275949] text-[#164234] dark:text-[#a0e5be]">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="text-label-caps font-semibold">
                          {pendingCount} remaining
                        </span>
                      </div>
                    )}
                    {lowStockCount > 0 && (
                      <div className="flex items-center gap-1.5 px-sm py-1 rounded-full bg-amber-500/20 dark:bg-amber-900/30 border border-amber-500/30 text-amber-900 dark:text-amber-200">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span className="text-label-caps font-semibold">
                          {lowStockCount} low stock
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 px-sm py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200">
                      <Flame className="w-3.5 h-3.5 text-amber-600" />
                      <span className="text-label-caps font-bold">
                        7-Day Streak 🔥
                      </span>
                    </div>
                  </div>
                </div>

                {/* Compliance Ring */}
                <div className="flex flex-col items-center gap-xs shrink-0">
                  <AdherenceRing
                    percentage={compliance}
                    size={110}
                    strokeWidth={10}
                    label="Today"
                    sublabel={`${schedule.filter((m) => m.status === 'taken').length}/${schedule.length} doses`}
                    showLabel
                    showPercentage
                    theme={compliance >= 80 ? 'success' : compliance >= 50 ? 'warning' : 'danger'}
                    animated
                    className="[&_text]:!fill-[#11382d] dark:[&_text]:!fill-white [&_p]:!text-[#285445] dark:[&_p]:!text-[#c2e4d2]"
                  />
                  <div className="flex items-center gap-1 text-[#285445] dark:text-[#c2e4d2]">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span className="text-label-caps">Daily Compliance</span>
                  </div>
                </div>
              </div>
            </section>

            {/* 2. Medication Timeline ───────────────────────────────── */}
            <section>
              <div className="flex items-center justify-between mb-md">
                <h2 className="text-body-sm font-bold text-on-surface">
                  Today&apos;s Medications
                </h2>
                <Link href="/medicines">
                  <Button variant="ghost" size="sm" rightIcon={<ChevronRight className="w-4 h-4" />}>
                    View All
                  </Button>
                </Link>
              </div>

              <div className="space-y-lg">
                {Object.entries(grouped).map(([slot, meds]) => (
                  <SlotSection
                    key={slot}
                    slotKey={slot}
                    meds={meds}
                    onTaken={handleTaken}
                    onSnooze={handleSnooze}
                    onSkip={handleSkip}
                  />
                ))}
              </div>

              {/* Zero-State Empathetic Hero Card when no medications active */}
              {schedule.length === 0 && !scheduleLoading && (
                <div className="mt-md p-6 sm:p-10 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 text-center shadow-sm space-y-4">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-inner">
                    <Pill className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
                  </div>
                  <div className="max-w-md mx-auto space-y-1.5">
                    <h3 className="text-body-lg sm:text-headline-sm font-bold text-on-surface">
                      {locale === 'hi' ? 'कोई सक्रिय दवा शेड्यूल नहीं मिला' : 'No Active Medication Schedules Yet'}
                    </h3>
                    <p className="text-caption sm:text-body-sm text-on-surface-variant">
                      {locale === 'hi'
                        ? 'अपनी डॉक्टर की पर्ची स्कैन करें या मैन्युअल रूप से दवा जोड़कर अपनी दैनिक समय-सारणी शुरू करें।'
                        : 'Upload your clinical prescription scan or add medications manually to generate your daily adherence timeline.'}
                    </p>
                  </div>
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                    <Link href="/scan" className="w-full sm:w-auto">
                      <Button variant="primary" size="md" leftIcon={<Camera className="w-4 h-4" />} className="w-full sm:w-auto min-h-[44px]">
                        {locale === 'hi' ? 'पर्ची स्कैन करें (AI)' : 'Scan Prescription (AI)'}
                      </Button>
                    </Link>
                    <Link href="/medicines" className="w-full sm:w-auto">
                      <Button variant="outline" size="md" leftIcon={<PlusCircle className="w-4 h-4" />} className="w-full sm:w-auto min-h-[44px]">
                        {locale === 'hi' ? 'दवा जोड़ें' : 'Add Medication'}
                      </Button>
                    </Link>
                  </div>
                </div>
              )}

              {/* All done state */}
              {pendingCount === 0 && schedule.length > 0 && (
                <div className="mt-lg text-center py-xl bg-tertiary/5 rounded-lg border border-tertiary/20">
                  <CheckCircle2 className="w-10 h-10 text-tertiary mx-auto mb-sm" />
                  <p className="text-body-sm font-bold text-tertiary">All doses accounted for!</p>
                  <p className="text-caption text-on-surface-variant mt-1">
                    Great job staying on track today.
                  </p>
                </div>
              )}
            </section>
          </div>

          {/* ── Right Column ──────────────────────────────────────────── */}
          <div className="space-y-md xl:sticky xl:top-24">

            {/* Live Reminder / Alarm Widget */}
            <ReminderWidget />

            {/* 3. Inventory & Refill Widget ─────────────────────────── */}
            <InventoryWidget items={inventory} />

            {/* Weekly Adherence Mini-chart ──────────────────────────── */}
            <Card variant="flat" padding="md">
              <Card.Header
                title="Weekly Trend"
                icon={<TrendingUp className="w-5 h-5 text-tertiary" />}
              />
              <div className="mt-md flex items-end justify-between gap-1 h-20">
                {weeklyTrends.map((t, i) => {
                  const h = t.percentage;
                  const isToday = t.isToday;
                  const isBlank = t.isBeforeAccount || false;
                  return (
                    <div key={i} className="flex flex-col items-center gap-1 flex-1">
                      <div className="w-full relative flex flex-col items-center justify-end" style={{ height: 64 }}>
                        <div
                          className={[
                            'w-full rounded-sm transition-all duration-500',
                            isBlank
                              ? 'bg-surface-container/30'  // pre-account: near-invisible
                              : isToday
                              ? 'bg-primary'
                              : h >= 80
                              ? 'bg-tertiary/60'
                              : h >= 50
                              ? 'bg-secondary/60'
                              : h > 0
                              ? 'bg-error/50'
                              : 'bg-surface-container',  // zero-data: neutral gray stub
                          ].join(' ')}
                          style={{ height: isBlank ? '3px' : `${Math.max(h > 0 ? 8 : 4, (h / 100) * 64)}px` }}
                          title={isBlank ? 'Before account' : `${t.dayName}: ${h}%`}
                        />
                      </div>
                      <span className={`text-[10px] font-semibold ${isToday ? 'text-primary' : 'text-on-surface-variant'}`}>
                        {t.dayLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="text-label-caps text-on-surface-variant text-center mt-xs">
                7-day medication adherence
              </p>
            </Card>

            {/* 4. Quick Scan / Add banner ───────────────────────────── */}
            <div className="rounded-lg border-2 border-dashed border-primary/30 p-md bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-all group">
              <div className="flex items-center gap-md">
                <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                  <Camera className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-caption font-bold text-on-surface">Scan Prescription</p>
                  <p className="text-label-caps text-on-surface-variant mt-0.5">
                    AI OCR auto-fills your schedule
                  </p>
                </div>
              </div>
              <div className="mt-sm flex gap-xs">
                <Link href="/scan" className="flex-1">
                  <Button variant="primary" size="sm" fullWidth leftIcon={<Camera className="w-4 h-4" />}>
                    Scan Now
                  </Button>
                </Link>
                <Link href="/medicines" className="flex-1">
                  <Button variant="outline" size="sm" fullWidth leftIcon={<PlusCircle className="w-4 h-4" />}>
                    Add Manual
                  </Button>
                </Link>
              </div>
            </div>

            {/* Health Tips & Drug Interaction Safeguard */}
            <div className="p-card-padding rounded-xl bg-surface-container-low border border-outline-variant/30 space-y-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HeartPulse className="w-4 h-4 text-tertiary" />
                  <h3 className="text-caption font-bold text-on-surface">Daily Health & Safety Guard</h3>
                </div>
                <Badge variant="taken" size="xs">Verified Safe</Badge>
              </div>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                💧 <strong>Hydration Tip:</strong> Always take oral medication with at least 200ml of clean water to ensure optimal gastric dissolution.
              </p>
              <div className="p-2 rounded-lg bg-surface-container border border-outline-variant/20 flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                <p className="text-[10px] text-on-surface-variant">
                  Zero severe drug interactions detected across your active medications.
                </p>
              </div>
            </div>

            {/* Quick Share & Emergency Connection */}
            <div className="p-card-padding rounded-xl bg-surface-container-low border border-outline-variant/30 space-y-sm">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-primary" />
                <h3 className="text-caption font-bold text-on-surface">Care Circle Sharing</h3>
              </div>
              <p className="text-[11px] text-on-surface-variant">
                Export records for your physician or contact emergency support.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  fullWidth
                  leftIcon={<Download className="w-3.5 h-3.5" />}
                  onClick={() => setIsExportModalOpen(true)}
                  className="bg-[#164234] hover:bg-[#0f2e24] text-white"
                >
                  Export Records
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  title="Call Emergency / Caregiver"
                  onClick={() => window.location.href = 'tel:911'}
                  className="px-2.5 text-error border-error/30 hover:bg-error/10"
                >
                  <PhoneCall className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Patient Care Assistance & Grievance Desk Card */}
            <div className="p-card-padding rounded-xl bg-surface-container-low border border-outline-variant/30 space-y-sm">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-primary" />
                <h3 className="text-caption font-bold text-on-surface">
                  {locale === 'hi' ? 'सहायता एवं समाधान' : 'Care & Grievance Desk'}
                </h3>
              </div>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                {locale === 'hi'
                  ? 'अलार्म न बजने, पर्ची स्कैनिंग या दवाई की खुराक समझने में कोई समस्या हो तो तुरंत सहायता मांगें।'
                  : 'Facing an alarm issue, scanner doubt, or need dosage clarification? Our care team is here 24/7.'}
              </p>
              <Button
                variant="outline"
                size="sm"
                fullWidth
                leftIcon={<HelpCircle className="w-3.5 h-3.5 text-primary" />}
                onClick={() => setIsSupportModalOpen(true)}
                className="font-medium min-h-[38px]"
              >
                {locale === 'hi' ? 'सहायता अनुरोध भेजें' : 'Get Help / Report Issue'}
              </Button>
            </div>
          </div>
        </div>
      </main>

      {/* ── Floating Action Button (mobile) ───────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-30 xl:hidden">
        <Link href="/medicines">
          <button
            className={[
              'w-14 h-14 rounded-full bg-primary text-on-primary shadow-modal',
              'flex items-center justify-center',
              'hover:bg-primary-container hover:shadow-elevated hover:-translate-y-1',
              'active:translate-y-0 active:shadow-sm',
              'transition-all duration-200 focus:outline-none',
              'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
            ].join(' ')}
            aria-label="Add or scan medicine"
          >
            <PlusCircle className="w-6 h-6" />
          </button>
        </Link>
      </div>

      {/* Emergency disclaimer */}
      <footer className="max-w-7xl mx-auto px-gutter pb-lg">
        <div className="p-sm rounded-md bg-error-container/30 border border-error/20 text-center">
          <p className="text-caption text-error font-medium">
            ⚠️ Medical Disclaimer: This app is a scheduling tool only. It does not replace professional
            medical advice. In case of emergency, call{' '}
            <a href="tel:911" className="font-bold underline">911</a> (US) or{' '}
            <a href="tel:108" className="font-bold underline">108</a> (India) immediately.
          </p>
        </div>
      </footer>

      {/* ── Auto-Popup: Scheduled Dose Due Alert (Medical Sage Green) ── */}
      {nextDueMed && (
        <Modal
          isOpen={dosePopupOpen}
          onClose={handleModalDismiss}
          title=""
          size="md"
        >
          <div className="space-y-md text-left">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#c5e6d0] dark:bg-[#1b3d32] border border-[#a6d8b6] dark:border-[#275949] text-[#164234] dark:text-[#a0e5be] text-[11px] font-bold tracking-wider uppercase">
              <Pill className="w-3.5 h-3.5" />
              SCHEDULED DOSE DUE NOW
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#11382d] dark:text-white font-heading">
                Time for your {nextDueMed.name} {nextDueMed.strength}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">
                Scheduled for <strong className="text-slate-800 dark:text-white">{nextDueMed.time}</strong> • {nextDueMed.type || 'Prescribed Regimen'}
              </p>
            </div>

            {/* Instruction Card */}
            <div className="p-4 rounded-2xl bg-[#d8eedf] dark:bg-[#132a22] border border-[#bfe3cd] dark:border-[#1e4537] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#164234] dark:text-[#a0e5be]">Clinical Instruction:</span>
                <Badge variant={nextDueMed.color || 'primary'} size="sm">
                  {nextDueMed.slot}
                </Badge>
              </div>
              <p className="text-xs text-[#285445] dark:text-[#c2e4d2] leading-relaxed">
                {nextDueMed.instructions || 'Take with a glass of plain water after meal.'}
              </p>
            </div>

            <Modal.Footer>
              <Button variant="ghost" size="sm" onClick={handleModalDismiss}>
                Later
              </Button>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Clock className="w-4 h-4" />}
                onClick={handleModalSnooze}
              >
                Snooze 15m
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="bg-[#164234] hover:bg-[#0f2e24] text-white font-semibold"
                leftIcon={<CheckCircle2 className="w-4 h-4" />}
                onClick={handleModalTaken}
              >
                Mark as Taken
              </Button>
            </Modal.Footer>
          </div>
        </Modal>
      )}

      {/* ── Patient Clinical Records Export Center Modal ────────────────── */}
      <ExportDataModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        userRole="patient"
      />

      {/* ── Patient Care Assistance & Grievance Modal ────────────────── */}
      <Modal
        isOpen={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
        title={locale === 'hi' ? 'सहायता केंद्र एवं प्रश्न (Help Desk)' : 'Patient Care Assistance & Support Desk'}
        size="lg"
      >
        <SupportTicketForm
          compact
          onCancel={() => setIsSupportModalOpen(false)}
          onSuccess={() => {
            addToast({
              title: locale === 'hi' ? 'सहायता अनुरोध दर्ज हुआ' : 'Care Request Received',
              description: locale === 'hi' ? 'आपकी समस्या दर्ज हो गई है। हमारी टीम जल्द संपर्क करेगी।' : 'Your request has been logged. Our care team is reviewing it.',
              variant: 'success',
            });
          }}
        />
      </Modal>
      </div>
    </DashboardLayout>
  );
}

// ── Page Export — wraps inner page with ToastProvider ────────────────────────

export default function PatientDashboardPage() {
  return (
    <ToastProvider position="top-center">
      <PatientDashboardInner />
    </ToastProvider>
  );
}
