'use client';
import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import { medicineAPI } from '@/lib/api';

/**
 * AddReminderModal — Lets the patient create a new reminder by:
 *  1. Selecting a medicine from a dropdown (fetched from API)
 *  2. Picking a time slot (Morning / Afternoon / Evening) with custom time
 *  3. Choosing notification channels (Push, Email, SMS, In-App)
 */

const TIME_SLOTS = [
  { key: 'morning',   label: '🌅 Morning',   default: '08:00' },
  { key: 'afternoon', label: '☀️ Afternoon', default: '13:00' },
  { key: 'evening',   label: '🌙 Evening',   default: '20:00' },
];

const CHANNELS = [
  { key: 'push',   label: 'Push Notification', icon: 'notifications' },
  { key: 'email',  label: 'Email',             icon: 'mail' },
  { key: 'sms',    label: 'SMS',               icon: 'sms' },
  { key: 'in_app', label: 'In-App Alert',      icon: 'campaign' },
];

const DOSAGE_UNITS = ['mg', 'ml', 'IU', 'mcg', 'g', 'drops', 'puffs', 'patches', 'units'];

export default function AddReminderModal({ isOpen, onClose, onAdd }) {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form state
  const [selectedMedicine, setSelectedMedicine] = useState('');
  const [customName, setCustomName] = useState('');
  const [dosage, setDosage] = useState('');
  const [dosageUnit, setDosageUnit] = useState('mg');
  const [slot, setSlot] = useState('morning');
  const [customTime, setCustomTime] = useState('08:00');
  const [channels, setChannels] = useState(new Set(['push', 'in_app']));
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState({});

  // Fetch medicines from backend
  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const res = await medicineAPI.list();
        if (res?.data && Array.isArray(res.data)) {
          setMedicines(res.data);
        }
      } catch {
        // Ignore — user can type manually
      }
    })();
  }, [isOpen]);

  // Reset form when closed
  useEffect(() => {
    if (!isOpen) {
      setSelectedMedicine('');
      setCustomName('');
      setDosage('');
      setDosageUnit('mg');
      setSlot('morning');
      setCustomTime('08:00');
      setChannels(new Set(['push', 'in_app']));
      setNotes('');
      setErrors({});
    }
  }, [isOpen]);

  const toggleChannel = (ch) => {
    setChannels((prev) => {
      const next = new Set(prev);
      if (next.has(ch)) next.delete(ch);
      else next.add(ch);
      return next;
    });
  };

  const validate = () => {
    const errs = {};
    const name = selectedMedicine === '__custom__' ? customName.trim() : selectedMedicine;
    if (!name) errs.medicine = 'Please select or enter a medicine name';
    if (!dosage || Number(dosage) <= 0) errs.dosage = 'Enter a valid dosage';
    if (channels.size === 0) errs.channels = 'Select at least one notification channel';
    return errs;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    const medicineName = selectedMedicine === '__custom__' ? customName.trim() : selectedMedicine;
    const slotMeta = TIME_SLOTS.find((s) => s.key === slot);

    onAdd?.({
      medicine: medicineName,
      dosage: `${dosage} ${dosageUnit}`,
      slot: slot,
      time: customTime || slotMeta?.default || '08:00',
      channels: Array.from(channels),
      notes: notes.trim(),
    });

    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-scrim/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-modal border border-outline-variant/30 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-outline-variant/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-[20px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}>
                alarm_add
              </span>
            </div>
            <div>
              <h2 className="text-title-sm font-bold text-on-surface">Add Reminder</h2>
              <p className="text-caption text-on-surface-variant">Set up a medication reminder</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-on-surface/8 transition-colors"
            aria-label="Close modal"
          >
            <span className="material-symbols-outlined text-[20px] text-on-surface-variant">close</span>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">

          {/* Medicine Selection */}
          <div>
            <label className="text-caption font-semibold text-on-surface mb-1.5 block">
              Medicine *
            </label>
            <select
              value={selectedMedicine}
              onChange={(e) => {
                setSelectedMedicine(e.target.value);
                if (errors.medicine) setErrors((p) => ({ ...p, medicine: '' }));
              }}
              className="w-full px-3 py-2.5 rounded-lg border border-outline-variant/50 bg-surface-container-lowest text-on-surface text-body-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            >
              <option value="">— Select a medicine —</option>
              {medicines.map((med) => (
                <option key={med.id} value={med.name || med.medicine_name}>
                  {med.name || med.medicine_name} {med.dosage ? `(${med.dosage})` : ''}
                </option>
              ))}
              <option value="__custom__">✏️ Type custom name...</option>
            </select>
            {selectedMedicine === '__custom__' && (
              <input
                type="text"
                placeholder="Enter medicine name"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="mt-2 w-full px-3 py-2.5 rounded-lg border border-outline-variant/50 bg-surface-container-lowest text-on-surface text-body-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            )}
            {errors.medicine && (
              <p className="text-caption text-error mt-1">{errors.medicine}</p>
            )}
          </div>

          {/* Dosage */}
          <div>
            <label className="text-caption font-semibold text-on-surface mb-1.5 block">
              Dosage *
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                step="any"
                placeholder="e.g. 500"
                value={dosage}
                onChange={(e) => {
                  setDosage(e.target.value);
                  if (errors.dosage) setErrors((p) => ({ ...p, dosage: '' }));
                }}
                className="flex-1 px-3 py-2.5 rounded-lg border border-outline-variant/50 bg-surface-container-lowest text-on-surface text-body-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
              <select
                value={dosageUnit}
                onChange={(e) => setDosageUnit(e.target.value)}
                className="w-24 px-2 py-2.5 rounded-lg border border-outline-variant/50 bg-surface-container-lowest text-on-surface text-body-sm focus:border-primary outline-none"
              >
                {DOSAGE_UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            {errors.dosage && (
              <p className="text-caption text-error mt-1">{errors.dosage}</p>
            )}
          </div>

          {/* Time Slot */}
          <div>
            <label className="text-caption font-semibold text-on-surface mb-1.5 block">
              Time Slot
            </label>
            <div className="grid grid-cols-3 gap-2">
              {TIME_SLOTS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => {
                    setSlot(s.key);
                    setCustomTime(s.default);
                  }}
                  className={[
                    'px-3 py-2.5 rounded-lg text-caption font-semibold transition-all border text-center',
                    slot === s.key
                      ? 'bg-primary text-on-primary border-primary shadow-sm'
                      : 'bg-surface-container-low text-on-surface-variant border-outline-variant/40 hover:border-primary/40',
                  ].join(' ')}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="mt-2">
              <label className="text-label-caps text-on-surface-variant">Custom time:</label>
              <input
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="ml-2 px-2 py-1.5 rounded border border-outline-variant/50 bg-surface-container-lowest text-on-surface text-caption focus:border-primary outline-none"
              />
            </div>
          </div>

          {/* Notification Channels */}
          <div>
            <label className="text-caption font-semibold text-on-surface mb-1.5 block">
              Notification Channels
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CHANNELS.map((ch) => (
                <button
                  key={ch.key}
                  type="button"
                  onClick={() => {
                    toggleChannel(ch.key);
                    if (errors.channels) setErrors((p) => ({ ...p, channels: '' }));
                  }}
                  className={[
                    'flex items-center gap-2 px-3 py-2.5 rounded-lg text-caption font-medium transition-all border',
                    channels.has(ch.key)
                      ? 'bg-primary/10 text-primary border-primary/30'
                      : 'bg-surface-container-low text-on-surface-variant border-outline-variant/40 hover:border-outline-variant/60',
                  ].join(' ')}
                >
                  <span className="material-symbols-outlined text-[16px]"
                        style={{ fontVariationSettings: channels.has(ch.key) ? "'FILL' 1" : "'FILL' 0" }}>
                    {ch.icon}
                  </span>
                  {ch.label}
                </button>
              ))}
            </div>
            {errors.channels && (
              <p className="text-caption text-error mt-1">{errors.channels}</p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-caption font-semibold text-on-surface mb-1.5 block">
              Notes (optional)
            </label>
            <textarea
              placeholder="e.g. Take with food, before bedtime..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2.5 rounded-lg border border-outline-variant/50 bg-surface-container-lowest text-on-surface text-body-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-outline-variant/30 bg-surface-container-low/50">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            leftIcon={
              <span className="material-symbols-outlined text-[16px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}>
                alarm_add
              </span>
            }
          >
            Add Reminder
          </Button>
        </div>
      </div>
    </div>
  );
}
