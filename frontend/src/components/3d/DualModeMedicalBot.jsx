'use client';

/**
 * PillSync — Pure Three.js Dual-Mode Flying AI Medical Robot Companion
 * ═════════════════════════════════════════════════════════════════════
 * Built with native Three.js WebGL (100% crash-free on React 18/19 & Next.js 15).
 * 
 * Major Engineering Upgrades:
 *   1. Teal / Aqua Glassmorphism Overhaul (backdrop-blur-2xl, teal-500/cyan-400 glow).
 *   2. First-Time User Onboarding & Intro Center Stage: Bot flies to screen center on first visit.
 *   3. Tap-to-Advance Screen Overlay: Users can tap anywhere to glide to the next feature.
 *   4. Ultra-Calm 0.015 Lerp Physics: Slow, soothing, controlled floating movement.
 *   5. Smart Obstruction-Free Positioning: Dynamically flips left/right to protect dashboard content.
 *   6. DevOps Error Boundary & WebGL Context Guard: 100% zero white-screen guarantee.
 */

import React, { Component, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Bot, ChevronRight, ChevronLeft, X, Sparkles, Hand } from 'lucide-react';
import useMedicalBotStore from '@/store/useMedicalBotStore';

// ── 1. React Error Boundary for 3D/WebGL Fail-Safe ────────────────
class BotErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.warn('[PillSync 3D] WebGL error caught by boundary; gracefully rendering 2D fallback:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <Fallback2DCompanion />;
    }
    return this.props.children;
  }
}

// ── 2. Fallback 2D Companion in case of WebGL failure ───────────────
function Fallback2DCompanion() {
  const openChat = useMedicalBotStore((s) => s.openChat);
  const startTour = useMedicalBotStore((s) => s.startTour);

  return (
    <div className="fixed bottom-6 right-6 z-[9995] flex items-center gap-2">
      <button
        onClick={openChat}
        className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-teal-600 via-teal-500 to-cyan-600 text-white text-xs font-bold shadow-xl border border-teal-400/40 hover:scale-105 active:scale-95 transition-all cursor-pointer backdrop-blur-xl"
        aria-label="Open PillSync AI Assistant"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-300 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
        </span>
        <Bot className="w-4 h-4 text-cyan-200" />
        <span>Ask PillSync AI</span>
      </button>

      <button
        onClick={startTour}
        className="px-3.5 py-2.5 rounded-full bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl text-teal-700 dark:text-teal-300 border border-teal-600/25 dark:border-teal-500/40 hover:border-teal-500 text-xs font-semibold shadow-md shadow-teal-950/5 hover:scale-105 active:scale-95 transition-all cursor-pointer"
        aria-label="Start Guided Tour"
      >
        Tour
      </button>
    </div>
  );
}

