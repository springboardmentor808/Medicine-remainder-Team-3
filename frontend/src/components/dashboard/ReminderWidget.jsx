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
  ZapOff,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { patientAPI, medicineAPI } from '@/lib/api';

/**
 * ReminderWidget — PillSync
 * Read-only compact view of today's medication schedule.
 * Displays persisted status from PostgreSQL daily-tracking — NO action buttons.
 * Use the main timeline dose cards for Taken / Snooze / Skip actions.
 */

const TIME_SLOTS = [
  { key: 'morning',   label: 'Morning',   Icon: Sunrise, color: 'text-amber-500' },
  { key: 'afternoon', label: 'Afternoon', Icon: Sun,     color: 'text-sky-500' },
  { key: 'evening',   label: 'Evening',   Icon: Sunset,  color: 'text-purple-500' },
  { key: 'night',     label: 'Night',     Icon: Moon,    color: 'text-slate-500' },
];

/** Map a DB status string to a compact badge. */
function StatusBadge({ status }) {
  if (status === 'taken') {
    return (
      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-tertiary/15 text-tertiary border border-tertiary/25 shrink-0">
        <CheckCircle2 className="w-2.5 h-2.5" />
        Taken
      </span>
    );
  }
  if (status === 'skipped' || status === 'missed') {
    return (
      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-error/10 text-error border border-error/25 shrink-0">
        <XCircle className="w-2.5 h-2.5" />
        Missed
      </span>
    );
  }
  if (status === 'snoozed') {
    return (
      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary/15 text-secondary border border-secondary/25 shrink-0">
        <Clock className="w-2.5 h-2.5" />
        Snoozed
      </span>
    );
  }
  // pending
  return (
    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 shrink-0">
      <Clock className="w-2.5 h-2.5" />
      Pending
    </span>
  );
}

export default function ReminderWidget({ maxItems = 6, className = '' }) {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch schedule AND daily-tracking to show persisted statuses
  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const data = await patientAPI.getTodaySchedule();
      const list = Array.isArray(data) ? data : (data?.schedules || []);

      let mapped = [];

      if (list.length > 0) {
        const slotMap = {
          '08:00': 'morning', '08:00 AM': 'morning',
          '13:00': 'afternoon', '01:00 PM': 'afternoon',
          '14:00': 'afternoon', '02:00 PM': 'afternoon',
          '18:00': 'evening', '06:00 PM': 'evening',
          '20:00': 'night', '08:00 PM': 'night',
          '21:00': 'night', '09:00 PM': 'night',
        };

        mapped = list.map((s, idx) => ({
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
          status: 'pending',
        }));
      } else {
        // Fallback: use active medicines list
        const medsRes = await medicineAPI.list();
        const meds = Array.isArray(medsRes) ? medsRes : (medsRes?.items || medsRes?.data || []);
        if (meds.length > 0) {
          const slots   = ['morning', 'afternoon', 'night'];
          const times   = ['08:00 AM', '01:00 PM', '08:00 PM'];
          const times24 = ['08:00', '13:00', '20:00'];
          mapped = meds.map((m, idx) => ({
            id: m.id || `rw-med-${idx}`,
            medicine_id: m.id,
            name: m.name,
            strength: m.dosage || '',
            slot: slots[idx % 3],
            time: times[idx % 3],
            time24: times24[idx % 3],
            status: 'pending',
          }));
        }
      }

      // ── Overlay persisted statuses from PostgreSQL daily-tracking ──
      try {
        const tracking = await patientAPI.getDailyTracking();
        const dbDoses = tracking?.doses || [];
        const statusMap = {};
        for (const d of dbDoses) {
          if (d.schedule_id) {
            statusMap[d.schedule_id] = d.status;
          }
        }
        mapped = mapped.map((m) => {
          const dbStatus = statusMap[m.schedule_id];
          if (!dbStatus) return m;
          const normalized =
            dbStatus === 'Taken'   ? 'taken'   :
            dbStatus === 'Missed'  ? 'skipped' :
            dbStatus === 'Snoozed' ? 'snoozed' :
            'pending';
          return { ...m, status: normalized };
        });
      } catch {
        // No persisted logs yet — all doses remain pending
      }

      setSchedule(mapped);
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
    const total   = schedule.length;
    const taken   = schedule.filter((r) => r.status === 'taken').length;
    const pending = schedule.filter((r) => r.status === 'pending' || r.status === 'snoozed').length;
    const progress = total > 0 ? Math.round((taken / total) * 100) : 0;
    return { total, taken, pending, progress };
  }, [schedule]);

  // Show all items, most-recent / pending first
  const displayItems = useMemo(() => {
    const order = { pending: 0, snoozed: 1, taken: 2, skipped: 3 };
    return [...schedule]
      .sort((a, b) => (order[a.status] ?? 4) - (order[b.status] ?? 4))
      .slice(0, maxItems);
  }, [schedule, maxItems]);

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

        {/* Read-Only Schedule List */}
        {loading ? (
          <div className="flex items-center justify-center py-6 text-on-surface-variant gap-2 text-caption">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            Loading reminders...
          </div>
        ) : displayItems.length > 0 ? (
          <div className="space-y-1.5">
            {displayItems.map((item) => {
              const slotInfo = TIME_SLOTS.find((s) => s.key === item.slot) || TIME_SLOTS[0];
              const isDone = item.status === 'taken' || item.status === 'skipped';
              return (
                <div
                  key={item.id}
                  className={[
                    'flex items-center gap-2.5 p-2.5 rounded-lg border transition-colors',
                    isDone
                      ? 'bg-surface-container-low/50 border-outline-variant/20 opacity-75'
                      : 'bg-surface border-outline-variant/30',
                  ].join(' ')}
                >
                  {/* Pill icon */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isDone ? 'bg-surface-container' : 'bg-primary/8'}`}>
                    <Pill className={`w-3.5 h-3.5 ${isDone ? 'text-on-surface-variant/50' : 'text-primary'}`} />
                  </div>

                  {/* Name + time */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-caption font-semibold truncate ${isDone ? 'text-on-surface-variant' : 'text-on-surface'}`}>
                      {item.name}
                      {item.strength && (
                        <span className="font-normal text-on-surface-variant ml-1">{item.strength}</span>
                      )}
                    </p>
                    <p className="text-[10px] text-on-surface-variant flex items-center gap-1 mt-0.5">
                      <slotInfo.Icon className={`w-2.5 h-2.5 ${slotInfo.color}`} />
                      {item.time}
                    </p>
                  </div>

                  {/* Static status badge — no buttons */}
                  <StatusBadge status={item.status} />
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

        {/* Read-only notice */}
        {!loading && schedule.length > 0 && (
          <p className="text-[10px] text-on-surface-variant/60 text-center mt-3 flex items-center justify-center gap-1">
            <ZapOff className="w-2.5 h-2.5" />
            Use the timeline below to mark doses
          </p>
        )}
      </div>
    </Card>
  );
}
