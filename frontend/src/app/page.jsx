'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

/**
 * Landing Page — PillSync
 * Design: Stitch project "PillSync" Welcome / Landing Screen
 * Primary Teal #00685f | Clinical Minimalism | Inter + Public Sans
 */


const FEATURES = [
  {
    icon: 'camera_alt',
    title: 'AI Prescription Scanner',
    desc: 'Upload any prescription — Tesseract OCR + AI auto-fills your medicine schedule instantly.',
    color: 'primary',
  },
  {
    icon: 'schedule',
    title: 'Smart Reminders',
    desc: 'Push, SMS & WhatsApp reminders. Never miss a dose with morning, noon & night schedules.',
    color: 'tertiary',
  },
  {
    icon: 'insights',
    title: 'Adherence Analytics',
    desc: 'Circular progress dial tracks your adherence. See weekly trends and health insights.',
    color: 'secondary',
  },
  {
    icon: 'local_pharmacy',
    title: 'Nearby Pharmacy Finder',
    desc: 'OpenStreetMap integration finds pharmacies near you when stock runs low.',
    color: 'primary',
  },
  {
    icon: 'supervisor_account',
    title: 'Caregiver Dashboard',
    desc: 'Monitor multiple patients, get missed-dose alerts and communicate directly.',
    color: 'tertiary',
  },
  {
    icon: 'security',
    title: 'Secure & Private',
    desc: 'JWT auth with HttpOnly cookies. Your health data stays private and protected.',
    color: 'secondary',
  },
];

const ROLES = [
  {
    value: 'patient',
    icon: 'person',
    title: 'Patient',
    desc: 'Manage your medication schedule',
    color: 'bg-primary/10 text-primary',
  },
  {
    value: 'caregiver',
    icon: 'favorite',
    title: 'Caregiver',
    desc: 'Monitor loved ones\' care',
    color: 'bg-tertiary/10 text-tertiary',
  },
  {
    value: 'admin',
    icon: 'shield_person',
    title: 'Admin',
    desc: 'Manage facility operations',
    color: 'bg-secondary/10 text-secondary',
  },
];

const STATS = [
  { value: '50K+', label: 'Active Users', icon: 'group' },
  { value: '99.9%', label: 'Uptime',      icon: 'health_and_safety' },
  { value: '98%',   label: 'Adherence',   icon: 'medication' },
  { value: '24/7',  label: 'Support',     icon: 'support_agent' },
];



