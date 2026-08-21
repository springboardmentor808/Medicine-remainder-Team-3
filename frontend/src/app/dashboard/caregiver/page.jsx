'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  AlertTriangle,
  TrendingUp,
  UserPlus,
  Search,
  Filter,
  Bell,
  Phone,
  Clock,
  XCircle,
  CheckCircle2,
  Pill,
  Activity,
  ChevronRight,
  Copy,
  Link2,
  RefreshCw,
  Download,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import AdherenceRing from '@/components/ui/AdherenceRing';
import PatientRosterCard from '@/components/dashboard/PatientRosterCard';
import LogoutButton from '@/components/ui/LogoutButton';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ReminderWidget from '@/components/dashboard/ReminderWidget';
import { exportAPI } from '@/lib/api';

/**
 * CaregiverDashboard — PillSync Caregiver Portal
 * ────────────────────────────────────────────────
 * Design Ref: Stitch #39 Caregiver Dashboard - Overview,
 *             #40 Caregiver Multi-Patient View,
 *             #41 Caregiver Management Dashboard
 *
 * Layout:
 *   ┌─────────────────────────────────────────────────────────┐
 *   │  Welcome Banner + Quick Stats                          │
 *   ├──────────────────────────────────┬──────────────────────┤
 *   │  Search / Filter Bar            │  Link New Patient    │
 *   ├──────────────────────────────────┴──────────────────────┤
 *   │  Patient Roster Grid (3-col desktop)                   │
 *   ├─────────────────────────────────────────────────────────┤
 *   │  Emergency Alert Feed (Bottom Banner)                  │
 *   └─────────────────────────────────────────────────────────┘
 */

// ── Mock Data ─────────────────────────────────────────────────────────────────
// Replace with API calls: GET /caregiver/patients, GET /caregiver/alerts

const MOCK_PATIENTS = [
  {
    id: 'p-001',
    name: 'Eleanor Martinez',
    age: 72,
    relation: 'Mother',
    adherenceScore: 94,
    pendingDosesCount: 0,
    lastDoseStatus: 'taken',
    image: null,
    nextMedication: { name: 'Metformin 500mg', time: '2:00 PM', dosage: '1 tablet' },
  },
  {
    id: 'p-002',
    name: 'Robert Chen',
    age: 68,
    relation: 'Father',
    adherenceScore: 73,
    pendingDosesCount: 1,
    lastDoseStatus: 'missed',
    image: null,
    nextMedication: { name: 'Amlodipine 5mg', time: '6:00 PM', dosage: '1 tablet' },
  },
  {
    id: 'p-003',
    name: 'Margaret Davis',
    age: 81,
    relation: 'Grandmother',
    adherenceScore: 45,
    pendingDosesCount: 3,
    lastDoseStatus: 'missed',
    image: null,
    nextMedication: { name: 'Warfarin 2.5mg', time: '8:00 AM', dosage: '1 tablet' },
  },
  {
    id: 'p-004',
    name: 'James Wilson',
    age: 55,
    relation: 'Uncle',
    adherenceScore: 88,
    pendingDosesCount: 0,
    lastDoseStatus: 'taken',
    image: null,
    nextMedication: { name: 'Atorvastatin 20mg', time: '9:00 PM', dosage: '1 tablet' },
  },
  {
    id: 'p-005',
    name: 'Patricia Thompson',
    age: 76,
    relation: 'Aunt',
    adherenceScore: 62,
    pendingDosesCount: 2,
    lastDoseStatus: 'missed',
    image: null,
    nextMedication: { name: 'Lisinopril 10mg', time: '12:00 PM', dosage: '1 tablet' },
  },
  {
    id: 'p-006',
    name: 'David Anderson',
    age: 79,
    relation: 'Father-in-law',
    adherenceScore: 97,
    pendingDosesCount: 0,
    lastDoseStatus: 'taken',
    image: null,
    nextMedication: { name: 'Omeprazole 20mg', time: '7:30 AM', dosage: '1 capsule' },
  },
];

