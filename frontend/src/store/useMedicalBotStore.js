'use client';

/**
 * PillSync — Dual-Mode Medical Bot State Machine (Zustand)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Architecture:
 *   - Isolated State Machine: Chat state, Tour state, and Intro state strictly decoupled
 *   - Modes:
 *       'intro'    → First-time user welcome, bot centers on screen
 *       'tutorial' → Interactive guided walkthrough across patient dashboard
 *       'docked'   → Quiet, compact bottom-right companion
 *   - Non-blocking Tap-to-Advance engine with accessible Skip controls
 *   - Zero-breakage persistent storage sync
 */

import { create } from 'zustand';

// ── LocalStorage Keys ─────────────────────────────────────────────
const STORAGE_KEY = 'pillsync_bot_mode';
const SEEN_INTRO_KEY = 'pillsync_has_seen_intro';

function getInitialMode() {
  if (typeof window === 'undefined') return 'docked';
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'docked') return 'docked';
  } catch {
    // safe fallback in restricted iframe/browser environments
  }
  return 'docked';
}

function persistMode(mode) {
  if (typeof window === 'undefined') return;
  try {
    if (mode === 'docked') {
      localStorage.setItem(STORAGE_KEY, 'docked');
    }
  } catch {
    // silent fallback
  }
}

// ── Guided Dashboard Tour Steps ──────────────────────────────────
export const DASHBOARD_TOUR_STEPS = [
  {
    stepIndex: 0,
    selector: '[data-tour="header-overview"]',
    title: 'Patient Overview & Stats',
    message: 'Welcome to your health dashboard! Here you can monitor total daily medications, today’s adherence status, and vital health summaries at a glance.',
  },
  {
    stepIndex: 1,
    selector: '[data-tour="today-timeline"]',
    title: "Today's Schedule & Alarms",
    message: 'This is your medication timeline. When it is time for a dose, sound alarms ring and you can log your medication immediately with "Take Dose".',
  },
  {
    stepIndex: 2,
    selector: '[data-tour="drug-safety-hub"]',
    title: 'AI Drug Safety & Interaction Hub',
    message: 'PillSync AI continuously monitors your active prescriptions against 176+ contraindications, dangerous drug-drug interactions, and food warnings in real-time.',
  },
  {
    stepIndex: 3,
    selector: '[data-tour="refill-section"]',
    title: 'Smart Refill & Nearby Chemists',
    message: 'Automatic alerts notify you when stock runs low. Find verified nearby pharmacies with one tap on the interactive healthcare map.',
  },
  {
    stepIndex: 4,
    selector: '[data-tour="care-circle-section"]',
    title: 'Care Circle & Emergency SOS',
    message: 'Share your adherence logs with family members and clinicians. In acute distress, one-tap SOS connects instantly to emergency services (108/112/911).',
  },
];

export const INTRO_STEP = {
  title: 'Meet PillSync AI',
  message: 'Hello! I am your AI Medical Robot Companion. I help you track medications, monitor health stats, and ensure drug safety. Tap anywhere to start your 1-minute guided tour!',
};

