'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Database,
  Server,
  Layers,
  ScanLine,
  MessageSquare,
  Cpu,
  MemoryStick,
  Timer,
  Network,
  RefreshCw,
  Trash2,
  Radio,
  Download,
  ChevronRight,
  ChevronLeft,
  Bell,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  Wifi,
  WifiOff,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { ToastProvider, useToast } from '@/components/ui/Toast';

// ── Constants ─────────────────────────────────────────────────────────────────

const AUTO_REFRESH_INTERVAL = 30_000; // 30 s

// ── Mock Data ─────────────────────────────────────────────────────────────────
// TODO: replace with GET /admin/health, /admin/metrics, /admin/incidents

const SERVICES_INITIAL = [
  {
    id: 'postgres',
    label: 'PostgreSQL Database',
    detail: 'Primary cluster · pg-prod-01 · v15.4',
    icon: Database,
    status: 'healthy',
    metrics: { latency: '4 ms', connections: '12/100', uptime: '99.98%' },
    lastChecked: '12 s ago',
  },
  {
    id: 'fastapi',
    label: 'FastAPI Server',
    detail: 'uvicorn · 4 workers · v0.103',
    icon: Server,
    status: 'healthy',
    metrics: { latency: '24 ms', rps: '148 req/s', uptime: '99.95%' },
    lastChecked: '12 s ago',
  },
  {
    id: 'redis',
    label: 'Redis Queue / Cache',
    detail: 'Session store · rate-limit · job queue',
    icon: Layers,
    status: 'healthy',
    metrics: { latency: '1 ms', keys: '8,431', memory: '124 MB' },
    lastChecked: '12 s ago',
  },
  {
    id: 'ocr',
    label: 'OCR / AI Pipeline',
    detail: 'Tesseract 5.3 + spaCy NER · GPU disabled',
    icon: ScanLine,
    status: 'degraded',
    metrics: { latency: '340 ms', throughput: '3 docs/min', uptime: '97.12%' },
    lastChecked: '12 s ago',
  },
  {
    id: 'twilio',
    label: 'Twilio / SMS Gateway',
    detail: 'FCM push · Twilio SMS · 6 sender pool',
    icon: MessageSquare,
    status: 'healthy',
    metrics: { deliveryRate: '98.7%', queued: '14', failedLast24h: '2' },
    lastChecked: '12 s ago',
  },
];

const SERVER_METRICS_INITIAL = [
  {
    id: 'cpu',
    label: 'CPU Load',
    value: 42,
    unit: '%',
    max: 100,
    icon: Cpu,
    trend: 'up',
    thresholdWarn: 70,
    thresholdCrit: 90,
    sparkline: [28, 33, 38, 35, 42, 45, 42],
  },
  {
    id: 'memory',
    label: 'Memory Usage',
    value: 61,
    unit: '%',
    max: 100,
    icon: MemoryStick,
    trend: 'stable',
    thresholdWarn: 75,
    thresholdCrit: 90,
    detail: '4.9 GB / 8 GB',
    sparkline: [55, 58, 60, 59, 62, 61, 61],
  },
  {
    id: 'latency',
    label: 'API Response Latency',
    value: 24,
    unit: 'ms',
    max: 500,
    icon: Timer,
    trend: 'down',
    thresholdWarn: 200,
    thresholdCrit: 400,
    sparkline: [38, 32, 29, 45, 26, 28, 24],
  },
  {
    id: 'pool',
    label: 'DB Connection Pool',
    value: 12,
    unit: ' / 100',
    max: 100,
    icon: Network,
    trend: 'stable',
    thresholdWarn: 75,
    thresholdCrit: 90,
    sparkline: [10, 11, 13, 12, 14, 12, 12],
  },
];

