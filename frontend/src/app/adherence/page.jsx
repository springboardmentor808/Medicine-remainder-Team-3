'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Pause,
  Pill,
  Flame,
  BarChart3,
  Filter,
  Download,
  RefreshCw,
  Award,
  Target,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import AdherenceRing from '@/components/ui/AdherenceRing';
import { ToastProvider, useToast } from '@/components/ui/Toast';

// ── Constants ────────────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { key: '7d',  label: '7 Days' },
  { key: '30d', label: '30 Days' },
  { key: '90d', label: '90 Days' },
];

const ACTION_CONFIG = {
  taken:   { label: 'Taken',   Icon: CheckCircle2, color: 'text-tertiary',  bgColor: 'bg-tertiary/10',  borderColor: 'border-l-tertiary' },
  missed:  { label: 'Missed',  Icon: XCircle,      color: 'text-error',     bgColor: 'bg-error/10',     borderColor: 'border-l-error' },
  skipped: { label: 'Skipped', Icon: XCircle,      color: 'text-error',     bgColor: 'bg-error/10',     borderColor: 'border-l-error' },
  snoozed: { label: 'Snoozed', Icon: Pause,        color: 'text-secondary', bgColor: 'bg-secondary/10', borderColor: 'border-l-secondary' },
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_SUMMARY = {
  '7d':  { overall: 87, taken: 42, missed: 3, snoozed: 3, total: 48, streakDays: 5 },
  '30d': { overall: 82, taken: 164, missed: 18, snoozed: 14, total: 196, streakDays: 5 },
  '90d': { overall: 79, taken: 460, missed: 62, snoozed: 46, total: 568, streakDays: 5 },
};

const MOCK_PER_MEDICINE = [
  { id: 'med-1', name: 'Metformin',     strength: '500mg',   type: 'Diabetes',       adherence: 92, taken: 26, total: 28, trend: 'up' },
  { id: 'med-2', name: 'Amlodipine',    strength: '5mg',     type: 'Blood Pressure', adherence: 86, taken: 12, total: 14, trend: 'stable' },
  { id: 'med-3', name: 'Atorvastatin',  strength: '20mg',    type: 'Cholesterol',    adherence: 78, taken: 11, total: 14, trend: 'down' },
  { id: 'med-4', name: 'Levothyroxine', strength: '50mcg',   type: 'Thyroid',        adherence: 95, taken: 27, total: 28, trend: 'up' },
  { id: 'med-5', name: 'Aspirin',       strength: '75mg',    type: 'Heart Health',   adherence: 71, taken: 10, total: 14, trend: 'down' },
  { id: 'med-6', name: 'Vitamin D3',    strength: '1000 IU', type: 'Supplement',     adherence: 100, taken: 14, total: 14, trend: 'stable' },
];

const MOCK_DOSE_HISTORY = [
  { id: 'dl-01', medicineName: 'Metformin 500mg',     date: '2026-08-17', time: '08:05 AM', action: 'taken',   notes: '' },
  { id: 'dl-02', medicineName: 'Amlodipine 5mg',      date: '2026-08-17', time: '08:02 AM', action: 'taken',   notes: '' },
  { id: 'dl-03', medicineName: 'Levothyroxine 50mcg', date: '2026-08-17', time: '06:32 AM', action: 'taken',   notes: '' },
  { id: 'dl-04', medicineName: 'Atorvastatin 20mg',   date: '2026-08-16', time: '01:15 PM', action: 'taken',   notes: '' },
  { id: 'dl-05', medicineName: 'Aspirin 75mg',        date: '2026-08-16', time: '',          action: 'missed',  notes: 'Forgot — was traveling' },
  { id: 'dl-06', medicineName: 'Metformin 500mg',     date: '2026-08-16', time: '09:00 PM', action: 'snoozed', notes: 'Snoozed 15 min' },
  { id: 'dl-07', medicineName: 'Metformin 500mg',     date: '2026-08-16', time: '09:18 PM', action: 'taken',   notes: 'Took after snooze' },
  { id: 'dl-08', medicineName: 'Amlodipine 5mg',      date: '2026-08-16', time: '08:00 AM', action: 'taken',   notes: '' },
  { id: 'dl-09', medicineName: 'Levothyroxine 50mcg', date: '2026-08-16', time: '06:30 AM', action: 'taken',   notes: '' },
  { id: 'dl-10', medicineName: 'Vitamin D3 1000 IU',  date: '2026-08-16', time: '09:10 AM', action: 'taken',   notes: '' },
  { id: 'dl-11', medicineName: 'Atorvastatin 20mg',   date: '2026-08-15', time: '',          action: 'skipped', notes: 'Side effects — nausea' },
  { id: 'dl-12', medicineName: 'Aspirin 75mg',        date: '2026-08-15', time: '06:20 PM', action: 'taken',   notes: '' },
  { id: 'dl-13', medicineName: 'Metformin 500mg',     date: '2026-08-15', time: '08:10 AM', action: 'taken',   notes: '' },
  { id: 'dl-14', medicineName: 'Metformin 500mg',     date: '2026-08-15', time: '09:05 PM', action: 'taken',   notes: '' },
];

// ── Generate Weekly Heatmap Data ─────────────────────────────────────────────

function generateHeatmapData(weeks = 4) {
  const data = [];
  const today = new Date();
  for (let w = weeks - 1; w >= 0; w--) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(today);
      date.setDate(today.getDate() - (w * 7 + (6 - d)));
      const isFuture = date > today;
      // Simulate adherence percentage per day
      const pct = isFuture ? -1 : Math.floor(Math.random() * 40) + 60;
      week.push({
        date: date.toISOString().split('T')[0],
        dayLabel: date.getDate(),
        weekday: WEEKDAYS[date.getDay()],
        percentage: pct,
        isFuture,
      });
    }
    data.push(week);
  }
  return data;
}

