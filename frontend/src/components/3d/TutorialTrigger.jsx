'use client';

/**
 * PillSync — Tutorial Trigger Wrapper Component
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * G-Stack Pattern: Reusable compound component with zero prop-drilling.
 * 
 * Features:
 *   - Only active when botMode === 'tutorial'
 *   - On hover: captures element's DOMRect + sends message to Zustand store
 *   - Graceful 450ms safety debounce on leave so moving mouse to speech bubble never dismisses it
 *   - During active guided tours, targets remain stably pinned
 */

import React, { useRef, useCallback } from 'react';
import useMedicalBotStore from '@/store/useMedicalBotStore';

export default function TutorialTrigger({ message, title = null, children, className = '' }) {
  const wrapperRef = useRef(null);
  const leaveTimerRef = useRef(null);
  const botMode = useMedicalBotStore((s) => s.botMode);
  const isTourActive = useMedicalBotStore((s) => s.isTourActive);
  const setTarget = useMedicalBotStore((s) => s.setTarget);
  const clearTarget = useMedicalBotStore((s) => s.clearTarget);

  const handleMouseEnter = useCallback(() => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    if (botMode !== 'tutorial' || !wrapperRef.current || isTourActive) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    setTarget(rect, message, title);
  }, [botMode, isTourActive, message, title, setTarget]);

  const handleMouseLeave = useCallback(() => {
    if (botMode !== 'tutorial' || isTourActive) return;
    // 450ms safety buffer allows mouse to reach speech bubble without vanishing
    leaveTimerRef.current = setTimeout(() => {
      clearTarget();
    }, 450);
  }, [botMode, isTourActive, clearTarget]);

  return (
    <div
      ref={wrapperRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={className}
      style={{ position: 'relative' }}
    >
      {children}
    </div>
  );
}