export default function LandingPage() {
  return (
    <>
      {/* ── Navigation ─────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-40 w-full bg-surface-container-lowest/80 backdrop-blur-md border-b border-outline-variant/40">
        <div className="max-w-7xl mx-auto px-gutter flex items-center justify-between h-16">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-xs group">
            <div className="p-xs rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <span
                className="material-symbols-outlined text-primary text-[22px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                medical_services
              </span>
            </div>
            <span className="text-body-sm font-bold text-primary tracking-tight">PillSync</span>
          </Link>

          {/* Nav links — desktop */}
          <div className="hidden md:flex items-center gap-xl text-caption text-on-surface-variant">
            <Link href="#features" className="hover:text-primary transition-colors">Features</Link>
            <Link href="#how-it-works" className="hover:text-primary transition-colors">How it works</Link>
            <Link href="/help" className="hover:text-primary transition-colors">Support</Link>
          </div>

          {/* CTA Buttons */}
          <div className="flex items-center gap-xs">
            <Link
              href="/login"
              className="hidden sm:inline-flex items-center h-9 px-md text-caption font-semibold text-primary hover:bg-primary/8 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Sign In
            </Link>
            <Link
              href="/select-role"
              className="inline-flex items-center h-9 px-md text-caption font-semibold bg-primary text-on-primary rounded-md hover:bg-primary-container hover:shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
            >
              Get Started
              <span className="material-symbols-outlined text-[16px] ml-0.5">arrow_forward</span>
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* ── Hero Section ───────────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          {/* Gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-surface to-tertiary/5" aria-hidden="true" />

          <div className="relative max-w-7xl mx-auto px-gutter py-xl md:py-[80px] grid grid-cols-1 lg:grid-cols-2 gap-xl items-center">
            {/* Hero text */}
            <div className="space-y-lg">
              <div className="inline-flex items-center gap-xs px-sm py-xs rounded-full bg-primary/10 border border-primary/20">
                <span className="material-symbols-outlined text-primary text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  auto_awesome
                </span>
                <span className="text-label-caps text-primary font-semibold uppercase tracking-wider">
                  AI-Powered Healthcare
                </span>
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-[56px] font-bold text-on-surface leading-[1.1] tracking-tight">
                Never miss a{' '}
                <span className="text-primary">medication</span>{' '}
                again.
              </h1>

              <p className="text-body-md text-on-surface-variant max-w-lg leading-relaxed">
                AI-powered medication tracking with prescription OCR, smart reminders, adherence
                analytics, and caregiver monitoring — all in one platform.
              </p>

              {/* CTA row */}
              <div className="flex flex-wrap items-center gap-sm">
                <Link
                  href="/select-role"
                  className="inline-flex items-center gap-xs h-input-target px-xl text-body-sm font-semibold bg-primary text-on-primary rounded-md hover:bg-primary-container hover:shadow-elevated hover:-translate-y-0.5 active:translate-y-0 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  <span className="material-symbols-outlined text-[20px]">rocket_launch</span>
                  Start Free Today
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-xs h-input-target px-xl text-body-sm font-semibold text-primary border border-primary/30 rounded-md hover:bg-primary/8 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                >
                  Sign In
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </Link>
              </div>
            </div>

            {/* Hero — Product Illustration Banner */}
            <div className="relative flex items-center justify-center">
              {/* Decorative backdrop blur / glow */}
              <div className="absolute -inset-4 bg-gradient-to-tr from-primary/20 via-tertiary/15 to-secondary/10 rounded-3xl blur-2xl opacity-70 pointer-events-none" />

              {/* Main Image Container */}
              <div className="relative rounded-2xl overflow-hidden border border-outline-variant/40 bg-surface-container-lowest shadow-modal group">
                <Image
                  src="/hero-banner.jpg"
                  alt="PillSync AI Smart Medicine Tracker Illustration"
                  width={600}
                  height={450}
                  priority
                  unoptimized
                  className="w-full h-auto object-cover transform group-hover:scale-[1.02] transition-transform duration-500 ease-out"
                />

                {/* Floating micro feature badges */}
                <div className="absolute top-4 right-4 bg-surface-container-lowest/90 backdrop-blur-md rounded-full shadow-elevated border border-outline-variant/30 px-3 py-1.5 flex items-center gap-1.5 z-10">
                  <span className="material-symbols-outlined text-primary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    verified
                  </span>
                  <span className="text-caption font-semibold text-on-surface">AI Powered OCR</span>
                </div>

                <div className="absolute bottom-4 right-4 bg-surface-container-lowest/90 backdrop-blur-md rounded-full shadow-elevated border border-outline-variant/30 px-3 py-1.5 flex items-center gap-1.5 z-10">
                  <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse" />
                  <span className="text-caption font-semibold text-tertiary">Smart Scheduling</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Stats ──────────────────────────────────────────────────────── */}
        <section className="border-y border-outline-variant/40 bg-surface-container-low py-lg">
          <div className="max-w-7xl mx-auto px-gutter grid grid-cols-2 md:grid-cols-4 gap-lg">
            {STATS.map(({ value, label, icon }) => (
              <div key={label} className="flex items-center gap-sm">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">{icon}</span>
                </div>
                <div>
                  <p className="text-headline-sm font-bold text-primary leading-none">{value}</p>
                  <p className="text-caption text-on-surface-variant mt-0.5">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Features ───────────────────────────────────────────────────── */}
        <section id="features" className="py-xl md:py-[80px]">
          <div className="max-w-7xl mx-auto px-gutter">
            <div className="text-center mb-section-gap">
              <span className="text-label-caps text-primary uppercase tracking-widest font-semibold">Features</span>
              <h2 className="text-4xl font-bold text-on-surface mt-xs tracking-tight">
                Everything you need for medication management
              </h2>
              <p className="text-body-md text-on-surface-variant mt-sm max-w-xl mx-auto">
                From OCR prescription scanning to caregiver dashboards — built for patients,
                families, and clinics.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md">
              {FEATURES.map(({ icon, title, desc, color }) => (
                <article
                  key={title}
                  className="group bg-surface-container-lowest rounded-lg border border-outline-variant/30 p-card-padding shadow-card hover:shadow-elevated hover:-translate-y-1 transition-all duration-300"
                >
                  <div
                    className={[
                      'w-12 h-12 rounded-xl flex items-center justify-center mb-md',
                      color === 'primary'   ? 'bg-primary/10 text-primary' :
                      color === 'tertiary'  ? 'bg-tertiary/10 text-tertiary' :
                                              'bg-secondary/10 text-secondary',
                    ].join(' ')}
                  >
                    <span className="material-symbols-outlined text-[24px]">{icon}</span>
                  </div>
                  <h3 className="text-body-sm font-bold text-on-surface mb-xs">{title}</h3>
                  <p className="text-caption text-on-surface-variant leading-relaxed">{desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ───────────────────────────────────────────────── */}
        <section id="how-it-works" className="py-xl md:py-[80px] bg-surface-container-low border-t border-outline-variant/40">
          <div className="max-w-4xl mx-auto px-gutter">
            <div className="text-center mb-section-gap">
              <span className="text-label-caps text-primary uppercase tracking-widest font-semibold">How it works</span>
              <h2 className="text-4xl font-bold text-on-surface mt-xs tracking-tight">
                Get started in 3 steps
              </h2>
            </div>

            <div className="relative">
              {/* Connector line */}
              <div className="hidden md:block absolute left-1/2 top-8 bottom-8 w-0.5 bg-outline-variant/50 -translate-x-1/2" aria-hidden="true" />

              <div className="space-y-xl">
                {[
                  {
                    step: '01',
                    icon: 'badge',
                    title: 'Select Your Role',
                    desc: 'Choose whether you\'re a Patient, Caregiver, or Admin and create your secure account.',
                    align: 'left',
                  },
                  {
                    step: '02',
                    icon: 'camera_alt',
                    title: 'Scan or Add Medicines',
                    desc: 'Upload your prescription for AI OCR auto-fill, or add medicines manually with dosage details.',
                    align: 'right',
                  },
                  {
                    step: '03',
                    icon: 'notifications_active',
                    title: 'Stay on Track',
                    desc: 'Receive smart reminders, log doses, track adherence and get refill alerts automatically.',
                    align: 'left',
                  },
                ].map(({ step, icon, title, desc, align }) => (
                  <div
                    key={step}
                    className={`flex items-center gap-xl ${align === 'right' ? 'flex-row-reverse' : ''}`}
                  >
                    <div className={`flex-1 ${align === 'right' ? 'text-right' : ''}`}>
                      <span className="text-label-caps text-primary font-bold uppercase tracking-widest">{step}</span>
                      <h3 className="text-headline-sm font-bold text-on-surface mt-xs">{title}</h3>
                      <p className="text-body-sm text-on-surface-variant mt-xs leading-relaxed">{desc}</p>
                    </div>
                    <div className="shrink-0 w-16 h-16 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-elevated z-10">
                      <span className="material-symbols-outlined text-[28px]">{icon}</span>
                    </div>
                    <div className="flex-1 hidden md:block" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA Section ─────────────────────────────────────────────────── */}
        <section className="py-xl md:py-[80px] bg-gradient-to-br from-primary to-primary-container text-on-primary">
          <div className="max-w-3xl mx-auto px-gutter text-center">
            <h2 className="text-4xl font-bold tracking-tight mb-md">
              Ready to take control of your health?
            </h2>
            <p className="text-body-md text-on-primary/80 mb-section-gap max-w-xl mx-auto">
              Join 50,000+ patients and caregivers who trust PillSync for their medication management.
            </p>
            <div className="flex flex-wrap gap-sm justify-center">
              <Link
                href="/select-role"
                className="inline-flex items-center gap-xs h-input-target px-xl text-body-sm font-semibold bg-surface-container-lowest text-primary rounded-md hover:shadow-elevated hover:-translate-y-0.5 transition-all focus:outline-none"
              >
                <span className="material-symbols-outlined text-[20px]">rocket_launch</span>
                Get Started Free
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-xs h-input-target px-xl text-body-sm font-semibold border border-on-primary/30 text-on-primary rounded-md hover:bg-on-primary/10 transition-all focus:outline-none"
              >
                Sign In
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-outline-variant/40 bg-surface py-xl">
        <div className="max-w-7xl mx-auto px-gutter">
          <div className="flex flex-col md:flex-row items-center justify-between gap-md">
            <div className="flex items-center gap-xs">
              <span
                className="material-symbols-outlined text-primary text-[20px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                medical_services
              </span>
              <span className="text-caption font-bold text-primary">PillSync</span>
            </div>
            <p className="text-caption text-on-surface-variant text-center">
              PillSync AI · Next.js · FastAPI · OpenCV · spaCy · PostgreSQL · Redis
            </p>
            <div className="flex gap-md text-caption text-on-surface-variant">
              <Link href="/help"    className="hover:text-primary transition-colors">Support</Link>
              <Link href="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
              <Link href="/terms"   className="hover:text-primary transition-colors">Terms</Link>
            </div>
          </div>
          {/* Emergency disclaimer */}
          <div className="mt-md p-sm rounded-md bg-error-container/30 border border-error/20 text-center">
            <p className="text-caption text-error font-medium">
              ⚠️ Medical Disclaimer: This app is a scheduling tool only. It does not replace professional medical advice.
              In case of emergency, call{' '}
              <a href="tel:911" className="font-bold underline">911</a>
              {' '}(US) or{' '}
              <a href="tel:108" className="font-bold underline">108</a>
              {' '}(India) immediately.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
