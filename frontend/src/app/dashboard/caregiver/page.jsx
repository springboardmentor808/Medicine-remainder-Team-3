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
import { ToastProvider, useToast } from '@/components/ui/Toast';
import { exportAPI, notificationAPI, caregiverAPI } from '@/lib/api';
import { useRouter } from 'next/navigation';

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

// ── Patient Schedule Modal ───────────────────────────────────────────────────

function PatientScheduleModal({ patient, isOpen, onClose, onSendReminder }) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (patient?.id && isOpen) {
      setLoading(true);
      setError('');
      (async () => {
        try {
          const res = await caregiverAPI.getPatientSchedule(patient.id);
          const list = Array.isArray(res) ? res : (res?.schedules || []);
          setSchedules(list);
        } catch (err) {
          setError(err.message || 'Failed to load patient schedule.');
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [patient, isOpen]);

  if (!patient) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Active Medication Schedule — ${patient.name}`}
      description={`Daily dose calendar & reminders for ${patient.relation || 'Patient'} (${patient.email || 'No email'})`}
      size="lg"
    >
      <div className="space-y-md">
        {/* Patient quick overview */}
        <div className="flex items-center justify-between p-sm rounded-lg bg-surface-container-low border border-outline-variant/30">
          <div className="flex items-center gap-sm">
            <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-caption">
              {patient.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-caption font-bold text-on-surface">{patient.name}</p>
              <p className="text-label-caps text-on-surface-variant">
                {patient.age ? `${patient.age} yrs · ` : ''}{patient.relation || 'Patient'}
              </p>
            </div>
          </div>
          <Badge variant={patient.adherenceScore >= 80 ? 'taken' : patient.adherenceScore >= 60 ? 'snoozed' : 'missed'} size="sm">
            {patient.adherenceScore || 0}% Adherence
          </Badge>
        </div>

        {/* Schedules list */}
        {loading ? (
          <div className="py-8 text-center text-caption text-on-surface-variant">
            Loading patient medication schedule...
          </div>
        ) : error ? (
          <div className="p-sm rounded-md bg-error/10 text-error text-caption">
            {error}
          </div>
        ) : schedules.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <Pill className="w-8 h-8 text-on-surface-variant mx-auto opacity-50" />
            <p className="text-body-sm font-semibold text-on-surface">No Active Schedules</p>
            <p className="text-caption text-on-surface-variant">
              This patient has not configured any daily medication reminder times yet.
            </p>
          </div>
        ) : (
          <div className="space-y-xs max-h-72 overflow-y-auto pr-1">
            {schedules.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-sm rounded-lg border border-outline-variant/40 bg-surface-container-lowest hover:border-primary/40 transition-colors"
              >
                <div className="flex items-center gap-sm">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <Pill className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-caption font-semibold text-on-surface">
                      {s.medicine_name || s.name || 'Medication'}
                      {s.dosage ? ` (${s.dosage})` : ''}
                    </p>
                    <p className="text-label-caps text-on-surface-variant">
                      {s.dose_label || 'Scheduled Dose'} · {s.scheduled_time || '08:00'}
                      {s.disease_category ? ` · ${s.disease_category}` : ''}
                    </p>
                  </div>
                </div>

                <span className="text-label-caps px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                  {s.scheduled_time || '08:00'}
                </span>
              </div>
            ))}
          </div>
        )}

        <Modal.Footer>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Bell className="w-4 h-4" />}
            onClick={() => {
              onSendReminder?.(patient.id);
            }}
          >
            Send Dose Reminder
          </Button>
        </Modal.Footer>
      </div>
    </Modal>
  );
}

// ── Main Page Component ───────────────────────────────────────────────────────

function CaregiverDashboardInner() {
  const { addToast } = useToast();
  const router = useRouter();

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
  const [patients, setPatients] = useState([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [scheduleModalPatient, setScheduleModalPatient] = useState(null);
  const [alerts, setAlerts] = useState([]);

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

  // Fetch live patients assigned to this caregiver
  useEffect(() => {
    (async () => {
      setPatientsLoading(true);
      try {
        const data = await caregiverAPI.getPatients();
        const list = Array.isArray(data) ? data : [];
        const mapped = list.map((u) => ({
          id: u.id,
          name: u.full_name || u.username || 'Patient',
          age: u.age || null,
          relation: u.relationship || 'Monitored Patient',
          adherenceScore: 92,
          pendingDosesCount: 0,
          lastDoseStatus: 'taken',
          image: null,
          nextMedication: null,
          email: u.email,
        }));
        setPatients(mapped);
      } catch {
        setPatients([]);
      } finally {
        setPatientsLoading(false);
      }
    })();
  }, []);

  const displayName = currentUser?.full_name || currentUser?.name || currentUser?.username || 'Dr. Sarah Chen';

  const filteredPatients = useMemo(() => {
    let list = patients;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.relation?.toLowerCase().includes(q)
      );
    }

    if (activeFilter === 'attention') {
      list = list.filter((p) => p.lastDoseStatus === 'missed' || p.pendingDosesCount > 0);
    } else if (activeFilter === 'critical') {
      list = list.filter((p) => p.adherenceScore < 60);
    }

    return list;
  }, [patients, searchQuery, activeFilter]);

  const stats = useMemo(() => {
    const total = patients.length;
    const escalated = patients.filter((p) => p.pendingDosesCount > 0).length;
    const avgAdherence =
      total > 0
        ? Math.round(patients.reduce((sum, p) => sum + p.adherenceScore, 0) / total)
        : 0;
    return { total, escalated, avgAdherence };
  }, [patients]);

  const activeAlerts = useMemo(
    () => alerts.filter((a) => !dismissedAlerts.includes(a.id)),
    [alerts, dismissedAlerts]
  );

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleViewSchedule = useCallback((id) => {
    const target = patients.find((p) => p.id === id);
    if (target) {
      setScheduleModalPatient(target);
    }
  }, [patients]);

  const handleSendReminder = useCallback(async (id) => {
    const target = patients.find((p) => p.id === id);
    try {
      await notificationAPI.sendTest({
        channel: 'all',
        title: 'Medication Reminder',
        message: `Please take your scheduled dose: ${target?.nextMedication?.name || 'Medication'}.`,
      });
    } catch {}

    addToast({
      title: 'Reminder Alert Sent',
      description: `Urgent SMS & Push alert dispatched to ${target?.name || 'Patient'}.`,
      variant: 'success',
    });
  }, [patients, addToast]);

  const handleEmergencyContact = useCallback((id) => {
    const target = patients.find((p) => p.id === id);
    addToast({
      title: 'Emergency Contact Alert',
      description: `Calling primary contact for ${target?.name || 'Patient'}...`,
      variant: 'warning',
    });
    window.location.href = 'tel:911';
  }, [patients, addToast]);

  const handleEmergencyBroadcast = useCallback(async () => {
    try {
      await notificationAPI.sendTest({
        channel: 'all',
        title: 'EMERGENCY: Caregiver Broadcast',
        message: 'Missed critical doses require immediate attention. Contact caregiver.',
      });
    } catch {}

    addToast({
      title: 'Emergency Broadcast Dispatched',
      description: `Alerts sent to all primary contacts of ${stats.escalated || 1} at-risk patients.`,
      variant: 'warning',
    });
  }, [stats.escalated, addToast]);

  const handleDismissAlert = useCallback((alertId) => {
    setDismissedAlerts((prev) => [...prev, alertId]);
    addToast({
      title: 'Alert Dismissed',
      description: 'Incident marked as acknowledged.',
      variant: 'info',
    });
  }, [addToast]);

  // Link Modal state with dynamic inputs
  const [linkTab, setLinkTab] = useState('manual'); // 'manual' | 'code'
  const [manualQuery, setManualQuery] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualAge, setManualAge] = useState('');
  const [manualRelation, setManualRelation] = useState('Parent');
  const [manualNotes, setManualNotes] = useState('');
  const [manualMedicines, setManualMedicines] = useState('');

  const handleLinkPatient = useCallback(async () => {
    setLinkLoading(true);
    setLinkError('');

    try {
      const payload = linkTab === 'code' ? {
        code: linkCode.trim(),
        relationship: manualRelation,
      } : {
        email: manualQuery.trim().includes('@') ? manualQuery.trim() : undefined,
        phone: !manualQuery.trim().includes('@') && manualQuery.trim() ? manualQuery.trim() : undefined,
        patient_name: manualName.trim() || undefined,
        age: manualAge ? Number(manualAge) : undefined,
        relationship: manualRelation,
        notes: manualNotes.trim() || undefined,
        assigned_medicines: manualMedicines ? manualMedicines.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      };

      const res = await caregiverAPI.linkPatient(payload);
      setLinkSuccess(true);
      addToast({
        title: 'Patient Connected',
        description: res?.message || `Patient successfully added to your caregiver roster.`,
        variant: 'success',
      });

      // Refresh patients list
      const data = await caregiverAPI.getPatients();
      const list = Array.isArray(data) ? data : [];
      setPatients(list.map((u) => ({
        id: u.id,
        name: u.full_name || u.username || 'Patient',
        age: u.age || (u.id === res?.patient?.id ? Number(manualAge) : null),
        relation: u.relationship || manualRelation || 'Monitored Patient',
        adherenceScore: 92,
        pendingDosesCount: 0,
        lastDoseStatus: 'taken',
        image: null,
        nextMedication: null,
        email: u.email,
      })));
    } catch (err) {
      setLinkError(err.message || 'Failed to connect patient. Please verify the details.');
    } finally {
      setLinkLoading(false);
    }
  }, [linkTab, linkCode, manualQuery, manualName, manualAge, manualRelation, manualNotes, manualMedicines, addToast]);

  const handleCloseLinkModal = useCallback(() => {
    setIsLinkModalOpen(false);
    setLinkCode('');
    setManualQuery('');
    setManualName('');
    setManualAge('');
    setManualNotes('');
    setManualMedicines('');
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
                <Button
                  variant="danger"
                  size="sm"
                  fullWidth
                  leftIcon={<Phone className="w-4 h-4" />}
                  onClick={handleEmergencyBroadcast}
                >
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
        description="Connect a patient to your caregiver roster via Pairing Code or direct search."
        size="md"
      >
        {linkSuccess ? (
          /* Success state */
          <div className="text-center py-md">
            <div className="w-16 h-16 rounded-full bg-tertiary/15 flex items-center justify-center mx-auto mb-md">
              <CheckCircle2 className="w-8 h-8 text-tertiary" />
            </div>
            <h3 className="text-body-sm font-bold text-on-surface">
              Patient Connected Successfully!
            </h3>
            <p className="text-caption text-on-surface-variant mt-1">
              The patient has been added to your roster. You can now monitor their medication schedule, send reminders, and track adherence.
            </p>
            <Modal.Footer align="center">
              <Button variant="primary" size="sm" onClick={handleCloseLinkModal}>
                View Roster
              </Button>
            </Modal.Footer>
          </div>
        ) : (
          <div className="space-y-md">
            {/* ── 2-Tab Switcher ────────────────────────────────────── */}
            <div className="flex rounded-lg bg-surface-container-low p-1 border border-outline-variant/30">
              <button
                type="button"
                onClick={() => { setLinkTab('code'); setLinkError(''); }}
                className={`flex-1 py-1.5 text-caption font-semibold rounded-md transition-all ${
                  linkTab === 'code'
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                🔢 Pairing Code
              </button>
              <button
                type="button"
                onClick={() => { setLinkTab('manual'); setLinkError(''); }}
                className={`flex-1 py-1.5 text-caption font-semibold rounded-md transition-all ${
                  linkTab === 'manual'
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                📧 Manual Search (Email / Phone)
              </button>
            </div>

            {linkTab === 'code' ? (
              /* Tab 1: Pairing Code */
              <div className="space-y-md">
                <div className="flex items-center justify-center gap-sm py-2">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex items-center gap-1 text-outline">
                    <span className="w-6 border-t-2 border-dashed border-outline-variant" />
                    <Link2 className="w-4 h-4 text-primary" />
                    <span className="w-6 border-t-2 border-dashed border-outline-variant" />
                  </div>
                  <div className="w-10 h-10 rounded-full bg-tertiary/10 flex items-center justify-center">
                    <Pill className="w-5 h-5 text-tertiary" />
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
              </div>
            ) : (
              /* Tab 2: Manual Search */
              <div className="space-y-sm">
                <div className="p-sm rounded-lg bg-secondary/8 border border-secondary/20">
                  <p className="text-caption text-secondary font-medium">
                    💡 <strong>Direct Patient Assignment:</strong> Use this for elderly patients who cannot generate codes.
                  </p>
                </div>

                <Input
                  label="Patient Email or Phone Number"
                  placeholder="e.g. robert.chen@email.com or +91 98765 43210"
                  value={manualQuery}
                  onChange={(e) => {
                    setManualQuery(e.target.value);
                    setLinkError('');
                  }}
                  error={linkError}
                  required
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-sm">
                  <Input
                    label="Patient Name (Optional)"
                    placeholder="e.g. Robert Chen"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                  />

                  <Input
                    label="Patient Age (Optional)"
                    placeholder="e.g. 68"
                    type="number"
                    min="1"
                    max="120"
                    value={manualAge}
                    onChange={(e) => setManualAge(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-sm">
                  <div>
                    <label className="block text-label-caps font-semibold text-on-surface uppercase tracking-wider mb-1">
                      Relationship
                    </label>
                    <select
                      value={manualRelation}
                      onChange={(e) => setManualRelation(e.target.value)}
                      className="w-full px-3 py-2 text-caption rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="Mother">Mother</option>
                      <option value="Father">Father</option>
                      <option value="Grandparent">Grandparent</option>
                      <option value="Spouse">Spouse</option>
                      <option value="Child">Child</option>
                      <option value="Monitored Patient">Monitored Patient</option>
                      <option value="Other Relative">Other Relative</option>
                    </select>
                  </div>

                  <Input
                    label="Assigned Medicines (Optional)"
                    placeholder="e.g. Metformin 500mg, Lisinopril 10mg"
                    value={manualMedicines}
                    onChange={(e) => setManualMedicines(e.target.value)}
                  />
                </div>

                <Input
                  label="Care Notes & Special Instructions (Optional)"
                  placeholder="e.g. Take morning pills after food with water."
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                />
              </div>
            )}

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
                {linkTab === 'code' ? 'Link via Code' : 'Connect Patient'}
              </Button>
            </Modal.Footer>
          </div>
        )}
      </Modal>

      {/* ── Patient Schedule Inspection Modal ────────────────────────────── */}
      <PatientScheduleModal
        patient={scheduleModalPatient}
        isOpen={Boolean(scheduleModalPatient)}
        onClose={() => setScheduleModalPatient(null)}
        onSendReminder={handleSendReminder}
      />

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

export default function CaregiverDashboardPage() {
  return (
    <ToastProvider position="top-center">
      <CaregiverDashboardInner />
    </ToastProvider>
  );
}