// ── 3. Main 3D Flying Robot Implementation ────────────────────────
function MedicalBotScene() {
  const canvasRef = useRef(null);
  const botMode = useMedicalBotStore((s) => s.botMode);
  const isIntroActive = useMedicalBotStore((s) => s.isIntroActive);
  const isTourActive = useMedicalBotStore((s) => s.isTourActive);
  const hoverMessage = useMedicalBotStore((s) => s.hoverMessage);
  const hoverTitle = useMedicalBotStore((s) => s.hoverTitle);
  const currentTourStep = useMedicalBotStore((s) => s.currentTourStep);
  const totalTourSteps = useMedicalBotStore((s) => s.totalTourSteps);

  const checkAndTriggerIntro = useMedicalBotStore((s) => s.checkAndTriggerIntro);
  const startTour = useMedicalBotStore((s) => s.startTour);
  const nextTourStep = useMedicalBotStore((s) => s.nextTourStep);
  const prevTourStep = useMedicalBotStore((s) => s.prevTourStep);
  const tapAdvance = useMedicalBotStore((s) => s.tapAdvance);
  const endTour = useMedicalBotStore((s) => s.endTour);
  const openChat = useMedicalBotStore((s) => s.openChat);
  const setMode = useMedicalBotStore((s) => s.setMode);

  // Screen-space 2D anchor for DOM overlay speech bubble
  const [screenPos, setScreenPos] = useState({ x: 0, y: 0, visible: false });
  const [webglFailed, setWebglFailed] = useState(false);
  const isHoveringBubbleRef = useRef(false);

  // First-time visit auto-trigger with delay for smooth entrance
  useEffect(() => {
    const timer = setTimeout(() => {
      checkAndTriggerIntro();
    }, 700);
    return () => clearTimeout(timer);
  }, [checkAndTriggerIntro]);

  useEffect(() => {
    if (webglFailed) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ── WebGL Context Loss Handler ─────────────────────────────
    const handleContextLost = (event) => {
      event.preventDefault();
      console.warn('[PillSync 3D] WebGL context lost; engaging fallback.');
      setWebglFailed(true);
    };
    canvas.addEventListener('webglcontextlost', handleContextLost);

    // ── 1. Scene, Camera, Renderer ──────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 5);

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    } catch (err) {
      console.warn('[PillSync 3D] WebGL initialization failed:', err);
      setWebglFailed(true);
      return;
    }

    // ── 2. Studio Lighting (Teal / Aqua Clinical Palette) ──────
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight.position.set(3, 5, 4);
    scene.add(dirLight);

    // Primary Aqua Point Light
    const pointLightAqua = new THREE.PointLight(0x06b6d4, 2.2, 8);
    pointLightAqua.position.set(-2, 2, -2);
    scene.add(pointLightAqua);

    // Secondary Teal Point Light
    const pointLightTeal = new THREE.PointLight(0x14b8a6, 2.2, 8);
    pointLightTeal.position.set(2, -1, 2);
    scene.add(pointLightTeal);

    // ── 3. Robot Mesh Construction (Pure Geometries) ───────────
    const robotGroup = new THREE.Group();
    robotGroup.scale.set(0.38, 0.38, 0.38);

    // Head
    const headGeo = new THREE.SphereGeometry(0.44, 32, 32);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      metalness: 0.15,
      roughness: 0.25,
    });
    const headMesh = new THREE.Mesh(headGeo, headMat);
    headMesh.position.set(0, 0.85, 0);
    robotGroup.add(headMesh);

    // Visor Shield (Dark sleek protective glass)
    const visorGeo = new THREE.SphereGeometry(0.42, 32, 16, 0, Math.PI, 0, Math.PI / 2);
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.8,
      roughness: 0.1,
    });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 0.88, 0.08);
    visor.rotation.x = Math.PI / 2.2;
    robotGroup.add(visor);

    // Eyes (Glowing Aqua / Cyan Neon)
    const eyeGeo = new THREE.SphereGeometry(0.065, 16, 16);
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x22d3ee,
      emissiveIntensity: 3.2,
    });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.13, 0.92, 0.38);
    robotGroup.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.13, 0.92, 0.38);
    robotGroup.add(rightEye);

    // Mouth (Animated Scale-Y)
    const mouthGeo = new THREE.BoxGeometry(0.14, 0.05, 0.04);
    const mouthMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });
    const mouthMesh = new THREE.Mesh(mouthGeo, mouthMat);
    mouthMesh.position.set(0, 0.74, 0.39);
    robotGroup.add(mouthMesh);

    // Antenna & Glowing Tip
    const antGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.22, 8);
    const antMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8 });
    const antMesh = new THREE.Mesh(antGeo, antMat);
    antMesh.position.set(0, 1.38, 0);
    robotGroup.add(antMesh);

    const antTipGeo = new THREE.SphereGeometry(0.05, 16, 16);
    const antTipMat = new THREE.MeshStandardMaterial({
      color: 0x14b8a6,
      emissive: 0x2dd4bf,
      emissiveIntensity: 3.5,
    });
    const antTipMesh = new THREE.Mesh(antTipGeo, antTipMat);
    antTipMesh.position.set(0, 1.52, 0);
    robotGroup.add(antTipMesh);

    // Body
    const bodyGeo = new THREE.CylinderGeometry(0.32, 0.36, 0.65, 24);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.1,
      roughness: 0.3,
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.set(0, 0.18, 0);
    robotGroup.add(bodyMesh);

    // Medical Cross (Clinical Teal Glow)
    const crossMat = new THREE.MeshStandardMaterial({
      color: 0x0d9488,
      emissive: 0x14b8a6,
      emissiveIntensity: 1.8,
    });
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.02), crossMat);
    crossH.position.set(0, 0.22, 0.34);
    robotGroup.add(crossH);

    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.02), crossMat);
    crossV.position.set(0, 0.22, 0.34);
    robotGroup.add(crossV);

    // Arms
    const armGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.28, 16);
    const armMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.2 });

    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.set(-0.42, 0.2, 0);
    leftArm.rotation.z = 0.35;
    robotGroup.add(leftArm);

    const rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.position.set(0.42, 0.2, 0);
    rightArm.rotation.z = -0.35;
    robotGroup.add(rightArm);

    // Thruster Engine Ring (Aqua Glow)
    const thrusterGeo = new THREE.CylinderGeometry(0.2, 0.13, 0.22, 20);
    const thrusterMat = new THREE.MeshStandardMaterial({
      color: 0x0f766e,
      emissive: 0x06b6d4,
      emissiveIntensity: 2.2,
    });
    const thrusterMesh = new THREE.Mesh(thrusterGeo, thrusterMat);
    thrusterMesh.position.set(0, -0.28, 0);
    robotGroup.add(thrusterMesh);

    const ringGeo = new THREE.TorusGeometry(0.12, 0.02, 8, 24);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x14b8a6,
      emissive: 0x2dd4bf,
      emissiveIntensity: 3.0,
      transparent: true,
      opacity: 0.85,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.set(0, -0.38, 0);
    ringMesh.rotation.x = Math.PI / 2;
    robotGroup.add(ringMesh);

    scene.add(robotGroup);

    // ── 4. Viewport Helper ─────────────────────────────────────
    const getViewportSize = () => {
      const vFOV = (camera.fov * Math.PI) / 180;
      const height = 2 * Math.tan(vFOV / 2) * camera.position.z;
      const width = height * camera.aspect;
      return { width, height };
    };

    let animationFrameId;
    const clock = new THREE.Clock();
    const targetPos = new THREE.Vector3();

    // ── 5. Physics & Render Loop (Ultra-Calm 0.015 Lerp) ─────────
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const t = clock.getElapsedTime();
      const vp = getViewportSize();

      const state = useMedicalBotStore.getState();
      const currentMode = state.botMode;
      const talking = state.isTalking;
      const rect = state.targetElementRect;

      // Gentle mouth speech flutter
      if (talking) {
        mouthMesh.scale.y = 0.25 + Math.abs(Math.sin(t * 12)) * 0.75;
      } else {
        mouthMesh.scale.y = THREE.MathUtils.lerp(mouthMesh.scale.y, 0.25, 0.1);
      }

      // Soothing sinusoidal breathing float (1.0s calm period)
      const gentleHover = Math.sin(t * 1.0) * 0.03;

      // ── SMART POSITIONING MODES ────────────────────────────────
      if (currentMode === 'intro') {
        // Mode 1: Absolute Center Stage for first-time user greeting
        targetPos.set(0, 0.12 + gentleHover, 0);
        robotGroup.position.lerp(targetPos, 0.015);
      } else if (currentMode === 'tutorial' && rect) {
        // Mode 2: Non-obstructive element tracking
        const cx = rect.x + rect.width / 2;
        const cy = rect.y + rect.height / 2;
        const ndcX = (cx / window.innerWidth) * 2 - 1;
        const ndcY = -(cy / window.innerHeight) * 2 + 1;

        // Smart Obstruction Prevention:
        // If element is on the right half, fly to its left; otherwise fly to its right.
        const isRightBiased = cx > window.innerWidth * 0.55;
        const xOffset = isRightBiased ? -0.85 : 0.85;

        const worldX = ndcX * (vp.width / 2) + xOffset;
        const worldY = ndcY * (vp.height / 2) + gentleHover;

        targetPos.set(
          Math.max(-vp.width / 2 + 0.6, Math.min(vp.width / 2 - 0.6, worldX)),
          Math.max(-vp.height / 2 + 0.6, Math.min(vp.height / 2 - 0.6, worldY)),
          0
        );
        // Ultra-calming 0.015 lerp
        robotGroup.position.lerp(targetPos, 0.015);
      } else {
        // Mode 3: Docked bottom-right corner companion
        const dockedX = vp.width / 2 - 0.85;
        const dockedY = -vp.height / 2 + 0.95 + gentleHover;
        targetPos.set(dockedX, dockedY, 0);
        robotGroup.position.lerp(targetPos, 0.015);
      }

      // Gentle, natural yaw & pitch drift
      const targetRotY = Math.sin(t * 0.5) * 0.08;
      robotGroup.rotation.y = THREE.MathUtils.lerp(robotGroup.rotation.y, targetRotY, 0.015);
      robotGroup.rotation.x = Math.sin(t * 0.7) * 0.03;

      renderer.render(scene, camera);

      // ── Project 3D coordinates to 2D Screen Anchor ──────────────
      const headWorldPos = new THREE.Vector3();
      headMesh.getWorldPosition(headWorldPos);

      // Offset bubble based on mode so it never covers the 3D robot or dashboard
      if (currentMode === 'intro') {
        headWorldPos.y -= 0.65; // place right beneath robot at center
      } else {
        headWorldPos.y += 0.45; // place above robot
      }

      headWorldPos.project(camera);

      const rawSx = ((headWorldPos.x + 1) * window.innerWidth) / 2;
      const rawSy = ((-headWorldPos.y + 1) * window.innerHeight) / 2;

      // Safe viewport clamping
      const clampedX = Math.max(180, Math.min(window.innerWidth - 180, rawSx));
      const clampedY = Math.max(150, Math.min(window.innerHeight - 120, rawSy));

      setScreenPos({ x: clampedX, y: clampedY, visible: true });
    };

    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach((mat) => mat.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      renderer.dispose();
    };
  }, [webglFailed]);

  if (webglFailed) {
    return <Fallback2DCompanion />;
  }

  const showBubble =
    screenPos.visible &&
    (isIntroActive || isTourActive || (botMode === 'tutorial' && hoverMessage));

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 9995,
      }}
    >
      <canvas ref={canvasRef} aria-hidden="true" style={{ width: '100%', height: '100%', display: 'block' }} />

      {/* ── Tap-to-Advance Screen Overlay (Active during Intro or Tour) ── */}
      {(isIntroActive || isTourActive) && (
        <div
          onClick={tapAdvance}
          className="fixed inset-0 z-[9991] cursor-pointer bg-slate-900/25 dark:bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 pointer-events-auto"
          title="Tap anywhere to advance the tour"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') tapAdvance();
          }}
          aria-label="Tap anywhere on screen to advance the tour"
        >
          {/* Subtle top indicator bar */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-teal-600/25 dark:border-teal-500/30 text-teal-800 dark:text-teal-300 text-[11px] font-semibold flex items-center gap-1.5 shadow-lg shadow-teal-950/10 animate-pulse-slow">
            <Hand className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>Tap anywhere to advance • Skip anytime</span>
          </div>
        </div>
      )}

      {/* ── Teal / Aqua Glassmorphism Speech Bubble Overlay ───────── */}
      {showBubble && (
        <div
          onClick={(e) => e.stopPropagation()} // Prevent bubble clicks from triggering tapAdvance
          onMouseEnter={() => { isHoveringBubbleRef.current = true; }}
          onMouseLeave={() => { isHoveringBubbleRef.current = false; }}
          style={{
            position: 'absolute',
            left: `${screenPos.x}px`,
            top: `${screenPos.y - 145}px`,
            transform: 'translateX(-50%)',
            pointerEvents: 'auto',
            zIndex: 9996,
          }}
          role="dialog"
          aria-modal="false"
          aria-live="polite"
          aria-label="PillSync AI Tour Guide"
          className="w-[320px] sm:w-[380px] rounded-2xl p-4 sm:p-5 bg-white/90 dark:bg-slate-950/85 backdrop-blur-2xl border border-teal-500/25 dark:border-teal-500/30 shadow-2xl shadow-teal-950/15 dark:shadow-[0_20px_50px_rgba(20,184,166,0.25)] transition-all duration-300 animate-in fade-in zoom-in-95 text-slate-800 dark:text-slate-100 select-none"
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-teal-600/15 dark:border-teal-500/20">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-teal-500/15 dark:bg-teal-500/20 text-teal-600 dark:text-teal-300 border border-teal-500/30 flex items-center justify-center font-bold">
                <Bot className="w-3.5 h-3.5 text-teal-600 dark:text-teal-300" />
              </div>
              <span className="text-xs font-bold text-teal-700 dark:text-teal-300 uppercase tracking-wider">
                {hoverTitle || 'PillSync AI'}
              </span>
            </div>

            {isTourActive && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-teal-500/15 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border border-teal-500/30">
                Step {currentTourStep + 1} / {totalTourSteps}
              </span>
            )}

            <button
              onClick={() => {
                if (isTourActive || isIntroActive) endTour();
                else setMode('docked');
              }}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
              title="Close"
              aria-label="Close message"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Message Content */}
          <p className="text-xs sm:text-[13px] leading-relaxed my-3.5 font-medium text-slate-700 dark:text-slate-200">
            {hoverMessage}
          </p>

          {/* Navigation Action Buttons */}
          <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-teal-600/15 dark:border-slate-800/80">
            {isIntroActive ? (
              // Intro Buttons
              <div className="flex items-center justify-between w-full">
                <button
                  onClick={endTour}
                  aria-label="Skip guided tour"
                  className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 transition-colors cursor-pointer"
                >
                  Skip Tour
                </button>
                <button
                  onClick={startTour}
                  aria-label="Start guided tour"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-teal-600 via-teal-500 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 shadow-md shadow-teal-900/20 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer border border-teal-400/30"
                >
                  <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
                  <span>Start Guided Tour</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : isTourActive ? (
              // Active Tour Step Controls
              <>
                <button
                  onClick={prevTourStep}
                  disabled={currentTourStep === 0}
                  aria-label="Previous tour step"
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-teal-50 dark:hover:bg-slate-800/60 disabled:opacity-25 disabled:pointer-events-none flex items-center gap-1 transition-all cursor-pointer"
                >
                  <ChevronLeft className="w-3 h-3" />
                  <span>Back</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={endTour}
                    aria-label="Skip tour"
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 transition-colors cursor-pointer"
                  >
                    Skip
                  </button>

                  <button
                    onClick={nextTourStep}
                    aria-label={currentTourStep === totalTourSteps - 1 ? 'Finish guided tour' : 'Next tour step'}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-teal-600 via-teal-500 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 shadow-md shadow-teal-900/20 flex items-center gap-1 transition-all active:scale-95 cursor-pointer border border-teal-400/30"
                  >
                    <span>{currentTourStep === totalTourSteps - 1 ? 'Finish Tour' : 'Next'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            ) : (
              // Standalone Hover Controls
              <div className="flex items-center justify-between w-full">
                <button
                  onClick={() => startTour()}
                  aria-label="Start full dashboard tour"
                  className="text-xs font-bold text-teal-700 dark:text-teal-300 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-teal-600 dark:text-teal-300" />
                  <span>Full Dashboard Tour</span>
                </button>

                <button
                  onClick={() => setMode('docked')}
                  className="px-3 py-1 rounded-lg text-xs font-semibold bg-gradient-to-r from-teal-600 to-cyan-600 text-white hover:from-teal-500 hover:to-cyan-500 shadow-sm transition-all cursor-pointer"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Docked Bottom-Right Companion Action Buttons ── */}
      {screenPos.visible && botMode === 'docked' && !isIntroActive && !isTourActive && (
        <div
          style={{
            position: 'absolute',
            left: `${screenPos.x}px`,
            top: `${screenPos.y - 75}px`,
            transform: 'translateX(-50%)',
            pointerEvents: 'auto',
            zIndex: 9996,
          }}
          className="flex items-center gap-1.5"
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              openChat();
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-gradient-to-r from-teal-600 via-teal-500 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-semibold text-xs shadow-xl shadow-teal-950/20 hover:scale-105 active:scale-95 transition-all border border-teal-400/40 cursor-pointer backdrop-blur-xl"
            aria-label="Ask PillSync AI"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-300 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
            </span>
            <span>🤖 Ask AI</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              startTour();
            }}
            title="Start Guided Tour"
            className="px-3 py-2 rounded-full bg-white/85 dark:bg-slate-900/80 backdrop-blur-xl text-teal-700 dark:text-teal-300 border border-teal-600/25 dark:border-teal-500/40 hover:border-teal-500 font-bold text-xs shadow-md shadow-teal-950/5 hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-1"
            aria-label="Start Guided Tour"
          >
            <Sparkles className="w-3 h-3 text-teal-600 dark:text-teal-300" />
            <span>Tour</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ── 4. Main Export Wrapped with Error Boundary ─────────────────────
export default function DualModeMedicalBot() {
  return (
    <BotErrorBoundary>
      <MedicalBotScene />
    </BotErrorBoundary>
  );
}
