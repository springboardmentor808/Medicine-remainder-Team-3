'use client';

/**
 * PillSync — Dual-Mode Medical Bot State Machine (Zustand)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * G-Stack Pattern: Zustand over Redux — zero boilerplate, single import.
 * 
 * Two strict modes:
 *   'tutorial' → Flying onboarding guide (first-time users)
 *   'docked'   → Static bottom-right assistant (returning users)
 * 
 * Persistence: botMode saved to localStorage so returning users
 * skip the tutorial automatically.
 */

import { create } from 'zustand';

// ── LocalStorage Key ─────────────────────────────────────────────
const STORAGE_KEY = 'pillsync_bot_mode';

/**
 * Read persisted bot mode from localStorage.
 * First-time users default to 'tutorial', returning users to 'docked'.
 */
function getInitialMode() {
  if (typeof window === 'undefined') return 'tutorial';
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'docked' || saved === 'tutorial') return saved;
  } catch {
    // SSR or localStorage unavailable — safe fallback
  }
  return 'tutorial';
}

/**
 * Persist mode change to localStorage.
 */
function persistMode(mode) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Silently fail if storage is full or blocked
  }
}

// ── Zustand Store ────────────────────────────────────────────────
const useMedicalBotStore = create((set) => ({
  // ── State ──────────────────────────────────────────────────────
  botMode: getInitialMode(),          // 'tutorial' | 'docked'
  hoverMessage: null,                  // string | null — tooltip text
  targetElementRect: null,             // DOMRect | null — screen position of hovered element
  isTalking: false,                    // drives mouth animation (sine-wave scale-Y)
  isChatOpen: false,                   // controls slide-over RAG chat sidebar

  // ── Actions ────────────────────────────────────────────────────

  /**
   * Switch between tutorial and docked modes.
   * Persists to localStorage so the user's preference survives page reloads.
   * G-Stack: Single source of truth for bot behavior across all components.
   */
  setMode: (mode) => {
    persistMode(mode);
    set({
      botMode: mode,
      // Clear tutorial state when docking
      ...(mode === 'docked' ? { hoverMessage: null, targetElementRect: null, isTalking: false } : {}),
    });
  },

  /**
   * Called by <TutorialTrigger> on hover — sets the flight target.
   * Only meaningful when botMode === 'tutorial'.
   */
  setTarget: (rect, message) =>
    set({ targetElementRect: rect, hoverMessage: message, isTalking: true }),

  /**
   * Called by <TutorialTrigger> on mouse leave — clears the flight target.
   */
  clearTarget: () =>
    set({ targetElementRect: null, hoverMessage: null, isTalking: false }),

  /**
   * Open the slide-over RAG chat sidebar (docked mode action).
   * G-Stack: Chat state lives in the same store — no context gymnastics.
   */
  openChat: () => set({ isChatOpen: true }),

  /**
   * Close the slide-over RAG chat sidebar.
   */
  closeChat: () => set({ isChatOpen: false }),
}));

export default useMedicalBotStore;
