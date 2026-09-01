'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import {
  Bell,
  BellOff,
  Clock,
  CheckCircle2,
  XCircle,
  Pause,
  Play,
  Sunrise,
  Sun,
  Sunset,
  Moon,
  Plus,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  Volume2,
  VolumeX,
  Calendar,
  RefreshCw,
  Pill,
  Timer,
  Trash2,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import { playWebAudioAlarm } from '@/lib/alarm_service';
import AddReminderModal from '@/components/patient/AddReminderModal';
import { patientAPI, medicineAPI } from '@/lib/api';

// ── Constants ────────────────────────────────────────────────────────────────

const SNOOZE_OPTIONS = [5, 10, 15, 30];

const TIME_SLOTS = [
  { key: 'morning',   label: 'Morning',   time: '6:00 AM – 12:00 PM', Icon: Sunrise, gradient: 'from-amber-50 to-orange-50',   iconColor: 'text-amber-500',    borderColor: 'border-l-amber-400' },
  { key: 'afternoon', label: 'Afternoon', time: '12:00 PM – 5:00 PM',  Icon: Sun,     gradient: 'from-sky-50 to-blue-50',       iconColor: 'text-sky-500',      borderColor: 'border-l-sky-400' },
  { key: 'evening',   label: 'Evening',   time: '5:00 PM – 9:00 PM',   Icon: Sunset,  gradient: 'from-purple-50 to-indigo-50',  iconColor: 'text-purple-500',   borderColor: 'border-l-purple-400' },
  { key: 'night',     label: 'Night',     time: '9:00 PM – 6:00 AM',   Icon: Moon,    gradient: 'from-slate-100 to-gray-100',   iconColor: 'text-slate-500',    borderColor: 'border-l-slate-400' },
];

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  variant: 'snoozed', Icon: Clock,        textCls: 'text-secondary', bgCls: 'bg-secondary/5' },
  taken:    { label: 'Taken',    variant: 'taken',    Icon: CheckCircle2, textCls: 'text-tertiary',  bgCls: 'bg-tertiary/5' },
  skipped:  { label: 'Skipped',  variant: 'missed',   Icon: XCircle,      textCls: 'text-error',     bgCls: 'bg-error/5' },
  snoozed:  { label: 'Snoozed',  variant: 'snoozed',  Icon: Pause,        textCls: 'text-secondary', bgCls: 'bg-secondary/5' },
  overdue:  { label: 'Overdue',  variant: 'missed',   Icon: AlertTriangle,textCls: 'text-error',     bgCls: 'bg-error/5' },
};

// ── Inner Page Component ─────────────────────────────────────────────────────

