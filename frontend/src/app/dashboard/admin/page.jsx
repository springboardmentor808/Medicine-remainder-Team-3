'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  Heart,
  FileText,
  AlertTriangle,
  Database,
  Server,
  Bell,
  ShieldCheck,
  ChevronRight,
  Activity,
  RefreshCw,
  UserCog,
  BarChart3,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Download,
  Filter,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import LogoutButton from '@/components/ui/LogoutButton';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { exportAPI, adminAPI, medicineAPI } from '@/lib/api';

// ── Base Metric Templates ───────────────────────────────────────────────────

const DEFAULT_METRICS = [
  {
    id: 'patients',
    label: 'Active Patients',
    value: 0,
    delta: 0,
    period: 'live registered',
    icon: Users,
    color: 'primary',
    href: '/admin/users?role=patient',
  },
  {
    id: 'caregivers',
    label: 'Total Caregivers',
    value: 0,
    delta: 0,
    period: 'live registered',
    icon: Heart,
    color: 'tertiary',
    href: '/admin/users?role=caregiver',
  },
  {
    id: 'prescriptions',
    label: 'Prescriptions Tracked',
    value: 0,
    delta: 0,
    period: 'in catalog',
    icon: FileText,
    color: 'secondary',
    href: '/medicines',
  },
  {
    id: 'alerts',
    label: 'System Status',
    value: 0,
    delta: 0,
    period: 'active issues',
    icon: AlertTriangle,
    color: 'error',
    href: '/admin/health',
  },
];

const SYSTEM_STATUS = [
  {
    id: 'db',
    label: 'PostgreSQL Database',
    detail: 'Primary cluster · pg-prod-01',
    status: 'healthy',
    value: '4 ms',
    valueLabel: 'query latency',
    icon: Database,
  },
  {
    id: 'api',
    label: 'FastAPI Server',
    detail: 'uvicorn · 4 workers',
    status: 'healthy',
    value: '24 ms',
    valueLabel: 'avg response',
    icon: Server,
  },
  {
    id: 'push',
    label: 'Push Notifications',
    detail: 'FCM · Twilio SMS',
    status: 'healthy',
    value: '98.7%',
    valueLabel: 'delivery rate',
    icon: Bell,
  },
  {
    id: 'redis',
    label: 'Redis Cache',
    detail: 'Session & rate-limit store',
    status: 'healthy',
    value: '1 ms',
    valueLabel: 'hit latency',
    icon: Activity,
  },
  {
    id: 'ocr',
    label: 'OCR / AI Service',
    detail: 'OpenCV + spaCy pipeline',
    status: 'degraded',
    value: '340 ms',
    valueLabel: 'processing avg',
    icon: BarChart3,
  },
  {
    id: 'backup',
    label: 'Scheduled Backups',
    detail: 'Daily 02:00 UTC',
    status: 'healthy',
    value: '6 h ago',
    valueLabel: 'last run',
    icon: Download,
  },
];

const NAV_CARDS = [
  {
    href: '/admin/users',
    icon: UserCog,
    title: 'User Management',
    desc: 'Manage patients, caregivers & roles. Reset passwords, deactivate accounts.',
    color: 'primary',
    badge: '1,626 users',
  },
  {
    href: '/admin/health',
    icon: Activity,
    title: 'System Health',
    desc: 'Real-time service uptime, API metrics, error rates & incident history.',
    color: 'tertiary',
    badge: '1 degraded',
    badgeVariant: 'warning',
  },
  {
    href: '/notifications',
    icon: Bell,
    title: 'Notification Queue',
    desc: 'Broadcast alerts, delivery logs, push/SMS/email channel status.',
    color: 'secondary',
    badge: '14 queued',
  },
  {
    href: '/admin/health',
    icon: ShieldCheck,
    title: 'Audit & Security',
    desc: 'Compliance logs, failed login attempts, permission changes.',
    color: 'primary',
    badge: null,
  },
];

