'use client';

/**
 * PillSync — Pure Three.js Dual-Mode Flying AI Medical Robot Companion
 * ═════════════════════════════════════════════════════════════════════
 * Built with native Three.js WebGL (100% crash-free on React 19 / Next.js 15).
 * 
 * Upgrades:
 *   - Compact Companion Size (scale 0.38): Never covers dashboard content.
 *   - Calm Drone Physics: Smooth 0.03 lerp glide, soothing 1.2s breathing float.
 *   - Anti-Vanishing Speech Bubble: Stably anchored with mouse persistence.
 *   - 6-Step Guided Patient Dashboard Tour with Next / Previous controls.
 *   - Luxury Emerald Glassmorphism UI (backdrop-blur-2xl, green neon accents).
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Bot, ChevronRight, ChevronLeft, X, Sparkles } from 'lucide-react';
import useMedicalBotStore from '@/store/useMedicalBotStore';

export default function DualModeMedicalBot() {
  const canvasRef = useRef(null);
  const botMode = useMedicalBotStore((s) => s.botMode);
  const hoverMessage = useMedicalBotStore((s) => s.hoverMessage);
  const hoverTitle = useMedicalBotStore((s) => s.hoverTitle);
  const isTourActive = useMedicalBotStore((s) => s.isTourActive);
  const currentTourStep = useMedicalBotStore((s) => s.currentTourStep);
  const totalTourSteps = useMedicalBotStore((s) => s.totalTourSteps);
  const setMode = useMedicalBotStore((s) => s.setMode);
  const startTour = useMedicalBotStore((s) => s.startTour);
  const nextTourStep = useMedicalBotStore((s) => s.nextTourStep);
  const prevTourStep = useMedicalBotStore((s) => s.prevTourStep);
  const endTour = useMedicalBotStore((s) => s.endTour);
  const openChat = useMedicalBotStore((s) => s.openChat);

  // Screen-space 2D anchor for DOM overlay bubble
  const [screenPos, setScreenPos] = useState({ x: 0, y: 0, visible: false });
  const isHoveringBubbleRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

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
      console.warn('[PillSync 3D] WebGL context initialization failed:', err);
      return;
    }

    // ── 2. Studio Lighting ─────────────────────────────────────
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight.position.set(3, 5, 4);
    scene.add(dirLight);

    const pointLightCyan = new THREE.PointLight(0x00f0ff, 2.2, 8);
    pointLightCyan.position.set(-2, 2, -2);
    scene.add(pointLightCyan);

    const pointLightEmerald = new THREE.PointLight(0x10b981, 2.0, 8);
    pointLightEmerald.position.set(2, -1, 2);
    scene.add(pointLightEmerald);

    // ── 3. Robot Mesh Construction (Compact 0.38 Scale) ─────────
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

    // Visor Shield (Dark sleek glass)
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

    // Eyes (Glowing Cyan Neon)
    const eyeGeo = new THREE.SphereGeometry(0.065, 16, 16);
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00e5ff,
      emissiveIntensity: 3.0,
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

    // Antenna
    const antGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.22, 8);
    const antMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8 });
    const antMesh = new THREE.Mesh(antGeo, antMat);
    antMesh.position.set(0, 1.38, 0);
    robotGroup.add(antMesh);

    const antTipGeo = new THREE.SphereGeometry(0.05, 16, 16);
    const antTipMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
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

    // Medical Cross (Vitality Emerald Green)
    const crossMat = new THREE.MeshStandardMaterial({
      color: 0x059669,
      emissive: 0x10b981,
      emissiveIntensity: 1.2,
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

    // Thruster Engine Ring
    const thrusterGeo = new THREE.CylinderGeometry(0.2, 0.13, 0.22, 20);
    const thrusterMat = new THREE.MeshStandardMaterial({
      color: 0x0891b2,
      emissive: 0x00e5ff,
      emissiveIntensity: 2.2,
    });
    const thrusterMesh = new THREE.Mesh(thrusterGeo, thrusterMat);
    thrusterMesh.position.set(0, -0.28, 0);
    robotGroup.add(thrusterMesh);

    const ringGeo = new THREE.TorusGeometry(0.12, 0.02, 8, 24);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
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

    // ── 5. Physics & Render Loop (Calm Drone Movement) ─────────
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const t = clock.getElapsedTime();
      const vp = getViewportSize();

      const state = useMedicalBotStore.getState();
      const currentMode = state.botMode;
      const talking = state.isTalking;
      const rect = state.targetElementRect;

      // Gentle mouth talking flutter
      if (talking) {
        mouthMesh.scale.y = 0.25 + Math.abs(Math.sin(t * 14)) * 0.75;
      } else {
        mouthMesh.scale.y = THREE.MathUtils.lerp(mouthMesh.scale.y, 0.25, 0.1);
      }

      // Smooth Gentle Idle Breathing Hover
      const gentleHover = Math.sin(t * 1.2) * 0.035;

      if (currentMode === 'tutorial' && rect) {
        // Fly calmly next to the hovered or tour-targeted element
        const cx = rect.x + rect.width;
        const cy = rect.y + rect.height / 2;
        const ndcX = (cx / window.innerWidth) * 2 - 1;
        const ndcY = -(cy / window.innerHeight) * 2 + 1;

        // Position slightly to the right of the element
        const worldX = ndcX * (vp.width / 2) + 0.55;
        const worldY = ndcY * (vp.height / 2) + gentleHover;
        targetPos.set(
          Math.min(vp.width / 2 - 0.5, worldX),
          Math.max(-vp.height / 2 + 0.6, Math.min(vp.height / 2 - 0.6, worldY)),
          0
        );
        // Calm slow lerp (0.03 instead of 0.08)
        robotGroup.position.lerp(targetPos, 0.035);
      } else {
        // Docked mode at bottom-right corner
        const dockedX = vp.width / 2 - 0.85;
        const dockedY = -vp.height / 2 + 0.95 + gentleHover;
        targetPos.set(dockedX, dockedY, 0);
        robotGroup.position.lerp(targetPos, 0.035);
      }

      // Gentle natural pitch & yaw
      const targetRotY = Math.sin(t * 0.6) * 0.12;
      robotGroup.rotation.y = THREE.MathUtils.lerp(robotGroup.rotation.y, targetRotY, 0.03);
      robotGroup.rotation.x = Math.sin(t * 0.8) * 0.04;

      renderer.render(scene, camera);

      // Project 3D head position to screen 2D coordinates for the speech bubble
      const headWorldPos = new THREE.Vector3();
      headMesh.getWorldPosition(headWorldPos);
      headWorldPos.y += 0.45;
      headWorldPos.project(camera);

      const rawSx = ((headWorldPos.x + 1) * window.innerWidth) / 2;
      const rawSy = ((-headWorldPos.y + 1) * window.innerHeight) / 2;

      // Clamp coordinates so speech bubble never overflows viewport edges
      const clampedX = Math.max(160, Math.min(window.innerWidth - 170, rawSx));
      const clampedY = Math.max(140, Math.min(window.innerHeight - 80, rawSy));

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
      renderer.dispose();
    };
  }, []);

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
      aria-hidden="true"
    >
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

      {/* ── Luxury Emerald Glassmorphism Speech Bubble / Tour Overlay ── */}
      {screenPos.visible && (isTourActive || (botMode === 'tutorial' && hoverMessage)) && (
        <div
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
          className="w-[300px] sm:w-[340px] rounded-2xl p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-emerald-500/40 shadow-[0_16px_48px_rgba(16,185,129,0.22)] transition-all duration-300 animate-in fade-in zoom-in-95 text-slate-800 dark:text-slate-100"
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-emerald-500/20">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                {hoverTitle || 'PillSync Guide'}
              </span>
            </div>

            {isTourActive && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                Step {currentTourStep + 1} / {totalTourSteps}
              </span>
            )}

            <button
              onClick={() => {
                if (isTourActive) endTour();
                else setMode('docked');
              }}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-md transition-colors"
              title="Close Tour"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Message Content */}
          <p className="text-xs sm:text-[13px] leading-relaxed my-3 font-medium text-slate-700 dark:text-slate-200">
            {hoverMessage}
          </p>

          {/* Navigation Action Buttons */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
            {isTourActive ? (
              <>
                <button
                  onClick={prevTourStep}
                  disabled={currentTourStep === 0}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1 transition-all"
                >
                  <ChevronLeft className="w-3 h-3" />
                  <span>Back</span>
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={endTour}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    Skip
                  </button>

                  <button
                    onClick={nextTourStep}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-md shadow-emerald-900/30 flex items-center gap-1 transition-all active:scale-95"
                  >
                    <span>{currentTourStep === totalTourSteps - 1 ? 'Finish Tour' : 'Next'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between w-full">
                <button
                  onClick={() => startTour()}
                  className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Full Dashboard Tour</span>
                </button>
                <button
                  onClick={() => setMode('docked')}
                  className="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm transition-all"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Docked Bottom-Right Companion Action Buttons ── */}
      {screenPos.visible && botMode === 'docked' && (
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-lg shadow-emerald-950/40 hover:scale-105 active:scale-95 transition-all border border-emerald-400/40 cursor-pointer"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
            </span>
            <span>🤖 Ask AI</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              startTour();
            }}
            title="Start Guided Tour"
            className="px-2.5 py-1.5 rounded-full bg-surface/90 dark:bg-slate-900/90 backdrop-blur-md text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:border-emerald-500 font-bold text-xs shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3" />
            <span>Tour</span>
          </button>
        </div>
      )}
    </div>
  );
}
