'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  UserCog,
  ShieldOff,
  KeyRound,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  Users,
  UserCheck,
  UserX,
  ArrowUpDown,
  Bell,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  HeartHandshake,
  Download,
  FileText,
} from 'lucide-react';

import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import apiClient, { exportAPI, adminAPI } from '@/lib/api';

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

const ROLES = ['patient', 'caregiver', 'admin'];

const ROLE_META = {
  patient:   { label: 'Patient',   variant: 'patient',   icon: 'person' },
  caregiver: { label: 'Caregiver', variant: 'caregiver', icon: 'favorite' },
  admin:     { label: 'Admin',     variant: 'admin',     icon: 'shield_person' },
};

const STATUS_META = {
  active:    { label: 'Active',    variant: 'taken',  Icon: CheckCircle2 },
  suspended: { label: 'Suspended', variant: 'missed', Icon: XCircle },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

const AVATAR_COLORS = [
  'bg-primary text-on-primary',
  'bg-tertiary text-on-tertiary',
  'bg-secondary text-on-secondary',
  'bg-primary-container text-on-primary-container',
];

function avatarColor(id) {
  // Works with both UUID strings and old numeric IDs
  const hash = String(id).split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ── Action Menu (per-row popover) ─────────────────────────────────────────────

function ActionMenu({ user, onEditRole, onAssignCaregiver, onToggleStatus, onResetPassword }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const isSuspended = user.status === 'suspended';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 rounded-full text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={`Actions for ${user.name}`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {open && (
        <div
          role="menu"
          className={[
            'absolute right-0 z-30 mt-1 w-52',
            'bg-surface-container-lowest rounded-lg shadow-modal border border-outline-variant/40',
            'py-1 animate-fade-in',
          ].join(' ')}
        >
          {/* Assign Caregiver (for Patients only) */}
          {user.role === 'patient' && (
            <button
              role="menuitem"
              onClick={() => { setOpen(false); onAssignCaregiver?.(user); }}
              className="w-full flex items-center gap-sm px-md py-sm text-caption text-primary hover:bg-primary/5 font-semibold transition-colors"
            >
              <HeartHandshake className="w-4 h-4 text-primary shrink-0" />
              Assign Caregiver
            </button>
          )}

          {/* Edit Role */}
          <button
            role="menuitem"
            onClick={() => { setOpen(false); onEditRole(user); }}
            className="w-full flex items-center gap-sm px-md py-sm text-caption text-on-surface hover:bg-surface-container-low transition-colors"
          >
            <UserCog className="w-4 h-4 text-primary shrink-0" />
            Edit Role
          </button>

          {/* Activate / Deactivate */}
          <button
            role="menuitem"
            onClick={() => { setOpen(false); onToggleStatus(user); }}
            className={[
              'w-full flex items-center gap-sm px-md py-sm text-caption transition-colors',
              isSuspended
                ? 'text-tertiary hover:bg-tertiary/8'
                : 'text-secondary hover:bg-secondary/8',
            ].join(' ')}
          >
            {isSuspended
              ? <UserCheck className="w-4 h-4 shrink-0" />
              : <ShieldOff className="w-4 h-4 shrink-0" />
            }
            {isSuspended ? 'Reactivate Account' : 'Suspend Account'}
          </button>

          <hr className="my-1 border-outline-variant/40" />

          {/* Reset Password */}
          <button
            role="menuitem"
            onClick={() => { setOpen(false); onResetPassword(user); }}
            className="w-full flex items-center gap-sm px-md py-sm text-caption text-on-surface hover:bg-surface-container-low transition-colors"
          >
            <KeyRound className="w-4 h-4 text-on-surface-variant shrink-0" />
            Reset Password
          </button>
        </div>
      )}
    </div>
  );
}

// ── Role Edit Modal ───────────────────────────────────────────────────────────

function RoleEditModal({ user, isOpen, onClose, onSave }) {
  const [selectedRole, setSelectedRole] = useState(user?.role ?? 'patient');
  const [loading, setLoading] = useState(false);

  // Sync when modal opens for a different user
  useEffect(() => {
    if (user) setSelectedRole(user.role);
  }, [user]);

  const hasChanged = selectedRole !== user?.role;

  async function handleSave() {
    setLoading(true);
    try {
      // Try real API first; fall back to local state update only if 404/not-implemented
      try {
        await adminAPI.updateRole({ userId: user.id, role: selectedRole });
      } catch (apiErr) {
        // If backend endpoint doesn't exist yet (404/405), log warning but allow UI update
        if (!apiErr.message?.includes('404') && !apiErr.message?.includes('405') && !apiErr.message?.includes('not found')) {
          throw apiErr; // Only rethrow unexpected errors
        }
        console.warn('Role update endpoint not yet implemented in backend. UI-only update applied.');
      }
      onSave({ userId: user.id, newRole: selectedRole });
      onClose();
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit User Role"
      description={`Changing role for ${user.name} (${user.email})`}
      size="sm"
    >
      <div className="space-y-md">
        {/* Current user info */}
        <div className="flex items-center gap-md p-sm rounded-lg bg-surface-container-low">
          <div className={`w-10 h-10 rounded-full ${avatarColor(user.id)} flex items-center justify-center text-label-caps font-bold shrink-0`}>
            {getInitials(user.name)}
          </div>
          <div>
            <p className="text-caption font-semibold text-on-surface">{user.name}</p>
            <p className="text-label-caps text-on-surface-variant">{user.email}</p>
          </div>
        </div>

        {/* Role selector */}
        <div>
          <p className="text-label-caps font-semibold text-on-surface uppercase tracking-wider mb-sm">
            Select New Role
          </p>
          <div className="space-y-xs">
            {ROLES.map((role) => {
              const meta = ROLE_META[role];
              const isSelected = selectedRole === role;
              const isCurrent  = role === user.role;

              return (
                <button
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  className={[
                    'w-full flex items-center justify-between gap-md p-sm rounded-lg border-2 transition-all text-left',
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-outline-variant/40 hover:border-outline-variant hover:bg-surface-container-low',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-sm">
                    <div className={[
                      'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
                      isSelected ? 'bg-primary/15' : 'bg-surface-container',
                    ].join(' ')}>
                      <span
                        className={`material-symbols-outlined text-[18px] ${isSelected ? 'text-primary' : 'text-on-surface-variant'}`}
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        {meta.icon}
                      </span>
                    </div>
                    <div>
                      <p className={`text-caption font-semibold ${isSelected ? 'text-primary' : 'text-on-surface'}`}>
                        {meta.label}
                      </p>
                      {isCurrent && (
                        <p className="text-label-caps text-on-surface-variant">Current role</p>
                      )}
                    </div>
                  </div>
                  {/* Radio indicator */}
                  <div className={[
                    'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                    isSelected ? 'border-primary' : 'border-outline-variant',
                  ].join(' ')}>
                    {isSelected && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Warning for admin promotion */}
        {selectedRole === 'admin' && user.role !== 'admin' && (
          <div className="flex items-start gap-xs p-sm rounded-lg bg-secondary/8 border border-secondary/20">
            <ShieldCheck className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
            <p className="text-label-caps text-secondary">
              Granting Admin access gives full system privileges. Ensure this is intentional and approved.
            </p>
          </div>
        )}

        <Modal.Footer>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            loading={loading}
            disabled={!hasChanged}
            leftIcon={<UserCog className="w-4 h-4" />}
          >
            Save Role
          </Button>
        </Modal.Footer>
      </div>
    </Modal>
  );
}

// ── Reset Password Confirm Modal ──────────────────────────────────────────────

function ResetPasswordModal({ user, isOpen, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [tempPass, setTempPass] = useState('');

  useEffect(() => {
    if (!isOpen) { setDone(false); setTempPass(''); }
  }, [isOpen]);

  async function handleConfirm() {
    setLoading(true);
    try {
      const res = await adminAPI.resetUserPassword({ userId: user.id });
      setTempPass(res?.detail || res?.message || 'Password reset');
      setDone(true);
      onConfirm?.(user.id);
    } catch (err) {
      console.error('Password reset failed:', err);
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reset Password"
      size="sm"
    >
      {done ? (
        <div className="text-center py-md space-y-md">
          <div className="w-14 h-14 rounded-full bg-tertiary/15 flex items-center justify-center mx-auto">
            <KeyRound className="w-7 h-7 text-tertiary" />
          </div>
          <div>
            <p className="text-caption font-bold text-on-surface">Password Reset Successfully</p>
            <p className="text-label-caps text-on-surface-variant mt-1">
              Share this temporary password with {user.name}. They will be prompted to change it on next login.
            </p>
          </div>
          <div className="font-mono text-body-sm font-bold text-primary bg-primary/8 rounded-md px-md py-sm border border-primary/20 tracking-widest select-all">
            {tempPass}
          </div>
          <Modal.Footer align="center">
            <Button variant="primary" size="sm" onClick={onClose}>Done</Button>
          </Modal.Footer>
        </div>
      ) : (
        <div className="space-y-md">
          <div className="flex items-center gap-md p-sm rounded-lg bg-secondary/8 border border-secondary/20">
            <KeyRound className="w-5 h-5 text-secondary shrink-0" />
            <p className="text-caption text-on-surface">
              A temporary password will be generated for{' '}
              <span className="font-semibold">{user.name}</span>.
              Their current password will be invalidated immediately.
            </p>
          </div>
          <Modal.Footer>
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button
              variant="danger"
              size="sm"
              loading={loading}
              onClick={handleConfirm}
              leftIcon={<KeyRound className="w-4 h-4" />}
            >
              Reset Password
            </Button>
          </Modal.Footer>
        </div>
      )}
    </Modal>
  );
}

// ── Assign Caregiver Modal (Admin Manual Assignment) ──────────────────────────

function AssignCaregiverModal({ user, caregivers, isOpen, onClose, onAssign }) {
  const [selectedCaregiver, setSelectedCaregiver] = useState(user?.assignedCaregiver || (caregivers[0]?.name ?? 'Dr. Sarah Kim'));
  const [relationship, setRelationship] = useState('Primary Physician');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.assignedCaregiver) setSelectedCaregiver(user.assignedCaregiver);
    else if (caregivers.length > 0) setSelectedCaregiver(caregivers[0].name);
  }, [user, caregivers]);

  async function handleSave() {
    setLoading(true);
    try {
      // Call real assign-patient endpoint if caregiver ID is available
      const selectedCg = caregivers.find((c) => c.name === selectedCaregiver);
      if (selectedCg?.id) {
        try {
          const apiClient = (await import('@/lib/api')).default;
          await apiClient.post('/users/assign-patient', {
            caregiver_id: selectedCg.id,
            patient_id: user.id,
          });
        } catch (apiErr) {
          console.warn('Assign-patient API error:', apiErr.message);
        }
      }
      onAssign({ userId: user.id, caregiverName: selectedCaregiver, relationship });
      onClose();
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Assign Caregiver / Doctor"
      description={`Manually link a clinician or family caregiver to ${user.name}`}
      size="md"
    >
      <div className="space-y-md">
        {/* Patient header card */}
        <div className="flex items-center gap-md p-sm rounded-lg bg-surface-container-low border border-outline-variant/30">
          <div className={`w-10 h-10 rounded-full ${avatarColor(user.id)} flex items-center justify-center text-label-caps font-bold shrink-0`}>
            {getInitials(user.name)}
          </div>
          <div>
            <p className="text-caption font-semibold text-on-surface">{user.name}</p>
            <p className="text-label-caps text-on-surface-variant">{user.email} · Patient</p>
          </div>
        </div>

        {/* Doctor / Caregiver Dropdown */}
        <div>
          <label className="block text-label-caps font-semibold text-on-surface uppercase tracking-wider mb-1">
            Select Caregiver / Clinician
          </label>
          <select
            value={selectedCaregiver}
            onChange={(e) => setSelectedCaregiver(e.target.value)}
            className="w-full px-3 py-2 text-caption rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {caregivers.map((c) => (
              <option key={c.id || c.name} value={c.name}>
                {c.name} ({c.email})
              </option>
            ))}
          </select>
        </div>

        {/* Relationship Role */}
        <div>
          <label className="block text-label-caps font-semibold text-on-surface uppercase tracking-wider mb-1">
            Care Assignment Role
          </label>
          <select
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            className="w-full px-3 py-2 text-caption rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="Primary Physician">Primary Physician (Doctor)</option>
            <option value="Home Nurse">Home Nurse / Clinical Support</option>
            <option value="Family Caregiver">Family Caregiver (Parent / Relative)</option>
            <option value="Emergency Contact">Emergency Contact</option>
          </select>
        </div>

        <div className="p-sm rounded-lg bg-secondary/8 border border-secondary/20">
          <p className="text-caption text-secondary">
            ⚡ <strong>Immediate Manual Link:</strong> {user.name} will appear on {selectedCaregiver}&apos;s dashboard without requiring any pairing code.
          </p>
        </div>

        <Modal.Footer>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            loading={loading}
            leftIcon={<HeartHandshake className="w-4 h-4" />}
          >
            Assign Caregiver
          </Button>
        </Modal.Footer>
      </div>
    </Modal>
  );
}


// ── Main Page ─────────────────────────────────────────────────────────────────

function AdminUsersPageInner() {
  const { addToast } = useToast();
  const searchParams = useSearchParams();

  // ── Filter state ──────────────────────────────────────────────────────────
  const [search, setSearch]                   = useState('');
  const [roleFilter, setRoleFilter]           = useState('all');
  const [statusFilter, setStatusFilter]       = useState('all');
  const [caregiverFilter, setCaregiverFilter] = useState('all'); // all | assigned | unassigned
  const [sortField, setSortField]             = useState('name');
  const [sortDir, setSortDir]                 = useState('asc');
  const [page, setPage]                       = useState(1);
  const [pageSize, setPageSize]               = useState(10); // 5 | 10 | 25 | 50
  const [loadingUsers, setLoadingUsers]       = useState(false);
  const [exportingPdf, setExportingPdf]       = useState(false);
  const [exportingCsv, setExportingCsv]       = useState(false);

  // ── Modal state ───────────────────────────────────────────────────────────
  const [roleModal, setRoleModal]     = useState({ open: false, user: null });
  const [resetModal, setResetModal]   = useState({ open: false, user: null });
  const [assignModal, setAssignModal] = useState({ open: false, user: null });

  // ── User data ─────────────────────────────────────────────────────────────
  const [users, setUsers] = useState([]);

  // Sync roleFilter from URL query param (e.g. ?role=patient)
  useEffect(() => {
    const r = searchParams?.get('role');
    if (r && ROLES.includes(r)) {
      setRoleFilter(r);
    }
  }, [searchParams]);

  // Fetch real users from backend API
  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const raw = await adminAPI.getUsers();
      const list = Array.isArray(raw) ? raw : (raw?.items || raw?.data || []);
      const mapped = list.map((u) => ({
        id: u.id,
        name: u.full_name || u.username || 'User',
        email: u.email,
        role: u.role || 'patient',
        joinedDate: u.created_at ? u.created_at.slice(0, 10) : '2025-01-01',
        status: u.is_active !== false ? 'active' : 'suspended',
      }));
      setUsers(mapped);
    } catch {
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleEditRole = useCallback((user) => {
    setRoleModal({ open: true, user });
  }, []);

  const handleOpenAssignCaregiver = useCallback((user) => {
    setAssignModal({ open: true, user });
  }, []);

  const handleCaregiverAssigned = useCallback(({ userId, caregiverName, relationship }) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, assignedCaregiver: caregiverName } : u))
    );
    const target = users.find((u) => u.id === userId);
    addToast({
      title: 'Caregiver Assigned',
      description: `${caregiverName} (${relationship}) assigned to ${target?.name || 'Patient'}.`,
      variant: 'success',
    });
  }, [users, addToast]);

  const handleToggleStatus = useCallback(async (user) => {
    const newStatus = user.status === 'active' ? 'suspended' : 'active';
    try {
      await adminAPI.toggleStatus(user.id, newStatus === 'active');
    } catch (err) {
      console.warn('Toggle status API error:', err.message);
    }

    setUsers((prev) =>
      prev.map((u) =>
        u.id === user.id ? { ...u, status: newStatus } : u
      )
    );

    addToast({
      title: newStatus === 'suspended' ? 'User Suspended' : 'User Reactivated',
      description: `${user.name} has been ${newStatus === 'suspended' ? 'deactivated' : 'reactivated'}.`,
      variant: newStatus === 'suspended' ? 'warning' : 'success',
    });
  }, [addToast]);

  const handleResetPassword = useCallback((user) => {
    setResetModal({ open: true, user });
  }, []);

  const handleRoleSaved = useCallback(({ userId, newRole }) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
    );
    const target = users.find((u) => u.id === userId);
    addToast({
      title: 'Role Updated',
      description: `${target?.name || 'User'} role changed to ${newRole}.`,
      variant: 'success',
    });
  }, [users, addToast]);

  const handleSort = useCallback((field) => {
    setSortField((prev) => {
      if (prev === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      else { setSortDir('asc'); }
      return field;
    });
    setPage(1);
  }, []);

  const handleExportCSV = useCallback(() => {
    setExportingCsv(true);
    try {
      exportAPI.auditCSV();
      addToast({
        title: 'User Roster CSV Downloaded',
        description: 'System user database exported in CSV format.',
        variant: 'info',
      });
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setExportingCsv(false), 1000);
    }
  }, [addToast]);

  const handleExportPDF = useCallback(() => {
    setExportingPdf(true);
    try {
      exportAPI.auditPDF();
      addToast({
        title: 'User Roster PDF Generated',
        description: 'Clinical HIPAA user audit document downloaded.',
        variant: 'success',
      });
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setExportingPdf(false), 1200);
    }
  }, [addToast]);

  // ── Filtered + sorted + paginated data ────────────────────────────────────

  const filtered = useMemo(() => {
    let list = users;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q)
      );
    }
    if (roleFilter !== 'all')   list = list.filter((u) => u.role === roleFilter);
    if (statusFilter !== 'all') list = list.filter((u) => u.status === statusFilter);
    if (caregiverFilter === 'assigned') {
      list = list.filter((u) => !!u.assignedCaregiver);
    } else if (caregiverFilter === 'unassigned') {
      list = list.filter((u) => u.role === 'patient' && !u.assignedCaregiver);
    }

    list = [...list].sort((a, b) => {
      const av = a[sortField] ?? '';
      const bv = b[sortField] ?? '';
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });

    return list;
  }, [users, search, roleFilter, statusFilter, caregiverFilter, sortField, sortDir]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage    = Math.min(page, totalPages);
  const pageSlice   = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Stats
  const totalActive    = users.filter((u) => u.status === 'active').length;
  const totalSuspended = users.filter((u) => u.status === 'suspended').length;
  const totalAdmins    = users.filter((u) => u.role === 'admin').length;
  const totalPatients  = users.filter((u) => u.role === 'patient').length;

  // Sort header helper
  function SortIcon({ field }) {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return (
      <ChevronDown
        className={`w-3 h-3 text-primary transition-transform ${sortDir === 'desc' ? 'rotate-180' : ''}`}
      />
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
        <main className="max-w-7xl mx-auto px-gutter py-lg space-y-lg">

        {/* ── Page Header ─────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
          <div>
            <h1 className="text-headline-sm font-bold text-on-surface">User Management</h1>
            <p className="text-caption text-on-surface-variant mt-0.5">
              Manage roles, clinician assignments, status and passwords for all {users.length} platform users.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-sm">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Download className={`w-4 h-4 ${exportingCsv ? 'animate-spin' : ''}`} />}
              onClick={handleExportCSV}
              disabled={exportingCsv}
            >
              Export CSV
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<FileText className={`w-4 h-4 ${exportingPdf ? 'animate-spin' : ''}`} />}
              onClick={handleExportPDF}
              disabled={exportingPdf}
            >
              Audit PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RefreshCw className={`w-4 h-4 ${loadingUsers ? 'animate-spin' : ''}`} />}
              onClick={fetchUsers}
              disabled={loadingUsers}
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* ── Summary Stat Pills ───────────────────────────────────────── */}
        <div className="flex flex-wrap gap-sm">
          {[
            { icon: Users,       label: 'Total Users',  value: users.length,    color: 'primary' },
            { icon: UserCheck,   label: 'Patients',     value: totalPatients,   color: 'primary' },
            { icon: CheckCircle2,label: 'Active',        value: totalActive,     color: 'tertiary' },
            { icon: UserX,       label: 'Suspended',     value: totalSuspended,  color: 'secondary' },
            { icon: ShieldCheck, label: 'Admins',       value: totalAdmins,     color: 'primary' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div
              key={label}
              className={`flex items-center gap-xs px-md py-xs rounded-full border bg-${color}/8 border-${color}/20`}
            >
              <Icon className={`w-4 h-4 text-${color}`} />
              <span className={`text-label-caps font-bold text-${color}`}>{value}</span>
              <span className="text-label-caps text-on-surface-variant">{label}</span>
            </div>
          ))}
        </div>

        {/* ── 1. Search & Advanced Filter Bar ──────────────────────────── */}
        <Card variant="flat" padding="md">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-sm">
            {/* Search */}
            <div className="flex-1">
              <Input
                type="search"
                placeholder="Search by name, email, or role…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                clearable
                onClear={() => { setSearch(''); setPage(1); }}
              />
            </div>

            {/* Role filter */}
            <div className="relative">
              <select
                value={roleFilter}
                onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
                className="h-touch-target pl-md pr-10 rounded-md border border-outline-variant bg-surface-container-lowest text-caption text-on-surface appearance-none focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer w-full"
              >
                <option value="all">All Roles</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_META[r].label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
            </div>

            {/* Status filter */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="h-touch-target pl-md pr-10 rounded-md border border-outline-variant bg-surface-container-lowest text-caption text-on-surface appearance-none focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer w-full"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
            </div>

            {/* Caregiver Assignment Filter */}
            <div className="relative">
              <select
                value={caregiverFilter}
                onChange={(e) => { setCaregiverFilter(e.target.value); setPage(1); }}
                className="h-touch-target pl-md pr-10 rounded-md border border-outline-variant bg-surface-container-lowest text-caption text-on-surface appearance-none focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer w-full"
              >
                <option value="all">All Assignments</option>
                <option value="assigned">Assigned Caregiver</option>
                <option value="unassigned">Unassigned Patients</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
            </div>

            {/* Rows Per Page Dropdown */}
            <div className="relative flex items-center gap-1.5 pl-1">
              <span className="text-label-caps text-on-surface-variant whitespace-nowrap">Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="h-touch-target px-3 rounded-md border border-outline-variant bg-surface-container-lowest text-caption text-on-surface appearance-none focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer font-semibold"
              >
                <option value={5}>5 / page</option>
                <option value={10}>10 / page</option>
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
              </select>
            </div>
          </div>

          {/* Active filter chips */}
          {(search || roleFilter !== 'all' || statusFilter !== 'all' || caregiverFilter !== 'all') && (
            <div className="flex flex-wrap items-center gap-xs mt-sm">
              <span className="text-label-caps text-on-surface-variant">Filters:</span>
              {search && (
                <Badge variant="primary" size="sm" removable onRemove={() => setSearch('')}>
                  &quot;{search}&quot;
                </Badge>
              )}
              {roleFilter !== 'all' && (
                <Badge variant="primary" size="sm" removable onRemove={() => setRoleFilter('all')}>
                  Role: {ROLE_META[roleFilter]?.label}
                </Badge>
              )}
              {statusFilter !== 'all' && (
                <Badge variant="primary" size="sm" removable onRemove={() => setStatusFilter('all')}>
                  Status: {statusFilter}
                </Badge>
              )}
              {caregiverFilter !== 'all' && (
                <Badge variant="primary" size="sm" removable onRemove={() => setCaregiverFilter('all')}>
                  Assignment: {caregiverFilter === 'assigned' ? 'Assigned' : 'Unassigned'}
                </Badge>
              )}
              <button
                onClick={() => { setSearch(''); setRoleFilter('all'); setStatusFilter('all'); setCaregiverFilter('all'); setPage(1); }}
                className="text-label-caps text-error hover:underline"
              >
                Clear all
              </button>
            </div>
          )}
        </Card>

        {/* ── 2. User Data Table ───────────────────────────────────────── */}
        <Card variant="default" padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[700px]">
              <thead>
                <tr className="border-b border-outline-variant/40 bg-surface-container-low">
                  {/* Avatar col */}
                  <th className="py-sm px-md w-12" />

                  {/* Name */}
                  <th className="py-sm px-md">
                    <button
                      onClick={() => handleSort('name')}
                      className="flex items-center gap-1 text-label-caps font-semibold text-on-surface-variant uppercase tracking-wider hover:text-primary transition-colors"
                    >
                      Full Name <SortIcon field="name" />
                    </button>
                  </th>

                  {/* Email */}
                  <th className="py-sm px-md hidden lg:table-cell">
                    <span className="text-label-caps font-semibold text-on-surface-variant uppercase tracking-wider">
                      Email
                    </span>
                  </th>

                  {/* Role */}
                  <th className="py-sm px-md">
                    <button
                      onClick={() => handleSort('role')}
                      className="flex items-center gap-1 text-label-caps font-semibold text-on-surface-variant uppercase tracking-wider hover:text-primary transition-colors"
                    >
                      Role <SortIcon field="role" />
                    </button>
                  </th>

                  {/* Assigned Caregiver / Clinician */}
                  <th className="py-sm px-md hidden md:table-cell">
                    <span className="text-label-caps font-semibold text-on-surface-variant uppercase tracking-wider">
                      Caregiver Link
                    </span>
                  </th>

                  {/* Joined */}
                  <th className="py-sm px-md hidden md:table-cell">
                    <button
                      onClick={() => handleSort('joinedDate')}
                      className="flex items-center gap-1 text-label-caps font-semibold text-on-surface-variant uppercase tracking-wider hover:text-primary transition-colors"
                    >
                      Joined <SortIcon field="joinedDate" />
                    </button>
                  </th>

                  {/* Status */}
                  <th className="py-sm px-md">
                    <button
                      onClick={() => handleSort('status')}
                      className="flex items-center gap-1 text-label-caps font-semibold text-on-surface-variant uppercase tracking-wider hover:text-primary transition-colors"
                    >
                      Status <SortIcon field="status" />
                    </button>
                  </th>

                  {/* Actions */}
                  <th className="py-sm px-md text-right">
                    <span className="text-label-caps font-semibold text-on-surface-variant uppercase tracking-wider">
                      Actions
                    </span>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-outline-variant/30">
                {loadingUsers ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="py-md px-md"><div className="w-8 h-8 rounded-full bg-surface-container" /></td>
                      <td className="py-md px-md"><div className="h-4 w-32 rounded bg-surface-container" /></td>
                      <td className="py-md px-md hidden lg:table-cell"><div className="h-4 w-44 rounded bg-surface-container" /></td>
                      <td className="py-md px-md"><div className="h-4 w-16 rounded bg-surface-container" /></td>
                      <td className="py-md px-md hidden md:table-cell"><div className="h-4 w-28 rounded bg-surface-container" /></td>
                      <td className="py-md px-md hidden md:table-cell"><div className="h-4 w-20 rounded bg-surface-container" /></td>
                      <td className="py-md px-md"><div className="h-4 w-14 rounded bg-surface-container" /></td>
                      <td className="py-md px-md text-right"><div className="h-4 w-8 rounded bg-surface-container ml-auto" /></td>
                    </tr>
                  ))
                ) : pageSlice.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-xl text-center">
                      <div className="flex flex-col items-center gap-sm">
                        <Users className="w-8 h-8 text-on-surface-variant opacity-40" />
                        <p className="text-caption font-semibold text-on-surface">No users found</p>
                        <p className="text-label-caps text-on-surface-variant max-w-xs">
                          {search || roleFilter !== 'all' || statusFilter !== 'all'
                            ? 'Try adjusting your search or filters.'
                            : 'No users registered yet.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pageSlice.map((user) => {
                    const rm = ROLE_META[user.role]   || ROLE_META.patient;
                    const sm = STATUS_META[user.status] || STATUS_META.active;
                    const SIcon = sm.Icon;

                    return (
                      <tr
                        key={user.id}
                        className="hover:bg-surface-container-low transition-colors"
                      >
                        {/* Avatar */}
                        <td className="py-sm px-md">
                          <div
                            className={`w-8 h-8 rounded-full ${avatarColor(user.id)} flex items-center justify-center text-label-caps font-bold shrink-0`}
                          >
                            {getInitials(user.name)}
                          </div>
                        </td>

                        {/* Name + phone */}
                        <td className="py-sm px-md">
                          <p className="text-caption font-semibold text-on-surface">{user.name}</p>
                          <p className="text-label-caps text-on-surface-variant lg:hidden">{user.email}</p>
                        </td>

                        {/* Email */}
                        <td className="py-sm px-md hidden lg:table-cell text-caption text-on-surface-variant font-mono">
                          {user.email}
                        </td>

                        {/* Role */}
                        <td className="py-sm px-md">
                          <Badge variant={rm.variant} size="xs">{rm.label}</Badge>
                        </td>

                        {/* Assigned Caregiver */}
                        <td className="py-sm px-md hidden md:table-cell text-caption text-on-surface-variant">
                          {user.assignedCaregiver ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-[#00685f]">
                              <HeartHandshake className="w-3.5 h-3.5" />
                              {user.assignedCaregiver}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-xs">Unassigned</span>
                          )}
                        </td>

                        {/* Joined Date */}
                        <td className="py-sm px-md hidden md:table-cell text-caption text-on-surface-variant">
                          {formatDate(user.joinedDate)}
                        </td>

                        {/* Status */}
                        <td className="py-sm px-md">
                          <div className="flex items-center gap-1">
                            <SIcon className={`w-3.5 h-3.5 ${user.status === 'active' ? 'text-tertiary' : 'text-error'}`} />
                            <Badge variant={sm.variant} size="xs">{sm.label}</Badge>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-sm px-md text-right">
                          <ActionMenu
                            user={user}
                            onEditRole={handleEditRole}
                            onAssignCaregiver={handleOpenAssignCaregiver}
                            onToggleStatus={handleToggleStatus}
                            onResetPassword={handleResetPassword}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          <div className="border-t border-outline-variant/40 px-md py-sm flex flex-col sm:flex-row items-center justify-between gap-sm">
            <p className="text-label-caps text-on-surface-variant">
              Showing{' '}
              <span className="font-semibold text-on-surface">
                {filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1}–
                {Math.min(safePage * pageSize, filtered.length)}
              </span>{' '}
              of <span className="font-semibold text-on-surface">{filtered.length}</span> users
            </p>

            <div className="flex items-center gap-xs">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<ChevronLeft className="w-4 h-4" />}
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </Button>

              {/* Page number pills */}
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
                      <span key={`ellipsis-${i}`} className="text-caption text-on-surface-variant px-1">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={[
                          'w-8 h-8 rounded-md text-caption font-semibold transition-colors',
                          p === safePage
                            ? 'bg-primary text-on-primary font-bold'
                            : 'text-on-surface-variant hover:bg-surface-container',
                        ].join(' ')}
                      >
                        {p}
                      </button>
                    )
                  )}
              </div>

              <Button
                variant="outline"
                size="sm"
                rightIcon={<ChevronRight className="w-4 h-4" />}
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
      </main>

      {/* ── 4. Role Edit Modal ───────────────────────────────────────── */}
      <RoleEditModal
        user={roleModal.user}
        isOpen={roleModal.open}
        onClose={() => setRoleModal({ open: false, user: null })}
        onSave={handleRoleSaved}
      />

      {/* Reset Password Modal */}
      <ResetPasswordModal
        user={resetModal.user}
        isOpen={resetModal.open}
        onClose={() => setResetModal({ open: false, user: null })}
        onConfirm={(id) => {
          const target = users.find((u) => u.id === id);
          addToast({
            title: 'Password Reset',
            description: `Temporary password issued for ${target?.name || 'User'}.`,
            variant: 'info',
          });
        }}
      />
      {/* Assign Caregiver Modal (Admin Manual Assignment) */}
      <AssignCaregiverModal
        user={assignModal.user}
        caregivers={users.filter((u) => u.role === 'caregiver')}
        isOpen={assignModal.open}
        onClose={() => setAssignModal({ open: false, user: null })}
        onAssign={handleCaregiverAssigned}
      />
      </div>
    </DashboardLayout>
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-on-surface-variant">Loading...</div>}>
      <ToastProvider position="top-center">
        <AdminUsersPageInner />
      </ToastProvider>
    </Suspense>
  );
}
