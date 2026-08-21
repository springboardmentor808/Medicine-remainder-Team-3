'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  Bell,
  CheckCircle2,
  Clock,
  XCircle,
  Pill,
  Timer,
  Sunrise,
  Sun,
  Sunset,
  Moon,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';

/**
 * ReminderWidget — PillSync
 * Compact, embeddable reminder card for dashboards.
 * Shows today's medication schedule with Take/Snooze/Skip actions.
 */

const TIME_SLOTS = [
  { key: 'morning',   label: 'Morning',   Icon: Sunrise, color: 'text-amber-500' },
  { key: 'afternoon', label: 'Afternoon', Icon: Sun,     color: 'text-sky-500' },
  { key: 'evening',   label: 'Evening',   Icon: Sunset,  color: 'text-purple-500' },
  { key: 'night',     label: 'Night',     Icon: Moon,    color: 'text-slate-500' },
];

const DEMO_SCHEDULE = [
  { id: 'rw-1', name: 'Metformin', strength: '500mg', slot: 'morning', time: '08:00 AM', status: 'pending' },
  { id: 'rw-2', name: 'Amlodipine', strength: '5mg', slot: 'morning', time: '08:00 AM', status: 'taken', takenAt: '08:05 AM' },
  { id: 'rw-3', name: 'Atorvastatin', strength: '20mg', slot: 'afternoon', time: '01:00 PM', status: 'pending' },
  { id: 'rw-4', name: 'Aspirin', strength: '75mg', slot: 'evening', time: '06:00 PM', status: 'pending' },
  { id: 'rw-5', name: 'Vitamin D3', strength: '1000 IU', slot: 'morning', time: '09:00 AM', status: 'pending' },
];

export default function ReminderWidget({ maxItems = 5, className = '' }) {
  const [schedule, setSchedule] = useState(DEMO_SCHEDULE);

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

  const handleTake = useCallback((item) => {
    const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    setSchedule((prev) =>
      prev.map((r) => (r.id === item.id ? { ...r, status: 'taken', takenAt: now } : r))
    );
  }, []);

  const handleSkip = useCallback((item) => {
    setSchedule((prev) =>
      prev.map((r) => (r.id === item.id ? { ...r, status: 'skipped' } : r))
    );
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
        {upcomingItems.length > 0 ? (
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
                      title="Take"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleSkip(item)}
                      className="p-1.5 rounded-md text-on-surface-variant hover:bg-error/10 hover:text-error transition-colors"
                      title="Skip"
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
            <p className="text-[11px] text-on-surface-variant">You&apos;ve taken all your medications.</p>
          </div>
        )}
      </div>
    </Card>
  );
}
