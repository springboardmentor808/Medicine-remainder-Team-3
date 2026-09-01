'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Pill,
  Bell,
  BarChart3,
  Package,
  Users,
  Shield,
  HelpCircle,
  Activity,
  FileText,
  Download,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Heart,
  AlertTriangle,
} from 'lucide-react';
import LogoutButton from '@/components/ui/LogoutButton';
import { exportAPI } from '@/lib/api';

/**
 * Sidebar — PillSync
 * Collapsible sidebar with role-aware navigation items.
 * Mobile: slide-out drawer. Desktop: collapsible rail.
 */

const NAV_ITEMS = {
  patient: [
    { href: '/dashboard/patient', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/medicines', label: 'My Medicines', icon: Pill },
    { href: '/reminders', label: 'Reminders', icon: Bell },
    { href: '/adherence', label: 'Adherence', icon: BarChart3 },
    { href: '/refill', label: 'Refill Tracker', icon: Package },
    { href: '/interactions', label: 'AI Drug Safety', icon: Shield },
    { href: '/help', label: 'Help & Support', icon: HelpCircle },
  ],
  caregiver: [
    { href: '/dashboard/caregiver', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/medicines', label: 'Patient Medicines', icon: Pill },
    { href: '/reminders', label: 'Schedules & Alarms', icon: Bell },
    { href: '/adherence', label: 'Adherence Reports', icon: BarChart3 },
    { href: '/refill', label: 'Refill Tracker', icon: Package },
    { href: '/interactions', label: 'AI Drug Safety', icon: Shield },
    { href: '/notifications', label: 'Emergency Alerts', icon: AlertTriangle },
    { href: '/help', label: 'Help & Support', icon: HelpCircle },
  ],
  admin: [
    { href: '/dashboard/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/users', label: 'User Management', icon: Users },
    { href: '/admin/health', label: 'System Health', icon: Activity },
    { href: '/interactions', label: 'AI Drug Safety', icon: Shield },
    { href: '/notifications', label: 'Broadcast & Queue', icon: Bell },
    { href: '/help', label: 'Help & Support', icon: HelpCircle },
  ],
};

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('pillsync_user');
      if (stored) setUser(JSON.parse(stored));
    } catch {}
  }, []);

  // Determine effective role from stored user role or current path
  const userRole = (user?.role || '').toLowerCase();
  const isAdminPath = pathname?.startsWith('/admin') || pathname === '/dashboard/admin';
  const isCaregiverPath = pathname?.startsWith('/dashboard/caregiver') || pathname === '/dashboard/caregiver';

  const effectiveRole = userRole === 'admin' || isAdminPath
    ? 'admin'
    : userRole === 'caregiver' || isCaregiverPath
    ? 'caregiver'
    : 'patient';

  const items = NAV_ITEMS[effectiveRole] || NAV_ITEMS.patient;
  const initials = (user?.full_name || user?.name || user?.username || (effectiveRole === 'admin' ? 'AU' : effectiveRole === 'caregiver' ? 'CG' : 'PT'))
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const isActive = (href) => {
    if (href === '/dashboard/patient' || href === '/dashboard/caregiver' || href === '/dashboard/admin') {
      return pathname === href;
    }
    return pathname?.startsWith(href);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo / Brand — Clickable to Toggle Collapse */}
      <div
        onClick={() => setCollapsed((prev) => !prev)}
        className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-4 py-5 border-b border-outline-variant/30 cursor-pointer select-none hover:bg-surface-container-low transition-colors group`}
        title={collapsed ? 'Click pill to expand sidebar' : 'Click pill to collapse sidebar'}
      >
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform shadow-sm">
          <span className="text-on-primary text-sm font-bold">💊</span>
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <h2 className="text-body-sm font-bold text-on-surface truncate flex items-center justify-between">
              <span>PillSync</span>
              <span className="text-[10px] text-on-surface-variant/60 font-normal group-hover:text-primary transition-colors">
                ⟨ ⟩
              </span>
            </h2>
            <p className={`text-[11px] font-semibold truncate capitalize ${
              effectiveRole === 'admin' ? 'text-primary' : effectiveRole === 'caregiver' ? 'text-secondary' : 'text-on-surface-variant'
            }`}>
              {effectiveRole} Portal
            </p>
          </div>
        )}
      </div>

      {/* User Info */}
      <div className={`flex items-center ${collapsed ? 'justify-center py-4' : 'gap-3 px-4 py-3'} border-b border-outline-variant/20`}>
        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xs ${
          effectiveRole === 'admin' ? 'bg-primary/20 text-primary' : 'bg-primary/15 text-primary'
        }`}>
          <span>{initials}</span>
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="text-caption font-semibold text-on-surface truncate">
              {user?.full_name || user?.name || (effectiveRole === 'admin' ? 'Admin User' : 'User')}
            </p>
            <p className="text-[11px] text-on-surface-variant truncate">{user?.email || ''}</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                ${active
                  ? 'bg-primary/12 text-primary shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                }`}
              title={collapsed ? label : undefined}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-primary' : ''}`} />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}

        {/* Export link */}
        <div className={`pt-2 mt-2 border-t border-outline-variant/20`}>
          <button
            onClick={async () => {
              try {
                await exportAPI.medicinesPDF();
              } catch (err) {
                console.error('Export error:', err);
              }
            }}
            className={`w-full flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-lg text-sm font-medium text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-all duration-200`}
            title={collapsed ? 'Export Data' : undefined}
          >
            <Download className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>Export Data</span>}
          </button>
        </div>
      </nav>

      {/* Collapse Toggle (Desktop) */}
      <div className="hidden lg:block px-2 py-2 border-t border-outline-variant/20">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-on-surface-variant hover:bg-surface-container-low transition-all"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>

      {/* Logout */}
      <div className="px-2 py-3 border-t border-outline-variant/20">
        <LogoutButton variant={collapsed ? 'icon' : 'sidebar'} />
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-surface-container-lowest shadow-elevated border border-outline-variant/30 text-on-surface"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        >
          <aside
            className="w-72 h-full bg-surface-container-lowest shadow-2xl border-r border-outline-variant/30 transform transition-transform"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-on-surface-variant hover:bg-surface-container-low"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col h-screen sticky top-0 bg-surface-container-lowest border-r border-outline-variant/30 transition-all duration-300 ${
          collapsed ? 'w-[68px]' : 'w-64'
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
