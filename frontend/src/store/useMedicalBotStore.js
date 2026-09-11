'use client';

/**
 * PillSync — Dual-Mode Medical Bot State Machine (Zustand)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * G-Stack Pattern: Zustand over Redux — zero boilerplate, single import.
 * 
 * Modes:
 *   'tutorial' → Interactive guided walkthrough of patient dashboard
 *   'docked'   → Compact bottom-right companion (returning users)
 * 
 * Features:
 *   - 6-step guided interactive tour across dashboard components
 *   - Auto-scroll and target tracking for smooth drone flight
 *   - Persistent mode stored in localStorage
 */

import { create } from 'zustand';

// ── LocalStorage Key ─────────────────────────────────────────────
const STORAGE_KEY = 'pillsync_bot_mode';

function getInitialMode() {
  if (typeof window === 'undefined') return 'docked';
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'docked' || saved === 'tutorial') return saved;
  } catch {
    // safe fallback
  }
  return 'docked';
}

function persistMode(mode) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // silent
  }
}

export const DASHBOARD_TOUR_STEPS = [
  {
    stepIndex: 0,
    selector: '[data-tour="header-overview"]',
    title: 'Patient Overview & Stats',
    message: 'नमस्ते! यह आपका मुख्य स्वास्थ्य डैशबोर्ड है। यहाँ आज की कुल दवाइयाँ, खुराक की स्थिति और ओवरऑल स्वास्थ्य समरी दिखती है।',
  },
  {
    stepIndex: 1,
    selector: '[data-tour="today-timeline"]',
    title: "Today's Schedule & Alarms",
    message: 'यह आपकी दैनिक खुराक टाइमलाइन है। समय होने पर अलार्म बजेगा और आप यहीं से "Take Dose" बटन दबाकर दवा लॉग कर सकते हैं।',
  },
  {
    stepIndex: 2,
    selector: '[data-tour="my-prescriptions"]',
    title: 'Active Medications & Stock',
    message: 'यहाँ आपकी सभी सक्रिय दवाइयाँ, बची हुई गोलियों की गिनती (Current Stock) और डॉक्टर के पर्चे की पूरी जानकारी सुरक्षित रहती है।',
  },
  {
    stepIndex: 3,
    selector: '[data-tour="drug-safety-hub"]',
    title: 'AI Drug Safety & Clinical Check',
    message: 'PillSync का AI इंजन आपकी सभी दवाइयों के बीच हानिकारक रिएक्शन (Contraindications) और खाने-पीने की सावधानियों की लाइव जाँच करता है।',
  },
  {
    stepIndex: 4,
    selector: '[data-tour="refill-section"]',
    title: 'Smart Refill & Nearby Chemists',
    message: 'दवाई कम होने पर स्वचालित चेतावनी मिलती है, और आप OpenStreetMap पर अपने घर के सबसे नज़दीकी मेडिकल स्टोर देख सकते हैं।',
  },
  {
    stepIndex: 5,
    selector: '[data-tour="care-circle-section"]',
    title: 'Care Circle & Emergency SOS',
    message: 'अपने परिवार के सदस्यों और डॉक्टर के साथ दवाइयाँ समय पर लेने का रिकॉर्ड साझा करें और आपातकाल में एक क्लिक पर कॉल करें।',
  },
];

const useMedicalBotStore = create((set, get) => ({
  // ── State ──────────────────────────────────────────────────────
  botMode: getInitialMode(),           // 'tutorial' | 'docked'
  hoverMessage: null,                   // string | null
  hoverTitle: null,                     // string | null
  targetElementRect: null,              // DOMRect | null
  isTalking: false,                     // drives mouth animation
  isChatOpen: false,                    // controls slide-over RAG chat sidebar
  isTourActive: false,                  // true during interactive 6-step walkthrough
  currentTourStep: 0,                   // 0 to 5
  totalTourSteps: DASHBOARD_TOUR_STEPS.length,

  // ── Actions ────────────────────────────────────────────────────
  setMode: (mode) => {
    persistMode(mode);
    set({
      botMode: mode,
      ...(mode === 'docked' ? { hoverMessage: null, hoverTitle: null, targetElementRect: null, isTalking: false, isTourActive: false } : {}),
    });
  },

  setTarget: (rect, message, title = null) =>
    set({ targetElementRect: rect, hoverMessage: message, hoverTitle: title, isTalking: true }),

  clearTarget: () => {
    // If tour is actively running, do not clear target on random mouse moves
    if (get().isTourActive) return;
    set({ targetElementRect: null, hoverMessage: null, hoverTitle: null, isTalking: false });
  },

  startTour: () => {
    set({ botMode: 'tutorial', isTourActive: true, currentTourStep: 0 });
    get().goToTourStep(0);
  },

  goToTourStep: (stepIdx) => {
    if (stepIdx < 0 || stepIdx >= DASHBOARD_TOUR_STEPS.length) {
      get().endTour();
      return;
    }

    const step = DASHBOARD_TOUR_STEPS[stepIdx];
    set({ currentTourStep: stepIdx, isTourActive: true, botMode: 'tutorial', isTalking: true });

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
      } else {
        // Fallback if specific section is scrolled or collapsed
        set({
          hoverMessage: step.message,
          hoverTitle: step.title,
          isTalking: true,
        });
      }
    }
  },

  nextTourStep: () => {
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

  endTour: () => {
    persistMode('docked');
    set({
      isTourActive: false,
      botMode: 'docked',
      targetElementRect: null,
      hoverMessage: null,
      hoverTitle: null,
      isTalking: false,
    });
  },

  openChat: () => set({ isChatOpen: true }),
  closeChat: () => set({ isChatOpen: false }),
}));

export default useMedicalBotStore;
