'use client';

/**
 * PillSync — Tutorial Trigger Wrapper Component
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * G-Stack Pattern: Reusable compound component with zero prop-drilling.
 * 
 * Usage:
 *   <TutorialTrigger message="यह आपकी दवाइयों का दैनिक टाइमलाइन है">
 *     <DoseTimelineCard />
 *   </TutorialTrigger>
 * 
 * Behavior:
 *   - Only active when botMode === 'tutorial'
 *   - On hover: captures element's DOMRect + sends message to Zustand store
 *   - On leave: clears the target so the robot stops tracking
 *   - In 'docked' mode: renders children without any hover behavior (zero overhead)
 */

import React, { useRef, useCallback } from 'react';
import useMedicalBotStore from '@/store/useMedicalBotStore';

export default function TutorialTrigger({ message, children, className = '' }) {
  const wrapperRef = useRef(null);
  const botMode = useMedicalBotStore((s) => s.botMode);
  const setTarget = useMedicalBotStore((s) => s.setTarget);
  const clearTarget = useMedicalBotStore((s) => s.clearTarget);

  /**
   * On mouse enter: capture the element's bounding rect and send it
   * to the store so the 3D robot knows where to fly.
   * R3F Expert: DOMRect provides (x, y, width, height) which we later
   * convert to NDC → 3D world coordinates in the robot's useFrame loop.
   */
  const handleMouseEnter = useCallback(() => {
    if (botMode !== 'tutorial' || !wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    setTarget(rect, message);
  }, [botMode, message, setTarget]);

  /**
   * On mouse leave: clear the target so the robot gently floats back
   * to its idle position.
   */
  const handleMouseLeave = useCallback(() => {
    if (botMode !== 'tutorial') return;
    clearTarget();
  }, [botMode, clearTarget]);

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
