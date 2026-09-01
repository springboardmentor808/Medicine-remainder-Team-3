'use client';

import React, { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Bell,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Smartphone,
  MessageSquare,
  Mail,
  Radio,
  TrendingUp,
  Filter,
  Megaphone,
  RefreshCw,
  Search,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import DashboardLayout from '@/components/dashboard/DashboardLayout';

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 8;

// ── Channel Config ────────────────────────────────────────────────────────────

const CHANNELS = [
  { key: 'all',      label: 'All Channels',  icon: Bell,           count: null },
  { key: 'push',     label: 'App Push',       icon: Smartphone,     count: 67 },
  { key: 'sms',      label: 'SMS (Twilio)',   icon: MessageSquare,  count: 38 },
  { key: 'whatsapp', label: 'WhatsApp',       icon: Radio,          count: 22 },
  { key: 'email',    label: 'Email',          icon: Mail,           count: 15 },
];

const CHANNEL_BADGE = {
  push:     { label: 'Push',     variant: 'primary' },
  sms:      { label: 'SMS',      variant: 'secondary' },
  whatsapp: { label: 'WhatsApp', variant: 'taken' },
  email:    { label: 'Email',    variant: 'info' },
};

// ── Delivery Status Config ────────────────────────────────────────────────────

const STATUS_CFG = {
  delivered: { label: 'Delivered', variant: 'taken',   Icon: CheckCircle2, text: 'text-tertiary' },
  pending:   { label: 'Pending',   variant: 'snoozed', Icon: Clock,        text: 'text-secondary' },
  failed:    { label: 'Failed',    variant: 'missed',  Icon: XCircle,      text: 'text-error' },
};

// ── Message Type Config ───────────────────────────────────────────────────────

const MSG_TYPES = {
  medication_reminder:    { label: 'Medication Reminder',    icon: 'medication',    color: 'primary' },
  low_stock_alert:        { label: 'Low Stock Alert',        icon: 'inventory_2',   color: 'secondary' },
  caregiver_escalation:   { label: 'Caregiver Escalation',   icon: 'error_outline', color: 'error' },
  adherence_report:       { label: 'Adherence Report',       icon: 'insights',      color: 'tertiary' },
  system_broadcast:       { label: 'System Broadcast',       icon: 'campaign',      color: 'primary' },
  appointment_reminder:   { label: 'Appointment Reminder',   icon: 'event',         color: 'secondary' },
};

const MOCK_LOGS = [];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(ts) {
  return ts.split(' ')[1].slice(0, 5);
}
function formatDate(ts) {
  return ts.split(' ')[0];
}

// ── Broadcast Modal ───────────────────────────────────────────────────────────

function BroadcastModal({ isOpen, onClose }) {
  const [title, setTitle]       = useState('');
  const [message, setMessage]   = useState('');
  const [channels, setChannels] = useState(['push']);
  const [priority, setPriority] = useState('normal');
  const [sending, setSending]   = useState(false);
  const [sent, setSent]         = useState(false);

  const CHANNEL_OPTIONS = [
    { key: 'push',     label: 'App Push',  icon: Smartphone },
    { key: 'sms',      label: 'SMS',       icon: MessageSquare },
    { key: 'whatsapp', label: 'WhatsApp',  icon: Radio },
    { key: 'email',    label: 'Email',     icon: Mail },
  ];

  function toggleChannel(ch) {
    setChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  }

  async function handleSend() {
    if (!title.trim() || !message.trim() || channels.length === 0) return;
    setSending(true);
    // TODO: await notificationAPI.broadcast({ title, message, channels, priority });
    await new Promise((r) => setTimeout(r, 1500));
    setSending(false);
    setSent(true);
  }

  function handleClose() {
    onClose();
    // Reset after animation
    setTimeout(() => {
      setTitle('');
      setMessage('');
      setChannels(['push']);
      setPriority('normal');
      setSent(false);
    }, 300);
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Send System Broadcast"
      description="This message will be sent to all platform users via selected channels."
      size="lg"
    >
      {sent ? (
        <div className="text-center py-lg">
          <div className="w-16 h-16 rounded-full bg-tertiary/15 flex items-center justify-center mx-auto mb-md">
            <CheckCircle2 className="w-8 h-8 text-tertiary" />
          </div>
          <h3 className="text-body-sm font-bold text-on-surface">Broadcast Sent Successfully!</h3>
          <p className="text-caption text-on-surface-variant mt-1 max-w-sm mx-auto">
            Your announcement is being delivered via {channels.map((c) => CHANNEL_BADGE[c]?.label).join(', ')}.
            Delivery status will update in real-time.
          </p>
          <Modal.Footer align="center">
            <Button variant="primary" size="sm" onClick={handleClose}>
              Done
            </Button>
          </Modal.Footer>
        </div>
      ) : (
        <div className="space-y-md">
          {/* Title */}
          <Input
            label="Broadcast Title"
            placeholder="e.g. Scheduled Maintenance Notice"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={80}
            showCharCount
          />

          {/* Message Body */}
          <Input
            label="Message Body"
            type="textarea"
            placeholder="Write the broadcast message content…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            rows={4}
            maxLength={500}
            showCharCount
          />

          {/* Channel selection */}
          <div>
            <p className="text-label-caps font-semibold text-on-surface uppercase tracking-wider mb-sm">
              Delivery Channels <span className="text-error">*</span>
            </p>
            <div className="flex flex-wrap gap-xs">
              {CHANNEL_OPTIONS.map(({ key, label, icon: Icon }) => {
                const active = channels.includes(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleChannel(key)}
                    className={[
                      'flex items-center gap-1.5 px-md py-xs rounded-full border-2 text-caption font-semibold transition-all',
                      active
                        ? 'border-primary bg-primary/8 text-primary'
                        : 'border-outline-variant/50 text-on-surface-variant hover:border-outline-variant',
                    ].join(' ')}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                    {active && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </button>
                );
              })}
            </div>
            {channels.length === 0 && (
              <p className="text-label-caps text-error mt-1">Select at least one channel.</p>
            )}
          </div>

          {/* Priority */}
          <div>
            <p className="text-label-caps font-semibold text-on-surface uppercase tracking-wider mb-sm">
              Priority
            </p>
            <div className="flex gap-xs">
              {[
                { key: 'normal',   label: 'Normal',   color: 'primary' },
                { key: 'high',     label: 'High',     color: 'secondary' },
                { key: 'critical', label: 'Critical', color: 'error' },
              ].map(({ key, label, color }) => (
                <button
                  key={key}
                  onClick={() => setPriority(key)}
                  className={[
                    'px-md py-xs rounded-md border-2 text-caption font-semibold transition-all',
                    priority === key
                      ? `border-${color} bg-${color}/8 text-${color}`
                      : 'border-outline-variant/50 text-on-surface-variant hover:border-outline-variant',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Warning for critical */}
          {priority === 'critical' && (
            <div className="flex items-start gap-xs p-sm rounded-lg bg-error/8 border border-error/20">
              <AlertTriangle className="w-4 h-4 text-error shrink-0 mt-0.5" />
              <p className="text-label-caps text-error">
                Critical broadcasts interrupt user activity with a full-screen alert.
                Use only for emergencies.
              </p>
            </div>
          )}

          <Modal.Footer>
            <Button variant="ghost" size="sm" onClick={handleClose}>Cancel</Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSend}
              loading={sending}
              disabled={!title.trim() || !message.trim() || channels.length === 0}
              leftIcon={<Send className="w-4 h-4" />}
            >
              Send Broadcast
            </Button>
          </Modal.Footer>
        </div>
      )}
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  // State
  const [logs]                     = useState(MOCK_LOGS);
  const [activeChannel, setActiveChannel] = useState('all');
  const [statusFilter, setStatusFilter]   = useState('all');
  const [search, setSearch]        = useState('');
  const [page, setPage]            = useState(1);
  const [broadcastOpen, setBroadcastOpen] = useState(false);

  // ── Derived Metrics ───────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const total     = logs.length;
    const delivered = logs.filter((l) => l.status === 'delivered').length;
    const failed    = logs.filter((l) => l.status === 'failed').length;
    const pending   = logs.filter((l) => l.status === 'pending').length;
    const escalations = logs.filter((l) => l.type === 'caregiver_escalation').length;
    const rate = total > 0 ? ((delivered / total) * 100).toFixed(1) : '0.0';
    return { total, delivered, failed, pending, escalations, rate };
  }, [logs]);

  // ── Filtered + Paginated ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = logs;

    if (activeChannel !== 'all') {
      list = list.filter((l) => l.channel === activeChannel);
    }
    if (statusFilter !== 'all') {
      list = list.filter((l) => l.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (l) =>
          l.recipient.toLowerCase().includes(q) ||
          MSG_TYPES[l.type]?.label.toLowerCase().includes(q)
      );
    }

    return list;
  }, [logs, activeChannel, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const pageSlice  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
        <main className="max-w-7xl mx-auto px-gutter py-lg space-y-lg">

        {/* ── Page Header ──────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
          <div>
            <h1 className="text-headline-sm font-bold text-on-surface">Notification Center</h1>
            <p className="text-caption text-on-surface-variant mt-0.5">
              Delivery logs, channel analytics & broadcast management
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw className="w-4 h-4" />}
            onClick={() => window.location.reload()}
          >
            Refresh
          </Button>
        </div>

        {/* ── 1. Metrics Summary Header ─────────────────────────────────── */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-md">
          {[
            {
              label: 'Sent Today',
              value: metrics.total,
              icon: Send,
              color: 'primary',
              sub: `${metrics.delivered} delivered`,
            },
            {
              label: 'Delivery Rate',
              value: `${metrics.rate}%`,
              icon: TrendingUp,
              color: 'tertiary',
              sub: `${metrics.delivered}/${metrics.total} dispatched`,
            },
            {
              label: 'Failed Dispatches',
              value: metrics.failed,
              icon: XCircle,
              color: 'error',
              sub: metrics.failed === 0 ? 'No failures today' : `${metrics.pending} still pending`,
            },
            {
              label: 'Active Escalations',
              value: metrics.escalations,
              icon: AlertTriangle,
              color: 'secondary',
              sub: 'Caregiver notifications',
            },
          ].map(({ label, value, icon: Icon, color, sub }) => (
            <Card key={label} variant="default" padding="md">
              <div className="flex items-start justify-between gap-sm">
                <div className={`w-10 h-10 rounded-xl bg-${color}/10 flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 text-${color}`} />
                </div>
                <p className={`text-headline-sm font-bold text-${color} leading-none`}>
                  {value}
                </p>
              </div>
              <p className="text-caption font-semibold text-on-surface mt-md">{label}</p>
              <p className="text-label-caps text-on-surface-variant mt-0.5">{sub}</p>
            </Card>
          ))}
        </section>

        {/* ── 2. Channel Tabs ──────────────────────────────────────────── */}
        <section className="flex items-center gap-xs overflow-x-auto pb-1 -mb-1">
          {CHANNELS.map(({ key, label, icon: Icon, count }) => (
            <button
              key={key}
              onClick={() => { setActiveChannel(key); setPage(1); }}
              className={[
                'inline-flex items-center gap-1.5 px-md py-xs rounded-full text-caption font-semibold whitespace-nowrap',
                'border transition-all duration-200',
                activeChannel === key
                  ? 'bg-primary text-on-primary border-primary shadow-sm'
                  : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/50 hover:border-primary/40 hover:text-primary',
              ].join(' ')}
            >
              <Icon className="w-4 h-4" />
              {label}
              {count !== null && (
                <span className={[
                  'ml-0.5 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center',
                  activeChannel === key
                    ? 'bg-on-primary/20 text-on-primary'
                    : 'bg-surface-container text-on-surface-variant',
                ].join(' ')}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </section>

        {/* ── Search & Status Filter ───────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-sm">
          <div className="flex-1">
            <Input
              type="search"
              placeholder="Search recipient or message type…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              clearable
              onClear={() => { setSearch(''); setPage(1); }}
              size="sm"
            />
          </div>
          <div className="flex items-center gap-xs">
            {['all', 'delivered', 'pending', 'failed'].map((s) => {
              const cfg = STATUS_CFG[s];
              return (
                <button
                  key={s}
                  onClick={() => { setStatusFilter(s); setPage(1); }}
                  className={[
                    'px-sm py-xs rounded-full text-label-caps font-semibold capitalize border transition-all',
                    statusFilter === s
                      ? s === 'failed'    ? 'bg-error text-on-error border-error'
                      : s === 'pending'   ? 'bg-secondary text-on-secondary border-secondary'
                      : s === 'delivered' ? 'bg-tertiary text-on-tertiary border-tertiary'
                      : 'bg-on-surface text-surface border-on-surface'
                      : 'bg-transparent text-on-surface-variant border-outline-variant/50 hover:border-outline',
                  ].join(' ')}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 3. Delivery Log Table ────────────────────────────────────── */}
        <Card variant="default" padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[640px]">
              <thead>
                <tr className="border-b border-outline-variant/40 bg-surface-container-low">
                  <th className="py-sm px-md text-label-caps font-semibold text-on-surface-variant uppercase tracking-wider">
                    Recipient
                  </th>
                  <th className="py-sm px-md text-label-caps font-semibold text-on-surface-variant uppercase tracking-wider">
                    Channel
                  </th>
                  <th className="py-sm px-md text-label-caps font-semibold text-on-surface-variant uppercase tracking-wider hidden md:table-cell">
                    Message Type
                  </th>
                  <th className="py-sm px-md text-label-caps font-semibold text-on-surface-variant uppercase tracking-wider">
                    Sent
                  </th>
                  <th className="py-sm px-md text-label-caps font-semibold text-on-surface-variant uppercase tracking-wider text-right">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {pageSlice.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-xl text-center">
                      <Bell className="w-10 h-10 mx-auto text-on-surface-variant/40 mb-sm" />
                      <p className="text-caption text-on-surface-variant">No notifications match your filters.</p>
                      <button
                        onClick={() => { setActiveChannel('all'); setStatusFilter('all'); setSearch(''); setPage(1); }}
                        className="text-caption text-primary hover:underline mt-xs"
                      >
                        Clear filters
                      </button>
                    </td>
                  </tr>
                ) : (
                  pageSlice.map((log) => {
                    const ch  = CHANNEL_BADGE[log.channel];
                    const st  = STATUS_CFG[log.status] ?? STATUS_CFG.pending;
                    const mt  = MSG_TYPES[log.type] ?? MSG_TYPES.medication_reminder;
                    const StIcon = st.Icon;

                    return (
                      <tr key={log.id} className="group hover:bg-surface-container-low/60 transition-colors">
                        {/* Recipient */}
                        <td className="py-sm px-md">
                          <div className="flex items-center gap-sm">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-label-caps font-bold text-primary shrink-0">
                              {log.recipient.split(' ').map((w) => w[0]).join('').slice(0, 2)}
                            </div>
                            <div>
                              <p className="text-caption font-semibold text-on-surface">{log.recipient}</p>
                              <p className="text-label-caps text-on-surface-variant md:hidden">
                                {mt.label}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Channel */}
                        <td className="py-sm px-md">
                          <Badge variant={ch?.variant ?? 'default'} size="xs">{ch?.label ?? log.channel}</Badge>
                        </td>

                        {/* Message Type */}
                        <td className="py-sm px-md hidden md:table-cell">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`material-symbols-outlined text-[16px] text-${mt.color}`}
                              style={{ fontVariationSettings: "'FILL' 1" }}
                            >
                              {mt.icon}
                            </span>
                            <span className="text-caption text-on-surface">{mt.label}</span>
                          </div>
                        </td>

                        {/* Sent Time */}
                        <td className="py-sm px-md">
                          <div className="flex items-center gap-1 text-caption text-on-surface-variant">
                            <Clock className="w-3 h-3" />
                            {formatTime(log.sentTime)}
                          </div>
                          <p className="text-[10px] text-on-surface-variant/60 mt-0.5">
                            {formatDate(log.sentTime)}
                          </p>
                        </td>

                        {/* Status */}
                        <td className="py-sm px-md text-right">
                          <div className="inline-flex items-center gap-1">
                            <StIcon className={`w-3.5 h-3.5 ${st.text}`} />
                            <Badge variant={st.variant} size="xs">{st.label}</Badge>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="border-t border-outline-variant/40 px-md py-sm flex flex-col sm:flex-row items-center justify-between gap-sm">
            <p className="text-label-caps text-on-surface-variant">
              Showing{' '}
              <span className="font-semibold text-on-surface">
                {filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–
                {Math.min(safePage * PAGE_SIZE, filtered.length)}
              </span>{' '}
              of <span className="font-semibold text-on-surface">{filtered.length}</span> notifications
            </p>
            <div className="flex items-center gap-xs">
              <Button
                variant="outline" size="sm"
                leftIcon={<ChevronLeft className="w-4 h-4" />}
                disabled={safePage <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Prev
              </Button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                  .reduce((acc, p, idx, arr) => {
                    if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === '…' ? (
                      <span key={`e-${i}`} className="text-caption text-on-surface-variant px-1">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={[
                          'w-8 h-8 rounded-md text-caption font-semibold transition-colors',
                          p === safePage
                            ? 'bg-primary text-on-primary'
                            : 'text-on-surface-variant hover:bg-surface-container',
                        ].join(' ')}
                      >
                        {p}
                      </button>
                    )
                  )}
              </div>

              <Button
                variant="outline" size="sm"
                rightIcon={<ChevronRight className="w-4 h-4" />}
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>

        {/* ── Channel Delivery Breakdown ────────────────────────────────── */}
        <section>
          <h2 className="text-body-sm font-bold text-on-surface mb-md">Channel Breakdown</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-md">
            {CHANNELS.filter((c) => c.key !== 'all').map(({ key, label, icon: Icon }) => {
              const total = logs.filter((l) => l.channel === key).length;
              const ok    = logs.filter((l) => l.channel === key && l.status === 'delivered').length;
              const fail  = logs.filter((l) => l.channel === key && l.status === 'failed').length;
              const pend  = logs.filter((l) => l.channel === key && l.status === 'pending').length;
              const pct   = total > 0 ? Math.round((ok / total) * 100) : 0;

              return (
                <Card key={key} variant="flat" padding="md" className="space-y-sm">
                  <div className="flex items-center gap-xs">
                    <Icon className="w-4 h-4 text-on-surface-variant" />
                    <p className="text-caption font-semibold text-on-surface">{label}</p>
                  </div>

                  <p className="text-headline-sm font-bold text-on-surface">{total}</p>

                  {/* Mini bar */}
                  <div className="w-full h-1.5 rounded-full bg-surface-container overflow-hidden flex">
                    {ok > 0 && (
                      <div className="h-full bg-tertiary" style={{ width: `${(ok / total) * 100}%` }} />
                    )}
                    {pend > 0 && (
                      <div className="h-full bg-secondary" style={{ width: `${(pend / total) * 100}%` }} />
                    )}
                    {fail > 0 && (
                      <div className="h-full bg-error" style={{ width: `${(fail / total) * 100}%` }} />
                    )}
                  </div>

                  <div className="flex items-center gap-xs flex-wrap text-label-caps text-on-surface-variant">
                    <span className="flex items-center gap-0.5 text-tertiary">
                      <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />{ok}
                    </span>
                    {pend > 0 && (
                      <span className="flex items-center gap-0.5 text-secondary">
                        <span className="w-1.5 h-1.5 rounded-full bg-secondary" />{pend}
                      </span>
                    )}
                    {fail > 0 && (
                      <span className="flex items-center gap-0.5 text-error">
                        <span className="w-1.5 h-1.5 rounded-full bg-error" />{fail}
                      </span>
                    )}
                    <span className="ml-auto font-bold">{pct}%</span>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        {/* ── Disclaimer ──────────────────────────────────────────────── */}
        <div className="p-sm rounded-md bg-error-container/30 border border-error/20 text-center">
          <p className="text-caption text-error font-medium">
            ⚠️ Notification data is retained for 30 days. Broadcast messages are logged and auditable.
            Misuse of broadcast privileges may result in admin suspension.
          </p>
        </div>
      </main>

      {/* ── 4. Broadcast Modal ──────────────────────────────────────── */}
      <BroadcastModal
        isOpen={broadcastOpen}
        onClose={() => setBroadcastOpen(false)}
      />
      </div>
    </DashboardLayout>
  );
}
