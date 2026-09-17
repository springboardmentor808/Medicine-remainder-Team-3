'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Bell,
  RefreshCw,
  User,
  Pill,
  ChevronRight,
  Sparkles,
  Info,
} from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { caregiverAPI } from '@/lib/api';

/**
 * CaregiverQueueWidget — Multi-Patient Ward Scheduled Dose Queue
 * Displays all scheduled medication doses across monitored patients for today.
 */
export default function CaregiverQueueWidget({ onSendReminder, className = '' }) {
  const [queueData, setQueueData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const fetchQueue = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    try {
      setError(null);
      const res = await caregiverAPI.getCaregiverQueue();
      if (!res || res.error) {
        throw new Error(res?.message || res?.detail || 'Failed to load ward queue');
      }
      const data = res?.data !== undefined ? res.data : res;
      setQueueData(data);
    } catch (err) {
      console.error('Failed to load caregiver queue:', err);
      setError(err?.message || 'Unable to connect to ward queue service.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    // 30-second live polling
    const timer = setInterval(() => fetchQueue(true), 30000);
    return () => clearInterval(timer);
  }, [fetchQueue]);

  const handleRemindClick = async (item) => {
    setActionLoadingId(item.schedule_id);
    try {
      if (onSendReminder) {
        await onSendReminder(item.patient_id, item);
      } else {
        await caregiverAPI.sendPatientReminder(
          item.patient_id,
          `Reminder: Please take your scheduled ${item.medicine_name} (${item.dosage}) scheduled for ${item.scheduled_time}.`
        );
      }
    } catch (e) {
      console.error('Reminder trigger error:', e);
    } finally {
      setActionLoadingId(null);
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '--:--';
    const [h, m] = timeStr.split(':');
    if (!h) return timeStr;
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const formattedHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${formattedHour}:${m || '00'} ${ampm}`;
  };

  const renderStatusPill = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'taken') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="w-3 h-3" />
          Taken
        </span>
      );
    }
    if (s === 'missed') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 animate-pulse">
          <XCircle className="w-3 h-3" />
          Missed
        </span>
      );
    }
    if (s === 'snoozed') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
          <Clock className="w-3 h-3" />
          Snoozed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
        <Clock className="w-3 h-3" />
        Pending
      </span>
    );
  };

  const items = queueData?.items || [];
  const total = queueData?.total_doses ?? items.length;
  const pending = queueData?.pending_count ?? items.filter((i) => i.status === 'Pending').length;
  const taken = queueData?.taken_count ?? items.filter((i) => i.status === 'Taken').length;
  const missed = queueData?.missed_count ?? items.filter((i) => i.status === 'Missed').length;
  const isDemo = queueData?.is_demo;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Top Telemetry Counters */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-surface-container-high/40 border border-outline-variant/20 backdrop-blur-xs">
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 font-medium text-on-surface">
            <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
            <span>Today&apos;s Total: <strong>{total}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Taken: <strong>{taken}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
            <Clock className="w-3.5 h-3.5" />
            <span>Pending: <strong>{pending}</strong></span>
          </div>
          {missed > 0 && (
            <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-bold">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Missed: <strong>{missed}</strong></span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isDemo && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Sparkles className="w-3 h-3" />
              Sample Demo Ward
            </span>
          )}
          <button
            onClick={() => fetchQueue(true)}
            disabled={refreshing}
            title="Refresh dose schedule"
            className="p-1 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-primary' : ''}`} />
          </button>
        </div>
      </div>

      {/* Demo Banner Notification */}
      {isDemo && (
        <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-primary/5 border border-primary/15 text-xs text-on-surface-variant">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <span>
            Displaying sample demo schedule for initial review. Once you connect your patient, real-time clinical logs will stream here automatically.
          </span>
        </div>
      )}

      {/* Cached Data with Stale/Failed Refresh Warning */}
      {error && queueData && (
        <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-xs text-amber-700 dark:text-amber-300 animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>Ward sync interrupted:</strong> Showing cached schedule ({error}).
            </span>
          </div>
          <button
            onClick={() => fetchQueue(false)}
            className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 dark:text-amber-200 transition-colors shrink-0"
          >
            Retry Now
          </button>
        </div>
      )}

      {/* Dose Items List */}
      {loading && !queueData ? (
        <div className="py-8 text-center space-y-2">
          <RefreshCw className="w-5 h-5 text-primary animate-spin mx-auto" />
          <p className="text-xs text-on-surface-variant">Synchronizing ward schedules...</p>
        </div>
      ) : error && !queueData ? (
        <div className="py-8 px-4 text-center rounded-xl border border-error/30 bg-error-container/20">
          <AlertCircle className="w-8 h-8 text-error mx-auto mb-2" />
          <p className="text-body-sm font-semibold text-error">Queue Synchronization Failed</p>
          <p className="text-caption text-on-surface-variant mt-1 mb-3">{error}</p>
          <button
            onClick={() => fetchQueue()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface text-error border border-error/40 hover:bg-surface-container-high transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry Connection
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center rounded-xl border border-dashed border-outline-variant/40 bg-surface-container-lowest">
          <Clock className="w-8 h-8 text-on-surface-variant/40 mx-auto mb-2" />
          <p className="text-body-sm font-medium text-on-surface">No doses scheduled today</p>
          <p className="text-caption text-on-surface-variant">All patient regimens are either clear or completed.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
          {items.map((item, idx) => {
            const isPendingOrMissed = item.status === 'Pending' || item.status === 'Missed';
            return (
              <div
                key={item.schedule_id || idx}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-surface border border-outline-variant/30 hover:border-primary/40 hover:bg-surface-container-lowest transition-all"
              >
                {/* Left: Time + Patient & Medicine */}
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center justify-center w-16 px-2 py-1.5 rounded-lg bg-surface-container-high/60 border border-outline-variant/30 text-center shrink-0">
                    <span className="text-xs font-black text-on-surface tracking-tight">
                      {formatTime(item.scheduled_time)}
                    </span>
                    <span className="text-[10px] text-on-surface-variant uppercase font-semibold">
                      {item.dose_label || 'Dose'}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-body-sm font-bold text-on-surface flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-primary" />
                        {item.patient_name}
                      </span>
                      {item.patient_phone && (
                        <span className="text-[11px] text-on-surface-variant/70 hidden md:inline">
                          ({item.patient_phone})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Pill className="w-3.5 h-3.5 text-secondary" />
                      <span className="text-xs font-semibold text-on-surface-variant">
                        {item.medicine_name}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-surface-container-highest text-on-surface-variant">
                        {item.dosage}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Status Pill + Quick Reminder */}
                <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-outline-variant/20">
                  {renderStatusPill(item.status)}

                  {isPendingOrMissed && (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => handleRemindClick(item)}
                      disabled={actionLoadingId === item.schedule_id}
                      className="text-primary hover:bg-primary/10 font-semibold gap-1 text-[11px] px-2.5 py-1"
                      title="Send dose alert notification"
                    >
                      <Bell className="w-3 h-3" />
                      <span>{actionLoadingId === item.schedule_id ? 'Sending...' : 'Remind'}</span>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