const useMedicalBotStore = create((set, get) => ({
  // ── 1. Core Bot & Tour State ───────────────────────────────────
  botMode: getInitialMode(),           // 'intro' | 'tutorial' | 'docked'
  isIntroActive: false,                // true during center introduction
  isTourActive: false,                 // true during interactive guided walkthrough
  currentTourStep: 0,                  // 0 to DASHBOARD_TOUR_STEPS.length - 1
  totalTourSteps: DASHBOARD_TOUR_STEPS.length,

  // ── 2. Speech Bubble & Targeting ───────────────────────────────
  hoverMessage: null,                  // text displayed in glassmorphic bubble
  hoverTitle: null,                    // title displayed in bubble header
  targetElementRect: null,             // DOMRect of currently highlighted section
  isTalking: false,                    // drives mouth flutter and antenna pulsing

  // ── 3. AI Chat Drawer State (Completely Isolated) ───────────────
  isChatOpen: false,                   // controls slide-over RAG chat sidebar

  // ── 4. Actions & State Transitions ─────────────────────────────
  setMode: (mode) => {
    persistMode(mode);
    if (mode === 'intro') {
      get().startIntro();
      return;
    }
    set({
      botMode: mode,
      ...(mode === 'docked'
        ? {
            isIntroActive: false,
            isTourActive: false,
            hoverMessage: null,
            hoverTitle: null,
            targetElementRect: null,
            isTalking: false,
          }
        : {}),
    });
  },

  setTarget: (rect, message, title = null) =>
    set({
      targetElementRect: rect,
      hoverMessage: message,
      hoverTitle: title,
      isTalking: true,
    }),

  clearTarget: () => {
    // Tour and intro targets are immune to ambient mouse clearing
    if (get().isTourActive || get().isIntroActive) return;
    set({
      targetElementRect: null,
      hoverMessage: null,
      hoverTitle: null,
      isTalking: false,
    });
  },

  // First-time user onboarding detection (Do not interrupt active tour)
  checkAndTriggerIntro: () => {
    if (typeof window === 'undefined') return;
    try {
      if (get().isTourActive || get().isIntroActive || get().botMode === 'tutorial') {
        return;
      }
      const hasSeen = localStorage.getItem(SEEN_INTRO_KEY);
      if (!hasSeen) {
        get().startIntro();
      }
    } catch {
      // Safe fallback
    }
  },


  startIntro: () => {
    set({
      botMode: 'intro',
      isIntroActive: true,
      isTourActive: false,
      currentTourStep: 0,
      targetElementRect: null,
      hoverTitle: INTRO_STEP.title,
      hoverMessage: INTRO_STEP.message,
      isTalking: true,
    });
  },

  startTour: () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(SEEN_INTRO_KEY, 'true');
      } catch {}
    }
    set({
      botMode: 'tutorial',
      isTourActive: true,
      isIntroActive: false,
      currentTourStep: 0,
    });
    get().goToTourStep(0);
  },

  goToTourStep: (stepIdx) => {
    if (stepIdx < 0 || stepIdx >= DASHBOARD_TOUR_STEPS.length) {
      get().endTour();
      return;
    }

    const step = DASHBOARD_TOUR_STEPS[stepIdx];
    set({
      currentTourStep: stepIdx,
      isTourActive: true,
      isIntroActive: false,
      botMode: 'tutorial',
      isTalking: true,
      hoverMessage: step.message,
      hoverTitle: step.title,
    });

    if (typeof window !== 'undefined') {
      const el = document.querySelector(step.selector);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
          const rect = el.getBoundingClientRect();
          set({
            targetElementRect: rect,
            hoverMessage: step.message,
            hoverTitle: step.title,
            isTalking: true,
          });
        }, 350);
      }
    }
  },

  nextTourStep: () => {
    if (get().isIntroActive) {
      get().startTour();
      return;
    }

    const nextIdx = get().currentTourStep + 1;
    if (nextIdx < DASHBOARD_TOUR_STEPS.length) {
      get().goToTourStep(nextIdx);
    } else {
      get().endTour();
    }
  },

  prevTourStep: () => {
    const prevIdx = get().currentTourStep - 1;
    if (prevIdx >= 0) {
      get().goToTourStep(prevIdx);
    }
  },

  // Tap anywhere on screen to advance the tour
  tapAdvance: () => {
    if (get().isIntroActive) {
      get().startTour();
    } else if (get().isTourActive) {
      get().nextTourStep();
    }
  },

  endTour: () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(SEEN_INTRO_KEY, 'true');
      } catch {}
    }
    persistMode('docked');
    set({
      isTourActive: false,
      isIntroActive: false,
      botMode: 'docked',
      targetElementRect: null,
      hoverMessage: null,
      hoverTitle: null,
      isTalking: false,
    });
  },

  // AI Chat controls — strict shallow updates preserving conversation state
  openChat: () => set({ isChatOpen: true }),
  closeChat: () => set({ isChatOpen: false }),
}));

export default useMedicalBotStore;