// ── Inner Page Component ─────────────────────────────────────────────────────

function AdherencePageInner() {
  const { addToast } = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [historyFilter, setHistoryFilter] = useState('all'); // 'all' | 'taken' | 'missed' | 'snoozed'
  const [loading, setLoading] = useState(false);

  const summary = MOCK_SUMMARY[selectedPeriod] || MOCK_SUMMARY['7d'];
  const heatmapData = useMemo(() => generateHeatmapData(4), []);

  // Sort medicines by adherence (lowest first for attention)
  const sortedMedicines = useMemo(
    () => [...MOCK_PER_MEDICINE].sort((a, b) => a.adherence - b.adherence),
    []
  );

  // Filtered dose history
  const filteredHistory = useMemo(() => {
    if (historyFilter === 'all') return MOCK_DOSE_HISTORY;
    return MOCK_DOSE_HISTORY.filter((d) => d.action === historyFilter);
  }, [historyFilter]);

  // Group history by date
  const groupedHistory = useMemo(() => {
    const groups = {};
    filteredHistory.forEach((entry) => {
      if (!groups[entry.date]) groups[entry.date] = [];
      groups[entry.date].push(entry);
    });
    return groups;
  }, [filteredHistory]);

  const getHeatmapColor = (pct) => {
    if (pct < 0) return 'bg-surface-container';
    if (pct >= 90) return 'bg-tertiary';
    if (pct >= 75) return 'bg-tertiary/60';
    if (pct >= 50) return 'bg-secondary/60';
    return 'bg-error/60';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="bg-gradient-primary text-on-primary">
        <div className="max-w-4xl mx-auto px-gutter py-lg">
          {/* Back Nav */}
          <div className="flex items-center justify-between mb-md">
            <Link
              href="/dashboard/patient"
              className="flex items-center gap-xs text-on-primary/80 hover:text-on-primary transition-colors text-body-sm"
            >
              <ChevronLeft className="w-4 h-4" />
              Dashboard
            </Link>
          </div>

          {/* Title */}
          <div className="flex items-center gap-sm mb-lg">
            <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-sm">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-headline-sm font-bold">Adherence Reports</h1>
              <p className="text-body-sm text-on-primary/70">Track your medication compliance</p>
            </div>
          </div>

          {/* Period Selector */}
          <div className="flex gap-xs bg-white/10 rounded-lg p-1 backdrop-blur-sm">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSelectedPeriod(opt.key)}
                className={`flex-1 py-xs px-md rounded-md text-body-sm font-medium transition-all duration-200
                  ${selectedPeriod === opt.key
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-on-primary/70 hover:text-on-primary hover:bg-white/10'
                  }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-gutter py-lg">
        {/* ── Overall Adherence Ring ──────────────────────────────── */}
        <Card className="mb-lg">
          <div className="p-card-padding">
            <div className="flex flex-col sm:flex-row items-center gap-lg">
              {/* Ring */}
              <div className="flex-shrink-0">
                <AdherenceRing
                  percentage={summary.overall}
                  size={140}
                  strokeWidth={12}
                  label="Overall"
                  sublabel={`Last ${selectedPeriod === '7d' ? '7 days' : selectedPeriod === '30d' ? '30 days' : '90 days'}`}
                />
              </div>

              {/* Stats Grid */}
              <div className="flex-1 w-full grid grid-cols-2 sm:grid-cols-4 gap-sm">
                <div className="text-center p-sm rounded-lg bg-tertiary/5">
                  <CheckCircle2 className="w-5 h-5 text-tertiary mx-auto mb-1" />
                  <p className="text-headline-sm font-bold text-on-surface">{summary.taken}</p>
                  <p className="text-xs text-on-surface-variant">Taken</p>
                </div>
                <div className="text-center p-sm rounded-lg bg-error/5">
                  <XCircle className="w-5 h-5 text-error mx-auto mb-1" />
                  <p className="text-headline-sm font-bold text-on-surface">{summary.missed}</p>
                  <p className="text-xs text-on-surface-variant">Missed</p>
                </div>
                <div className="text-center p-sm rounded-lg bg-secondary/5">
                  <Pause className="w-5 h-5 text-secondary mx-auto mb-1" />
                  <p className="text-headline-sm font-bold text-on-surface">{summary.snoozed}</p>
                  <p className="text-xs text-on-surface-variant">Snoozed</p>
                </div>
                <div className="text-center p-sm rounded-lg bg-primary/5">
                  <Flame className="w-5 h-5 text-primary mx-auto mb-1" />
                  <p className="text-headline-sm font-bold text-on-surface">{summary.streakDays}</p>
                  <p className="text-xs text-on-surface-variant">Day Streak</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* ── Streak & Motivation ─────────────────────────────────── */}
        <Card className="mb-lg bg-gradient-to-r from-primary/5 to-tertiary/5 border-primary/20">
          <div className="p-card-padding">
            <div className="flex items-center gap-sm">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Award className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-body-sm font-semibold text-on-surface">
                  {summary.streakDays >= 7 ? '🔥 Amazing streak!' :
                   summary.streakDays >= 3 ? '💪 Keep it up!' : '🎯 Build your streak!'}
                </h3>
                <p className="text-caption text-on-surface-variant">
                  {summary.streakDays} consecutive day{summary.streakDays !== 1 ? 's' : ''} of perfect adherence.
                  {summary.streakDays >= 7
                    ? ' Your consistency is outstanding!'
                    : ' Take all doses today to extend your streak.'}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-display-lg font-bold text-primary">{summary.streakDays}</p>
                <p className="text-xs text-on-surface-variant">days</p>
              </div>
            </div>
          </div>
        </Card>

        {/* ── Weekly Heatmap Calendar ─────────────────────────────── */}
        <Card className="mb-lg">
          <div className="p-card-padding">
            <div className="flex items-center justify-between mb-md">
              <h2 className="text-body-sm font-semibold text-on-surface flex items-center gap-xs">
                <Calendar className="w-4 h-4 text-primary" />
                Weekly Adherence Heatmap
              </h2>
              <div className="flex items-center gap-xs text-xs text-on-surface-variant">
                <span className="w-3 h-3 rounded-sm bg-error/60" /> Low
                <span className="w-3 h-3 rounded-sm bg-secondary/60" /> Medium
                <span className="w-3 h-3 rounded-sm bg-tertiary/60" /> Good
                <span className="w-3 h-3 rounded-sm bg-tertiary" /> Excellent
              </div>
            </div>

            {/* Day Headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAYS.map((day) => (
                <div key={day} className="text-center text-xs text-on-surface-variant font-medium py-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Heatmap Grid */}
            <div className="flex flex-col gap-1">
              {heatmapData.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-1">
                  {week.map((day, di) => (
                    <div
                      key={di}
                      className={`aspect-square rounded-md flex items-center justify-center text-xs font-medium transition-colors
                        ${getHeatmapColor(day.percentage)}
                        ${day.percentage >= 75 ? 'text-white' : day.percentage >= 0 ? 'text-on-surface' : 'text-on-surface-variant'}
                        ${day.isFuture ? 'opacity-30' : 'hover:ring-2 hover:ring-primary/30 cursor-default'}
                      `}
                      title={day.isFuture ? 'Future' : `${day.date}: ${day.percentage}% adherence`}
                    >
                      {day.dayLabel}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* ── Per-Medicine Breakdown ──────────────────────────────── */}
        <Card className="mb-lg">
          <div className="p-card-padding">
            <h2 className="text-body-sm font-semibold text-on-surface flex items-center gap-xs mb-md">
              <Pill className="w-4 h-4 text-primary" />
              Per-Medication Breakdown
            </h2>

            <div className="flex flex-col gap-sm">
              {sortedMedicines.map((med) => {
                const TrendIcon = med.trend === 'up' ? TrendingUp : med.trend === 'down' ? TrendingDown : Activity;
                const trendColor = med.trend === 'up' ? 'text-tertiary' : med.trend === 'down' ? 'text-error' : 'text-on-surface-variant';

                return (
                  <div
                    key={med.id}
                    className="flex items-center gap-sm p-sm rounded-lg border border-outline-variant/50 hover:border-primary/30 transition-colors"
                  >
                    {/* Mini Ring */}
                    <AdherenceRing.Compact percentage={med.adherence} size={44} strokeWidth={5} />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-xs">
                        <h4 className="text-body-sm font-semibold text-on-surface truncate">{med.name}</h4>
                        <span className="text-xs text-on-surface-variant">{med.strength}</span>
                      </div>
                      <div className="flex items-center gap-sm text-xs text-on-surface-variant">
                        <span>{med.type}</span>
                        <span>•</span>
                        <span>{med.taken}/{med.total} doses</span>
                      </div>
                    </div>

                    {/* Trend */}
                    <div className={`flex items-center gap-1 ${trendColor} flex-shrink-0`}>
                      <TrendIcon className="w-4 h-4" />
                      <span className="text-caption font-semibold">{med.adherence}%</span>
                    </div>

                    {/* Low adherence warning */}
                    {med.adherence < 75 && (
                      <Badge variant="missed" className="text-xs flex-shrink-0">
                        <AlertTriangle className="w-3 h-3" />
                        Low
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* ── Dose History Log ─────────────────────────────────────── */}
        <Card>
          <div className="p-card-padding">
            <div className="flex items-center justify-between mb-md flex-wrap gap-sm">
              <h2 className="text-body-sm font-semibold text-on-surface flex items-center gap-xs">
                <Clock className="w-4 h-4 text-primary" />
                Dose History Log
              </h2>

              {/* Filter Chips */}
              <div className="flex gap-xs flex-wrap">
                {[
                  { key: 'all',     label: 'All' },
                  { key: 'taken',   label: 'Taken' },
                  { key: 'missed',  label: 'Missed' },
                  { key: 'snoozed', label: 'Snoozed' },
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setHistoryFilter(f.key)}
                    className={`px-sm py-1 rounded-full text-xs font-medium border transition-all duration-200
                      ${historyFilter === f.key
                        ? 'bg-primary text-on-primary border-primary'
                        : 'bg-surface-container-low text-on-surface-variant border-outline-variant hover:border-primary/50'
                      }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredHistory.length === 0 ? (
              <div className="text-center py-xl">
                <Clock className="w-8 h-8 text-on-surface-variant mx-auto mb-sm" />
                <p className="text-body-sm text-on-surface-variant">No dose history matching this filter.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-md">
                {Object.entries(groupedHistory).map(([date, entries]) => {
                  const dateLabel = (() => {
                    const today = new Date().toISOString().split('T')[0];
                    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
                    if (date === today) return 'Today';
                    if (date === yesterday) return 'Yesterday';
                    return new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                  })();

                  return (
                    <div key={date}>
                      <h3 className="text-caption font-semibold text-on-surface-variant uppercase tracking-wider mb-xs">
                        {dateLabel}
                      </h3>
                      <div className="flex flex-col gap-1">
                        {entries.map((entry) => {
                          const cfg = ACTION_CONFIG[entry.action] || ACTION_CONFIG.taken;
                          const EntryIcon = cfg.Icon;
                          return (
                            <div
                              key={entry.id}
                              className={`flex items-center gap-sm px-sm py-xs rounded-md border-l-3 ${cfg.borderColor} ${cfg.bgColor}/30 hover:${cfg.bgColor}/50 transition-colors`}
                            >
                              <EntryIcon className={`w-4 h-4 ${cfg.color} flex-shrink-0`} />
                              <span className="text-body-sm text-on-surface flex-1 truncate">{entry.medicineName}</span>
                              <Badge variant={cfg.label === 'Taken' ? 'taken' : cfg.label === 'Missed' || cfg.label === 'Skipped' ? 'missed' : 'snoozed'} className="text-xs">
                                {cfg.label}
                              </Badge>
                              <span className="text-xs text-on-surface-variant flex-shrink-0 w-20 text-right">
                                {entry.time || '—'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </main>
    </div>
  );
}

// ── Main Export (with Toast Provider) ─────────────────────────────────────────

export default function AdherencePage() {
  return (
    <ToastProvider position="top-center">
      <AdherencePageInner />
    </ToastProvider>
  );
}
