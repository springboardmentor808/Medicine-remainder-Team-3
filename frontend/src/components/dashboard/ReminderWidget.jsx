'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Bell,
  CheckCircle2,
  Clock,
  XCircle,
  Pill,
  Sunrise,
  Sun,
  Sunset,
  Moon,
  Loader2,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { patientAPI, medicineAPI } from '@/lib/api';

/**
 * ReminderWidget — PillSync
 * Live embeddable reminder card for dashboards.
 * Displays real medication schedule from PostgreSQL with Take/Skip actions.
 */

const TIME_SLOTS = [
  { key: 'morning',   label: 'Morning',   Icon: Sunrise, color: 'text-amber-500' },
  { key: 'afternoon', label: 'Afternoon', Icon: Sun,     color: 'text-sky-500' },
  { key: 'evening',   label: 'Evening',   Icon: Sunset,  color: 'text-purple-500' },
  { key: 'night',     label: 'Night',     Icon: Moon,    color: 'text-slate-500' },
];

export default function ReminderWidget({ maxItems = 5, className = '' }) {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch real schedule from PostgreSQL backend
  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const data = await patientAPI.getTodaySchedule();
      const list = Array.isArray(data) ? data : (data?.schedules || []);

      if (list.length > 0) {
        const slotMap = {
          '08:00': 'morning', '08:00 AM': 'morning',
          '13:00': 'afternoon', '01:00 PM': 'afternoon',
          '14:00': 'afternoon', '02:00 PM': 'afternoon',
          '18:00': 'evening', '06:00 PM': 'evening',
          '20:00': 'night', '08:00 PM': 'night',
          '21:00': 'night', '09:00 PM': 'night',
        };

        const mapped = list.map((s, idx) => ({
          id: s.id || `rw-sched-${idx}`,
          schedule_id: s.id,
          medicine_id: s.medicine_id,
          name: s.medicine_name || s.name || 'Medication',
          strength: s.dosage || s.strength || '',
          slot: s.dose_label?.toLowerCase().includes('morning')
            ? 'morning'
            : s.dose_label?.toLowerCase().includes('afternoon') || s.dose_label?.toLowerCase().includes('noon')
            ? 'afternoon'
            : s.dose_label?.toLowerCase().includes('evening')
            ? 'evening'
            : s.dose_label?.toLowerCase().includes('night')
            ? 'night'
            : slotMap[s.scheduled_time] || (idx % 2 === 0 ? 'morning' : 'night'),
          time: s.scheduled_time || '08:00 AM',
          time24: s.scheduled_time || '08:00',
          status: s.status || 'pending',
        }));
        setSchedule(mapped);
      } else {
        // Fallback to active medicines if no schedules created yet
        const medsRes = await medicineAPI.list();
        const meds = Array.isArray(medsRes) ? medsRes : (medsRes?.items || medsRes?.data || []);
        if (meds.length > 0) {
          const slots = ['morning', 'afternoon', 'night'];
          const times = ['08:00 AM', '01:00 PM', '08:00 PM'];
          const times24 = ['08:00', '13:00', '20:00'];
          const mapped = meds.map((m, idx) => ({
            id: m.id || `rw-med-${idx}`,
            medicine_id: m.id,
            name: m.name,
            strength: m.dosage || '',
            slot: slots[idx % 3],
            time: times[idx % 3],
            time24: times24[idx % 3],
            status: 'pending',
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
    fetchSchedule();
  }, [fetchSchedule]);

  const stats = useMemo(() => {
    const total = schedule.length;
    const taken = schedule.filter((r) => r.status === 'taken').length;
    const pending = schedule.filter((r) => r.status === 'pending' || r.status === 'snoozed').length;
    const progress = total > 0 ? Math.round((taken / total) * 100) : 0;
    return { total, taken, pending, progress };
  }, [schedule]);

  const upcomingItems = useMemo(() => {
    return schedule
      .filter((r) => r.status === 'pending' || r.status === 'snoozed')
      .slice(0, maxItems);
  }, [schedule, maxItems]);

  const handleTake = useCallback(async (item) => {
    const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    setSchedule((prev) =>
      prev.map((r) => (r.id === item.id ? { ...r, status: 'taken', takenAt: now } : r))
    );

    try {
      const today = new Date().toISOString().split('T')[0];
      await patientAPI.recordAction({
        schedule_id: item.schedule_id,
        medicine_id: item.medicine_id,
        scheduled_date: today,
        scheduled_time: item.time24 || '08:00',
        action: 'TAKEN',
      });
    } catch (err) {
      console.warn('Record action failed:', err.message);
    }
  }, []);

  const handleSkip = useCallback(async (item) => {
    setSchedule((prev) =>
      prev.map((r) => (r.id === item.id ? { ...r, status: 'skipped' } : r))
    );

    try {
      const today = new Date().toISOString().split('T')[0];
      await patientAPI.recordAction({
        schedule_id: item.schedule_id,
        medicine_id: item.medicine_id,
        scheduled_date: today,
        scheduled_time: item.time24 || '08:00',
        action: 'MISSED',
      });
    } catch (err) {
      console.warn('Record action failed:', err.message);
    }
  }, []);

  return (
    <Card className={className}>
      <div className="p-card-padding">
        {/* Header */}
        <div className="flex items-center justify-between mb-md">
          <div className="flex items-center gap-sm">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-body-sm font-semibold text-on-surface">Today&apos;s Reminders</h3>
              <p className="text-caption text-on-surface-variant">
                {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={stats.progress >= 80 ? 'taken' : stats.progress >= 40 ? 'snoozed' : 'missed'}>
              {stats.progress}%
            </Badge>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden mb-md">
          <div
            className="h-full bg-gradient-to-r from-primary to-tertiary rounded-full transition-all duration-700"
            style={{ width: `${stats.progress}%` }}
          />
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-lg text-caption text-on-surface-variant mb-md">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-tertiary" />
            {stats.taken} Done
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-secondary" />
            {stats.pending} Pending
          </span>
          <span className="ml-auto text-xs">{stats.taken}/{stats.total}</span>
        </div>

        {/* Upcoming Items */}
        {loading ? (
          <div className="flex items-center justify-center py-6 text-on-surface-variant gap-2 text-caption">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            Loading reminders...
          </div>
        ) : upcomingItems.length > 0 ? (
          <div className="space-y-2">
            {upcomingItems.map((item) => {
              const slotInfo = TIME_SLOTS.find((s) => s.key === item.slot) || TIME_SLOTS[0];
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-surface border border-outline-variant/30 hover:bg-surface-container-low transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/8 flex items-center justify-center flex-shrink-0">
                    <Pill className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-caption font-semibold text-on-surface truncate">
                      {item.name} <span className="font-normal text-on-surface-variant">{item.strength}</span>
                    </p>
                    <p className="text-[11px] text-on-surface-variant flex items-center gap-1">
                      <slotInfo.Icon className={`w-3 h-3 ${slotInfo.color}`} />
                      {item.time}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleTake(item)}
                      className="p-1.5 rounded-md bg-tertiary/10 text-tertiary hover:bg-tertiary/20 transition-colors"
                      title="Mark as Taken"
                      aria-label={`Mark ${item.name} as taken`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleSkip(item)}
                      className="p-1.5 rounded-md text-on-surface-variant hover:bg-error/10 hover:text-error transition-colors"
                      title="Skip Dose"
                      aria-label={`Skip ${item.name} dose`}
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6">
            <CheckCircle2 className="w-8 h-8 text-tertiary mx-auto mb-2" />
            <p className="text-caption font-semibold text-on-surface">All done for today!</p>
            <p className="text-[11px] text-on-surface-variant">You&apos;ve completed all scheduled doses.</p>
          </div>
        )}
      </div>
    </Card>
  );
}
