'use client';

import React, { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { exportAPI } from '@/lib/api';
import { 
  Download, 
  FileText, 
  FileSpreadsheet, 
  ShieldCheck, 
  Pill, 
  CalendarCheck, 
  Users, 
  CheckCircle2,
  Lock,
  Activity,
  Radio,
  Sparkles,
  UserCheck,
  Layers
} from 'lucide-react';

export default function ExportDataModal({ isOpen, onClose, userRole = 'patient', patients = [] }) {
  const [downloading, setDownloading] = useState(null);
  const [lastDownloaded, setLastDownloaded] = useState(null);
  const [timeframeScope, setTimeframeScope] = useState('30d');
  const [selectedPatientId, setSelectedPatientId] = useState('');

  const handleDownload = async (exportFunc, key) => {
    try {
      setDownloading(key);
      await exportFunc();
      setLastDownloaded(key);
      setTimeout(() => setDownloading(null), 1500);
    } catch (err) {
      console.error('Download error:', err);
      setDownloading(null);
    }
  };

  const isAdmin = userRole === 'admin';
  const isCaregiver = userRole === 'caregiver';
  const isPatient = !isAdmin && !isCaregiver;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="lg"
    >
      <div className="space-y-md text-left">
        {/* Header Eyebrow */}
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#d8eedf] dark:bg-[#16382c] border border-[#bfe3cd] dark:border-[#2e6d54] text-[#164234] dark:text-[#a0e5be] text-[11px] font-bold tracking-wider uppercase font-sans shadow-xs">
            <Download className="w-3.5 h-3.5 text-[#164234] dark:text-[#a0e5be]" />
            CLINICAL DATA EXPORT CENTER
          </div>
          <h3 className="text-xl sm:text-2xl font-bold font-heading text-[#11382d] dark:text-white mt-1">
            {isAdmin 
              ? 'System & Compliance Export Hub' 
              : isCaregiver 
              ? 'Caregiver Patient & Clinical Reports' 
              : 'Download Your Clinical Records'}
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            {isAdmin 
              ? 'Export consolidated executive platform dossiers, user registries, telemetry dispatches, and system diagnostic snapshots.' 
              : isCaregiver
              ? 'Generate comprehensive medication and adherence reports for assigned patients, or export your personal cabinet and combined dossiers.'
              : 'Select the health data format you need for personal records, specialist doctor appointments, or insurance claims.'}
          </p>
        </div>

        {/* Security / Compliance Badge */}
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#edf7f1] dark:bg-[#132e22] border border-[#c2e5cf] dark:border-[#20523d] text-[11px] text-[#164234] dark:text-[#a0e5be]">
          <Lock className="w-4 h-4 shrink-0 text-[#256a52]" />
          <span>
            <strong>100% Live DB Sync:</strong> Role-scoped exports stream directly from backend models with fast database connection release.
          </span>
        </div>

        {/* ── ADMIN ONLY: Grand Master Dossier Hero Card ── */}
        {isAdmin && (
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#164234] via-[#11382d] to-[#0a231c] text-white shadow-xl border-2 border-[#2e6d54] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-[#a0e5be]/20 text-[#a0e5be] flex items-center justify-center border border-[#a0e5be]/30">
                  <Sparkles className="w-4 h-4" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#a0e5be]/20 text-[#a0e5be] uppercase tracking-wider border border-[#a0e5be]/30">
                      ★ ALL-IN-ONE EXECUTIVE DOSSIER
                    </span>
                    <span className="text-[10px] text-[#a0e5be]/80 font-mono">~8 to 10 Pages</span>
                  </div>
                  <h4 className="text-base font-bold font-heading text-white mt-0.5">
                    Master System & Clinical Operations Dossier (PDF)
                  </h4>
                </div>
              </div>
              <div className="flex items-center gap-1 bg-black/30 p-1 rounded-xl border border-white/10 text-[10px]">
                {[
                  { id: '30d', label: '⚡ 30 Days' },
                  { id: '90d', label: '🗓️ 90 Days' },
                  { id: 'all', label: '🗄️ Full Archive' },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setTimeframeScope(s.id)}
                    className={`px-2.5 py-1 min-h-[32px] sm:min-h-0 rounded-lg font-semibold transition-all flex items-center justify-center ${
                      timeframeScope === s.id
                        ? 'bg-[#a0e5be] text-[#0a231c] shadow-xs'
                        : 'text-[#a0e5be]/70 hover:text-white'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-[#d8eedf] leading-relaxed">
              Consolidates <strong>all operational dimensions into a single signed document</strong>: Executive KPI Scorecard, Master User & RBAC Directory, System Infrastructure & DB Health, Formulary & Stock Inventory, Multi-Channel Telemetry (Twilio SMS/Push), and Cryptographic SHA-256 Audit Trail.
            </p>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-white/10">
              <div className="flex items-center gap-2 text-[10px] text-[#a0e5be]/90 font-mono">
                <span>✓ Cover + TOC</span>
                <span>•</span>
                <span>✓ User Roster</span>
                <span>•</span>
                <span>✓ Server Health</span>
                <span>•</span>
                <span>✓ Telemetry</span>
                <span>•</span>
                <span>✓ Signed Hash</span>
              </div>
              <Button
                variant="primary"
                size="sm"
                className="bg-[#3fd38d] hover:bg-[#34b679] text-[#0a231c] shrink-0 font-bold shadow-md hover:scale-102 transition-transform min-h-[40px] sm:min-h-0"
                onClick={() => handleDownload(() => exportAPI.masterPDF(timeframeScope), 'master_pdf')}
                disabled={downloading === 'master_pdf'}
              >
                {downloading === 'master_pdf' ? 'Generating 10-Page Dossier…' : 'Generate Master Dossier (PDF)'}
              </Button>
            </div>
          </div>
        )}

        {/* ── CAREGIVER ONLY: Hero Card for Assigned Patients ── */}
        {isCaregiver && (
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#164234] via-[#11382d] to-[#0a231c] text-white shadow-xl border-2 border-[#2e6d54] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-[#a0e5be]/20 text-[#a0e5be] flex items-center justify-center border border-[#a0e5be]/30">
                  <UserCheck className="w-4 h-4" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#a0e5be]/20 text-[#a0e5be] uppercase tracking-wider border border-[#a0e5be]/30">
                      CLINICAL PATIENT OVERSIGHT
                    </span>
                    <span className="text-[10px] text-[#a0e5be]/80 font-mono">
                      {selectedPatientId ? '1 Patient Selected' : 'All Assigned Patients'}
                    </span>
                  </div>
                  <h4 className="text-base font-bold font-heading text-white mt-0.5">
                    Assigned Patients Medication & Adherence Report
                  </h4>
                </div>
              </div>

              {/* Patient Selector Filter */}
              {patients && patients.length > 0 && (
                <div className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-xl border border-white/10 text-xs">
                  <span className="text-[11px] text-[#a0e5be] font-medium">Filter:</span>
                  <select
                    value={selectedPatientId}
                    onChange={(e) => setSelectedPatientId(e.target.value)}
                    className="bg-transparent text-white text-xs border-0 focus:ring-0 cursor-pointer pr-4"
                  >
                    <option value="" className="bg-[#11382d] text-white">All Patients ({patients.length})</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id} className="bg-[#11382d] text-white">
                        {p.full_name || p.username}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <p className="text-xs text-[#d8eedf] leading-relaxed">
              Exports comprehensive medication rosters, remaining days of stock, schedule patterns, and caregiver monitoring logs for your assigned care circle.
            </p>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-white/10">
              <div className="flex items-center gap-2 text-[10px] text-[#a0e5be]/90 font-mono">
                <span>✓ Active Meds</span>
                <span>•</span>
                <span>✓ Stock Levels</span>
                <span>•</span>
                <span>✓ Dose Schedules</span>
                <span>•</span>
                <span>✓ Clinical Notes</span>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/30 text-white hover:bg-white/10 text-xs font-semibold min-h-[36px]"
                  onClick={() => handleDownload(() => exportAPI.caregiverPatientsCSV(selectedPatientId || null), 'cg_patients_csv')}
                  disabled={downloading === 'cg_patients_csv'}
                >
                  {downloading === 'cg_patients_csv' ? 'Exporting…' : 'Export CSV'}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  className="bg-[#3fd38d] hover:bg-[#34b679] text-[#0a231c] shrink-0 font-bold shadow-md hover:scale-102 transition-transform text-xs min-h-[36px]"
                  onClick={() => handleDownload(() => exportAPI.caregiverPatientsPDF(selectedPatientId || null), 'cg_patients_pdf')}
                  disabled={downloading === 'cg_patients_pdf'}
                >
                  {downloading === 'cg_patients_pdf' ? 'Generating PDF…' : 'Download Clinical PDF'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Modular Single-Click Exports ── */}
        <div>
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
            {isAdmin 
              ? 'Modular Specialized Exports (Task-Specific)' 
              : isCaregiver
              ? 'Additional Caregiver Export Streams'
              : 'Available Export Streams'}
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Admin Stream 1: Master Database CSV (All users + meds + schedules) */}
            {isAdmin && (
              <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#edf7f1] dark:bg-[#132e22] text-[#164234] dark:text-[#a0e5be] flex items-center justify-center shrink-0 mt-0.5">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-[#11382d] dark:text-white">
                      Complete Platform Database (CSV)
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Unified export of all registered users, medications, and schedules across the entire platform.
                    </p>
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full text-xs font-semibold bg-[#164234] text-white"
                  onClick={() => handleDownload(exportAPI.adminAllCSV, 'admin_all_csv')}
                  disabled={downloading === 'admin_all_csv'}
                >
                  {downloading === 'admin_all_csv' ? 'Exporting…' : 'Download All Database (CSV)'}
                </Button>
              </div>
            )}

            {/* Caregiver Stream 1: Combined Personal + Patients Master */}
            {isCaregiver && (
              <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#edf7f1] dark:bg-[#132e22] text-[#164234] dark:text-[#a0e5be] flex items-center justify-center shrink-0 mt-0.5">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-[#11382d] dark:text-white">
                      Combined Master Dossier
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Caregiver personal medicine cabinet AND assigned patients data in one combined report.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs font-semibold"
                    onClick={() => handleDownload(exportAPI.caregiverCombinedCSV, 'cg_comb_csv')}
                    disabled={downloading === 'cg_comb_csv'}
                  >
                    {downloading === 'cg_comb_csv' ? 'CSV…' : 'CSV'}
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="text-xs font-semibold bg-[#164234] text-white"
                    onClick={() => handleDownload(exportAPI.caregiverCombinedPDF, 'cg_comb_pdf')}
                    disabled={downloading === 'cg_comb_pdf'}
                  >
                    {downloading === 'cg_comb_pdf' ? 'PDF…' : 'PDF'}
                  </Button>
                </div>
              </div>
            )}

            {/* Caregiver Stream 2: Personal Cabinet Only */}
            {isCaregiver && (
              <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#edf7f1] dark:bg-[#132e22] text-[#164234] dark:text-[#a0e5be] flex items-center justify-center shrink-0 mt-0.5">
                    <Pill className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-[#11382d] dark:text-white">
                      Caregiver Personal Cabinet
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Caregiver personal medications, stock counts, and daily frequencies only.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs font-semibold"
                    onClick={() => handleDownload(exportAPI.medicinesCSV, 'cg_own_csv')}
                    disabled={downloading === 'cg_own_csv'}
                  >
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs font-semibold"
                    onClick={() => handleDownload(exportAPI.medicinesPDF, 'cg_own_pdf')}
                    disabled={downloading === 'cg_own_pdf'}
                  >
                    PDF
                  </Button>
                </div>
              </div>
            )}

            {/* Patient Stream 1: Complete Dossier */}
            {isPatient && (
              <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#edf7f1] dark:bg-[#132e22] text-[#164234] dark:text-[#a0e5be] flex items-center justify-center shrink-0 mt-0.5">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-[#11382d] dark:text-white">
                      Complete Health Dossier
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Print-ready clinical summary with active regimens, stock counts, and schedules.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs font-semibold"
                    onClick={() => handleDownload(exportAPI.allCSV, 'all_csv')}
                    disabled={downloading === 'all_csv'}
                  >
                    CSV
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="text-xs font-semibold bg-[#164234] text-white"
                    onClick={() => handleDownload(exportAPI.allPDF, 'all_pdf')}
                    disabled={downloading === 'all_pdf'}
                  >
                    PDF
                  </Button>
                </div>
              </div>
            )}

            {/* Patient Stream 2: Medication Cabinet */}
            {isPatient && (
              <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#edf7f1] dark:bg-[#132e22] text-[#164234] dark:text-[#a0e5be] flex items-center justify-center shrink-0 mt-0.5">
                    <Pill className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-[#11382d] dark:text-white">
                      Medication Cabinet
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Active prescriptions, dosages, and remaining pill stock counts.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs font-semibold"
                    onClick={() => handleDownload(exportAPI.medicinesCSV, 'meds_csv')}
                    disabled={downloading === 'meds_csv'}
                  >
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs font-semibold"
                    onClick={() => handleDownload(exportAPI.medicinesPDF, 'meds_pdf')}
                    disabled={downloading === 'meds_pdf'}
                  >
                    PDF
                  </Button>
                </div>
              </div>
            )}

            {/* Admin Stream 2: Security Audit Trail */}
            {isAdmin && (
              <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#edf7f1] dark:bg-[#132e22] text-[#164234] dark:text-[#a0e5be] flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-[#11382d] dark:text-white">
                      Security Audit Trail
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Immutable authentication logs, sensitive exports, and role updates.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs font-semibold"
                    onClick={() => handleDownload(exportAPI.auditCSV, 'audit_csv')}
                    disabled={downloading === 'audit_csv'}
                  >
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs font-semibold"
                    onClick={() => handleDownload(exportAPI.auditPDF, 'audit_pdf')}
                    disabled={downloading === 'audit_pdf'}
                  >
                    PDF
                  </Button>
                </div>
              </div>
            )}

            {/* Admin Stream 3: System Health Diagnostics */}
            {isAdmin && (
              <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#edf7f1] dark:bg-[#132e22] text-[#164234] dark:text-[#a0e5be] flex items-center justify-center shrink-0 mt-0.5">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-[#11382d] dark:text-white">
                      System Health & Diagnostics
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      PostgreSQL pool latency, Redis memory, CPU load, and SLA uptime.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs font-semibold"
                    onClick={() => handleDownload(exportAPI.healthCSV, 'health_csv')}
                    disabled={downloading === 'health_csv'}
                  >
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs font-semibold"
                    onClick={() => handleDownload(exportAPI.healthPDF, 'health_pdf')}
                    disabled={downloading === 'health_pdf'}
                  >
                    PDF
                  </Button>
                </div>
              </div>
            )}

            {/* Adherence Log (Patient & Caregiver) */}
            {!isAdmin && (
              <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#edf7f1] dark:bg-[#132e22] text-[#164234] dark:text-[#a0e5be] flex items-center justify-center shrink-0 mt-0.5">
                    <CalendarCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-[#11382d] dark:text-white">
                      Adherence Log (CSV)
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Time-stamped dose event history of taken, missed, and snoozed medication alerts.
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs font-semibold"
                  onClick={() => handleDownload(exportAPI.adherenceCSV, 'adh_csv')}
                  disabled={downloading === 'adh_csv'}
                >
                  Download Adherence CSV
                </Button>
              </div>
            )}

            {/* Admin Stream 4: Notification Telemetry Logs */}
            {isAdmin && (
              <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#edf7f1] dark:bg-[#132e22] text-[#164234] dark:text-[#a0e5be] flex items-center justify-center shrink-0 mt-0.5">
                    <Radio className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-[#11382d] dark:text-white">
                      Multi-Channel Telemetry (CSV)
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      24-hour delivery records across Twilio SMS, WhatsApp, and Push.
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs font-semibold"
                  onClick={() => handleDownload(exportAPI.telemetryCSV, 'telemetry_csv')}
                  disabled={downloading === 'telemetry_csv'}
                >
                  Download CSV
                </Button>
              </div>
            )}
          </div>
        </div>

        {lastDownloaded && (
          <p className="text-[11px] text-[#256a52] dark:text-[#a0e5be] font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#3fd38d]" />
            File download initiated from backend database stream.
          </p>
        )}

        <Modal.Footer align="right">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </Modal.Footer>
      </div>
    </Modal>
  );
}