const MOCK_ALERTS = [
  {
    id: 'a-001',
    patientName: 'Margaret Davis',
    patientId: 'p-003',
    message: 'Missed 3 consecutive doses of Warfarin 2.5mg',
    severity: 'critical',
    time: '15 min ago',
  },
  {
    id: 'a-002',
    patientName: 'Robert Chen',
    patientId: 'p-002',
    message: 'Missed evening dose of Amlodipine 5mg',
    severity: 'warning',
    time: '1 hour ago',
  },
  {
    id: 'a-003',
    patientName: 'Patricia Thompson',
    patientId: 'p-005',
    message: 'Low medication stock — Lisinopril (3 pills remaining)',
    severity: 'warning',
    time: '2 hours ago',
  },
];

// ── Filter Options ────────────────────────────────────────────────────────────

const FILTER_TABS = [
  { key: 'all',       label: 'All Patients',      icon: Users },
  { key: 'attention', label: 'Needs Attention',    icon: AlertTriangle },
  { key: 'critical',  label: 'Critical Stock',     icon: Activity },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

// ── Main Page Component ───────────────────────────────────────────────────────

export default function CaregiverDashboardPage() {
  // State
  const [currentUser, setCurrentUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkCode, setLinkCode] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [linkSuccess, setLinkSuccess] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('pillsync_user');
        if (stored) setCurrentUser(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse user', e);
      }
    }
  }, []);

  const displayName = currentUser?.full_name || currentUser?.name || currentUser?.username || 'Dr. Sarah Chen';

  // Derived data
  const patients = MOCK_PATIENTS; // TODO: replace with useSWR / useEffect fetch

  const filteredPatients = useMemo(() => {
    let list = patients;

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.relation?.toLowerCase().includes(q)
      );
    }

    // Tab filter
    if (activeFilter === 'attention') {
      list = list.filter((p) => p.lastDoseStatus === 'missed' || p.pendingDosesCount > 0);
    } else if (activeFilter === 'critical') {
      list = list.filter((p) => p.adherenceScore < 60);
    }

    return list;
  }, [patients, searchQuery, activeFilter]);

  // Quick stats
  const stats = useMemo(() => {
    const total = patients.length;
    const escalated = patients.filter((p) => p.pendingDosesCount > 0).length;
    const avgAdherence =
      total > 0
        ? Math.round(patients.reduce((sum, p) => sum + p.adherenceScore, 0) / total)
        : 0;
    return { total, escalated, avgAdherence };
  }, [patients]);

  // Active alerts (not dismissed)
  const activeAlerts = useMemo(
    () => MOCK_ALERTS.filter((a) => !dismissedAlerts.includes(a.id)),
    [dismissedAlerts]
  );

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleViewSchedule = useCallback((id) => {
    // TODO: router.push(`/dashboard/caregiver/patients/${id}/schedule`)
    console.log('View schedule for:', id);
  }, []);

  const handleSendReminder = useCallback((id) => {
    // TODO: POST /caregiver/patients/{id}/remind
    console.log('Send reminder to:', id);
  }, []);

  const handleEmergencyContact = useCallback((id) => {
    // TODO: open emergency call sheet
    console.log('Emergency contact for:', id);
  }, []);

  const handleDismissAlert = useCallback((alertId) => {
    setDismissedAlerts((prev) => [...prev, alertId]);
  }, []);

  const handleLinkPatient = useCallback(async () => {
    if (!linkCode.trim()) {
      setLinkError('Please enter a patient pairing code.');
      return;
    }
    setLinkLoading(true);
    setLinkError('');
    try {
      // TODO: await caregiverAPI.linkPatient({ code: linkCode.trim() });
      await new Promise((resolve) => setTimeout(resolve, 1500)); // mock delay
      setLinkSuccess(true);
    } catch (err) {
      setLinkError(err.message || 'Failed to link patient. Please check the code.');
    } finally {
      setLinkLoading(false);
    }
  }, [linkCode]);

  const handleCloseLinkModal = useCallback(() => {
    setIsLinkModalOpen(false);
    setLinkCode('');
    setLinkError('');
    setLinkSuccess(false);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
        {/* Background pattern */}
        <div className="medical-pattern" aria-hidden="true" />

        {/* ── Top Actions Bar ────────────────────────────────────────── */}
        <div className="border-b border-outline-variant/30 bg-surface-container-lowest/60 backdrop-blur-md px-gutter py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Badge variant="caregiver" size="sm">Caregiver Portal</Badge>
              {stats.escalated > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-error/10 border border-error/20">
                  <span className="w-2 h-2 rounded-full bg-error animate-pulse-slow" />
                  <span className="text-[11px] text-error font-semibold">
                    {stats.escalated} patients need attention
                  </span>
                </div>
              )}
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

        <main className="relative z-10 max-w-7xl mx-auto px-gutter py-lg space-y-lg">
        {/* ── Welcome Banner + Quick Stats ──────────────────────────────── */}
        <section className="bg-gradient-to-br from-primary via-primary to-primary-container rounded-lg p-card-padding md:p-xl text-on-primary overflow-hidden relative">
          {/* Decorative circles */}
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-on-primary/5 blur-sm" aria-hidden="true" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-on-primary/5 blur-sm" aria-hidden="true" />

          <div className="relative z-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-lg">
              {/* Greeting */}
              <div>
                <p className="text-on-primary/70 text-caption font-medium">
                  {getGreeting()}, Caregiver
                </p>
                <h1 className="text-headline-sm md:text-headline-md font-bold mt-1 tracking-tight">
                  {displayName}
                </h1>
                <p className="text-on-primary/70 text-caption mt-1">
                  Clinical Director · {new Date().toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>

              {/* Quick stats cards */}
              <div className="flex flex-wrap gap-sm">
                {/* Total Patients */}
                <div className="flex items-center gap-sm bg-on-primary/10 backdrop-blur-sm rounded-md px-md py-sm border border-on-primary/10">
                  <div className="w-10 h-10 rounded-full bg-on-primary/15 flex items-center justify-center">
                    <Users className="w-5 h-5 text-on-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold leading-none">{stats.total}</p>
                    <p className="text-label-caps text-on-primary/70 uppercase tracking-wider mt-0.5">
                      Linked Patients
                    </p>
                  </div>
                </div>

                {/* Escalated Alerts */}
                <div className="flex items-center gap-sm bg-on-primary/10 backdrop-blur-sm rounded-md px-md py-sm border border-on-primary/10">
                  <div className="w-10 h-10 rounded-full bg-error/30 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-on-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold leading-none">{stats.escalated}</p>
                    <p className="text-label-caps text-on-primary/70 uppercase tracking-wider mt-0.5">
                      Escalated Alerts
                    </p>
                  </div>
                </div>

                {/* Avg Adherence */}
                <div className="flex items-center gap-sm bg-on-primary/10 backdrop-blur-sm rounded-md px-md py-sm border border-on-primary/10">
                  <div className="w-10 h-10 rounded-full bg-on-primary/15 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-on-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold leading-none">{stats.avgAdherence}%</p>
                    <p className="text-label-caps text-on-primary/70 uppercase tracking-wider mt-0.5">
                      Avg Adherence
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Live Medication Reminder & Alert Widget ──────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
          <div className="lg:col-span-2">
            <div className="bg-surface-container-lowest p-card-padding rounded-xl border border-outline-variant/30">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  <h2 className="text-body-sm font-bold text-on-surface">Scheduled Medication Queue</h2>
                </div>
                <Badge variant="patient" size="xs">Live Monitoring</Badge>
              </div>
              <p className="text-caption text-on-surface-variant mb-4">
                Real-time tracking of upcoming and overdue patient doses across assigned wards.
              </p>
              <ReminderWidget />
            </div>
          </div>
          <div className="space-y-4">
            <Card variant="flat" padding="md">
              <Card.Header
                title="Quick Escalation"
                icon={<AlertTriangle className="w-5 h-5 text-error" />}
              />
              <p className="text-caption text-on-surface-variant mt-2 mb-4">
                Trigger emergency SMS and call alerts to primary contacts for missed doses.
              </p>
              <div className="space-y-2">
                <Button variant="danger" size="sm" fullWidth leftIcon={<Phone className="w-4 h-4" />}>
                  Emergency Broadcast
                </Button>
                <Button variant="outlined" size="sm" fullWidth leftIcon={<Download className="w-4 h-4" />} onClick={() => exportAPI.adherenceCSV()}>
                  Download Logs (CSV)
                </Button>
              </div>
            </Card>
          </div>
        </section>

        {/* ── Search & Filter Bar ───────────────────────────────────────── */}
        <section className="flex flex-col md:flex-row items-start md:items-center justify-between gap-md">
          {/* Filter tabs */}
          <div className="flex items-center gap-xs overflow-x-auto pb-1 -mb-1">
            {FILTER_TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveFilter(key)}
                className={[
                  'inline-flex items-center gap-1.5 px-md py-xs rounded-full text-caption font-semibold whitespace-nowrap',
                  'border transition-all duration-200',
                  activeFilter === key
                    ? 'bg-primary text-on-primary border-primary shadow-sm'
                    : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/50 hover:border-primary/40 hover:text-primary',
                ].join(' ')}
              >
                <Icon className="w-4 h-4" />
                {label}
                {key === 'attention' && stats.escalated > 0 && (
                  <span className={[
                    'ml-0.5 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center',
                    activeFilter === key
                      ? 'bg-on-primary/20 text-on-primary'
                      : 'bg-error/15 text-error',
                  ].join(' ')}>
                    {stats.escalated}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Search + Link New Patient */}
          <div className="flex items-center gap-sm w-full md:w-auto">
            <div className="flex-1 md:w-64">
              <Input
                type="search"
                placeholder="Search patients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                clearable
                onClear={() => setSearchQuery('')}
                size="sm"
              />
            </div>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<UserPlus className="w-4 h-4" />}
              onClick={() => setIsLinkModalOpen(true)}
            >
              Link Patient
            </Button>
          </div>
        </section>

        {/* ── Patient Roster Grid ───────────────────────────────────────── */}
        <section>
          {filteredPatients.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-md">
              {filteredPatients.map((patient) => (
                <PatientRosterCard
                  key={patient.id}
                  patient={patient}
                  onViewSchedule={handleViewSchedule}
                  onSendReminder={handleSendReminder}
                  onEmergencyContact={handleEmergencyContact}
                />
              ))}
            </div>
          ) : (
            /* Empty state */
            <Card variant="tonal" className="text-center py-xl">
              <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center mx-auto mb-md">
                <Users className="w-8 h-8 text-on-surface-variant" />
              </div>
              <h3 className="text-body-sm font-semibold text-on-surface">
                {searchQuery || activeFilter !== 'all'
                  ? 'No patients match your filters'
                  : 'No linked patients yet'}
              </h3>
              <p className="text-caption text-on-surface-variant mt-1 max-w-sm mx-auto">
                {searchQuery || activeFilter !== 'all'
                  ? 'Try adjusting your search query or filter to find patients.'
                  : 'Link your first patient by entering their unique pairing code.'}
              </p>
              {!searchQuery && activeFilter === 'all' && (
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<UserPlus className="w-4 h-4" />}
                  onClick={() => setIsLinkModalOpen(true)}
                  className="mt-md"
                >
                  Link Your First Patient
                </Button>
              )}
            </Card>
          )}
        </section>

        {/* ── Emergency Alert Feed (Bottom Banner) ──────────────────────── */}
        {activeAlerts.length > 0 && (
          <section className="space-y-sm">
            <div className="flex items-center gap-xs">
              <div className="relative flex items-center">
                <span className="absolute inline-flex w-2.5 h-2.5 rounded-full bg-error opacity-60 animate-ping" />
                <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-error" />
              </div>
              <h2 className="text-body-sm font-semibold text-on-surface">
                Active Alerts
              </h2>
              <Badge variant="error" size="xs">{activeAlerts.length}</Badge>
            </div>

            <div className="space-y-xs">
              {activeAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={[
                    'flex items-center gap-md p-md rounded-lg border transition-all',
                    alert.severity === 'critical'
                      ? 'bg-error-container/20 border-error/30'
                      : 'bg-secondary-fixed/20 border-secondary/20',
                  ].join(' ')}
                >
                  {/* Alert icon */}
                  <div
                    className={[
                      'shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
                      alert.severity === 'critical'
                        ? 'bg-error/15 text-error'
                        : 'bg-secondary/15 text-secondary',
                    ].join(' ')}
                  >
                    {alert.severity === 'critical' ? (
                      <XCircle className="w-5 h-5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5" />
                    )}
                  </div>

                  {/* Alert content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-xs">
                      <p className="text-caption font-semibold text-on-surface truncate">
                        {alert.patientName}
                      </p>
                      <Badge
                        variant={alert.severity === 'critical' ? 'error' : 'warning'}
                        size="xs"
                      >
                        {alert.severity}
                      </Badge>
                    </div>
                    <p className="text-label-caps text-on-surface-variant mt-0.5 truncate">
                      {alert.message}
                    </p>
                  </div>

                  {/* Time + Actions */}
                  <div className="shrink-0 flex items-center gap-xs">
                    <span className="text-label-caps text-on-surface-variant whitespace-nowrap">
                      {alert.time}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewSchedule(alert.patientId)}
                      className="!px-xs"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                    <button
                      onClick={() => handleDismissAlert(alert.id)}
                      className="p-1 rounded-full text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors"
                      aria-label="Dismiss alert"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Quick Actions Footer ──────────────────────────────────────── */}
        <section className="flex flex-wrap items-center justify-between gap-sm pt-md border-t border-outline-variant/40">
          <p className="text-caption text-on-surface-variant">
            Showing {filteredPatients.length} of {patients.length} patients
          </p>
          <div className="flex items-center gap-xs">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<RefreshCw className="w-4 h-4" />}
              onClick={() => window.location.reload()}
            >
              Refresh
            </Button>
            <Link href="/help">
              <Button variant="outline" size="sm">
                Help Center
              </Button>
            </Link>
          </div>
        </section>
      </main>

      {/* ── Link New Patient Modal ──────────────────────────────────────── */}
      <Modal
        isOpen={isLinkModalOpen}
        onClose={handleCloseLinkModal}
        title="Link New Patient"
        description="Enter the unique pairing code shared by your patient to connect their account."
        size="sm"
      >
        {linkSuccess ? (
          /* Success state */
          <div className="text-center py-md">
            <div className="w-16 h-16 rounded-full bg-tertiary/15 flex items-center justify-center mx-auto mb-md">
              <CheckCircle2 className="w-8 h-8 text-tertiary" />
            </div>
            <h3 className="text-body-sm font-bold text-on-surface">
              Patient Linked Successfully!
            </h3>
            <p className="text-caption text-on-surface-variant mt-1">
              The patient has been added to your roster. You can now monitor their medication schedule.
            </p>
            <Modal.Footer align="center">
              <Button variant="primary" size="sm" onClick={handleCloseLinkModal}>
                View Roster
              </Button>
            </Modal.Footer>
          </div>
        ) : (
          /* Code entry form */
          <div className="space-y-md">
            {/* Visual link illustration */}
            <div className="flex items-center justify-center gap-sm py-sm">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div className="flex items-center gap-1 text-outline">
                <span className="w-6 border-t-2 border-dashed border-outline-variant" />
                <Link2 className="w-5 h-5 text-primary" />
                <span className="w-6 border-t-2 border-dashed border-outline-variant" />
              </div>
              <div className="w-12 h-12 rounded-full bg-tertiary/10 flex items-center justify-center">
                <Pill className="w-6 h-6 text-tertiary" />
              </div>
            </div>

            <Input
              label="Patient Pairing Code"
              placeholder="e.g. PS-7X4K-9M2R"
              value={linkCode}
              onChange={(e) => {
                setLinkCode(e.target.value.toUpperCase());
                setLinkError('');
              }}
              error={linkError}
              helper="Ask your patient to generate a code from Settings → Share Access."
              required
              maxLength={14}
              leftIcon={<Copy className="w-4 h-4 text-on-surface-variant" />}
            />

            <Modal.Footer>
              <Button variant="ghost" size="sm" onClick={handleCloseLinkModal}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleLinkPatient}
                loading={linkLoading}
                leftIcon={<UserPlus className="w-4 h-4" />}
              >
                Link Patient
              </Button>
            </Modal.Footer>
          </div>
        )}
      </Modal>

      {/* ── Emergency Disclaimer Footer ─────────────────────────────────── */}
      <footer className="relative z-10 max-w-7xl mx-auto px-gutter pb-lg">
        <div className="p-sm rounded-md bg-error-container/30 border border-error/20 text-center">
          <p className="text-caption text-error font-medium">
            ⚠️ Medical Disclaimer: This app is a scheduling tool only. It does not replace
            professional medical advice. In case of emergency, call{' '}
            <a href="tel:911" className="font-bold underline">911</a> (US) or{' '}
            <a href="tel:108" className="font-bold underline">108</a> (India) immediately.
          </p>
        </div>
      </footer>
      </div>
    </DashboardLayout>
  );
}
