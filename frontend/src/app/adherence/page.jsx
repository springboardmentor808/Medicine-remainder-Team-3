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
import EmptyState from '@/components/ui/EmptyState';
import AdherenceRing from '@/components/ui/AdherenceRing';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { exportAPI, patientAPI, medicineAPI, analyticsAPI, caregiverAPI } from '@/lib/api';
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

// ── Default Fallbacks for new accounts ────────────────────────────────────────

const DEFAULT_SUMMARY = {
  '7d':  { overall: 0, taken: 0, missed: 0, snoozed: 0, total: 0, streakDays: 0 },
  '30d': { overall: 0, taken: 0, missed: 0, snoozed: 0, total: 0, streakDays: 0 },
  '90d': { overall: 0, taken: 0, missed: 0, snoozed: 0, total: 0, streakDays: 0 },
};

// ── Heatmap is fully real — no mock data generator ───────────────────────────

// ── Inner Page Component ─────────────────────────────────────────────────────

function AdherencePageInner() {
  const { addToast } = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [historyFilter, setHistoryFilter] = useState('all'); // 'all' | 'taken' | 'missed' | 'snoozed'
  const [loading, setLoading] = useState(true);
  const [liveSummary, setLiveSummary] = useState(DEFAULT_SUMMARY);
  const [perMedicine, setPerMedicine] = useState([]);
  const [doseHistory, setDoseHistory] = useState([]);
  // Real heatmap from PostgreSQL (week-grid: array of weeks, each with 7 day objects)
  const [heatmapData, setHeatmapData] = useState([]);

  // Caregiver Roster State
  const [currentUser, setCurrentUser] = useState(null);
  const [wardPatients, setWardPatients] = useState([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('pillsync_user');
      if (stored) {
        const u = JSON.parse(stored);
        setCurrentUser(u);
        if (u.role === 'caregiver') {
          Promise.allSettled([
            caregiverAPI.getPatients(),
            caregiverAPI.patientOverview(),
          ]).then(([ptsRes, ovRes]) => {
            const pts = ptsRes.status === 'fulfilled' ? (ptsRes.value?.data || ptsRes.value) : [];
            const rawPts = Array.isArray(pts) ? pts : (pts?.patients || pts?.items || []);
            const ovs = ovRes.status === 'fulfilled' ? (ovRes.value?.data || ovRes.value) : [];
            const rawOvs = Array.isArray(ovs) ? ovs : (ovs?.reports || ovs?.items || []);

            const mapped = rawPts.map((p) => {
              const stat = rawOvs.find((o) => String(o.patient_id) === String(p.id)) || {};
              const isDemoPatient = String(p.id).startsWith('00000000-0000-4000-8000-00000000000');
              const adh = stat.adherence_percentage !== undefined && stat.adherence_percentage !== null
                ? stat.adherence_percentage
                : (isDemoPatient ? (String(p.id).endsWith('1') ? 94 : 68) : null);
              const missed = stat.missed_doses !== undefined && stat.missed_doses !== null
                ? stat.missed_doses
                : (isDemoPatient ? (adh !== null && adh < 75 ? 3 : 0) : 0);
              return {
                id: p.id,
                name: p.full_name || p.username || 'Patient',
                adherence: adh !== null ? Math.round(adh) : null,
                missedDoses: missed,
                isDemo: isDemoPatient,
              };
            });
            setWardPatients(mapped);
          }).catch(() => {});
        }
      }
    } catch {}
  }, []);

  // Fetch all real data in parallel — no mocks
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [rep7Res, rep30Res, rep90Res, medsRes, histRes, hmRes] = await Promise.allSettled([
          analyticsAPI.getSummary({ days: 7 }),
          analyticsAPI.getSummary({ days: 30 }),
          analyticsAPI.getSummary({ days: 90 }),
          medicineAPI.list(),
          patientAPI.getAdherenceHistory(),
          analyticsAPI.getHeatmap({ weeks: 4 }),
        ]);

        // ── Per-period adherence summaries ────────────────────────────
        const parseSummary = (res) => {
          if (res.status !== 'fulfilled' || !res.value) return { overall: 0, taken: 0, missed: 0, snoozed: 0, total: 0, streakDays: 0 };
          const r = res.value;
          return {
            overall: Math.round(r.adherence_percentage ?? 0),
            taken: r.taken_doses ?? 0,
            missed: r.missed_doses ?? 0,
            snoozed: r.snoozed_doses ?? 0,
            total: r.total_doses ?? 0,
            streakDays: r.streak_days ?? 0,
          };
        };
        setLiveSummary({
          '7d':  parseSummary(rep7Res),
          '30d': parseSummary(rep30Res),
          '90d': parseSummary(rep90Res),
        });

        // ── Per-medicine adherence from dose history ──────────────────
        const meds = medsRes.status === 'fulfilled' && Array.isArray(medsRes.value)
          ? medsRes.value
          : (medsRes.status === 'fulfilled' && medsRes.value?.items ? medsRes.value.items : []);

        // Compute real per-medicine adherence from history logs
        const histLogs = histRes.status === 'fulfilled'
          ? (histRes.value?.logs || [])
          : [];

        // Build per-medicine taken/total map from history
        const medMap = {};
        for (const log of histLogs) {
          const mId = log.medicine_id;
          if (!medMap[mId]) medMap[mId] = { taken: 0, total: 0 };
          medMap[mId].total += 1;
          if (log.action === 'Taken' || log.action === 'TAKEN') medMap[mId].taken += 1;
        }

        if (meds.length > 0) {
          setPerMedicine(meds.map((m, idx) => {
            const stats = medMap[m.id] || { taken: 0, total: 0 };
            const adh = stats.total > 0 ? Math.round((stats.taken / stats.total) * 100) : 0;
            return {
              id: m.id || `med-${idx}`,
              name: m.name,
              strength: m.dosage || '',
              type: m.disease_category || 'Medication',
              adherence: adh,
              taken: stats.taken,
              total: stats.total,
              trend: adh >= 80 ? 'up' : adh >= 50 ? 'stable' : 'down',
            };
          }));
        }

        // ── Dose history log entries ──────────────────────────────────
        if (histLogs.length > 0) {
          setDoseHistory(histLogs.map((log) => ({
            id: log.id,
            date: log.scheduled_date,
            action: log.action === 'Taken' || log.action === 'TAKEN'
              ? 'taken'
              : log.action === 'Missed' || log.action === 'MISSED'
              ? 'missed'
              : 'snoozed',
            medicineName: log.medicine_name ||
              meds.find((m) => m.id === log.medicine_id)?.name ||
              'Medication',
            time: log.action_time
              ? new Date(log.action_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
              : log.scheduled_time || '—',
          })).sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0)));
        }

        // ── Real heatmap grid ─────────────────────────────────────────
        if (hmRes.status === 'fulfilled' && Array.isArray(hmRes.value)) {
          setHeatmapData(hmRes.value);
        }
      } catch (err) {
        console.error('Failed to load adherence data:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const summary = liveSummary[selectedPeriod] || liveSummary['7d'];

  // Sort medicines by adherence (lowest first for attention)
  const sortedMedicines = useMemo(
    () => [...perMedicine].sort((a, b) => a.adherence - b.adherence),
    [perMedicine]
  );

  // Filtered dose history
  const filteredHistory = useMemo(() => {
    if (historyFilter === 'all') return doseHistory;
    return doseHistory.filter((d) => d.action === historyFilter);
  }, [doseHistory, historyFilter]);

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
    <DashboardLayout>
      <div className="min-h-screen bg-background">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <header className="bg-gradient-primary text-on-primary">
          <div className="max-w-4xl mx-auto px-gutter py-lg">
            {/* Back Nav + Export Action */}
            <div className="flex items-center justify-between mb-md">
              <Link
                href="/dashboard/patient"
                className="flex items-center gap-xs text-on-primary/80 hover:text-on-primary transition-colors text-body-sm"
              >
                <ChevronLeft className="w-4 h-4" />
                Dashboard
              </Link>

              <button
                onClick={() => exportAPI.adherenceCSV()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold backdrop-blur-sm transition-all"
                title="Download adherence history as CSV"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            </div>

            {/* Title */}
            <div className="flex items-center gap-sm mb-lg">
              <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-sm">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-headline-sm font-bold">Adherence Reports</h1>
                <p className="text-base text-on-primary/90 mt-1 font-medium">Track your medication compliance</p>
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
        {/* ── Caregiver Ward Roster Scorecard ─────────────────────── */}
        {currentUser?.role === 'caregiver' && wardPatients.length > 0 && (
          <Card className="mb-lg border border-[#bfe3cd] dark:border-[#1e4537] bg-[#f4faf6] dark:bg-[#0e241c]/60">
            <div className="p-card-padding">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-[#11382d] dark:text-[#a0e5be]">
                  <Activity className="w-5 h-5 text-[#164234] dark:text-[#a0e5be]" />
                  <h2 className="text-body-sm font-bold">Monitored Ward Compliance Roster</h2>
                </div>
                <Badge variant="caregiver" size="xs">Caregiver Pro</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {wardPatients.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 rounded-xl bg-white dark:bg-surface-container-low border border-outline-variant/30 flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-bold text-on-surface">{p.name}</h3>
                        {p.isDemo && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] bg-secondary/15 text-secondary uppercase font-bold">Sample</span>
                        )}
                      </div>
                      <p className="text-caption text-on-surface-variant mt-0.5">
                        {p.adherence === null ? (
                          <span className="text-on-surface-variant font-medium">ℹ️ No dose logs recorded yet</span>
                        ) : p.missedDoses > 0 ? (
                          <span className="text-error font-medium">⚠️ {p.missedDoses} missed doses reported</span>
                        ) : (
                          <span className="text-emerald-600 font-medium">✅ Full compliance on schedule</span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      {p.adherence !== null ? (
                        <>
                          <p className={`text-xl font-bold ${p.adherence > 80 ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {p.adherence}%
                          </p>
                          <p className="text-[10px] text-on-surface-variant uppercase font-semibold">Adherence</p>
                        </>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold bg-surface-container-high text-on-surface-variant">
                          No Data
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

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

            {/* Heatmap Grid — real data or empty state */}
            {heatmapData.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-8 h-8 text-on-surface-variant/40 mx-auto mb-2" />
                <p className="text-caption text-on-surface-variant">
                  {loading ? 'Loading heatmap...' : 'No dose data yet. Start taking your medications to build your history!'}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {heatmapData.map((week, wi) => (
                  <div key={wi} className="grid grid-cols-7 gap-1">
                    {week.map((day, di) => (
                      <div
                        key={di}
                        className={`aspect-square rounded-md flex items-center justify-center text-xs font-medium transition-colors
                          ${getHeatmapColor(day.percentage)}
                          ${day.percentage >= 75 ? 'text-white' : day.percentage >= 0 ? 'text-on-surface' : 'text-on-surface-variant'}
                          ${(day.isFuture || day.isBeforeAccount) ? 'opacity-25' : 'hover:ring-2 hover:ring-primary/30 cursor-default'}
                        `}
                        title={
                          day.isBeforeAccount
                            ? `${day.date}: before account creation`
                            : day.isFuture
                            ? 'Future'
                            : day.total > 0
                            ? `${day.date}: ${day.taken}/${day.total} taken (${day.percentage}%)`
                            : `${day.date}: no doses logged`
                        }
                      >
                        {day.dayLabel}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

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
              <EmptyState
                icon="history"
                title="No Dose History Records"
                description="No medication dose logs found matching this filter."
                className="py-8 my-4"
              />
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
    </DashboardLayout>
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
