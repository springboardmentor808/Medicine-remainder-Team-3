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
import { exportAPI, medicineAPI } from '@/lib/api';
import { ToastProvider, useToast } from '@/components/ui/Toast';

// ── Constants ────────────────────────────────────────────────────────────────

const SNOOZE_MINUTES = 15;

// ── Mock Data (replace with API: GET /patient/schedule/today) ────────────────

const INITIAL_SCHEDULE = [
  {
    id: 'm-001',
    name: 'Metformin',
    strength: '500mg',
    type: 'Diabetes',
    instructions: 'Take with food',
    slot: 'morning',
    time: '08:00 AM',
    status: 'pending', // 'pending' | 'taken' | 'snoozed' | 'skipped'
    snoozedUntil: null,
    color: 'primary',
  },
  {
    id: 'm-002',
    name: 'Amlodipine',
    strength: '5mg',
    type: 'Blood Pressure',
    instructions: 'Take at the same time each day',
    slot: 'morning',
    time: '08:00 AM',
    status: 'taken',
    snoozedUntil: null,
    color: 'tertiary',
  },
  {
    id: 'm-003',
    name: 'Atorvastatin',
    strength: '20mg',
    type: 'Cholesterol',
    instructions: 'Can be taken with or without food',
    slot: 'afternoon',
    time: '01:00 PM',
    status: 'pending',
    snoozedUntil: null,
    color: 'secondary',
  },
  {
    id: 'm-004',
    name: 'Omeprazole',
    strength: '20mg',
    type: 'Acid Reflux',
    instructions: 'Take 30 minutes before meal',
    slot: 'afternoon',
    time: '01:00 PM',
    status: 'skipped',
    snoozedUntil: null,
    color: 'primary',
  },
  {
    id: 'm-005',
    name: 'Aspirin',
    strength: '75mg',
    type: 'Heart Health',
    instructions: 'Take after food',
    slot: 'evening',
    time: '08:00 PM',
    status: 'pending',
    snoozedUntil: null,
    color: 'tertiary',
  },
  {
    id: 'm-006',
    name: 'Vitamin D3',
    strength: '1000 IU',
    type: 'Supplement',
    instructions: 'Take with a fatty meal for best absorption',
    slot: 'evening',
    time: '08:00 PM',
    status: 'pending',
    snoozedUntil: null,
    color: 'secondary',
  },
];

const INVENTORY = [
  { id: 'i-001', name: 'Metformin 500mg',  totalDays: 30, remainingDays: 2,  pillsLeft: 4  },
  { id: 'i-002', name: 'Amlodipine 5mg',   totalDays: 30, remainingDays: 12, pillsLeft: 24 },
  { id: 'i-003', name: 'Atorvastatin 20mg',totalDays: 30, remainingDays: 1,  pillsLeft: 2  },
  { id: 'i-004', name: 'Omeprazole 20mg',  totalDays: 30, remainingDays: 18, pillsLeft: 36 },
  { id: 'i-005', name: 'Aspirin 75mg',     totalDays: 60, remainingDays: 29, pillsLeft: 58 },
  { id: 'i-006', name: 'Vitamin D3 1000IU',totalDays: 90, remainingDays: 3,  pillsLeft: 9  },
];

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
  const [schedule, setSchedule] = useState(INITIAL_SCHEDULE);
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

  // Fetch dynamic medicine schedule from backend
  useEffect(() => {
    (async () => {
      try {
        const res = await medicineAPI.list();
        if (res?.data && Array.isArray(res.data) && res.data.length > 0) {
          const slotCycle = ['morning', 'afternoon', 'evening'];
          const colorCycle = ['primary', 'tertiary', 'secondary'];
          const mapped = res.data.map((med, idx) => ({
            id: med.id || `dyn-${idx}`,
            name: med.name || med.medicine_name || 'Unknown',
            strength: med.dosage || med.strength || '',
            type: med.form || med.category || 'Medication',
            instructions: med.instructions || med.notes || '',
            slot: slotCycle[idx % 3],
            time: ['08:00 AM', '01:00 PM', '08:00 PM'][idx % 3],
            status: 'pending',
            snoozedUntil: null,
            color: colorCycle[idx % 3],
          }));
          setSchedule(mapped);
        }
      } catch {
        // Keep INITIAL_SCHEDULE as fallback
      }
    })();
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
    () => INVENTORY.filter((i) => i.remainingDays <= 3).length,
    []
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

  const handleTaken = useCallback((id, undo = false) => {
    setSchedule((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, status: undo ? 'pending' : 'taken', snoozedUntil: null }
          : m
      )
    );
    if (!undo) {
      const med = schedule.find((m) => m.id === id);
      addToast({
        title: '✅ Dose Recorded',
        description: `${med?.name} ${med?.strength} marked as taken.`,
        variant: 'success',
        duration: 3500,
      });
    }
  }, [schedule, addToast]);

  const handleSnooze = useCallback((id) => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + SNOOZE_MINUTES);
    const snoozedUntil = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    setSchedule((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: 'snoozed', snoozedUntil } : m))
    );

    const med = schedule.find((m) => m.id === id);
    addToast({
      title: '⏰ Snoozed',
      description: `Reminder for ${med?.name} set for ${snoozedUntil}.`,
      variant: 'info',
      duration: 3000,
    });
  }, [schedule, addToast]);

  const handleSkip = useCallback((id, undo = false) => {
    setSchedule((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, status: undo ? 'pending' : 'skipped', snoozedUntil: null }
          : m
      )
    );
    if (!undo) {
      const med = schedule.find((m) => m.id === id);
      addToast({
        title: 'Dose Skipped',
        description: `${med?.name} skipped for this session.`,
        variant: 'warning',
        duration: 3000,
        action: {
          label: 'Undo',
          // Inline undo — avoids circular self-reference in useCallback deps
          onClick: () =>
            setSchedule((prev) =>
              prev.map((m) =>
                m.id === id ? { ...m, status: 'pending', snoozedUntil: null } : m
              )
            ),
        },
      });
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
                  Today's Medications
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
            <InventoryWidget items={INVENTORY} />

            {/* Weekly Adherence Mini-chart ──────────────────────────── */}
            <Card variant="flat" padding="md">
              <Card.Header
                title="Weekly Trend"
                icon={<TrendingUp className="w-5 h-5 text-tertiary" />}
              />
              <div className="mt-md flex items-end justify-between gap-1 h-20">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => {
                  const heights = [90, 75, 100, 60, 85, 95, compliance];
                  const h  = heights[i];
                  const isToday = i === 6;
                  return (
                    <div key={i} className="flex flex-col items-center gap-1 flex-1">
                      <div className="w-full relative flex flex-col items-center justify-end" style={{ height: 64 }}>
                        <div
                          className={[
                            'w-full rounded-sm transition-all duration-500',
                            isToday ? 'bg-primary' : h >= 80 ? 'bg-tertiary/60' : h >= 60 ? 'bg-secondary/60' : 'bg-error/50',
                          ].join(' ')}
                          style={{ height: `${(h / 100) * 64}px` }}
                          title={`${h}%`}
                        />
                      </div>
                      <span className={`text-[10px] font-semibold ${isToday ? 'text-primary' : 'text-on-surface-variant'}`}>
                        {day}
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
                <Link href="/medicines?scan=1" className="flex-1">
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