const INCIDENTS_INITIAL = [
  {
    id: 'inc-001',
    timestamp: '2026-08-09 17:44:02',
    service: 'OCR / AI Pipeline',
    level: 'warning',
    message: 'Average processing time exceeded 300 ms threshold (340 ms). Auto-scaling not triggered.',
    resolved: false,
  },
  {
    id: 'inc-002',
    timestamp: '2026-08-09 16:21:44',
    service: 'Twilio / SMS Gateway',
    level: 'warning',
    message: '2 SMS delivery failures in last 24 h. Carrier timeout on IN-MH region numbers.',
    resolved: true,
  },
  {
    id: 'inc-003',
    timestamp: '2026-08-09 14:47:12',
    service: 'FastAPI Server',
    level: 'critical',
    message: 'Repeated failed login attempts (×5) from 192.168.43.21. IP blocked via fail2ban.',
    resolved: true,
  },
  {
    id: 'inc-004',
    timestamp: '2026-08-09 12:05:33',
    service: 'PostgreSQL Database',
    level: 'warning',
    message: 'Slow query detected: SELECT on medications table took 1.8 s. Index hint applied.',
    resolved: true,
  },
  {
    id: 'inc-005',
    timestamp: '2026-08-09 09:30:00',
    service: 'Redis Queue / Cache',
    level: 'info',
    message: 'Scheduled cache flush completed. 8,431 keys reloaded from warm-up strategy.',
    resolved: true,
  },
  {
    id: 'inc-006',
    timestamp: '2026-08-08 23:58:11',
    service: 'FastAPI Server',
    level: 'critical',
    message: 'Worker #3 restarted after OOM kill signal. Memory spike from OCR batch job.',
    resolved: true,
  },
  {
    id: 'inc-007',
    timestamp: '2026-08-08 18:12:49',
    service: 'Twilio / SMS Gateway',
    level: 'info',
    message: 'FCM credentials successfully rotated. Old tokens expired and purged.',
    resolved: true,
  },
];

// ── Status Config ─────────────────────────────────────────────────────────────

const STATUS = {
  healthy:  { dot: 'bg-tertiary', ring: 'ring-tertiary/20',  badge: 'taken',   label: 'Healthy',  Icon: CheckCircle2 },
  degraded: { dot: 'bg-secondary', ring: 'ring-secondary/20', badge: 'warning', label: 'Degraded', Icon: AlertTriangle },
  down:     { dot: 'bg-error',    ring: 'ring-error/20',     badge: 'error',   label: 'Down',     Icon: XCircle },
};

const LEVEL = {
  critical: { badge: 'error',   Icon: XCircle,      text: 'text-error',     bg: 'bg-error/8' },
  warning:  { badge: 'warning', Icon: AlertTriangle, text: 'text-secondary', bg: 'bg-secondary/8' },
  info:     { badge: 'default', Icon: CheckCircle2,  text: 'text-primary',   bg: 'bg-primary/8' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function metricLevel(value, warn, crit, isLatency = false) {
  // For latency/pool: higher = worse; raw percentage comparisons
  const pct = isLatency ? (value / 500) * 100 : value;
  if (pct >= crit) return 'crit';
  if (pct >= warn) return 'warn';
  return 'ok';
}

function barColor(value, warn, crit) {
  if (value >= crit) return 'bg-error';
  if (value >= warn) return 'bg-secondary';
  return 'bg-tertiary';
}

// ── Sparkline SVG ─────────────────────────────────────────────────────────────

function Sparkline({ data = [], color = '#00685f', height = 28, width = 72 }) {
  if (!data.length) return null;
  const max  = Math.max(...data, 1);
  const min  = Math.min(...data);
  const range = max - min || 1;
  const step  = width / (data.length - 1);

  const points = data
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} aria-hidden="true">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        opacity="0.7"
      />
    </svg>
  );
}

// ── Service Status Card ───────────────────────────────────────────────────────

