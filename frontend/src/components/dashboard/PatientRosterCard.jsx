'use client';

import React, { useMemo, useCallback } from 'react';
import {
  Calendar,
  Bell,
  Phone,
  Clock,
  Pill,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  User,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import AdherenceRing from '@/components/ui/AdherenceRing';

/**
 * PatientRosterCard — Caregiver Dashboard Component
 * ──────────────────────────────────────────────────
 * Renders a polished desktop card for a single patient within the
 * caregiver's roster. Designed to match Google Stitch project
 * 11433898026932201853, Screen #38 (Caregiver-Patient Assignments)
 * and Screen #40 (Caregiver Multi-Patient View).
 *
 * Design tokens:
 *   Primary Teal  #00685f  |  Alert Amber  #855300
 *   Danger Red    #ef4444  |  Success Emerald #006947
 *
 * @param {Object}  props
 * @param {Object}  props.patient              - Patient data object
 * @param {string}  props.patient.id           - Unique patient ID
 * @param {string}  props.patient.name         - Full name
 * @param {number}  props.patient.age          - Age in years
 * @param {string}  [props.patient.relation]   - Relation tag (e.g. "Mother", "Father")
 * @param {number}  props.patient.adherenceScore     - 0–100 adherence %
 * @param {number}  props.patient.pendingDosesCount  - Pending dose count
 * @param {string}  props.patient.lastDoseStatus     - 'taken' | 'missed' | 'pending'
 * @param {string}  [props.patient.image]      - Avatar URL (fallback to initials)
 * @param {Object}  [props.patient.nextMedication]   - Next scheduled med
 * @param {string}  [props.patient.nextMedication.name]  - Medicine name
 * @param {string}  [props.patient.nextMedication.time]  - Scheduled time
 * @param {string}  [props.patient.nextMedication.dosage] - Dosage string
 * @param {Function} [props.onViewSchedule]    - "View Schedule" handler
 * @param {Function} [props.onSendReminder]    - "Send Reminder Alert" handler
 * @param {Function} [props.onEmergencyContact] - "Emergency Contact" handler
 * @param {string}  [props.className]          - Additional CSS classes
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Generate initials from full name (max 2 chars). */
function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/** Resolve dose status to display config. */
function getDoseStatusConfig(lastDoseStatus, pendingDosesCount) {
  if (lastDoseStatus === 'missed' || pendingDosesCount > 0) {
    const missedCount = pendingDosesCount || 1;
    return {
      label: `${missedCount} Missed Dose${missedCount > 1 ? 's' : ''}`,
      variant: 'missed',
      icon: <XCircle className="w-3.5 h-3.5" />,
      ringBorder: 'ring-2 ring-error/20',
    };
  }
  return {
    label: 'All Doses Taken',
    variant: 'taken',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    ringBorder: 'ring-2 ring-tertiary/20',
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

const PatientRosterCard = React.memo(function PatientRosterCard({
  patient,
  onViewSchedule,
  onSendReminder,
  onEmergencyContact,
  className = '',
}) {
  const {
    id,
    name = 'Unknown Patient',
    age,
    relation,
    adherenceScore = 0,
    pendingDosesCount = 0,
    lastDoseStatus = 'pending',
    image,
    nextMedication,
  } = patient ?? {};

  // Memoized computations
  const initials = useMemo(() => getInitials(name), [name]);
  const doseStatus = useMemo(
    () => getDoseStatusConfig(lastDoseStatus, pendingDosesCount),
    [lastDoseStatus, pendingDosesCount]
  );
  const isAtRisk = adherenceScore < 60;
  const isWarning = adherenceScore >= 60 && adherenceScore < 80;

  // Handlers
  const handleViewSchedule = useCallback(() => {
    onViewSchedule?.(id);
  }, [id, onViewSchedule]);

  const handleSendReminder = useCallback(() => {
    onSendReminder?.(id);
  }, [id, onSendReminder]);

  const handleEmergencyContact = useCallback(() => {
    onEmergencyContact?.(id);
  }, [id, onEmergencyContact]);

  // Age / relation tag text
  const tagText = [age && `${age} yrs`, relation].filter(Boolean).join(' · ');

  return (
    <Card
      variant="default"
      padding="lg"
      hoverable
      className={[
        'group relative overflow-hidden',
        // Subtle left accent border based on adherence status
        isAtRisk
          ? 'border-l-[3px] border-l-error'
          : isWarning
          ? 'border-l-[3px] border-l-secondary'
          : 'border-l-[3px] border-l-tertiary',
        className,
      ].join(' ')}
    >
      {/* ── Row 1: Patient Identity ──────────────────────────────────── */}
      <div className="flex items-start gap-md">
        {/* Avatar */}
        <div className={`relative shrink-0 ${doseStatus.ringBorder} rounded-full p-0.5`}>
          {image ? (
            <img
              src={image}
              alt={`${name} avatar`}
              className="w-12 h-12 rounded-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center">
              <span className="text-on-primary text-caption font-bold">
                {initials}
              </span>
            </div>
          )}
          {/* Online / status dot */}
          {lastDoseStatus === 'missed' && (
            <span
              className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-error border-2 border-surface-container-lowest animate-pulse-slow"
              aria-label="Missed dose alert"
            />
          )}
        </div>

        {/* Name + Tag */}
        <div className="flex-1 min-w-0">
          <h3 className="text-body-sm font-semibold text-on-surface truncate leading-tight">
            {name}
          </h3>
          {tagText && (
            <div className="flex items-center gap-xs mt-1">
              <Badge variant="default" size="sm">
                {tagText}
              </Badge>
            </div>
          )}
        </div>

        {/* Compact Adherence Ring */}
        <div className="shrink-0">
          <AdherenceRing.Compact
            percentage={adherenceScore}
            size={44}
            strokeWidth={4}
          />
        </div>
      </div>

      {/* ── Row 2: Adherence Progress Bar ────────────────────────────── */}
      <div className="mt-md">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-label-caps text-on-surface-variant uppercase tracking-wider">
            Adherence
          </span>
          <span
            className={[
              'text-caption font-bold',
              isAtRisk
                ? 'text-error'
                : isWarning
                ? 'text-secondary'
                : 'text-tertiary',
            ].join(' ')}
          >
            {adherenceScore}%
          </span>
        </div>
        {/* Progress track */}
        <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden">
          <div
            className={[
              'h-full rounded-full transition-all duration-700 ease-out',
              isAtRisk
                ? 'bg-error'
                : isWarning
                ? 'bg-secondary'
                : 'bg-tertiary',
            ].join(' ')}
            style={{ width: `${Math.min(adherenceScore, 100)}%` }}
            role="progressbar"
            aria-valuenow={adherenceScore}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${adherenceScore}% adherence`}
          />
        </div>
      </div>

      {/* ── Row 3: Status Badge ──────────────────────────────────────── */}
      <div className="mt-sm flex items-center gap-xs">
        <Badge
          variant={doseStatus.variant}
          size="sm"
          icon={doseStatus.icon}
          dot={lastDoseStatus === 'missed'}
        >
          {doseStatus.label}
        </Badge>

        {/* Warning indicator for at-risk patients */}
        {isAtRisk && (
          <Badge variant="error" size="sm" icon={<AlertTriangle className="w-3 h-3" />}>
            At Risk
          </Badge>
        )}
      </div>

      <Card.Divider />

      {/* ── Row 4: Next Medication ───────────────────────────────────── */}
      {nextMedication?.name && (
        <div className="flex items-center gap-sm p-sm rounded-md bg-surface-container-low/60">
          {/* Pill icon container */}
          <div className="shrink-0 w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center">
            <Pill className="w-4.5 h-4.5 text-primary" />
          </div>

          {/* Med details */}
          <div className="flex-1 min-w-0">
            <p className="text-caption font-semibold text-on-surface truncate">
              {nextMedication.name}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3 text-on-surface-variant" />
              <span className="text-label-caps text-on-surface-variant">
                {nextMedication.time || 'Scheduled'}
                {nextMedication.dosage && ` · ${nextMedication.dosage}`}
              </span>
            </div>
          </div>

          {/* Chevron */}
          <ChevronRight className="w-4 h-4 text-outline shrink-0 group-hover:text-primary transition-colors" />
        </div>
      )}

      {/* ── Row 5: Action Buttons ────────────────────────────────────── */}
      <Card.Footer divider={!nextMedication?.name} className="flex-wrap">
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Calendar className="w-4 h-4" />}
          onClick={handleViewSchedule}
          className="flex-1"
        >
          View Schedule
        </Button>

        <Button
          variant="secondary"
          size="sm"
          leftIcon={<Bell className="w-4 h-4" />}
          onClick={handleSendReminder}
          className="flex-1"
        >
          Send Reminder
        </Button>

        <Button
          variant="danger"
          size="sm"
          leftIcon={<Phone className="w-4 h-4" />}
          onClick={handleEmergencyContact}
        >
          Emergency
        </Button>
      </Card.Footer>
    </Card>
  );
});

PatientRosterCard.displayName = 'PatientRosterCard';
export default PatientRosterCard;
export { PatientRosterCard };
