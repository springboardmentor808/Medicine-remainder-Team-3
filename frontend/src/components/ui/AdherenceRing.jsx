'use client';

import React, { useMemo } from 'react';

/**
 * AdherenceRing — Vitality Core Design System
 * SVG circular progress dial for medication adherence percentage.
 * Used on Patient Dashboard & Caregiver Roster Cards.
 *
 * Usage:
 *   <AdherenceRing percentage={87} />
 *   <AdherenceRing percentage={60} size={120} strokeWidth={10} label="Weekly" />
 *   <AdherenceRing percentage={95} showIcon theme="success" />
 */

const THEMES = {
  default: {
    stroke:    '#00685f', // primary
    trackStroke: '#e7eeff', // surface-container
    textColor: '#00685f',
    label:     'Adherence',
  },
  success: {
    stroke:    '#006947', // tertiary
    trackStroke: '#f0f3ff',
    textColor: '#006947',
    label:     'On Track',
  },
  warning: {
    stroke:    '#855300', // secondary
    trackStroke: '#fff8ee',
    textColor: '#855300',
    label:     'At Risk',
  },
  danger: {
    stroke:    '#ba1a1a', // error
    trackStroke: '#ffdad6',
    textColor: '#ba1a1a',
    label:     'Critical',
  },
};

/**
 * Auto-pick theme based on percentage value.
 * ≥80 → default/success | 60–79 → warning | <60 → danger
 */
function autoTheme(pct) {
  if (pct >= 80) return 'success';
  if (pct >= 60) return 'warning';
  return 'danger';
}

function AdherenceRing({
  percentage = 0,
  size = 96,
  strokeWidth = 8,
  label,
  sublabel,
  showLabel = true,
  showPercentage = true,
  showIcon = false,
  theme: themeProp,
  animated = true,
  className = '',
}) {
  // Clamp 0–100
  const pct = Math.max(0, Math.min(100, Math.round(percentage)));

  // Theme resolution
  const theme = THEMES[themeProp ?? autoTheme(pct)] ?? THEMES.default;

  // Circle geometry
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = useMemo(
    () => circumference - (pct / 100) * circumference,
    [pct, circumference]
  );

  // Dynamic font sizes relative to ring size
  const pctFontSize = Math.round(size * 0.22);
  const labelFontSize = Math.round(size * 0.11);

  // Icon for adherence state
  const icon =
    pct >= 80 ? 'check_circle' :
    pct >= 60 ? 'warning' :
    'cancel';

  const resolvedLabel = label ?? theme.label;

  return (
    <div
      className={`inline-flex flex-col items-center gap-xs ${className}`}
      role="img"
      aria-label={`${resolvedLabel}: ${pct}%`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="rotate-[-90deg]"
        aria-hidden="true"
      >
        {/* Track circle */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={theme.trackStroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
        />

        {/* Progress arc */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={theme.stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={
            animated
              ? { transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }
              : undefined
          }
        />

        {/* Center content (rotate back since parent is rotated) */}
        <g transform={`rotate(90 ${cx} ${cy})`}>
          {/* Percentage text */}
          {showPercentage && (
            <text
              x={cx}
              y={showIcon ? cy - pctFontSize * 0.1 : cy + pctFontSize * 0.35}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={theme.textColor}
              fontSize={pctFontSize}
              fontWeight="700"
              fontFamily="Inter, system-ui, sans-serif"
            >
              {pct}%
            </text>
          )}

          {/* Icon overlay */}
          {showIcon && !showPercentage && (
            <text
              x={cx}
              y={cy + 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={theme.stroke}
              fontSize={Math.round(size * 0.3)}
              fontFamily="Material Symbols Outlined"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {icon === 'check_circle' ? '✓' :
               icon === 'warning' ? '!' : '✕'}
            </text>
          )}
        </g>
      </svg>

      {/* Label below ring */}
      {showLabel && (
        <div className="text-center">
          <p
            className="font-semibold uppercase tracking-wider"
            style={{ fontSize: labelFontSize, color: theme.textColor }}
          >
            {resolvedLabel}
          </p>
          {sublabel && (
            <p className="text-caption text-on-surface-variant mt-0.5">
              {sublabel}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── AdherenceRing.Compact ─────────────────────────────────────────────────────
/**
 * Small inline ring for use in list rows and roster cards.
 * <AdherenceRing.Compact percentage={85} />
 */
AdherenceRing.Compact = function AdherenceRingCompact({
  percentage = 0,
  size = 40,
  strokeWidth = 4,
  className = '',
}) {
  const pct = Math.max(0, Math.min(100, Math.round(percentage)));
  const theme = THEMES[autoTheme(pct)];
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      role="img"
      aria-label={`Adherence: ${pct}%`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="rotate-[-90deg]"
        aria-hidden="true"
      >
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={theme.trackStroke} strokeWidth={strokeWidth} fill="none"
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={theme.stroke} strokeWidth={strokeWidth}
          fill="none" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      <span
        className="absolute text-[10px] font-bold"
        style={{ color: theme.textColor }}
      >
        {pct}
      </span>
    </div>
  );
};

AdherenceRing.displayName = 'AdherenceRing';
export default AdherenceRing;
export { AdherenceRing };
