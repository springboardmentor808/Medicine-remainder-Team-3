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
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import AdherenceRing from '@/components/ui/AdherenceRing';
import LogoutButton from '@/components/ui/LogoutButton';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ReminderWidget from '@/components/dashboard/ReminderWidget';
import PushNotificationPrompt from '@/components/patient/PushNotificationPrompt';
import { exportAPI, medicineAPI, patientAPI, analyticsAPI } from '@/lib/api';
import { ToastProvider, useToast } from '@/components/ui/Toast';

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
              className="!h-8"
            >
              Taken
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Clock className="w-3.5 h-3.5" />}
              onClick={() => onSnooze(med.id)}
              className="!h-8"
            >
              Snooze {SNOOZE_MINUTES}m
            </Button>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<XCircle className="w-3.5 h-3.5" />}
              onClick={() => onSkip(med.id)}
              className="!h-8 !text-error hover:!bg-error/8"
            >
              Skip
            </Button>
          </div>
        )}

        {/* Undo for taken/skipped */}
        {isDone && (
          <button
            onClick={() => med.status === 'taken' ? onTaken(med.id, true) : onSkip(med.id, true)}
            className="mt-1 text-label-caps text-on-surface-variant hover:text-primary flex items-center gap-1 transition-colors"
          >
            <RotateCcw className="w-3 h-3" /> Undo
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

  // ── State ──────────────────────────────────────────────────────────────────
  const [schedule, setSchedule] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [weeklyTrends, setWeeklyTrends] = useState([]);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

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
          setSchedule(mapped);
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
            const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const todayIso = new Date().toISOString().split('T')[0];
            const mapped = trends.map((t) => {
              const d = new Date(t.date);
              const dayLabel = daysOfWeek[d.getDay()]?.[0] || 'D';
              return {
                dayLabel,
                dayName: t.day_name || daysOfWeek[d.getDay()],
                percentage: Math.round(t.adherence_rate ?? 100),
                isToday: t.date === todayIso,
              };
            });
            setWeeklyTrends(mapped);
          } else {
            const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
            setWeeklyTrends(days.map((d, i) => ({
              dayLabel: d,
              dayName: d,
              percentage: 100,
              isToday: i === 6,
            })));
          }
        } else {
          const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
          setWeeklyTrends(days.map((d, i) => ({
            dayLabel: d,
            dayName: d,
            percentage: 100,
            isToday: i === 6,
          })));
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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
        {/* ── Top Actions Bar ────────────────────────────────────────── */}
        <div className="border-b border-outline-variant/30 bg-surface-container-lowest/60 backdrop-blur-md px-gutter py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Badge variant="patient" size="sm">Patient Portal</Badge>
              {pendingCount > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/10 border border-secondary/20">
                  <span className="w-2 h-2 rounded-full bg-secondary animate-pulse-slow" />
                  <span className="text-[11px] text-secondary font-semibold">
                    {pendingCount} doses pending today
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outlined"
                size="sm"
                onClick={() => exportAPI.medicinesPDF()}
                leftIcon={<Download className="w-3.5 h-3.5" />}
              >
                PDF Report
              </Button>
              <Button
                variant="outlined"
                size="sm"
                onClick={() => exportAPI.allCSV()}
                leftIcon={<Download className="w-3.5 h-3.5" />}
              >
                Export CSV
              </Button>
              <LogoutButton variant="icon" />
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
            <section className="relative bg-gradient-to-br from-primary via-primary to-primary-container rounded-lg p-card-padding overflow-hidden text-on-primary">
              {/* Decorative blobs */}
              <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-on-primary/5 blur-sm pointer-events-none" aria-hidden="true" />
              <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full bg-on-primary/5 blur-sm pointer-events-none" aria-hidden="true" />

              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-lg">
                {/* Greeting */}
                <div>
                  <p className="text-on-primary/70 text-caption">{getGreeting()}</p>
                  <h1 className="text-headline-sm font-bold mt-0.5">{displayName}</h1>
                  <div className="flex items-center gap-xs mt-1.5 text-on-primary/70">
                    <Calendar className="w-3.5 h-3.5" />
                    <span className="text-caption">{formatDate()}</span>
                  </div>

                  {/* Quick summary pills */}
                  <div className="flex flex-wrap gap-xs mt-md">
                    <div className="flex items-center gap-1.5 px-sm py-1 rounded-full bg-on-primary/15 border border-on-primary/10">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span className="text-label-caps font-semibold">
                        {schedule.filter((m) => m.status === 'taken').length} taken today
                      </span>
                    </div>
                    {pendingCount > 0 && (
                      <div className="flex items-center gap-1.5 px-sm py-1 rounded-full bg-on-primary/15 border border-on-primary/10">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="text-label-caps font-semibold">
                          {pendingCount} remaining
                        </span>
                      </div>
                    )}
                    {lowStockCount > 0 && (
                      <div className="flex items-center gap-1.5 px-sm py-1 rounded-full bg-error/30 border border-error/20">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span className="text-label-caps font-semibold">
                          {lowStockCount} low stock
                        </span>
                      </div>
                    )}
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
                    className="[&_text]:fill-on-primary [&_p]:text-on-primary/80"
                  />
                  <div className="flex items-center gap-1 text-on-primary/70">
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
                  return (
                    <div key={i} className="flex flex-col items-center gap-1 flex-1">
                      <div className="w-full relative flex flex-col items-center justify-end" style={{ height: 64 }}>
                        <div
                          className={[
                            'w-full rounded-sm transition-all duration-500',
                            isToday ? 'bg-primary' : h >= 80 ? 'bg-tertiary/60' : h >= 60 ? 'bg-secondary/60' : 'bg-error/50',
                          ].join(' ')}
                          style={{ height: `${Math.max(8, (h / 100) * 64)}px` }}
                          title={`${t.dayName}: ${h}%`}
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
