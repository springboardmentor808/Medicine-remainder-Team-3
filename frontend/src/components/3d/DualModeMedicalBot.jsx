'use client';

/**
 * PillSync — Dual-Mode Flying AI Medical Robot (React Three Fiber)
 * ═══════════════════════════════════════════════════════════════════
 * 
 * G-Stack: ErrorBoundary on every 3rd-party render boundary
 * R3F Expert: useFrame for 60fps render loop, Drei Html for mixed DOM/3D overlays
 * 
 * Two strict modes:
 *   'tutorial' → Robot flies to hovered elements, animates mouth, shows speech bubble
 *   'docked'   → Robot anchors bottom-right, gently bobs, click opens RAG chat sidebar
 * 
 * 3D Anatomy:
 *   Head (sphere) → Cyan emissive eyes → Animated mouth (scale-Y sine) →
 *   White medical body → Green cross badge → Distort thruster engine
 */

import React, { useRef, useMemo, Suspense, Component } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';
import useMedicalBotStore from '@/store/useMedicalBotStore';

// ═══════════════════════════════════════════════════════════════════
// 1. ROBOT MESH — Full humanoid 3D anatomy
// ═══════════════════════════════════════════════════════════════════

function MedicalRobotMesh() {
  const mouthRef = useRef();
  const isTalking = useMedicalBotStore((s) => s.isTalking);

  /**
   * Mouth animation: Scale-Y oscillates via sine wave when talking.
   * R3F Expert: useFrame runs at 60fps inside the WebGL render loop.
   * Only scale-Y changes — no geometry recreation, zero GC pressure.
   */
  useFrame(({ clock }) => {
    if (mouthRef.current) {
      if (isTalking) {
        const t = clock.getElapsedTime();
        mouthRef.current.scale.y = 0.3 + Math.abs(Math.sin(t * 18)) * 0.7;
      } else {
        // Gently close mouth when not talking
        mouthRef.current.scale.y = THREE.MathUtils.lerp(mouthRef.current.scale.y, 0.3, 0.1);
      }
    }
  });

  return (
    <group>
      {/* ── Head (Rounded Sphere) ──────────────────────────────── */}
      <mesh position={[0, 0.85, 0]}>
        <sphereGeometry args={[0.42, 32, 32]} />
        <meshStandardMaterial
          color="#e8edf2"
          metalness={0.1}
          roughness={0.3}
        />
      </mesh>

      {/* ── Left Eye (Emissive Cyan) ──────────────────────────── */}
      <mesh position={[-0.14, 0.92, 0.35]}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshStandardMaterial
          color="#00f0ff"
          emissive="#00e5ff"
          emissiveIntensity={2.5}
        />
      </mesh>

      {/* ── Right Eye (Emissive Cyan) ─────────────────────────── */}
      <mesh position={[0.14, 0.92, 0.35]}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshStandardMaterial
          color="#00f0ff"
          emissive="#00e5ff"
          emissiveIntensity={2.5}
        />
      </mesh>

      {/* ── Mouth (Animated Scale-Y) ──────────────────────────── */}
      <mesh ref={mouthRef} position={[0, 0.72, 0.36]}>
        <boxGeometry args={[0.16, 0.06, 0.04]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>

      {/* ── Antenna ───────────────────────────────────────────── */}
      <mesh position={[0, 1.35, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.2, 8]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.6} />
      </mesh>
      <mesh position={[0, 1.48, 0]}>
        <sphereGeometry args={[0.04, 12, 12]} />
        <meshStandardMaterial
          color="#00f0ff"
          emissive="#00e5ff"
          emissiveIntensity={3}
        />
      </mesh>

      {/* ── Body (Cylinder — White Medical) ────────────────────── */}
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.32, 0.36, 0.7, 24]} />
        <meshStandardMaterial
          color="#f0f4f8"
          metalness={0.05}
          roughness={0.4}
        />
      </mesh>

      {/* ── Medical Cross (Green Badge on Chest) ──────────────── */}
      {/* Horizontal bar */}
      <mesh position={[0, 0.22, 0.33]}>
        <boxGeometry args={[0.18, 0.05, 0.02]} />
        <meshStandardMaterial
          color="#00a86b"
          emissive="#00a86b"
          emissiveIntensity={0.5}
        />
      </mesh>
      {/* Vertical bar */}
      <mesh position={[0, 0.22, 0.33]}>
        <boxGeometry args={[0.05, 0.18, 0.02]} />
        <meshStandardMaterial
          color="#00a86b"
          emissive="#00a86b"
          emissiveIntensity={0.5}
        />
      </mesh>

      {/* ── Arms (Capsule-style) ──────────────────────────────── */}
      {/* Left arm */}
      <mesh position={[-0.42, 0.2, 0]} rotation={[0, 0, 0.3]}>
        <capsuleGeometry args={[0.06, 0.3, 8, 16]} />
        <meshStandardMaterial color="#dce3ea" metalness={0.15} roughness={0.35} />
      </mesh>
      {/* Right arm */}
      <mesh position={[0.42, 0.2, 0]} rotation={[0, 0, -0.3]}>
        <capsuleGeometry args={[0.06, 0.3, 8, 16]} />
        <meshStandardMaterial color="#dce3ea" metalness={0.15} roughness={0.35} />
      </mesh>

      {/* ── Thruster Engine (Bottom — Distort Glow) ────────────── */}
      <mesh position={[0, -0.32, 0]}>
        <cylinderGeometry args={[0.22, 0.15, 0.25, 20]} />
        <MeshDistortMaterial
          color="#00e5ff"
          emissive="#0891b2"
          emissiveIntensity={1.5}
          distort={0.35}
          speed={5}
          transparent
          opacity={0.7}
        />
      </mesh>

      {/* ── Thruster Glow Ring ─────────────────────────────────── */}
      <mesh position={[0, -0.42, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.12, 0.02, 8, 24]} />
        <meshStandardMaterial
          color="#00f0ff"
          emissive="#00f0ff"
          emissiveIntensity={2}
          transparent
          opacity={0.5}
        />
      </mesh>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 2. SPEECH BUBBLE — Drei Html overlay
// ═══════════════════════════════════════════════════════════════════

function SpeechBubble() {
  const botMode = useMedicalBotStore((s) => s.botMode);
  const hoverMessage = useMedicalBotStore((s) => s.hoverMessage);
  const setMode = useMedicalBotStore((s) => s.setMode);
  const openChat = useMedicalBotStore((s) => s.openChat);

  if (botMode === 'tutorial' && hoverMessage) {
    return (
      <Html
        position={[0, 1.7, 0]}
        center
        distanceFactor={8}
        style={{ pointerEvents: 'auto' }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            border: '1px solid rgba(0, 240, 255, 0.3)',
            borderRadius: '14px',
            padding: '14px 18px',
            maxWidth: '260px',
            color: '#f1f5f9',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '13px',
            lineHeight: '1.5',
            boxShadow: '0 8px 32px rgba(0, 229, 255, 0.15), 0 0 12px rgba(0, 229, 255, 0.1)',
            backdropFilter: 'blur(12px)',
            userSelect: 'none',
          }}
        >
          <p style={{ margin: '0 0 10px 0', fontWeight: 500 }}>{hoverMessage}</p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMode('docked');
            }}
            style={{
              background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 14px',
              color: '#fff',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              letterSpacing: '0.5px',
              transition: 'transform 0.15s ease',
            }}
            onMouseEnter={(e) => (e.target.style.transform = 'scale(1.05)')}
            onMouseLeave={(e) => (e.target.style.transform = 'scale(1)')}
          >
            ✓ End Tour
          </button>
        </div>
      </Html>
    );
  }

  if (botMode === 'docked') {
    return (
      <Html
        position={[0, 1.2, 0]}
        center
        distanceFactor={8}
        style={{ pointerEvents: 'auto' }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            openChat();
          }}
          style={{
            background: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            borderRadius: '20px',
            padding: '6px 16px',
            color: '#fff',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(5, 150, 105, 0.3)',
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'scale(1.08)';
            e.target.style.boxShadow = '0 6px 24px rgba(5, 150, 105, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'scale(1)';
            e.target.style.boxShadow = '0 4px 16px rgba(5, 150, 105, 0.3)';
          }}
        >
          🤖 Ask PillSync AI
        </button>
      </Html>
    );
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════
// 3. FLIGHT CONTROLLER — useFrame coordinate mapping & lerp
// ═══════════════════════════════════════════════════════════════════

