'use client';

import React from 'react';

/**
 * RoleSelectorForm — PillSync
 * Design: Stitch screen "Role Selection" (9bc972cf4f0b48e292c40a8f3e5d8206)
 * Reusable role selection radio card group.
 * Used on: SelectRolePage, RegisterPage
 *
 * Usage:
 *   <RoleSelectorForm value={role} onChange={setRole} />
 */

const ROLES = [
  {
    value: 'patient',
    icon: 'person',
    title: 'Patient',
    description: 'I am managing my own care',
    features: ['Today\'s medication schedule', 'Adherence tracking', 'Refill reminders'],
  },
  {
    value: 'caregiver',
    icon: 'favorite',
    title: 'Caregiver',
    description: 'I am managing care for someone else',
    features: ['Patient roster oversight', 'Missed dose alerts', 'Direct messaging'],
  },
  {
    value: 'admin',
    icon: 'shield_person',
    title: 'Admin',
    description: 'I am managing facility operations',
    features: ['System health monitoring', 'User management', 'Analytics dashboard'],
  },
];

export default function RoleSelectorForm({
  value,
  onChange,
  showFeatures = false,
  className = '',
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Select your role"
      id="role-selection-group"
      className={`flex flex-col gap-sm relative z-10 ${className}`}
    >
      {ROLES.map(({ value: roleValue, icon, title, description, features }) => {
        const isSelected = value === roleValue;
        return (
          <label
            key={roleValue}
            className={[
              // Base
              'group relative cursor-pointer w-full rounded-xl',
              'flex items-center p-md gap-md',
              'transition-all duration-300',
              'outline-none',
              // Focus ring on inner radio
              'focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2',
              // Hover
              'hover:shadow-elevated',
              // Selected state
              isSelected
                ? 'bg-primary/8 shadow-sm border border-primary/40'
                : 'bg-surface border border-outline-variant/60 hover:border-primary/30',
            ].join(' ')}
          >
            {/* Hidden radio */}
            <input
              type="radio"
              name="role"
              value={roleValue}
              checked={isSelected}
              onChange={() => onChange(roleValue)}
              className="sr-only"
            />

            {/* Selection background overlay */}
            <div
              className={[
                'absolute inset-0 rounded-xl transition-all duration-300',
                isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-50',
              ].join(' ')}
              aria-hidden="true"
            />

            {/* Icon circle */}
            <div
              className={[
                'relative z-10 shrink-0 w-14 h-14 rounded-full flex items-center justify-center',
                'transition-all duration-300',
                isSelected
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'bg-surface-container-low text-primary group-hover:bg-primary group-hover:text-on-primary',
              ].join(' ')}
            >
              <span className="material-symbols-outlined text-[28px]">{icon}</span>
            </div>

            {/* Text content */}
            <div className="relative z-10 flex-1 min-w-0">
              <span className="text-headline-sm font-semibold text-on-surface block leading-tight">
                {title}
              </span>
              <span className="text-body-sm text-on-surface-variant line-clamp-1 mt-0.5">
                {description}
              </span>
              {showFeatures && isSelected && (
                <ul className="mt-xs space-y-0.5">
                  {features.map((feat) => (
                    <li key={feat} className="flex items-center gap-xs text-caption text-tertiary">
                      <span className="material-symbols-outlined text-[14px]">check</span>
                      {feat}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Radio indicator circle */}
            <div
              className={[
                'relative z-10 shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center',
                'transition-all duration-300',
                isSelected
                  ? 'border-primary bg-primary'
                  : 'border-outline-variant bg-transparent',
              ].join(' ')}
              aria-hidden="true"
            >
              {isSelected && (
                <span
                  className="material-symbols-outlined text-on-primary text-[14px] font-bold"
                  style={{ fontVariationSettings: "'wght' 700" }}
                >
                  check
                </span>
              )}
            </div>
          </label>
        );
      })}
    </div>
  );
}