function ServiceCard({ service, onPing }) {
  const s = STATUS[service.status] ?? STATUS.healthy;
  const { Icon: SIcon } = s;
  const ServiceIcon = service.icon;
  const [pinging, setPinging] = useState(false);

  async function handlePing() {
    setPinging(true);
    await new Promise((r) => setTimeout(r, 1200));
    setPinging(false);
    onPing?.(service.id);
  }

  return (
    <Card variant="default" padding="md" className="space-y-sm group">
      {/* Header */}
      <div className="flex items-start justify-between gap-sm">
        <div className="flex items-center gap-sm">
          {/* Status ring + pulsing dot */}
          <div className={`relative w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center ring-2 ${s.ring}`}>
            <ServiceIcon className="w-5 h-5 text-on-surface-variant" />
            <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${s.dot} border-2 border-surface-container-lowest ${service.status === 'healthy' ? 'animate-pulse-slow' : 'animate-pulse'}`} />
          </div>
          <div>
            <p className="text-caption font-bold text-on-surface leading-tight">{service.label}</p>
            <p className="text-label-caps text-on-surface-variant truncate max-w-[160px]">{service.detail}</p>
          </div>
        </div>
        <Badge variant={s.badge} size="xs">
          <SIcon className="w-3 h-3 mr-0.5" />
          {s.label}
        </Badge>
      </div>

      {/* Metrics row */}
      <div className="flex flex-wrap gap-xs pt-xs border-t border-outline-variant/30">
        {Object.entries(service.metrics).map(([k, v]) => (
          <div key={k} className="flex-1 min-w-[60px] bg-surface-container-low rounded-md px-xs py-1 text-center">
            <p className="text-[11px] font-bold text-on-surface leading-none">{v}</p>
            <p className="text-[9px] text-on-surface-variant uppercase tracking-wide mt-0.5">{k}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-label-caps text-on-surface-variant pt-xs">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Checked {service.lastChecked}
        </div>
        <button
          onClick={handlePing}
          disabled={pinging}
          className="flex items-center gap-0.5 text-primary hover:text-primary-container transition-colors disabled:opacity-50"
        >
          {pinging
            ? <RefreshCw className="w-3 h-3 animate-spin" />
            : <Radio className="w-3 h-3" />
          }
          {pinging ? 'Pinging…' : 'Ping'}
        </button>
      </div>
    </Card>
  );
}

// ── Server Metric Card ────────────────────────────────────────────────────────

function MetricCard({ metric }) {
  const MetricIcon = metric.icon;
  const rawPct    = metric.unit === '%' ? metric.value : Math.round((metric.value / metric.max) * 100);
  const lvl       = metricLevel(rawPct, metric.thresholdWarn, metric.thresholdCrit);
  const bar       = barColor(rawPct, metric.thresholdWarn, metric.thresholdCrit);
  const TrendIcon = metric.trend === 'up' ? TrendingUp : metric.trend === 'down' ? TrendingDown : Minus;
  const trendColor = metric.trend === 'up'
    ? (metric.id === 'latency' ? 'text-secondary' : 'text-error')
    : metric.trend === 'down'
    ? (metric.id === 'latency' ? 'text-tertiary' : 'text-error')
    : 'text-on-surface-variant';

  // Sparkline colour
  const sparkColor = lvl === 'crit' ? '#ba1a1a' : lvl === 'warn' ? '#855300' : '#006947';

  return (
    <Card variant="default" padding="md">
      <div className="flex items-start justify-between gap-sm mb-sm">
        <div className="flex items-center gap-xs">
          <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center">
            <MetricIcon className="w-4 h-4 text-on-surface-variant" />
          </div>
          <p className="text-caption font-semibold text-on-surface">{metric.label}</p>
        </div>
        <Sparkline data={metric.sparkline} color={sparkColor} />
      </div>

      {/* Big value */}
      <div className="flex items-end gap-xs mb-sm">
        <p className={`text-headline-sm font-bold leading-none ${
          lvl === 'crit' ? 'text-error' : lvl === 'warn' ? 'text-secondary' : 'text-on-surface'
        }`}>
          {metric.value}
          <span className="text-body-sm font-normal text-on-surface-variant ml-0.5">{metric.unit}</span>
        </p>
        <div className={`flex items-center gap-0.5 ${trendColor} mb-0.5`}>
          <TrendIcon className="w-3.5 h-3.5" />
          <span className="text-label-caps font-semibold">{metric.trend}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${bar}`}
            style={{ width: `${Math.min(rawPct, 100)}%` }}
            role="progressbar"
            aria-valuenow={rawPct}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        <div className="flex justify-between text-label-caps text-on-surface-variant">
          <span>{metric.detail ?? `${rawPct}% utilisation`}</span>
          <span>
            {lvl === 'crit' ? '🔴 Critical' : lvl === 'warn' ? '🟡 Warning' : '🟢 Normal'}
          </span>
        </div>
      </div>

      {/* Threshold markers */}
      <div className="flex gap-xs mt-xs flex-wrap">
        <span className="text-label-caps text-on-surface-variant">
          Warn ≥ {metric.thresholdWarn}% · Crit ≥ {metric.thresholdCrit}%
        </span>
      </div>
    </Card>
  );
}