function FlightController() {
  const groupRef = useRef();
  const { viewport } = useThree();

  const botMode = useMedicalBotStore((s) => s.botMode);
  const targetElementRect = useMedicalBotStore((s) => s.targetElementRect);

  /**
   * Docked anchor: bottom-right of the 3D viewport.
   * R3F Expert: viewport.width/height are in Three.js world units at z=0.
   */
  const dockedPosition = useMemo(
    () => new THREE.Vector3(
      viewport.width / 2 - 1.2,
      -viewport.height / 2 + 1.5,
      0
    ),
    [viewport.width, viewport.height]
  );

  // Scratch vector to avoid GC allocations inside useFrame
  const targetVec = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();

    if (botMode === 'tutorial' && targetElementRect) {
      /**
       * Screen-to-3D Coordinate Mapping:
       * R3F Expert: Convert 2D DOMRect (px) → NDC → 3D world coordinates
       * 
       * ndcX = ((x + width/2) / window.innerWidth) * 2 - 1
       * ndcY = -((y + height/2) / window.innerHeight) * 2 + 1
       * worldX = ndcX * (viewport.width / 2)
       * worldY = ndcY * (viewport.height / 2)
       */
      const cx = targetElementRect.x + targetElementRect.width / 2;
      const cy = targetElementRect.y + targetElementRect.height / 2;

      const ndcX = (cx / window.innerWidth) * 2 - 1;
      const ndcY = -(cy / window.innerHeight) * 2 + 1;

      // Offset the robot slightly to the right and above the target element
      const worldX = ndcX * (viewport.width / 2) + 0.8;
      const worldY = ndcY * (viewport.height / 2) + 0.5;

      targetVec.set(worldX, worldY, 0);

      // Smooth lerp flight — G-Stack: damping 0.08 for premium feel
      groupRef.current.position.lerp(targetVec, 0.08);

    } else if (botMode === 'docked') {
      /**
       * Docked mode: fly to anchor + gentle sine-wave idle hover.
       * The bob amplitude is subtle (0.05) to feel alive without distraction.
       */
      targetVec.copy(dockedPosition);
      targetVec.y += Math.sin(t * 2) * 0.05;

      groupRef.current.position.lerp(targetVec, 0.06);

    } else {
      // Tutorial mode but no target — float gently at center-right
      targetVec.set(
        viewport.width / 2 - 2,
        Math.sin(t * 1.5) * 0.15,
        0
      );
      groupRef.current.position.lerp(targetVec, 0.04);
    }

    // Billboard: gentle rotation tracking toward center (simulates eye contact)
    const targetRotY = Math.sin(t * 0.5) * 0.12;
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      targetRotY,
      0.05
    );
  });

  return (
    <group ref={groupRef} scale={0.6}>
      <MedicalRobotMesh />
      <SpeechBubble />
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 4. SCENE — Lighting & environment
// ═══════════════════════════════════════════════════════════════════

function BotScene() {
  return (
    <>
      {/* Ambient base light for soft medical aesthetic */}
      <ambientLight intensity={0.6} />
      {/* Key light — top-left warm */}
      <directionalLight position={[3, 5, 4]} intensity={1.2} color="#ffffff" />
      {/* Rim light — subtle cyan accent from behind */}
      <pointLight position={[-3, 2, -3]} intensity={0.5} color="#00e5ff" />
      {/* Fill from below for thruster glow */}
      <pointLight position={[0, -2, 2]} intensity={0.3} color="#0891b2" />

      <FlightController />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 5. ERROR BOUNDARY — Graceful fallback (G-Stack invariant)
// ═══════════════════════════════════════════════════════════════════

class R3FErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.warn('[PillSync 3D] WebGL/R3F error caught — falling back to 2D:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // G-Stack: Graceful degradation — show nothing rather than crash the app
      return null;
    }
    return this.props.children;
  }
}

// ═══════════════════════════════════════════════════════════════════
// 6. MAIN EXPORT — Global Canvas Overlay
// ═══════════════════════════════════════════════════════════════════

/**
 * DualModeMedicalBot — Global 3D Canvas overlay
 * 
 * Mount this once at the dashboard page level.
 * The Canvas uses pointer-events: none so all clicks pass through to DOM.
 * Only the Drei <Html> elements have pointer-events: auto for buttons.
 * 
 * G-Stack: Fixed overlay pattern — canvas floats above DOM without affecting layout.
 * R3F Expert: Camera at z=5 with orthographic-like perspective for consistent sizing.
 */
export default function DualModeMedicalBot() {
  return (
    <R3FErrorBoundary>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          pointerEvents: 'none',
          zIndex: 9999,
        }}
        aria-hidden="true"
      >
        <Canvas
          camera={{ position: [0, 0, 5], fov: 50 }}
          style={{ pointerEvents: 'none' }}
          gl={{ alpha: true, antialias: true }}
          dpr={[1, 2]}
        >
          <Suspense fallback={null}>
            <BotScene />
          </Suspense>
        </Canvas>
      </div>
    </R3FErrorBoundary>
  );
}
