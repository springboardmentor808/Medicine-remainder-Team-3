'use client';

import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { medicineAPI, emitToast } from '@/lib/api';
import {
  Sparkles,
  Pill,
  CheckCircle2,
  Clock,
  Calendar,
  AlertCircle,
  FileText,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';

const CATEGORIES = [
  'General Healthcare',
  'Antibiotics',
  'Blood Pressure',
  'Diabetes',
  'Thyroid',
  'Pain Relief',
  'Cardiovascular',
  'Respiratory',
  'Gastrointestinal',
  'Vitamins & Supplements',
];

const DOSAGE_FORMS = [
  'Tablet',
  'Capsule',
  'Syrup',
  'Injection',
  'Drops',
  'Cream',
  'Inhaler',
  'Powder',
];

export default function ReviewPrescriptionModal({
  isOpen,
  onClose,
  data,
  onSave,
}) {
  const [selectedMedIndex, setSelectedMedIndex] = useState(0);
  const [savedIndices, setSavedIndices] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [form, setForm] = useState({
    name: '',
    dosage: '',
    frequency: '1-0-1',
    daily_frequency: 2,
    quantity_per_dose: 1,
    initial_quantity: 30,
    current_stock: 30,
    dosage_form: 'Tablet',
    disease_category: 'General Healthcare',
    notes: '',
    instructions: '',
  });

  const isExcludedHeader = (name) => {
    if (!name) return true;
    const lower = name.toLowerCase().trim();
    const badPatterns = [
      /templatenet/i,
      /template\.net/i,
      /prescriber/i,
      /medication\s+details/i,
      /license\s+(?:number|no)/i,
      /date\s+of\s+birth/i,
      /of\s+birth/i,
      /company/i,
      /october|november|december|january|february|march|april|may|june|july|august|september/i,
      /patient\s+name/i,
      /doctor\s+name/i,
      /signature/i,
    ];
    return badPatterns.some((p) => p.test(lower));
  };

  // Extract medicines array or wrap single medication, filtering any non-medicine headers
  const medicinesList = React.useMemo(() => {
    if (!data) return [];
    const rawList = Array.isArray(data.medicines) && data.medicines.length > 0 ? data.medicines : [data];
    const filtered = rawList.filter((m) => {
      const name = m?.medicine_name || m?.name || m?.matched_medicine || '';
      return name && name.length >= 3 && !isExcludedHeader(name);
    });
    return filtered.length > 0 ? filtered : rawList;
  }, [data]);

  const convertItemToPayload = (item) => {
    let df = item.daily_frequency || 1;
    const freqStr = String(item.frequency || '').toLowerCase().trim();
    if (freqStr.includes('1-1-1') || freqStr.includes('thrice') || freqStr.includes('3x') || freqStr === '3') {
      df = 3;
    } else if (freqStr.includes('1-0-1') || freqStr.includes('0-1-1') || freqStr.includes('twice') || freqStr.includes('2x') || freqStr === '2') {
      df = 2;
    } else if (freqStr.includes('1-0-0') || freqStr.includes('0-0-1') || freqStr.includes('once') || freqStr.includes('1x') || freqStr === '1') {
      df = 1;
    } else if (freqStr.includes('4x') || freqStr === '4') {
      df = 4;
    }

    const medName = item.medicine_name || item.name || item.matched_medicine || '';
    const qty = parseInt(item.initial_quantity || item.current_stock, 10) || 30;
    let clinicalNotes = item.instructions || item.notes || '';
    if (item.generic_salt && !clinicalNotes.includes(item.generic_salt)) {
      clinicalNotes = clinicalNotes ? `${clinicalNotes} (Generic: ${item.generic_salt})` : `Generic: ${item.generic_salt}`;
    }

    return {
      name: medName.trim(),
      dosage: (item.dosage || 'As prescribed').trim(),
      frequency: item.frequency || (df === 3 ? '1-1-1' : df === 2 ? '1-0-1' : '1-0-0'),
      daily_frequency: df,
      quantity_per_dose: parseInt(item.quantity_per_dose, 10) || 1,
      initial_quantity: qty,
      current_stock: qty,
      dosage_form: item.dosage_form || 'Tablet',
      disease_category: item.disease_category || 'General Healthcare',
      notes: clinicalNotes,
    };
  };

  // Synchronize form when selected medicine or data changes
  const populateForm = (item) => {
    if (!item) return;

    // Calculate daily frequency from frequency shorthand if needed
    let df = item.daily_frequency || 1;
    const freqStr = String(item.frequency || '').toLowerCase().trim();
    if (freqStr.includes('1-1-1') || freqStr.includes('thrice') || freqStr.includes('3x') || freqStr === '3') {
      df = 3;
    } else if (freqStr.includes('1-0-1') || freqStr.includes('0-1-1') || freqStr.includes('twice') || freqStr.includes('2x') || freqStr === '2') {
      df = 2;
    } else if (freqStr.includes('1-0-0') || freqStr.includes('0-0-1') || freqStr.includes('once') || freqStr.includes('1x') || freqStr === '1') {
      df = 1;
    } else if (freqStr.includes('4x') || freqStr === '4') {
      df = 4;
    }

    const medName =
      item.medicine_name ||
      item.name ||
      item.matched_medicine ||
      '';

    const qty = parseInt(item.initial_quantity, 10) || 30;

    let clinicalNotes = item.instructions || item.notes || '';
    if (item.generic_salt && !clinicalNotes.includes(item.generic_salt)) {
      clinicalNotes = clinicalNotes
        ? `${clinicalNotes} (Generic: ${item.generic_salt})`
        : `Generic: ${item.generic_salt}`;
    }

    setForm({
      name: medName,
      dosage: item.dosage || '',
      frequency: item.frequency || (df === 3 ? '1-1-1' : df === 2 ? '1-0-1' : '1-0-0'),
      daily_frequency: df,
      quantity_per_dose: parseInt(item.quantity_per_dose, 10) || 1,
      initial_quantity: qty,
      current_stock: qty,
      dosage_form: item.dosage_form || 'Tablet',
      disease_category: item.disease_category || 'General Healthcare',
      notes: clinicalNotes,
      instructions: item.instructions || '',
    });
    setErrorMessage('');
  };

  useEffect(() => {
    if (isOpen && medicinesList.length > 0) {
      setSelectedMedIndex(0);
      setSavedIndices([]);
      populateForm(medicinesList[0]);
    }
  }, [isOpen, medicinesList]);

  const handleSelectMedicine = (idx) => {
    setSelectedMedIndex(idx);
    populateForm(medicinesList[idx]);
  };

  const handleInputChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errorMessage) setErrorMessage('');
  };

  const handleFrequencyChange = (e) => {
    const val = e.target.value;
    let df = form.daily_frequency;
    if (val === '1-0-0' || val === '0-1-0' || val === '0-0-1') df = 1;
    if (val === '1-0-1' || val === '0-1-1') df = 2;
    if (val === '1-1-1') df = 3;
    if (val === '1-1-1-1') df = 4;
    setForm((prev) => ({ ...prev, frequency: val, daily_frequency: df }));
  };

  const handleSaveAll = async () => {
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      let savedCount = 0;
      for (let i = 0; i < medicinesList.length; i++) {
        if (savedIndices.includes(i)) continue;
        let payload;
        if (i === selectedMedIndex) {
          payload = {
            name: form.name.trim(),
            dosage: form.dosage.trim() || 'As prescribed',
            frequency: form.frequency,
            daily_frequency: parseInt(form.daily_frequency, 10) || 1,
            quantity_per_dose: parseInt(form.quantity_per_dose, 10) || 1,
            initial_quantity: parseInt(form.initial_quantity, 10) || 30,
            current_stock: parseInt(form.current_stock || form.initial_quantity, 10) || 30,
            dosage_form: form.dosage_form,
            disease_category: form.disease_category,
            notes: form.notes || form.instructions || '',
          };
        } else {
          payload = convertItemToPayload(medicinesList[i]);
        }
        if (payload.name) {
          await medicineAPI.create(payload);
          savedCount++;
        }
      }
      emitToast(`Successfully added all ${medicinesList.length} medications to your cabinet & schedule!`, 'success');
      if (onSave) {
        await onSave(null);
      }
      onClose();
    } catch (err) {
      console.error('Failed to save all medications:', err);
      setErrorMessage(err.message || 'Failed to save all medicines. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!form.name.trim()) {
      setErrorMessage('Medicine name is required.');
      return;
    }
    if (form.initial_quantity <= 0) {
      setErrorMessage('Initial quantity must be greater than 0.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const payload = {
        name: form.name.trim(),
        dosage: form.dosage.trim() || 'As prescribed',
        frequency: form.frequency,
        daily_frequency: parseInt(form.daily_frequency, 10) || 1,
        quantity_per_dose: parseInt(form.quantity_per_dose, 10) || 1,
        initial_quantity: parseInt(form.initial_quantity, 10) || 30,
        current_stock: parseInt(form.current_stock || form.initial_quantity, 10) || 30,
        dosage_form: form.dosage_form,
        disease_category: form.disease_category,
        notes: form.notes || form.instructions || '',
      };

      const newSaved = [...savedIndices, selectedMedIndex];
      setSavedIndices(newSaved);

      // Check if there are other unsaved medicines
      const nextUnsavedIdx = medicinesList.findIndex((_, idx) => !newSaved.includes(idx));

      if (medicinesList.length > 1 && nextUnsavedIdx !== -1) {
        await medicineAPI.create(payload);
        emitToast(`Added ${payload.name} to schedule! Reviewing next (${nextUnsavedIdx + 1} of ${medicinesList.length})...`, 'success');
        handleSelectMedicine(nextUnsavedIdx);
      } else {
        if (onSave) {
          await onSave(payload);
        } else {
          await medicineAPI.create(payload);
        }
        emitToast(`${payload.name} saved to cabinet!`, 'success');
        onClose();
      }
    } catch (err) {
      console.error('Failed to save prescription medicine:', err);
      setErrorMessage(err.message || 'Failed to save medicine. Please check the fields and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confidencePct = Math.round(Number(data?.confidence_score ?? 0.85) * 100);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Verify Extracted Prescription"
      description="Review and customize the AI-extracted prescription details before adding to your schedule."
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-md">
        {/* OCR Confidence Header Badge */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-primary/10 border border-primary/20">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
            <div>
              <p className="text-caption font-bold text-on-surface">
                {data?.verified ? 'Catalog Verified Prescription' : 'Prescription Scanned via AI'}
              </p>
              <p className="text-[11px] text-on-surface-variant">
                {medicinesList.length} medication{medicinesList.length > 1 ? 's' : ''} detected · {confidencePct}% OCR confidence
              </p>
            </div>
          </div>
          <Badge variant={confidencePct >= 80 ? 'taken' : 'warning'} size="sm">
            {confidencePct}% Confidence
          </Badge>
        </div>

        {/* Multi-drug selector tabs if more than one medicine found */}
        {medicinesList.length > 1 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
                Detected Medicines ({medicinesList.length})
              </label>
              <span className="text-[11px] text-primary font-medium">
                {savedIndices.length} of {medicinesList.length} saved
              </span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {medicinesList.map((m, idx) => {
                const isSaved = savedIndices.includes(idx);
                return (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => handleSelectMedicine(idx)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      selectedMedIndex === idx
                        ? 'bg-primary text-white shadow-sm'
                        : isSaved
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
                    }`}
                  >
                    {isSaved ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Pill className="w-3.5 h-3.5" />}
                    {m.medicine_name || m.name || `Medicine ${idx + 1}`}
                    {isSaved && <span className="text-[10px] opacity-80">(Saved)</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Form Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
          {/* Medicine Name */}
          <div className="sm:col-span-2">
            <label className="block text-caption font-semibold text-on-surface mb-1">
              Medicine Name <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="e.g. Augmentin 625 Duo, Metformin, etc."
              required
              className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface text-on-surface text-body-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Dosage */}
          <div>
            <label className="block text-caption font-semibold text-on-surface mb-1">
              Dosage / Strength
            </label>
            <input
              type="text"
              value={form.dosage}
              onChange={(e) => handleInputChange('dosage', e.target.value)}
              placeholder="e.g. 500mg, 625mg, 10ml"
              className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface text-on-surface text-body-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Dosage Form */}
          <div>
            <label className="block text-caption font-semibold text-on-surface mb-1">
              Form
            </label>
            <select
              value={form.dosage_form}
              onChange={(e) => handleInputChange('dosage_form', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface text-on-surface text-body-sm focus:outline-none focus:border-primary transition-colors"
            >
              {DOSAGE_FORMS.map((formType) => (
                <option key={formType} value={formType}>
                  {formType}
                </option>
              ))}
            </select>
          </div>

          {/* Frequency Pattern */}
          <div>
            <label className="block text-caption font-semibold text-on-surface mb-1">
              Frequency Regimen
            </label>
            <select
              value={form.frequency}
              onChange={handleFrequencyChange}
              className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface text-on-surface text-body-sm focus:outline-none focus:border-primary transition-colors"
            >
              <option value="1-0-0">Once Daily (Morning: 1-0-0)</option>
              <option value="0-0-1">Once Daily (Night: 0-0-1)</option>
              <option value="1-0-1">Twice Daily (Morning + Night: 1-0-1)</option>
              <option value="1-1-1">Thrice Daily (Morning + Noon + Night: 1-1-1)</option>
              <option value="1-1-1-1">Four Times Daily (1-1-1-1)</option>
              <option value="As Needed">As Needed (SOS / PRN)</option>
            </select>
          </div>

          {/* Daily Frequency & Qty per dose */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-caption font-semibold text-on-surface mb-1">
                Times / Day
              </label>
              <input
                type="number"
                min="1"
                max="6"
                value={form.daily_frequency}
                onChange={(e) => handleInputChange('daily_frequency', Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface text-on-surface text-body-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="block text-caption font-semibold text-on-surface mb-1">
                Per Dose
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={form.quantity_per_dose}
                onChange={(e) => handleInputChange('quantity_per_dose', Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface text-on-surface text-body-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          {/* Initial Quantity (Total Stock) */}
          <div>
            <label className="block text-caption font-semibold text-on-surface mb-1">
              Initial Quantity (Total Units)
            </label>
            <input
              type="number"
              min="1"
              value={form.initial_quantity}
              onChange={(e) => {
                const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                setForm((prev) => ({ ...prev, initial_quantity: val, current_stock: val }));
              }}
              className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface text-on-surface text-body-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Therapeutic Category */}
          <div>
            <label className="block text-caption font-semibold text-on-surface mb-1">
              Category
            </label>
            <select
              value={form.disease_category}
              onChange={(e) => handleInputChange('disease_category', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface text-on-surface text-body-sm focus:outline-none focus:border-primary transition-colors"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Clinical Instructions / Notes */}
          <div className="sm:col-span-2">
            <label className="block text-caption font-semibold text-on-surface mb-1">
              Instructions & Dietary Guidance
            </label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="e.g. Take with food, after breakfast, avoid dairy"
              className="w-full px-3 py-2 rounded-lg border border-outline-variant bg-surface text-on-surface text-body-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>
        </div>

        {/* Raw text preview */}
        {data?.raw_text && (
          <div className="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/50 text-[11px] text-on-surface-variant font-mono line-clamp-2">
            <span className="font-bold text-on-surface">Extracted OCR: </span>
            {data.raw_text}
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-error/10 border border-error/20 text-error text-caption">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Modal Actions */}
        <Modal.Footer>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
            className="min-h-[42px]"
          >
            Cancel
          </Button>
          {medicinesList.length > 1 && savedIndices.length < medicinesList.length && (
            <Button
              type="button"
              variant="outlined"
              onClick={handleSaveAll}
              disabled={isSubmitting}
              isLoading={isSubmitting}
              className="min-h-[42px]"
            >
              Save All ({medicinesList.length}) Medicines
            </Button>
          )}
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            leftIcon={
              medicinesList.length > 1 && selectedMedIndex < medicinesList.length - 1
                ? <ChevronRight className="w-4 h-4" />
                : <CheckCircle2 className="w-4 h-4" />
            }
            className="min-h-[42px] px-5"
          >
            {isSubmitting
              ? 'Saving...'
              : medicinesList.length > 1 && selectedMedIndex < medicinesList.length - 1
              ? `Save & Next (${selectedMedIndex + 1}/${medicinesList.length})`
              : 'Confirm & Save to Cabinet'}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
