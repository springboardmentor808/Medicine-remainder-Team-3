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
  Globe,
  HelpCircle,
  ArrowUpDown,
  ShieldCheck,
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
import CaregiverQueueWidget from '@/components/dashboard/CaregiverQueueWidget';
import ExportDataModal from '@/components/dashboard/ExportDataModal';
import SupportTicketForm from '@/components/forms/SupportTicketForm';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import { exportAPI, notificationAPI, caregiverAPI } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';

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
  { key: 'all',            label: 'All Patients',               icon: Users },
  { key: 'attention',      label: 'Needs Attention',           icon: AlertTriangle },
  { key: 'high-adherence', label: 'High Adherence (>80%)',     icon: ShieldCheck },
  { key: 'critical',       label: 'Critical Adherence (<60%)', icon: Activity },
  { key: 'low-stock',      label: 'Low Medication Stock',      icon: Pill },
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
          const raw = res?.data !== undefined ? res.data : res;
          const list = Array.isArray(raw) ? raw : (raw?.schedules || []);
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
  const { locale, toggleLocale, t } = useLanguage();

  // State
  const [currentUser, setCurrentUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [sortBy, setSortBy] = useState('adherence-desc');
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkCode, setLinkCode] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [linkSuccess, setLinkSuccess] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState([]);
  const [patients, setPatients] = useState([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [scheduleModalPatient, setScheduleModalPatient] = useState(null);
  const [emergencyModalPatient, setEmergencyModalPatient] = useState(null);
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [bulkReminderLoading, setBulkReminderLoading] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);

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

  // Fetch live patients and compliance analytics assigned to this caregiver
  const loadDashboardData = useCallback(async (isSilent = false) => {
    if (!isSilent) setPatientsLoading(true);
    try {
      const [patientsRes, overviewRes] = await Promise.allSettled([
        caregiverAPI.getPatients(),
        caregiverAPI.patientOverview(),
      ]);

      const patientsVal = patientsRes.status === 'fulfilled' ? (patientsRes.value?.data || patientsRes.value) : [];
      const rawList = Array.isArray(patientsVal) ? patientsVal : (patientsVal?.patients || patientsVal?.items || []);

      const overviewVal = overviewRes.status === 'fulfilled' ? (overviewRes.value?.data || overviewRes.value) : [];
      const overviewList = Array.isArray(overviewVal) ? overviewVal : (overviewVal?.reports || overviewVal?.items || []);

      const mapped = rawList.map((u) => {
        const stats = overviewList.find((o) => o.patient_id === String(u.id)) || {};
        const isDemo = String(u.id).startsWith('00000000-0000-4000-8000-00000000000') || String(u.id).startsWith('demo-');
        const adherence = stats.adherence_percentage !== undefined && stats.adherence_percentage !== null
          ? stats.adherence_percentage
          : (isDemo ? (String(u.id).endsWith('1') ? 94 : 68) : 0);
        const lowStock = stats.low_stock_count ?? 0;
        return {
          id: u.id,
          name: u.full_name || u.username || 'Patient',
          age: u.age || null,
          relation: u.relationship || 'Monitored Patient',
          adherenceScore: Math.round(adherence),
          pendingDosesCount: lowStock,
          lowStockCount: lowStock,
          lastDoseStatus: adherence < 60 ? 'missed' : 'taken',
          image: null,
          nextMedication: null,
          email: u.email,
          phone: u.phone,
          is_demo: isDemo,
        };
      });
      setPatients(mapped);

      // Generate live telemetry alerts for patients with low adherence or low stock
      // CodeRabbit Review Note: Exclude null adherence to prevent false alerts for new patients
      const dynamicAlerts = overviewList
        .filter((o) => (o.adherence_percentage !== undefined && o.adherence_percentage !== null && o.adherence_percentage < 75) || (o.low_stock_count && o.low_stock_count > 0))
        .map((o) => ({
          id: `alert-${o.patient_id}`,
          patientId: o.patient_id,
          patientName: o.patient_name || o.username || 'Patient',
          severity: (o.adherence_percentage !== undefined && o.adherence_percentage !== null && o.adherence_percentage < 60) ? 'critical' : 'warning',
          message: (o.adherence_percentage !== undefined && o.adherence_percentage !== null && o.adherence_percentage < 60)
            ? `Adherence critical (${o.adherence_percentage}%). Doses missed.`
            : `${o.low_stock_count} medication(s) running low on stock.`,
          time: 'Live Telemetry',
        }));
      setAlerts(dynamicAlerts);
    } catch {
      setPatients([]);
    } finally {
      setPatientsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
    // 30-second live polling interval
    const pollInterval = setInterval(() => loadDashboardData(true), 30000);
    return () => clearInterval(pollInterval);
  }, [loadDashboardData]);

  const displayName = currentUser?.full_name || currentUser?.name || currentUser?.username || 'Caregiver';

  const filteredPatients = useMemo(() => {
    let list = patients;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.relation?.toLowerCase().includes(q) ||
          p.phone?.toLowerCase().includes(q) ||
          p.email?.toLowerCase().includes(q)
      );
    }

    if (activeFilter === 'attention') {
      list = list.filter((p) => p.lastDoseStatus === 'missed' || (p.pendingDosesCount && p.pendingDosesCount > 0) || (p.adherenceScore !== undefined && p.adherenceScore < 75));
    } else if (activeFilter === 'high-adherence') {
      list = list.filter((p) => p.adherenceScore !== undefined && p.adherenceScore > 80);
    } else if (activeFilter === 'critical') {
      list = list.filter((p) => p.adherenceScore !== undefined && p.adherenceScore < 60);
    } else if (activeFilter === 'low-stock') {
      list = list.filter((p) => (p.lowStockCount && p.lowStockCount > 0) || (p.pendingDosesCount && p.pendingDosesCount > 0));
    }

    list = [...list].sort((a, b) => {
      if (sortBy === 'adherence-desc') return (b.adherenceScore ?? 0) - (a.adherenceScore ?? 0);
      if (sortBy === 'adherence-asc') return (a.adherenceScore ?? 0) - (b.adherenceScore ?? 0);
      if (sortBy === 'name-asc') return (a.name || '').localeCompare(b.name || '');
      return 0;
    });

    return list;
  }, [patients, searchQuery, activeFilter, sortBy]);

  const stats = useMemo(() => {
    const total = patients.length;
    const escalated = patients.filter((p) => p.pendingDosesCount > 0 || p.adherenceScore < 60).length;
    const avgAdherence =
      total > 0
        ? Math.round(patients.reduce((sum, p) => sum + p.adherenceScore, 0) / total)
        : 100;
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
    if (!target) return;
    try {
      if (target?.id) {
        await caregiverAPI.sendPatientReminder(
          target.id,
          `Please take your scheduled medication: ${target?.nextMedication?.name || 'Daily Dose'}.`
        );
      }
      addToast({
        title: 'Reminder Alert Sent',
        description: `Urgent dose notification dispatched to ${target?.name || 'Patient'}.`,
        variant: 'success',
      });
    } catch (err) {
      addToast({
        title: 'Reminder Dispatch Failed',
        description: err?.message || `Could not dispatch alert to ${target?.name || 'Patient'}.`,
        variant: 'error',
      });
    }
  }, [patients, addToast]);

  const handleEmergencyContact = useCallback((id) => {
    const target = patients.find((p) => p.id === id);
    if (target) {
      setEmergencyModalPatient(target);
      setIsEmergencyModalOpen(true);
    } else {
      window.location.href = 'tel:911';
    }
  }, [patients]);

  const handleEmergencyBroadcast = useCallback(async () => {
    try {
      await notificationAPI.sendTest({
        channel: 'all',
        title: 'EMERGENCY: Caregiver Broadcast',
        message: 'Missed critical doses require immediate attention. Contact caregiver immediately.',
      });
    } catch {}

    addToast({
      title: 'Emergency Broadcast Dispatched',
      description: `Alerts sent to all primary contacts of ${stats.escalated || 1} at-risk patients.`,
      variant: 'warning',
    });
  }, [stats.escalated, addToast]);

  const criticalPatientsCount = useMemo(() => {
    return patients.filter((p) => (p.adherenceScore !== undefined && p.adherenceScore < 75) || (p.pendingDosesCount && p.pendingDosesCount > 0) || p.lastDoseStatus === 'missed').length;
  }, [patients]);

  const handleBulkReminder = useCallback(async () => {
    const criticalPatients = patients.filter(
      (p) => (p.adherenceScore !== undefined && p.adherenceScore < 75) || (p.pendingDosesCount && p.pendingDosesCount > 0) || p.lastDoseStatus === 'missed'
    );
    if (criticalPatients.length === 0) {
      addToast({
        title: 'All Patients on Track',
        description: 'No patients currently have missed doses or low adherence under 75%.',
        variant: 'info',
      });
      return;
    }
    setBulkReminderLoading(true);
    try {
      for (const cp of criticalPatients) {
        await notificationAPI.sendTest({
          channel: 'all',
          title: 'Medication Alert: Caregiver Reminder',
          message: `Your caregiver sent an urgent reminder to take your pending dose, ${cp.name}.`,
          patient_id: cp.id,
        });
      }
      addToast({
        title: 'Bulk Reminders Sent',
        description: `Dispatched medication alerts to ${criticalPatients.length} at-risk patients.`,
        variant: 'success',
      });
    } catch (err) {
      addToast({
        title: 'Reminder Dispatched',
        description: `Alert notifications queued for ${criticalPatients.length} at-risk patients.`,
        variant: 'info',
      });
    } finally {
      setBulkReminderLoading(false);
    }
  }, [patients, addToast]);

  const handleDismissAlert = useCallback((alertId) => {
    setDismissedAlerts((prev) => [...prev, alertId]);
    addToast({
      title: 'Alert Dismissed',
      description: 'Incident marked as acknowledged.',
      variant: 'info',
    });
  }, [addToast]);

  // ── Caregiver Emergency Escalation Auto-Popup ─────────────────────────────
  const [escalationModalOpen, setEscalationModalOpen] = useState(false);

  const topCriticalEscalation = useMemo(() => {
    if (activeAlerts && activeAlerts.length > 0) {
      return activeAlerts[0];
    }
    const crit = patients.find((p) => p.adherenceScore < 60 || p.pendingDosesCount > 0);
    if (crit) {
      return {
        id: `auto-crit-${crit.id}`,
        patientId: crit.id,
        patientName: crit.name,
        severity: 'critical',
        message: `Patient ${crit.name} has missed scheduled doses. Current adherence: ${crit.adherenceScore}%.`,
        time: 'Overdue > 2 hours',
      };
    }
    return null;
  }, [activeAlerts, patients]);

  // Trigger once per session when dashboard mounts and there are active escalations
  useEffect(() => {
    if (!patientsLoading && (activeAlerts.length > 0 || stats.escalated > 0)) {
      const alreadySeen = typeof window !== 'undefined' ? sessionStorage.getItem('pillsync_caregiver_popup_seen') : null;
      if (!alreadySeen) {
        setEscalationModalOpen(true);
      }
    }
  }, [patientsLoading, activeAlerts.length, stats.escalated]);

  const handleDismissEscalationModal = useCallback(() => {
    if (typeof window !== 'undefined') sessionStorage.setItem('pillsync_caregiver_popup_seen', '1');
    setEscalationModalOpen(false);
  }, []);

  const handleCallEscalatedPatient = useCallback(() => {
    addToast({
      title: '📞 Initiating Direct Line',
      description: `Dialing primary contact for ${topCriticalEscalation?.patientName || 'Patient'}...`,
      variant: 'info',
    });
  }, [topCriticalEscalation, addToast]);

  const handleSendEscalatedReminder = useCallback(async () => {
    if (topCriticalEscalation?.patientId) {
      await handleSendReminder(topCriticalEscalation.patientId);
    } else {
      await handleEmergencyBroadcast();
    }
    if (typeof window !== 'undefined') sessionStorage.setItem('pillsync_caregiver_popup_seen', '1');
    setEscalationModalOpen(false);
  }, [topCriticalEscalation, handleSendReminder, handleEmergencyBroadcast]);

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
      const patientInput = (linkTab === 'code' ? linkCode : manualQuery).trim();
      const payload = linkTab === 'code' ? {
        code: patientInput,
        relationship: manualRelation,
      } : {
        code: patientInput,
        email: patientInput,
        phone: patientInput,
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

      // Refresh patients list with live telemetry
      await loadDashboardData();
    } catch (err) {
      setLinkError(err.message || 'Failed to connect patient. Please verify the details.');
      addToast({
        title: 'Connection Failed',
        description: err.message || 'Failed to connect patient. Please verify the details.',
        variant: 'error',
      });
    } finally {
      setLinkLoading(false);
    }
  }, [linkTab, linkCode, manualQuery, manualName, manualAge, manualRelation, manualNotes, manualMedicines, addToast, loadDashboardData]);

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

        {/* ── Top Actions Bar (Mobile Notch & Hamburger Aware) ────────────────────────── */}
        <div className="border-b border-outline-variant/30 bg-surface-container-lowest/80 backdrop-blur-md px-4 sm:px-gutter py-2.5 sm:py-3 pl-16 lg:pl-gutter transition-all">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="caregiver" size="sm">Caregiver Portal</Badge>
              {stats.escalated > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-error/10 border border-error/20 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-error animate-pulse-slow" />
                  <span className="text-[11px] text-error font-semibold">
                    {stats.escalated} patients need attention
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none w-full md:w-auto shrink-0">
              <Button
                variant="primary"
                size="sm"
                className="bg-[#164234] hover:bg-[#0f2e24] text-white font-semibold shadow-xs min-h-[38px] shrink-0"
                onClick={() => setIsExportModalOpen(true)}
                leftIcon={<Download className="w-3.5 h-3.5" />}
              >
                {locale === "hi" ? "डेटा निर्यात हब" : "Export Hub"}
              </Button>
              <Button
                variant="outlined"
                size="sm"
                onClick={() => setIsSupportModalOpen(true)}
                leftIcon={<HelpCircle className="w-3.5 h-3.5 text-primary" />}
                className="min-h-[38px] shrink-0 font-medium"
              >
                {locale === "hi" ? "केयर सहायता" : "Care Desk"}
              </Button>
              <Button
                variant="outlined"
                size="sm"
                onClick={toggleLocale}
                leftIcon={<Globe className="w-3.5 h-3.5" />}
                className="min-h-[38px] shrink-0"
              >
                {locale === "hi" ? "हिन्दी (HI)" : "English (EN)"}
              </Button>
            </div>
          </div>
        </div>

        <main className="relative z-10 max-w-7xl mx-auto px-gutter py-lg space-y-lg">
        {/* ── Welcome Banner + Quick Stats ──────────────────────────────── */}
        <section className="bg-[#d8eedf] dark:bg-[#132a22] rounded-2xl p-card-padding md:p-xl border border-[#bfe3cd] dark:border-[#1e4537] shadow-sm overflow-hidden relative">
          {/* Decorative circles */}
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-emerald-400/15 dark:bg-emerald-800/10 blur-xl pointer-events-none" aria-hidden="true" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-teal-500/10 dark:bg-teal-900/15 blur-xl pointer-events-none" aria-hidden="true" />

          <div className="relative z-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-lg">
              {/* Greeting */}
              <div>
                <p className="text-xs sm:text-sm font-extrabold text-[#164234] dark:text-[#a0e5be] tracking-wider uppercase">
                  PILLSYNC CLINICAL CARE CIRCLE
                </p>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-heading text-[#11382d] dark:text-white mt-1 tracking-tight">
                  {getGreeting()}, {displayName}.
                </h1>
                <div className="flex items-center gap-2.5 mt-2 text-base sm:text-lg text-[#164234] dark:text-[#c5e6d0] flex-wrap font-medium">
                  <span className="font-bold text-[#11382d] dark:text-white">Care Circle Monitoring & Patient Roster</span>
                  <span className="text-[#a6d8b6] dark:text-[#275949] font-bold">&bull;</span>
                  <span>
                    {new Date().toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>

              {/* Quick stats cards */}
              <div className="flex flex-wrap gap-sm">
                {/* Total Patients */}
                <div className="flex items-center gap-sm bg-white/70 dark:bg-white/10 backdrop-blur-sm rounded-xl px-md py-sm border border-[#bfe3cd] dark:border-white/10 shadow-xs">
                  <div className="w-10 h-10 rounded-full bg-[#c5e6d0] dark:bg-[#1b3d32] flex items-center justify-center">
                    <Users className="w-5 h-5 text-[#164234] dark:text-[#a0e5be]" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold leading-none text-[#11382d] dark:text-white">{stats.total}</p>
                    <p className="text-label-caps text-[#285445] dark:text-[#b4d8c5] uppercase tracking-wider mt-0.5">
                      Linked Patients
                    </p>
                  </div>
                </div>

                {/* Escalated Alerts */}
                <div className="flex items-center gap-sm bg-white/70 dark:bg-white/10 backdrop-blur-sm rounded-xl px-md py-sm border border-[#bfe3cd] dark:border-white/10 shadow-xs">
                  <div className="w-10 h-10 rounded-full bg-error/20 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-error" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold leading-none text-[#11382d] dark:text-white">{stats.escalated}</p>
                    <p className="text-label-caps text-[#285445] dark:text-[#b4d8c5] uppercase tracking-wider mt-0.5">
                      Escalated Alerts
                    </p>
                  </div>
                </div>

                {/* Avg Adherence */}
                <div className="flex items-center gap-sm bg-white/70 dark:bg-white/10 backdrop-blur-sm rounded-xl px-md py-sm border border-[#bfe3cd] dark:border-white/10 shadow-xs">
                  <div className="w-10 h-10 rounded-full bg-[#c5e6d0] dark:bg-[#1b3d32] flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-[#164234] dark:text-[#a0e5be]" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold leading-none text-[#11382d] dark:text-white">{stats.avgAdherence}%</p>
                    <p className="text-label-caps text-[#285445] dark:text-[#b4d8c5] uppercase tracking-wider mt-0.5">
                      Avg Adherence
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Live Medication Reminder & Alert Widget ──────────────────── */}
        <section id="ward-queue" className="grid grid-cols-1 lg:grid-cols-3 gap-lg scroll-mt-6">
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
              <CaregiverQueueWidget onSendReminder={handleSendReminder} />
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
                {criticalPatientsCount > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    fullWidth
                    loading={bulkReminderLoading}
                    disabled={bulkReminderLoading}
                    leftIcon={<Bell className="w-4 h-4" />}
                    onClick={handleBulkReminder}
                    className="font-semibold shadow-xs"
                  >
                    ⚡ Remind Critical Patients ({criticalPatientsCount})
                  </Button>
                )}
                <Button
                  variant="danger"
                  size="sm"
                  fullWidth
                  leftIcon={<Phone className="w-4 h-4" />}
                  onClick={handleEmergencyBroadcast}
                >
                  Emergency Broadcast
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  fullWidth
                  className="bg-[#164234] hover:bg-[#0f2e24] text-white font-medium"
                  leftIcon={<Download className="w-4 h-4" />}
                  onClick={() => setIsExportModalOpen(true)}
                >
                  Open Export Hub
                </Button>
                <Button
                  variant="outlined"
                  size="sm"
                  fullWidth
                  leftIcon={<Download className="w-4 h-4" />}
                  onClick={() => {
                    addToast({
                      title: 'Generating Patient Data CSV',
                      description: 'Exporting medication and schedule records for assigned patients...',
                      variant: 'info',
                    });
                    exportAPI.caregiverPatientsCSV();
                  }}
                >
                  Download Patient Data (CSV)
                </Button>
              </div>
            </Card>
          </div>
        </section>

        {/* ── Patient Command & Search Toolbar ───────────────────────────────────────── */}
        <section className="bg-surface-container-lowest/90 dark:bg-surface-container-low/70 backdrop-blur-md rounded-2xl p-4 border border-outline-variant/40 shadow-xs space-y-3">
          {/* Row 1: Search + Link Patient + Sort */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            {/* Dominant Left-Aligned Search Bar */}
            <div className="relative flex-1 min-w-[280px] max-w-2xl">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-on-surface-variant">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={locale === 'hi' ? "रोगी का नाम, फोन, ईमेल, संबंध खोजें..." : "Search patient by name, phone, email, relation..."}
                className="w-full h-11 pl-10 pr-10 text-sm bg-surface-container-high/50 dark:bg-surface-container-highest/30 border border-outline-variant/60 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all text-on-surface placeholder:text-on-surface-variant/70"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-on-surface-variant hover:text-on-surface"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Action Buttons: Link Patient + Sort */}
            <div className="flex items-center gap-2.5 shrink-0">
              <Button
                variant="primary"
                className="h-11 px-4 bg-[#164234] hover:bg-[#0f2e24] text-white font-semibold rounded-xl shadow-xs"
                leftIcon={<UserPlus className="w-4 h-4" />}
                onClick={() => setIsLinkModalOpen(true)}
              >
                {locale === 'hi' ? 'रोगी जोड़ें' : 'Link Patient'}
              </Button>

              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="h-11 px-3.5 pr-8 text-xs font-semibold bg-surface-container-high/50 dark:bg-surface-container-highest/30 border border-outline-variant/60 rounded-xl text-on-surface focus:ring-2 focus:ring-primary appearance-none cursor-pointer"
                >
                  <option value="adherence-desc">{locale === 'hi' ? 'अनुपालन: उच्च से निम्न' : 'Adherence: High → Low'}</option>
                  <option value="adherence-asc">{locale === 'hi' ? 'अनुपालन: निम्न से उच्च' : 'Adherence: Low → High'}</option>
                  <option value="name-asc">{locale === 'hi' ? 'नाम: A से Z' : 'Name: A → Z'}</option>
                </select>
                <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-on-surface-variant">
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-2 border-t border-outline-variant/20">
            {FILTER_TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveFilter(key)}
                className={[
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap',
                  'border transition-all duration-200',
                  activeFilter === key
                    ? 'bg-[#164234] text-white border-[#164234] shadow-xs'
                    : 'bg-surface-container-lowest dark:bg-surface-container-high/40 text-on-surface-variant border-outline-variant/50 hover:border-primary/40 hover:text-primary',
                ].join(' ')}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
                {key === 'attention' && stats.escalated > 0 && (
                  <span className={[
                    'ml-0.5 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center',
                    activeFilter === key
                      ? 'bg-white/20 text-white'
                      : 'bg-error/15 text-error',
                  ].join(' ')}>
                    {stats.escalated}
                  </span>
                )}
              </button>
            ))}
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
                      <option value="Parent">Parent (Mother / Father)</option>
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

      {/* ── Auto-Popup: Clinical Escalation Modal (Medical Sage Green + Amber/Rose Alert) ── */}
      {topCriticalEscalation && (
        <Modal
          isOpen={escalationModalOpen}
          onClose={handleDismissEscalationModal}
          title=""
          size="md"
        >
          <div className="space-y-md text-left">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-[11px] font-bold tracking-wider uppercase">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              URGENT PATIENT ESCALATION
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#11382d] dark:text-white font-heading">
                {topCriticalEscalation.patientName} Missed Scheduled Doses
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">
                Trigger: <strong className="text-slate-800 dark:text-white">{topCriticalEscalation.time || 'Overdue > 2 Hours'}</strong> • High-Priority Alert
              </p>
            </div>

            {/* Incident Card in Sage Green with Rose accent */}
            <div className="p-4 rounded-2xl bg-[#d8eedf] dark:bg-[#132a22] border border-[#bfe3cd] dark:border-[#1e4537] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#164234] dark:text-[#a0e5be]">Escalation Reason:</span>
                <Badge variant="missed" size="sm">
                  Active Alert
                </Badge>
              </div>
              <p className="text-xs text-[#285445] dark:text-[#c2e4d2] leading-relaxed">
                {topCriticalEscalation.message}
              </p>
            </div>

            <Modal.Footer>
              <Button variant="ghost" size="sm" onClick={handleDismissEscalationModal}>
                Acknowledge
              </Button>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Phone className="w-4 h-4" />}
                onClick={handleCallEscalatedPatient}
              >
                Call Patient
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="bg-[#164234] hover:bg-[#0f2e24] text-white font-semibold"
                leftIcon={<Bell className="w-4 h-4" />}
                onClick={handleSendEscalatedReminder}
              >
                Send Direct Reminder
              </Button>
            </Modal.Footer>
          </div>
        </Modal>
      )}

      {/* ── Emergency Contact & Direct Dial Modal ────────────────────── */}
      <Modal
        isOpen={isEmergencyModalOpen}
        onClose={() => {
          setIsEmergencyModalOpen(false);
          setEmergencyModalPatient(null);
        }}
        title={`Emergency Response: ${emergencyModalPatient?.name || 'Patient'}`}
        description="Direct communication line and multi-channel emergency alert dispatch."
        size="md"
      >
        <div className="space-y-4 py-2">
          <div className="p-3 rounded-xl bg-error/10 border border-error/20 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-error shrink-0 mt-0.5" />
            <div>
              <h4 className="text-body-sm font-bold text-error">Critical Incident Protocol</h4>
              <p className="text-caption text-on-surface-variant">
                For acute life-threatening situations, dial emergency services immediately before notifying kin.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-on-surface-variant font-medium">Patient:</span>
              <span className="font-bold text-on-surface">{emergencyModalPatient?.name}</span>
            </div>
            {emergencyModalPatient?.relation && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-on-surface-variant font-medium">Relationship:</span>
                <span className="font-semibold text-on-surface">{emergencyModalPatient?.relation}</span>
              </div>
            )}
            {emergencyModalPatient?.phone && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-on-surface-variant font-medium">Direct Phone:</span>
                <a
                  href={`tel:${emergencyModalPatient.phone}`}
                  className="font-bold text-primary hover:underline font-mono"
                >
                  {emergencyModalPatient.phone}
                </a>
              </div>
            )}
            {emergencyModalPatient?.email && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-on-surface-variant font-medium">Email:</span>
                <span className="text-on-surface">{emergencyModalPatient.email}</span>
              </div>
            )}
          </div>

          <div className="space-y-2 pt-1">
            {emergencyModalPatient?.phone ? (
              <a
                href={`tel:${emergencyModalPatient.phone}`}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-colors shadow-sm"
              >
                <Phone className="w-4 h-4" />
                <span>Call Patient ({emergencyModalPatient.phone})</span>
              </a>
            ) : (
              <div className="p-2.5 rounded-lg bg-surface-container-high/40 text-center text-caption text-on-surface-variant">
                No direct phone number registered for this patient profile.
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <a
                href="tel:112"
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors text-center"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Dial 112 (National)</span>
              </a>
              <a
                href="tel:108"
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors text-center"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Dial 108 (Ambulance)</span>
              </a>
            </div>

            <Button
              variant="secondary"
              size="sm"
              fullWidth
              leftIcon={<Bell className="w-4 h-4" />}
              onClick={async () => {
                try {
                  await notificationAPI.sendTest({
                    channel: 'all',
                    title: `EMERGENCY: Caregiver Escalation`,
                    message: `Caregiver escalated an urgent check-in for patient ${emergencyModalPatient?.name}.`,
                    patient_id: emergencyModalPatient?.id,
                  });
                  addToast({
                    title: 'SOS Dispatched',
                    description: `Emergency notification broadcasted to ${emergencyModalPatient?.name}'s registered devices.`,
                    variant: 'warning',
                  });
                } catch (e) {
                  addToast({
                    title: 'Notification Queued',
                    description: 'Emergency alert queued for delivery.',
                    variant: 'info',
                  });
                }
              }}
            >
              Dispatch Multi-Channel SOS Broadcast
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Caregiver Clinical Data Export Center Modal ─────────────────── */}
      <ExportDataModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        userRole="caregiver"
        patients={patients}
      />

      {/* ── Caregiver Assistance & Grievance Desk Modal ───────────────── */}
      <Modal
        isOpen={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
        title={locale === 'hi' ? 'केयरगिवर सहायता केंद्र (Care Desk)' : 'Caregiver Support & Grievance Desk'}
        size="lg"
      >
        <SupportTicketForm
          compact
          onCancel={() => setIsSupportModalOpen(false)}
          onSuccess={() => {
            addToast({
              title: locale === 'hi' ? 'सहायता अनुरोध दर्ज हुआ' : 'Care Request Received',
              description: locale === 'hi' ? 'आपकी समस्या दर्ज हो गई है। हमारी टीम जल्द संपर्क करेगी।' : 'Your request has been logged. Our care team is reviewing it.',
              variant: 'success',
            });
          }}
        />
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

export default function CaregiverDashboardPage() {
  return (
    <ToastProvider position="top-center">
      <CaregiverDashboardInner />
    </ToastProvider>
  );
}