// ── Incident Row ──────────────────────────────────────────────────────────────

function IncidentRow({ incident }) {
  const lv = LEVEL[incident.level] ?? LEVEL.info;
  const LIcon = lv.Icon;

  return (
    <tr className="group hover:bg-surface-container-low/60 transition-colors">
      {/* Severity icon */}
      <td className="py-sm px-md w-10">
        <div className={`w-7 h-7 rounded-full ${lv.bg} flex items-center justify-center`}>
          <LIcon className={`w-3.5 h-3.5 ${lv.text}`} />
        </div>
      </td>

      {/* Timestamp */}
      <td className="py-sm px-md whitespace-nowrap">
        <div className="flex items-center gap-1 text-label-caps text-on-surface-variant">
          <Clock className="w-3 h-3" />
          {incident.timestamp.split(' ')[1]}
        </div>
        <p className="text-[10px] text-on-surface-variant/60 mt-0.5">
          {incident.timestamp.split(' ')[0]}
        </p>
      </td>

      {/* Service */}
      <td className="py-sm px-md whitespace-nowrap hidden sm:table-cell">
        <span className="text-caption font-semibold text-on-surface">{incident.service}</span>
      </td>

      {/* Level */}
      <td className="py-sm px-md whitespace-nowrap">
        <Badge variant={lv.badge} size="xs">{incident.level}</Badge>
      </td>

      {/* Message */}
      <td className="py-sm px-md">
        <p className="text-caption text-on-surface-variant leading-tight line-clamp-2 max-w-lg">
          {incident.message}
        </p>
        <p className="sm:hidden text-label-caps text-on-surface-variant/70 mt-0.5">
          {incident.service}
        </p>
      </td>

      {/* Resolved */}
      <td className="py-sm px-md whitespace-nowrap text-right">
        {incident.resolved ? (
          <Badge variant="taken" size="xs">Resolved</Badge>
        ) : (
          <Badge variant="error" size="xs" dot>Active</Badge>
        )}
      </td>
    </tr>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function AdminHealthPageInner() {
  const { addToast } = useToast();
  const [services,       setServices]       = useState(SERVICES_INITIAL);
  const [serverMetrics,  setServerMetrics]  = useState(SERVER_METRICS_INITIAL);
  const [incidents,      setIncidents]      = useState(INCIDENTS_INITIAL);
  const [levelFilter,    setLevelFilter]    = useState('all');
  const [incPage,        setIncPage]        = useState(1);
  const INC_PAGE_SIZE = 5;

  // ── Auto-refresh countdown ────────────────────────────────────────────────
  const [countdown, setCountdown] = useState(AUTO_REFRESH_INTERVAL / 1000);
  const timerRef = useRef(null);

  const doRefresh = useCallback(() => {
    // Simulate a small CPU/latency jitter so the page looks live
    setServerMetrics((prev) =>
      prev.map((m) => ({
        ...m,
        value: Math.max(
          1,
          Math.min(
            m.id === 'latency' ? 500 : 99,
            m.value + Math.round((Math.random() - 0.5) * 6)
          )
        ),
        sparkline: [...m.sparkline.slice(1), m.value],
      }))
    );
    setServices((prev) =>
      prev.map((s) => ({ ...s, lastChecked: '< 1 s ago' }))
    );
    setCountdown(AUTO_REFRESH_INTERVAL / 1000);
  }, []);

  // Start countdown timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { doRefresh(); return AUTO_REFRESH_INTERVAL / 1000; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [doRefresh]);

  // ── Action handlers ───────────────────────────────────────────────────────
  const [actionState, setActionState] = useState({
    clearCache: 'idle',  // idle | loading | done
    ping:       'idle',
    download:   'idle',
  });

  async function handleAction(key, delay = 1200) {
    setActionState((p) => ({ ...p, [key]: 'loading' }));
    await new Promise((r) => setTimeout(r, delay));
    setActionState((p) => ({ ...p, [key]: 'done' }));

    if (key === 'clearCache') {
      addToast({
        title: 'Cache Flushed',
        description: 'Redis session cache & rate-limit keys have been purged.',
        variant: 'success',
      });
    } else if (key === 'ping') {
      addToast({
        title: 'Ping Successful',
        description: 'All 5 backend clusters responded with 200 OK (avg 24ms).',
        variant: 'success',
      });
    } else if (key === 'download') {
      addToast({
        title: 'Logs Exported',
        description: 'System infrastructure diagnostics archive generated.',
        variant: 'info',
      });
    }

    setTimeout(() => setActionState((p) => ({ ...p, [key]: 'idle' })), 2500);
  }

  function handleServicePing(serviceId) {
    console.log('Pinged service:', serviceId);
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const healthyCount  = services.filter((s) => s.status === 'healthy').length;
  const degradedCount = services.filter((s) => s.status === 'degraded').length;
  const downCount     = services.filter((s) => s.status === 'down').length;
  const openIncidents = incidents.filter((i) => !i.resolved).length;

  const filteredIncidents = incidents.filter(
    (i) => levelFilter === 'all' || i.level === levelFilter
  );
  const totalIncPages = Math.max(1, Math.ceil(filteredIncidents.length / INC_PAGE_SIZE));
  const safeIncPage   = Math.min(incPage, totalIncPages);
  const incSlice      = filteredIncidents.slice(
    (safeIncPage - 1) * INC_PAGE_SIZE,
    safeIncPage * INC_PAGE_SIZE
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
        <main className="max-w-7xl mx-auto px-gutter py-lg space-y-lg">

        {/* ── Page Header ─────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
          <div>
            <h1 className="text-headline-sm font-bold text-on-surface">System Health Monitor</h1>
            <p className="text-caption text-on-surface-variant mt-0.5">
              Real-time infrastructure status · auto-refreshes every {AUTO_REFRESH_INTERVAL / 1000} s
            </p>
          </div>

          {/* 4. Action Controls */}
          <div className="flex flex-wrap items-center gap-sm">
            {/* Clear Cache */}
            <Button
              variant="outline"
              size="sm"
              leftIcon={
                actionState.clearCache === 'loading'
                  ? <RefreshCw className="w-4 h-4 animate-spin" />
                  : actionState.clearCache === 'done'
                  ? <CheckCircle2 className="w-4 h-4 text-tertiary" />
                  : <Trash2 className="w-4 h-4" />
              }
              onClick={() => handleAction('clearCache', 1500)}
              disabled={actionState.clearCache === 'loading'}
            >
              {actionState.clearCache === 'loading' ? 'Clearing…'
               : actionState.clearCache === 'done'  ? 'Cache Cleared!'
               : 'Clear Cache'}
            </Button>

            {/* Test API Ping */}
            <Button
              variant="outline"
              size="sm"
              leftIcon={
                actionState.ping === 'loading'
                  ? <Radio className="w-4 h-4 animate-pulse" />
                  : actionState.ping === 'done'
                  ? <Wifi className="w-4 h-4 text-tertiary" />
                  : <Radio className="w-4 h-4" />
              }
              onClick={() => { handleAction('ping', 1000); doRefresh(); }}
              disabled={actionState.ping === 'loading'}
            >
              {actionState.ping === 'loading' ? 'Pinging…'
               : actionState.ping === 'done'  ? 'Ping OK!'
               : 'Test API Ping'}
            </Button>

            {/* Download Audit Log */}
            <Button
              variant="primary"
              size="sm"
              leftIcon={
                actionState.download === 'loading'
                  ? <RefreshCw className="w-4 h-4 animate-spin" />
                  : <Download className="w-4 h-4" />
              }
              onClick={() => handleAction('download', 2000)}
              disabled={actionState.download === 'loading'}
            >
              {actionState.download === 'loading' ? 'Preparing…'
               : actionState.download === 'done'  ? 'Downloaded!'
               : 'Download Audit Log'}
            </Button>
          </div>
        </div>

        {/* ── Overall Health Banner ─────────────────────────────────────── */}
        <div className={[
          'rounded-lg p-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-md border',
          downCount > 0
            ? 'bg-error/8 border-error/30'
            : degradedCount > 0
            ? 'bg-secondary/8 border-secondary/30'
            : 'bg-tertiary/8 border-tertiary/30',
        ].join(' ')}>
          <div className="flex items-center gap-sm">
            {downCount > 0
              ? <WifiOff className="w-6 h-6 text-error shrink-0" />
              : degradedCount > 0
              ? <AlertTriangle className="w-6 h-6 text-secondary shrink-0" />
              : <Activity className="w-6 h-6 text-tertiary shrink-0" />
            }
            <div>
              <p className={`text-body-sm font-bold ${downCount > 0 ? 'text-error' : degradedCount > 0 ? 'text-secondary' : 'text-tertiary'}`}>
                {downCount > 0
                  ? `${downCount} service${downCount > 1 ? 's' : ''} down`
                  : degradedCount > 0
                  ? `${degradedCount} service degraded — monitoring`
                  : 'All Systems Operational'}
              </p>
              <p className="text-label-caps text-on-surface-variant mt-0.5">
                {healthyCount}/{services.length} services healthy · {openIncidents} active incident{openIncidents !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex gap-xs shrink-0">
            <Badge variant="taken"   size="sm">{healthyCount} Healthy</Badge>
            {degradedCount > 0 && <Badge variant="warning" size="sm">{degradedCount} Degraded</Badge>}
            {downCount     > 0 && <Badge variant="error"   size="sm">{downCount} Down</Badge>}
          </div>
        </div>

        {/* ── 1. Service Status Cards ──────────────────────────────────── */}
        <section>
          <h2 className="text-body-sm font-bold text-on-surface mb-md">Service Status</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-md">
            {services.map((svc) => (
              <ServiceCard key={svc.id} service={svc} onPing={handleServicePing} />
            ))}
          </div>
        </section>

        {/* ── 2. Server Metrics Cards ──────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-md">
            <h2 className="text-body-sm font-bold text-on-surface">Server Metrics</h2>
            <button
              onClick={doRefresh}
              className="flex items-center gap-1 text-label-caps text-primary hover:text-primary-container transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh Now
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-md">
            {serverMetrics.map((m) => (
              <MetricCard key={m.id} metric={m} />
            ))}
          </div>
        </section>

        {/* ── 3. Incident & Error Log Table ───────────────────────────── */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md mb-md">
            <h2 className="text-body-sm font-bold text-on-surface">
              Incident Log
              {openIncidents > 0 && (
                <Badge variant="error" size="xs" className="ml-sm">{openIncidents} active</Badge>
              )}
            </h2>

            {/* Level filter pills */}
            <div className="flex items-center gap-xs flex-wrap">
              {['all', 'critical', 'warning', 'info'].map((f) => (
                <button
                  key={f}
                  onClick={() => { setLevelFilter(f); setIncPage(1); }}
                  className={[
                    'px-sm py-0.5 rounded-full text-label-caps font-semibold capitalize border transition-all',
                    levelFilter === f
                      ? f === 'critical' ? 'bg-error text-on-error border-error'
                      : f === 'warning'  ? 'bg-secondary text-on-secondary border-secondary'
                      : f === 'info'     ? 'bg-primary text-on-primary border-primary'
                      : 'bg-on-surface text-surface border-on-surface'
                      : 'bg-transparent text-on-surface-variant border-outline-variant/50 hover:border-outline',
                  ].join(' ')}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <Card variant="default" padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[600px]">
                <thead>
                  <tr className="border-b border-outline-variant/40 bg-surface-container-low">
                    <th className="py-sm px-md w-10" />
                    <th className="py-sm px-md text-label-caps font-semibold text-on-surface-variant uppercase tracking-wider whitespace-nowrap">
                      Timestamp
                    </th>
                    <th className="py-sm px-md text-label-caps font-semibold text-on-surface-variant uppercase tracking-wider hidden sm:table-cell">
                      Service
                    </th>
                    <th className="py-sm px-md text-label-caps font-semibold text-on-surface-variant uppercase tracking-wider">
                      Level
                    </th>
                    <th className="py-sm px-md text-label-caps font-semibold text-on-surface-variant uppercase tracking-wider">
                      Details
                    </th>
                    <th className="py-sm px-md text-label-caps font-semibold text-on-surface-variant uppercase tracking-wider text-right">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {incSlice.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-xl text-center">
                        <CheckCircle2 className="w-10 h-10 mx-auto text-tertiary/50 mb-sm" />
                        <p className="text-caption text-on-surface-variant">
                          No {levelFilter !== 'all' ? levelFilter : ''} incidents logged.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    incSlice.map((inc) => <IncidentRow key={inc.id} incident={inc} />)
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="border-t border-outline-variant/40 px-md py-sm flex flex-col sm:flex-row items-center justify-between gap-sm">
              <p className="text-label-caps text-on-surface-variant">
                Showing{' '}
                <span className="font-semibold text-on-surface">
                  {filteredIncidents.length === 0 ? 0 : (safeIncPage - 1) * INC_PAGE_SIZE + 1}–
                  {Math.min(safeIncPage * INC_PAGE_SIZE, filteredIncidents.length)}
                </span>{' '}
                of <span className="font-semibold text-on-surface">{filteredIncidents.length}</span> events
              </p>
              <div className="flex items-center gap-xs">
                <Button
                  variant="outline" size="sm"
                  leftIcon={<ChevronLeft className="w-4 h-4" />}
                  disabled={safeIncPage <= 1}
                  onClick={() => setIncPage((p) => p - 1)}
                >
                  Prev
                </Button>
                <span className="text-caption text-on-surface-variant px-xs">
                  {safeIncPage} / {totalIncPages}
                </span>
                <Button
                  variant="outline" size="sm"
                  rightIcon={<ChevronRight className="w-4 h-4" />}
                  disabled={safeIncPage >= totalIncPages}
                  onClick={() => setIncPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </Card>
        </section>

        {/* ── Security disclaimer ───────────────────────────────────────── */}
        <div className="p-sm rounded-md bg-error-container/30 border border-error/20 text-center">
          <p className="text-caption text-error font-medium">
            ⚠️ Admin access is logged. All actions on this panel are recorded in the audit trail.
            For security incidents, contact{' '}
            <a href="mailto:security@pillsync.io" className="font-bold underline">
              security@pillsync.io
            </a>
            {' '}immediately.
          </p>
        </div>
      </main>
      </div>
    </DashboardLayout>
  );
}

export default function AdminHealthPage() {
  return (
    <ToastProvider position="top-center">
      <AdminHealthPageInner />
    </ToastProvider>
  );
}