const AUDIT_LOG = [
  {
    id: 'al-001',
    action: 'Role updated',
    detail: 'Role changed patient → caregiver for User #1042 (james.w@email.com)',
    actor: 'Admin (superuser)',
    timestamp: '2026-08-09 17:44:02',
    severity: 'info',
  },
  {
    id: 'al-002',
    action: 'Backup triggered',
    detail: 'Manual full-database backup initiated. Stored to S3 bucket pg-backup-prod.',
    actor: 'System (cron)',
    timestamp: '2026-08-09 17:30:00',
    severity: 'info',
  },
  {
    id: 'al-003',
    action: 'Account deactivated',
    detail: 'Patient account #0891 (eleanor.m@email.com) deactivated — user request.',
    actor: 'Admin (superuser)',
    timestamp: '2026-08-09 16:58:19',
    severity: 'warning',
  },
  {
    id: 'al-004',
    action: 'OCR service degraded',
    detail: 'Average processing time exceeded 300 ms threshold. Alert auto-raised.',
    actor: 'System (monitor)',
    timestamp: '2026-08-09 16:21:44',
    severity: 'error',
  },
  {
    id: 'al-005',
    action: 'New prescription added',
    detail: 'Bulk import: 47 prescriptions uploaded via CSV for Clinic #004.',
    actor: 'Admin (clinic_ops)',
    timestamp: '2026-08-09 15:09:33',
    severity: 'info',
  },
  {
    id: 'al-006',
    action: 'Failed login attempt',
    detail: 'Repeated failed logins (×5) for account admin@pillsync.io — IP blocked.',
    actor: 'Security guard',
    timestamp: '2026-08-09 14:47:12',
    severity: 'error',
  },
  {
    id: 'al-007',
    action: 'Push config updated',
    detail: 'FCM credentials rotated. Twilio SMS sender pool expanded to 6 numbers.',
    actor: 'Admin (devops)',
    timestamp: '2026-08-09 13:30:55',
    severity: 'info',
  },
  {
    id: 'al-008',
    action: 'User #2301 registered',
    detail: 'New patient onboarded via select-role flow. Email verified.',
    actor: 'System (auth)',
    timestamp: '2026-08-09 12:15:04',
    severity: 'info',
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatNumber(n) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

const COLOR = {
  primary:   { bg: 'bg-primary/10',   text: 'text-primary',   icon: 'bg-primary/15' },
  tertiary:  { bg: 'bg-tertiary/10',  text: 'text-tertiary',  icon: 'bg-tertiary/15' },
  secondary: { bg: 'bg-secondary/10', text: 'text-secondary', icon: 'bg-secondary/15' },
  error:     { bg: 'bg-error/10',     text: 'text-error',     icon: 'bg-error/15' },
};

const STATUS_CONFIG = {
  healthy:  { dot: 'bg-tertiary animate-pulse-slow', label: 'Healthy',  badge: 'taken' },
  degraded: { dot: 'bg-secondary animate-pulse-slow', label: 'Degraded', badge: 'warning' },
  down:     { dot: 'bg-error animate-pulse',         label: 'Down',     badge: 'error' },
};

const SEVERITY_CONFIG = {
  info:    { icon: CheckCircle2, text: 'text-primary',   bg: 'bg-primary/8' },
  warning: { icon: AlertTriangle, text: 'text-secondary', bg: 'bg-secondary/8' },
  error:   { icon: XCircle,      text: 'text-error',     bg: 'bg-error/8' },
};

// ── Sub-components ────────────────────────────────────────────────────────────

/** Top metric KPI card */
function MetricCard({ label, value, delta, period, icon: Icon, color, href }) {
  const c = COLOR[color] ?? COLOR.primary;
  const isPositive = delta > 0;
  const isNeutral  = delta === 0;
  const isDown     = color === 'error'; // for alerts, negative delta = good

  return (
    <Link href={href}>
      <Card
        variant="default"
        padding="md"
        hoverable
        className="group h-full"
      >
        <div className="flex items-start justify-between gap-sm">
          <div className={`w-11 h-11 rounded-xl ${c.icon} flex items-center justify-center shrink-0`}>
            <Icon className={`w-5 h-5 ${c.text}`} />
          </div>
          {/* Delta chip */}
          <div className={[
            'flex items-center gap-0.5 px-xs py-0.5 rounded-full text-[11px] font-bold shrink-0',
            isNeutral
              ? 'bg-surface-container text-on-surface-variant'
              : (isDown ? !isPositive : isPositive)
              ? 'bg-tertiary/10 text-tertiary'
              : 'bg-error/10 text-error',
          ].join(' ')}>
            {isNeutral ? (
              <Minus className="w-3 h-3" />
            ) : (isDown ? !isPositive : isPositive) ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : (
              <ArrowDownRight className="w-3 h-3" />
            )}
            {isPositive ? '+' : ''}{delta}
          </div>
        </div>

        <div className="mt-md">
          <p className="text-headline-sm font-bold text-on-surface leading-none">
            {formatNumber(value)}
          </p>
          <p className="text-caption font-semibold text-on-surface mt-1">{label}</p>
          <p className="text-label-caps text-on-surface-variant mt-0.5">{period}</p>
        </div>

        {/* Hover caret */}
        <ChevronRight className={`absolute top-4 right-4 w-4 h-4 text-outline opacity-0 group-hover:opacity-100 group-hover:${c.text} transition-all`} />
      </Card>
    </Link>
  );
}

/** Single system service row */
function StatusRow({ label, detail, status, value, valueLabel, icon: Icon }) {
  const s = STATUS_CONFIG[status] ?? STATUS_CONFIG.healthy;

  return (
    <div className="flex items-center gap-md py-sm px-md rounded-lg hover:bg-surface-container-low transition-colors">
      {/* Icon */}
      <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-on-surface-variant" />
      </div>

      {/* Labels */}
      <div className="flex-1 min-w-0">
        <p className="text-caption font-semibold text-on-surface">{label}</p>
        <p className="text-label-caps text-on-surface-variant truncate">{detail}</p>
      </div>

      {/* Metric value */}
      <div className="text-right shrink-0 hidden sm:block">
        <p className="text-caption font-bold text-on-surface">{value}</p>
        <p className="text-label-caps text-on-surface-variant">{valueLabel}</p>
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-xs shrink-0">
        <span className={`w-2 h-2 rounded-full ${s.dot}`} />
        <Badge variant={s.badge} size="xs">{s.label}</Badge>
      </div>
    </div>
  );
}

/** Quick nav card */
function NavCard({ href, icon: Icon, title, desc, color, badge, badgeVariant = 'default' }) {
  const c = COLOR[color] ?? COLOR.primary;

  return (
    <Link href={href} className="block group">
      <Card variant="default" padding="md" hoverable className="h-full">
        <div className="flex items-start justify-between gap-sm">
          <div className={`w-10 h-10 rounded-xl ${c.icon} flex items-center justify-center shrink-0`}>
            <Icon className={`w-5 h-5 ${c.text}`} />
          </div>
          {badge && (
            <Badge variant={badgeVariant} size="xs">{badge}</Badge>
          )}
        </div>
        <h3 className="text-caption font-bold text-on-surface mt-md">{title}</h3>
        <p className="text-label-caps text-on-surface-variant mt-1 leading-relaxed">{desc}</p>
        <div className={`flex items-center gap-1 mt-sm text-label-caps font-semibold ${c.text} opacity-0 group-hover:opacity-100 transition-opacity`}>
          Open <ChevronRight className="w-3 h-3" />
        </div>
      </Card>
    </Link>
  );
}

/** Audit log table row */
function AuditRow({ action, detail, actor, timestamp, severity }) {
  const s = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG.info;
  const SIcon = s.icon;

  return (
    <tr className="group hover:bg-surface-container-low transition-colors">
      <td className="py-sm px-md whitespace-nowrap">
        <div className={`w-7 h-7 rounded-full ${s.bg} flex items-center justify-center`}>
          <SIcon className={`w-3.5 h-3.5 ${s.text}`} />
        </div>
      </td>
      <td className="py-sm px-md">
        <p className="text-caption font-semibold text-on-surface whitespace-nowrap">{action}</p>
        <p className="text-label-caps text-on-surface-variant max-w-xs truncate">{detail}</p>
      </td>
      <td className="py-sm px-md whitespace-nowrap hidden md:table-cell">
        <span className="text-label-caps text-on-surface-variant">{actor}</span>
      </td>
      <td className="py-sm px-md whitespace-nowrap text-right">
        <div className="flex items-center justify-end gap-1 text-label-caps text-on-surface-variant">
          <Clock className="w-3 h-3" />
          {timestamp.split(' ')[1]}
        </div>
        <p className="text-[10px] text-on-surface-variant/60 text-right">{timestamp.split(' ')[0]}</p>
      </td>
    </tr>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const [auditFilter, setAuditFilter] = useState('all');
  const [lastRefreshed, setLastRefreshed] = useState('');
  const [liveMetrics, setLiveMetrics] = useState(DEFAULT_METRICS);
  const [totalUserCount, setTotalUserCount] = useState(0);

  // Fetch live stats from backend
  useEffect(() => {
    setLastRefreshed(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    (async () => {
      try {
        const [usersRes, medsRes] = await Promise.allSettled([
          adminAPI.getUsers(),
          medicineAPI.list(),
        ]);

        const usersList = usersRes.status === 'fulfilled' && Array.isArray(usersRes.value)
          ? usersRes.value
          : (usersRes.status === 'fulfilled' && usersRes.value?.items ? usersRes.value.items : []);
        
        const medsList = medsRes.status === 'fulfilled' && Array.isArray(medsRes.value)
          ? medsRes.value
          : (medsRes.status === 'fulfilled' && medsRes.value?.items ? medsRes.value.items : []);

        const patientCount = usersList.filter((u) => u.role === 'patient').length;
        const caregiverCount = usersList.filter((u) => u.role === 'caregiver').length;
        const medCount = medsList.length;

        setTotalUserCount(usersList.length);

        setLiveMetrics([
          {
            id: 'patients',
            label: 'Active Patients',
            value: patientCount,
            delta: patientCount > 0 ? patientCount : 0,
            period: 'registered accounts',
            icon: Users,
            color: 'primary',
            href: '/admin/users?role=patient',
          },
          {
            id: 'caregivers',
            label: 'Total Caregivers',
            value: caregiverCount,
            delta: caregiverCount > 0 ? caregiverCount : 0,
            period: 'registered accounts',
            icon: Heart,
            color: 'tertiary',
            href: '/admin/users?role=caregiver',
          },
          {
            id: 'prescriptions',
            label: 'Prescriptions Tracked',
            value: medCount,
            delta: medCount > 0 ? medCount : 0,
            period: 'in catalog',
            icon: FileText,
            color: 'secondary',
            href: '/medicines',
          },
          {
            id: 'alerts',
            label: 'System Status',
            value: 0,
            delta: 0,
            period: '0 critical incidents',
            icon: AlertTriangle,
            color: 'error',
            href: '/admin/health',
          },
        ]);
        setLastRefreshed(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
      } catch (err) {
        console.error('Failed to fetch admin stats:', err);
      }
    })();
  }, []);

  const healthyCount  = SYSTEM_STATUS.filter((s) => s.status === 'healthy').length;
  const degradedCount = SYSTEM_STATUS.filter((s) => s.status === 'degraded').length;
  const downCount     = SYSTEM_STATUS.filter((s) => s.status === 'down').length;
  const allHealthy    = degradedCount === 0 && downCount === 0;

  const filteredAudit = useMemo(() => {
    if (auditFilter === 'all') return AUDIT_LOG;
    return AUDIT_LOG.filter((e) => e.severity === auditFilter);
  }, [auditFilter]);

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
        {/* ── Top Actions Bar ────────────────────────────────────────── */}
        <div className="border-b border-outline-variant/30 bg-surface-container-lowest/60 backdrop-blur-md px-gutter py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Badge variant="admin" size="sm">Admin Portal</Badge>
              <div className="hidden sm:flex items-center gap-xs px-2.5 py-1 rounded-full bg-surface-container border border-outline-variant/50 text-[11px] text-on-surface-variant">
                <RefreshCw className="w-3 h-3" />
                Refreshed {lastRefreshed}
              </div>
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

        <main className="max-w-7xl mx-auto px-gutter py-lg space-y-lg">

        {/* ── Page Header ───────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
          <div>
            <p className="text-label-caps text-on-surface-variant uppercase tracking-wider">
              {getGreeting()}, Superuser
            </p>
            <h1 className="text-headline-sm font-bold text-on-surface mt-0.5">
              Admin Overview
            </h1>
            <p className="text-caption text-on-surface-variant mt-1">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
              })}
            </p>
          </div>
          <div className="flex items-center gap-sm">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<RefreshCw className="w-4 h-4" />}
              onClick={() => window.location.reload()}
            >
              Refresh Data
            </Button>
          </div>
        </div>

        {/* ── 1. Key Metric Cards ────────────────────────────────────────── */}
        <section>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-md">
            {liveMetrics.map((m) => (
              <MetricCard key={m.id} {...m} />
            ))}
          </div>
        </section>

        {/* ── 2. System Quick Status Strip ──────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-md">
            <div className="flex items-center gap-sm">
              <h2 className="text-body-sm font-bold text-on-surface">System Status</h2>
              {allHealthy ? (
                <Badge variant="taken" size="xs" dot>All Systems Operational</Badge>
              ) : (
                <Badge variant="warning" size="xs" dot>{degradedCount} Degraded</Badge>
              )}
            </div>
            <Link href="/admin/health">
              <Button variant="ghost" size="sm" rightIcon={<ChevronRight className="w-4 h-4" />}>
                Full Report
              </Button>
            </Link>
          </div>

          <Card variant="default" padding="none" className="overflow-hidden divide-y divide-outline-variant/30">
            {/* Summary strip */}
            <div className="flex items-center justify-between px-md py-sm bg-surface-container-low">
              <div className="flex items-center gap-md text-label-caps">
                <span className="flex items-center gap-1.5 text-tertiary font-semibold">
                  <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse-slow" />
                  {healthyCount} healthy
                </span>
                {degradedCount > 0 && (
                  <span className="flex items-center gap-1.5 text-secondary font-semibold">
                    <span className="w-2 h-2 rounded-full bg-secondary animate-pulse-slow" />
                    {degradedCount} degraded
                  </span>
                )}
                {downCount > 0 && (
                  <span className="flex items-center gap-1.5 text-error font-semibold">
                    <span className="w-2 h-2 rounded-full bg-error animate-pulse" />
                    {downCount} down
                  </span>
                )}
              </div>
              <span className="text-label-caps text-on-surface-variant">
                {SYSTEM_STATUS.length} services monitored
              </span>
            </div>

            {/* Service rows */}
            <div className="divide-y divide-outline-variant/20 px-xs py-xs">
              {SYSTEM_STATUS.map((svc) => (
                <StatusRow key={svc.id} {...svc} />
              ))}
            </div>
          </Card>
        </section>

        {/* ── 3. Quick Navigation Hub ───────────────────────────────────── */}
        <section>
          <h2 className="text-body-sm font-bold text-on-surface mb-md">Quick Navigation</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-md">
            {NAV_CARDS.map((card) => (
              <NavCard key={card.href + card.title} {...card} />
            ))}
          </div>
        </section>

        {/* ── 4. Audit Trail Table ──────────────────────────────────────── */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md mb-md">
            <h2 className="text-body-sm font-bold text-on-surface">
              Recent Audit Trail
            </h2>

            {/* Severity filter pills */}
            <div className="flex items-center gap-xs">
              {['all', 'info', 'warning', 'error'].map((f) => (
                <button
                  key={f}
                  onClick={() => setAuditFilter(f)}
                  className={[
                    'px-sm py-0.5 rounded-full text-label-caps font-semibold capitalize border transition-all',
                    auditFilter === f
                      ? f === 'error'   ? 'bg-error text-on-error border-error'
                      : f === 'warning' ? 'bg-secondary text-on-secondary border-secondary'
                      : f === 'info'    ? 'bg-primary text-on-primary border-primary'
                      : 'bg-on-surface text-surface border-on-surface'
                      : 'bg-transparent text-on-surface-variant border-outline-variant/50 hover:border-outline',
                  ].join(' ')}
                >
                  {f}
                </button>
              ))}
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Download className="w-3.5 h-3.5" />}
                className="ml-xs"
                onClick={() => exportAPI.allCSV()}
              >
                Export
              </Button>
            </div>
          </div>

          <Card variant="default" padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-outline-variant/40 bg-surface-container-low">
                    <th className="py-sm px-md w-10" />
                    <th className="py-sm px-md text-label-caps font-semibold text-on-surface-variant uppercase tracking-wider">
                      Action
                    </th>
                    <th className="py-sm px-md text-label-caps font-semibold text-on-surface-variant uppercase tracking-wider hidden md:table-cell">
                      Actor
                    </th>
                    <th className="py-sm px-md text-label-caps font-semibold text-on-surface-variant uppercase tracking-wider text-right">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {filteredAudit.map((entry) => (
                    <AuditRow key={entry.id} {...entry} />
                  ))}
                </tbody>
              </table>

              {filteredAudit.length === 0 && (
                <div className="text-center py-xl text-on-surface-variant">
                  <Filter className="w-8 h-8 mx-auto mb-sm opacity-40" />
                  <p className="text-caption">No {auditFilter} events in the log.</p>
                </div>
              )}
            </div>

            {/* Load more */}
            <div className="border-t border-outline-variant/40 px-md py-sm flex items-center justify-between">
              <p className="text-label-caps text-on-surface-variant">
                Showing {filteredAudit.length} of {AUDIT_LOG.length} entries
              </p>
              <Button variant="ghost" size="sm" rightIcon={<ChevronRight className="w-4 h-4" />}>
                View Full Audit Log
              </Button>
            </div>
          </Card>
        </section>

        {/* ── Emergency Disclaimer ──────────────────────────────────────── */}
        <div className="p-sm rounded-md bg-error-container/30 border border-error/20 text-center">
          <p className="text-caption text-error font-medium">
            ⚠️ Admin access is logged. Unauthorised actions may result in account suspension.
            In case of a security incident, contact{' '}
            <a href="mailto:security@pillsync.io" className="font-bold underline">
              security@pillsync.io
            </a>{' '}
            immediately.
          </p>
        </div>
      </main>
      </div>
    </DashboardLayout>
  );
}