function RemindersPageInner() {
  const { addToast } = useToast();
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [alarmEnabled, setAlarmEnabled] = useState(true);
  const [activeSlotFilter, setActiveSlotFilter] = useState('all');

  // Fetch live schedule from API
  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const data = await patientAPI.getTodaySchedule();
      const list = Array.isArray(data) ? data : (data?.schedules || []);
      if (list.length > 0) {
        const slotMap = {
          '08:00': 'morning', '08:00 AM': 'morning',
          '13:00': 'afternoon', '01:00 PM': 'afternoon',
          '18:00': 'evening', '06:00 PM': 'evening',
          '20:00': 'evening', '08:00 PM': 'evening',
          '21:00': 'night', '09:00 PM': 'night',
        };
        const mapped = list.map((s, idx) => ({
          id: s.id || `sched-${idx}`,
          schedule_id: s.id,
          medicine_id: s.medicine_id,
          name: s.medicine_name || s.name || 'Medication',
          strength: s.dosage || s.strength || '',
          type: s.disease_category || s.dose_label || 'Prescription',
          slot: s.dose_label?.toLowerCase().includes('morning')
            ? 'morning'
            : s.dose_label?.toLowerCase().includes('afternoon') || s.dose_label?.toLowerCase().includes('noon')
            ? 'afternoon'
            : s.dose_label?.toLowerCase().includes('evening')
            ? 'evening'
            : s.dose_label?.toLowerCase().includes('night')
            ? 'night'
            : slotMap[s.scheduled_time] || (idx % 2 === 0 ? 'morning' : 'evening'),
          time: s.scheduled_time || '08:00 AM',
          scheduled_time_24: s.scheduled_time || '08:00',
          status: 'pending',
          instructions: s.notes || s.instructions || 'Take with water',
        }));
        setSchedule(mapped);
      } else {
        // If no schedules exist, try listing medicines to populate default reminders
        const medsRes = await medicineAPI.list();
        const meds = Array.isArray(medsRes) ? medsRes : (medsRes?.items || medsRes?.data || []);
        if (meds.length > 0) {
          const slots = ['morning', 'afternoon', 'evening', 'night'];
          const times = ['08:00 AM', '01:00 PM', '06:00 PM', '09:00 PM'];
          const times24 = ['08:00', '13:00', '18:00', '21:00'];
          const mapped = meds.map((m, idx) => ({
            id: m.id || `med-${idx}`,
            medicine_id: m.id,
            name: m.name,
            strength: m.dosage || '',
            type: m.disease_category || 'Medication',
            slot: slots[idx % 4],
            time: times[idx % 4],
            scheduled_time_24: times24[idx % 4],
            status: 'pending',
            instructions: m.notes || 'Take as prescribed',
          }));
          setSchedule(mapped);
        } else {
          setSchedule([]);
        }
      }
    } catch {
      setSchedule([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // Modals
  const [snoozeModal, setSnoozeModal] = useState(null);   // reminder item
  const [skipModal, setSkipModal] = useState(null);        // reminder item
  const [skipReason, setSkipReason] = useState('');
  const [reminderModalOpen, setReminderModalOpen] = useState(false);

  // ── Date Navigation ─────────────────────────────────────────────────
  const dateStr = selectedDate.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const isToday = new Date().toDateString() === selectedDate.toDateString();

  const navigateDate = (delta) => {
    setSelectedDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + delta);
      return d;
    });
  };

  // ── Filter Logic ────────────────────────────────────────────────────
  const filteredSchedule = useMemo(() => {
    if (activeSlotFilter === 'all') return schedule;
    return schedule.filter((r) => r.slot === activeSlotFilter);
  }, [schedule, activeSlotFilter]);

  const groupedBySlot = useMemo(() => {
    const groups = {};
    TIME_SLOTS.forEach((slot) => {
      groups[slot.key] = filteredSchedule.filter((r) => r.slot === slot.key);
    });
    return groups;
  }, [filteredSchedule]);

  // ── Stats ───────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = schedule.length;
    const taken = schedule.filter((r) => r.status === 'taken').length;
    const pending = schedule.filter((r) => r.status === 'pending' || r.status === 'snoozed').length;
    const skipped = schedule.filter((r) => r.status === 'skipped').length;
    const overdue = schedule.filter((r) => r.status === 'overdue').length;
    const progress = total > 0 ? Math.round((taken / total) * 100) : 0;
    return { total, taken, pending, skipped, overdue, progress };
  }, [schedule]);

  // ── Actions ─────────────────────────────────────────────────────────
  const handleTakeDose = useCallback(async (item) => {
    const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    setSchedule((prev) =>
      prev.map((r) => r.id === item.id ? { ...r, status: 'taken', takenAt: now } : r)
    );
    if (alarmEnabled) {
      try { playWebAudioAlarm(); } catch { /* silent fallback */ }
    }
    addToast({
      title: 'Dose Confirmed',
      description: `${item.name} ${item.strength} marked as taken at ${now}`,
      variant: 'success',
    });

    try {
      await patientAPI.recordAction({
        schedule_id: item.schedule_id,
        medicine_id: item.medicine_id,
        scheduled_date: new Date().toISOString().split('T')[0],
        scheduled_time: item.scheduled_time_24 || '08:00',
        action: 'TAKEN',
      });
    } catch (err) {
      console.warn('Record action API error:', err.message);
    }
  }, [alarmEnabled, addToast]);

  const handleSkipDose = useCallback(async () => {
    if (!skipModal) return;
    const itemToSkip = skipModal;
    setSchedule((prev) =>
      prev.map((r) => r.id === itemToSkip.id ? { ...r, status: 'skipped', skipReason: skipReason } : r)
    );
    addToast({
      title: 'Dose Skipped',
      description: `${itemToSkip.name} ${itemToSkip.strength} has been skipped`,
      variant: 'warning',
    });
    setSkipModal(null);
    setSkipReason('');

    try {
      await patientAPI.recordAction({
        schedule_id: itemToSkip.schedule_id,
        medicine_id: itemToSkip.medicine_id,
        scheduled_date: new Date().toISOString().split('T')[0],
        scheduled_time: itemToSkip.scheduled_time_24 || '08:00',
        action: 'MISSED',
      });
    } catch (err) {
      console.warn('Record action API error:', err.message);
    }
  }, [skipModal, skipReason, addToast]);

  const handleSnoozeDose = useCallback(async (minutes) => {
    if (!snoozeModal) return;
    const itemToSnooze = snoozeModal;
    setSchedule((prev) =>
      prev.map((r) => r.id === itemToSnooze.id ? { ...r, status: 'snoozed', snoozedMinutes: minutes } : r)
    );
    addToast({
      title: 'Reminder Snoozed',
      description: `${itemToSnooze.name} snoozed for ${minutes} minutes`,
      variant: 'info',
    });
    setSnoozeModal(null);

    try {
      await patientAPI.recordAction({
        schedule_id: itemToSnooze.schedule_id,
        medicine_id: itemToSnooze.medicine_id,
        scheduled_date: new Date().toISOString().split('T')[0],
        scheduled_time: itemToSnooze.scheduled_time_24 || '08:00',
        action: 'SNOOZE',
        snooze_minutes: minutes,
      });
    } catch (err) {
      console.warn('Record action API error:', err.message);
    }
  }, [snoozeModal, addToast]);

  const handleUndoAction = useCallback((item) => {
    setSchedule((prev) =>
      prev.map((r) => r.id === item.id ? { ...r, status: 'pending', takenAt: undefined, skipReason: undefined, snoozedMinutes: undefined } : r)
    );
    addToast({
      title: 'Action Undone',
      description: `${item.name} set back to pending`,
      variant: 'default',
    });
  }, [addToast]);

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="bg-gradient-primary text-on-primary">
        <div className="max-w-4xl mx-auto px-gutter py-lg">
          {/* Top Nav */}
          <div className="flex items-center justify-between mb-md">
            <Link
              href="/dashboard/patient"
              className="flex items-center gap-xs text-on-primary/80 hover:text-on-primary transition-colors text-body-sm"
            >
              <ChevronLeft className="w-4 h-4" />
              Dashboard
            </Link>
            <div className="flex items-center gap-sm">
              <button
                onClick={() => setAlarmEnabled(!alarmEnabled)}
                className="p-xs rounded-full hover:bg-white/10 transition-colors"
                aria-label={alarmEnabled ? 'Mute alarm' : 'Enable alarm'}
              >
                {alarmEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5 opacity-50" />}
              </button>
              <button
                onClick={() => setReminderModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-body-sm font-semibold text-on-primary border border-on-primary/30 rounded-lg hover:bg-white/10 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Reminder
              </button>
            </div>
          </div>

          {/* Title */}
          <div className="flex items-center gap-sm mb-lg">
            <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-sm">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-headline-sm font-bold">Reminders & Schedule</h1>
              <p className="text-body-sm text-on-primary/70">Your daily medication timeline</p>
            </div>
          </div>

          {/* Date Navigator */}
          <div className="flex items-center justify-between bg-white/10 rounded-lg px-md py-sm backdrop-blur-sm">
            <button
              onClick={() => navigateDate(-1)}
              className="p-xs rounded-full hover:bg-white/10 transition-colors"
              aria-label="Previous day"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
              <p className="text-body-sm font-semibold">{dateStr}</p>
              {isToday && (
                <Badge variant="taken" className="mt-1 text-xs">Today</Badge>
              )}
            </div>
            <button
              onClick={() => navigateDate(1)}
              className="p-xs rounded-full hover:bg-white/10 transition-colors"
              aria-label="Next day"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-gutter py-lg">
        {/* ── Progress Bar ────────────────────────────────────────── */}
        <Card className="mb-lg">
          <div className="p-card-padding">
            <div className="flex items-center justify-between mb-sm">
              <h2 className="text-caption font-semibold text-on-surface uppercase tracking-wider">
                Today's Progress
              </h2>
              <span className="text-headline-sm font-bold text-primary">{stats.progress}%</span>
            </div>
            <div className="w-full h-3 bg-surface-container rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary-container rounded-full transition-all duration-700 ease-out"
                style={{ width: `${stats.progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-sm text-caption text-on-surface-variant">
              <div className="flex items-center gap-lg">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-tertiary" />
                  {stats.taken} Taken
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-secondary" />
                  {stats.pending} Pending
                </span>
                {stats.skipped > 0 && (
                  <span className="flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5 text-error" />
                    {stats.skipped} Skipped
                  </span>
                )}
              </div>
              <span>{stats.taken}/{stats.total} doses</span>
            </div>
          </div>
        </Card>

        {/* ── Slot Filter Chips ───────────────────────────────────── */}
        <div className="flex gap-xs overflow-x-auto pb-sm mb-lg scrollbar-hide">
          <button
            onClick={() => setActiveSlotFilter('all')}
            className={`flex-shrink-0 px-md py-xs rounded-full text-caption font-medium border transition-all duration-200
              ${activeSlotFilter === 'all'
                ? 'bg-primary text-on-primary border-primary shadow-sm'
                : 'bg-surface-container-low text-on-surface-variant border-outline-variant hover:border-primary/50'
              }`}
          >
            All ({schedule.length})
          </button>
          {TIME_SLOTS.map((slot) => {
            const count = schedule.filter((r) => r.slot === slot.key).length;
            return (
              <button
                key={slot.key}
                onClick={() => setActiveSlotFilter(slot.key)}
                className={`flex-shrink-0 flex items-center gap-1 px-md py-xs rounded-full text-caption font-medium border transition-all duration-200
                  ${activeSlotFilter === slot.key
                    ? 'bg-primary text-on-primary border-primary shadow-sm'
                    : 'bg-surface-container-low text-on-surface-variant border-outline-variant hover:border-primary/50'
                  }`}
              >
                <slot.Icon className="w-3.5 h-3.5" />
                {slot.label} ({count})
              </button>
            );
          })}
        </div>

        {/* ── Timeline Slots ──────────────────────────────────────── */}
        <div className="flex flex-col gap-lg">
          {TIME_SLOTS.map((slot) => {
            const items = groupedBySlot[slot.key];
            if (activeSlotFilter !== 'all' && activeSlotFilter !== slot.key) return null;
            if (!items || items.length === 0) return null;

            return (
              <section key={slot.key}>
                {/* Slot Header */}
                <div className="flex items-center gap-sm mb-sm">
                  <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${slot.gradient} flex items-center justify-center`}>
                    <slot.Icon className={`w-5 h-5 ${slot.iconColor}`} />
                  </div>
                  <div>
                    <h3 className="text-body-sm font-semibold text-on-surface">{slot.label}</h3>
                    <p className="text-xs text-on-surface-variant">{slot.time}</p>
                  </div>
                  <Badge variant={items.every((i) => i.status === 'taken') ? 'taken' : 'snoozed'} className="ml-auto">
                    {items.filter((i) => i.status === 'taken').length}/{items.length}
                  </Badge>
                </div>

                {/* Reminder Cards */}
                <div className="flex flex-col gap-sm ml-4 pl-md border-l-2 border-outline-variant">
                  {items.map((item) => {
                    const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
                    const StatusIcon = statusCfg.Icon;
                    const isDone = item.status === 'taken' || item.status === 'skipped';

                    return (
                      <Card
                        key={item.id}
                        className={`transition-all duration-300 ${isDone ? 'opacity-70' : ''} ${slot.borderColor} border-l-4`}
                      >
                        <div className="p-md">
                          <div className="flex items-start justify-between gap-sm">
                            {/* Left: Medication Info */}
                            <div className="flex items-start gap-sm flex-1 min-w-0">
                              <div className={`w-10 h-10 rounded-lg ${statusCfg.bgCls} flex items-center justify-center flex-shrink-0`}>
                                <Pill className={`w-5 h-5 ${statusCfg.textCls}`} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-xs flex-wrap">
                                  <h4 className={`text-body-sm font-semibold ${isDone ? 'line-through text-on-surface-variant' : 'text-on-surface'}`}>
                                    {item.name}
                                  </h4>
                                  <span className="text-caption text-on-surface-variant">{item.strength}</span>
                                  <Badge variant={statusCfg.variant} className="text-xs">
                                    <StatusIcon className="w-3 h-3" />
                                    {statusCfg.label}
                                  </Badge>
                                </div>
                                <p className="text-xs text-on-surface-variant mt-0.5">
                                  <Clock className="w-3 h-3 inline mr-1" />
                                  {item.time}
                                  {item.takenAt && ` • Taken at ${item.takenAt}`}
                                  {item.snoozedMinutes && ` • Snoozed ${item.snoozedMinutes}min`}
                                </p>
                                {item.instructions && (
                                  <p className="text-xs text-on-surface-variant mt-0.5 italic">
                                    {item.instructions}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Right: Actions */}
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {!isDone ? (
                                <>
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => handleTakeDose(item)}
                                    className="text-xs"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Take
                                  </Button>
                                  <button
                                    onClick={() => setSnoozeModal(item)}
                                    className="p-xs rounded-md hover:bg-secondary/10 text-secondary transition-colors"
                                    aria-label="Snooze"
                                    title="Snooze"
                                  >
                                    <Timer className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => setSkipModal(item)}
                                    className="p-xs rounded-md hover:bg-error/10 text-error transition-colors"
                                    aria-label="Skip"
                                    title="Skip"
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleUndoAction(item)}
                                  className="p-xs rounded-md hover:bg-surface-container text-on-surface-variant transition-colors text-xs flex items-center gap-1"
                                  title="Undo"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                  Undo
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {/* Empty state */}
          {filteredSchedule.length === 0 && (
            <EmptyState
              icon="notifications_off"
              title="No Reminders Scheduled"
              description={
                activeSlotFilter !== 'all'
                  ? `No reminders scheduled for ${TIME_SLOTS.find((s) => s.key === activeSlotFilter)?.label || 'this time slot'}.`
                  : 'No medications scheduled for this day. Add medicines to start receiving automated dose reminders.'
              }
              actionLabel="Add Medicine"
              actionHref="/medicines"
              className="my-8"
            />
          )}
        </div>

        {/* ── Quick Stats Footer ──────────────────────────────────── */}
        {schedule.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-sm mt-xl">
            {[
              { label: 'Total Doses',  value: stats.total,   icon: Pill,          color: 'text-primary' },
              { label: 'Completed',    value: stats.taken,   icon: CheckCircle2,  color: 'text-tertiary' },
              { label: 'Pending',      value: stats.pending, icon: Clock,         color: 'text-secondary' },
              { label: 'Skipped',      value: stats.skipped, icon: XCircle,       color: 'text-error' },
            ].map(({ label, value, icon: StatIcon, color }) => (
              <Card key={label} className="text-center">
                <div className="p-md">
                  <StatIcon className={`w-5 h-5 ${color} mx-auto mb-xs`} />
                  <p className="text-headline-sm font-bold text-on-surface">{value}</p>
                  <p className="text-xs text-on-surface-variant">{label}</p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* ── Snooze Modal ──────────────────────────────────────────── */}
      {snoozeModal && (
        <Modal
          open={!!snoozeModal}
          onClose={() => setSnoozeModal(null)}
          title="Snooze Reminder"
        >
          <div className="p-md">
            <p className="text-body-sm text-on-surface-variant mb-lg">
              Snooze <strong>{snoozeModal.name} {snoozeModal.strength}</strong> for:
            </p>
            <div className="grid grid-cols-2 gap-sm">
              {SNOOZE_OPTIONS.map((mins) => (
                <Button
                  key={mins}
                  variant="secondary"
                  onClick={() => handleSnoozeDose(mins)}
                  className="justify-center"
                >
                  <Timer className="w-4 h-4" />
                  {mins} minutes
                </Button>
              ))}
            </div>
            <div className="mt-md pt-md border-t border-outline-variant">
              <Button variant="ghost" onClick={() => setSnoozeModal(null)} className="w-full justify-center">
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Skip Modal ────────────────────────────────────────────── */}
      {skipModal && (
        <Modal
          open={!!skipModal}
          onClose={() => { setSkipModal(null); setSkipReason(''); }}
          title="Skip Dose"
        >
          <div className="p-md">
            <p className="text-body-sm text-on-surface-variant mb-md">
              Why are you skipping <strong>{skipModal.name} {skipModal.strength}</strong>?
            </p>
            <textarea
              value={skipReason}
              onChange={(e) => setSkipReason(e.target.value)}
              placeholder="Reason for skipping (optional)..."
              rows={3}
              className="w-full px-md py-sm rounded-md border border-outline-variant bg-surface-container-lowest text-on-surface text-body-sm
                         placeholder:text-on-surface-variant/50 resize-none
                         focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
            />
            <div className="flex gap-sm mt-md">
              <Button variant="ghost" onClick={() => { setSkipModal(null); setSkipReason(''); }} className="flex-1 justify-center">
                Cancel
              </Button>
              <Button variant="danger" onClick={handleSkipDose} className="flex-1 justify-center">
                <XCircle className="w-4 h-4" />
                Skip Dose
              </Button>
            </div>
          </div>
        </Modal>
      )}
      {/* ── Add Reminder Modal ─────────────────────────────────── */}
      <AddReminderModal
        isOpen={reminderModalOpen}
        onClose={() => setReminderModalOpen(false)}
        onAdd={(data) => {
          const newReminder = {
            id: `r-new-${Date.now()}`,
            name: data.medicine,
            strength: data.dosage,
            type: 'Medication',
            slot: data.slot,
            time: new Date(`2000-01-01T${data.time}`).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            status: 'pending',
            instructions: data.notes || '',
          };
          setSchedule((prev) => [...prev, newReminder]);
          addToast({
            title: 'Reminder Added',
            description: `${data.medicine} ${data.dosage} reminder set for ${data.slot}`,
            variant: 'success',
          });
        }}
      />
      </div>
    </DashboardLayout>
  );
}

// ── Main Export (with Toast Provider) ─────────────────────────────────────────

export default function RemindersPage() {
  return (
    <ToastProvider position="top-center">
      <RemindersPageInner />
    </ToastProvider>
  );
}
