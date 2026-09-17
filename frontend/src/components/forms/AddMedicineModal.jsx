'use client';

import React, { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { medicineAPI } from '@/lib/api';

const CATEGORIES = [
  'General Healthcare',
  'Blood Pressure',
  'Diabetes',
  'Thyroid',
  'Antibiotics',
  'Vitamins',
  'Heart Medications',
];

const DOSAGE_FORMS = [
  'Tablet', 'Capsule', 'Syrup', 'Injection', 'Drops',
  'Cream', 'Ointment', 'Inhaler', 'Patch', 'Powder',
  'Suppository', 'Suspension', 'Lozenge', 'Spray',
];

const MEDICINE_PRESETS = [
  'Metformin', 'Amlodipine', 'Lisinopril', 'Atorvastatin', 'Omeprazole',
  'Levothyroxine', 'Aspirin', 'Paracetamol', 'Ibuprofen', 'Amoxicillin',
  'Ciprofloxacin', 'Cetirizine', 'Loratadine', 'Pantoprazole', 'Ranitidine',
  'Losartan', 'Hydrochlorothiazide', 'Metoprolol', 'Glimepiride', 'Sitagliptin',
  'Insulin Glargine', 'Rosuvastatin', 'Clopidogrel', 'Warfarin', 'Digoxin',
  'Furosemide', 'Spironolactone', 'Prednisolone', 'Montelukast', 'Salbutamol',
  'Vitamin D3', 'Vitamin B12', 'Folic Acid', 'Iron Supplement', 'Calcium',
  'Azithromycin', 'Doxycycline', 'Fluconazole', 'Acyclovir', 'Gabapentin',
];

export default function AddMedicineModal({ isOpen, onClose, onSuccess, initialData = null }) {
  const [formData, setFormData] = useState({
    name: '',
    disease_category: 'General Healthcare',
    dosage: '',
    dosage_form: 'Tablet',
    initial_quantity: 30,
    daily_frequency: 1,
    quantity_per_dose: 1,
    notes: '',
  });

  const [selectedMedIndex, setSelectedMedIndex] = useState(0);

  const populateFromItem = (item) => {
    if (!item) return;
    let freq = 1;
    const f = String(item.frequency || item.extracted_frequency || '').trim().toLowerCase();
    if (f.includes('1-1-1') || f.includes('thrice') || f.includes('3 times') || f.includes('3x') || f === '3') {
      freq = 3;
    } else if (f.includes('1-0-1') || f.includes('0-1-1') || f.includes('twice') || f.includes('2 times') || f.includes('2x') || f === '2') {
      freq = 2;
    } else if (f.includes('4 times') || f.includes('4x') || f === '4') {
      freq = 4;
    } else if (typeof item.daily_frequency === 'number') {
      freq = item.daily_frequency;
    }

    const initialQty = item.extracted_quantity || item.initial_quantity || 30;

    const medName =
      item.matched_medicine ||
      item.medicine_name ||
      item.extracted_medicine_name ||
      item.name ||
      '';

    const dosageForm =
      item.dosage_form ||
      (medName.toLowerCase().includes('syrup')
        ? 'Syrup'
        : medName.toLowerCase().includes('capsule') || medName.toLowerCase().includes('cap')
        ? 'Capsule'
        : medName.toLowerCase().includes('injection')
        ? 'Injection'
        : medName.toLowerCase().includes('drops')
        ? 'Drops'
        : 'Tablet');

    const qtyPerDose = parseInt(item.quantity_per_dose, 10) || 1;

    let clinicalNotes = item.instructions || '';
    if (item.generic_salt && !clinicalNotes.includes(item.generic_salt)) {
      clinicalNotes = clinicalNotes
        ? `${clinicalNotes} (Generic: ${item.generic_salt})`
        : `Generic: ${item.generic_salt}`;
    }
    if (!clinicalNotes && item.raw_text) {
      clinicalNotes = `Prescription text: ${item.raw_text.slice(0, 150)}`;
    }

    setFormData((prev) => ({
      ...prev,
      name: medName,
      dosage: item.dosage || item.extracted_dosage || '',
      dosage_form: dosageForm,
      daily_frequency: freq,
      quantity_per_dose: qtyPerDose,
      initial_quantity: parseInt(initialQty, 10) || 30,
      current_stock: parseInt(item.current_stock || initialQty, 10) || 30,
      notes: clinicalNotes || item.notes || '',
      disease_category: item.disease_category || 'General Healthcare',
    }));
  };

  React.useEffect(() => {
    if (initialData && isOpen) {
      const medList = Array.isArray(initialData.medicines) && initialData.medicines.length > 0
        ? initialData.medicines
        : [initialData];
      setSelectedMedIndex(0);
      populateFromItem(medList[0]);
    }
  }, [initialData, isOpen]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    let val = type === 'number' ? (value === '' ? '' : parseInt(value, 10) || 0) : value;
    // Enforce min=1 on numeric fields
    if (type === 'number' && val !== '' && val < 1) val = 1;
    setFormData((prev) => ({
      ...prev,
      [name]: val,
    }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Medicine name is required.');
      return;
    }
    if (!formData.dosage.trim()) {
      setError('Dosage details (e.g. 500mg) are required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const initialQty = parseInt(formData.initial_quantity, 10) || 30;
      const currentStock = parseInt(formData.current_stock || formData.initial_quantity, 10) || initialQty;
      const dailyFreq = parseInt(formData.daily_frequency, 10) || 1;
      const qtyPerDose = parseInt(formData.quantity_per_dose, 10) || 1;

      const res = await medicineAPI.create({
        name: formData.name.trim(),
        disease_category: formData.disease_category || 'General Healthcare',
        dosage: formData.dosage.trim(),
        dosage_form: formData.dosage_form || 'Tablet',
        initial_quantity: initialQty,
        current_stock: currentStock,
        daily_frequency: dailyFreq,
        quantity_per_dose: qtyPerDose,
        notes: formData.notes ? formData.notes.trim() : null,
      });

      // Reset form only on success
      setFormData({
        name: '',
        disease_category: 'General Healthcare',
        dosage: '',
        dosage_form: 'Tablet',
        initial_quantity: 30,
        current_stock: 30,
        daily_frequency: 1,
        quantity_per_dose: 1,
        notes: '',
      });

      onSuccess?.(res?.data || res);
      onClose?.();
    } catch (err) {
      setError(err.message || 'Failed to save medicine. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Medicine"
      description="Add a medication to your inventory to automate reminders and refill tracking."
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {Array.isArray(initialData?.medicines) && initialData.medicines.length > 1 && (
          <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 space-y-1.5">
            <p className="text-xs font-semibold text-primary">
              AI Detected Multiple Medications ({initialData.medicines.length}):
            </p>
            <div className="flex flex-wrap gap-2">
              {initialData.medicines.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setSelectedMedIndex(idx);
                    populateFromItem(item);
                  }}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium border transition-all ${
                    selectedMedIndex === idx
                      ? 'bg-primary text-white border-primary shadow-sm'
                      : 'bg-surface hover:bg-surface-variant/40 text-on-surface border-outline-variant'
                  }`}
                >
                  {item.medicine_name || `Medicine #${idx + 1}`} {item.dosage ? `(${item.dosage})` : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-error-container/40 border border-error/30 text-error text-caption flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{error}</span>
          </div>
        )}

        <Input
          label="Medicine Name"
          id="name"
          name="name"
          placeholder="e.g. Metformin, Amlodipine"
          value={formData.name}
          onChange={handleChange}
          required
          leftIcon={<span className="material-symbols-outlined text-[20px]">medication</span>}
          list="medicine-presets"
        />
        <datalist id="medicine-presets">
          {MEDICINE_PRESETS.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-body-sm font-semibold text-on-surface mb-1">
              Disease Category
            </label>
            <select
              name="disease_category"
              value={formData.disease_category}
              onChange={handleChange}
              className="w-full h-[44px] px-3 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface text-body-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-body-sm font-semibold text-on-surface mb-1">
              Dosage Form
            </label>
            <select
              name="dosage_form"
              value={formData.dosage_form}
              onChange={handleChange}
              className="w-full h-[44px] px-3 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface text-body-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {DOSAGE_FORMS.map((form) => (
                <option key={form} value={form}>
                  {form}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Dosage Strength"
            id="dosage"
            name="dosage"
            placeholder="e.g. 500mg, 10ml"
            value={formData.dosage}
            onChange={handleChange}
            required
            leftIcon={<span className="material-symbols-outlined text-[20px]">pill</span>}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Initial Stock Quantity"
            id="initial_quantity"
            name="initial_quantity"
            type="number"
            min={1}
            value={formData.initial_quantity}
            onChange={handleChange}
            required
            leftIcon={<span className="material-symbols-outlined text-[20px]">inventory_2</span>}
          />

          <Input
            label="Daily Frequency (times/day)"
            id="daily_frequency"
            name="daily_frequency"
            type="number"
            min={1}
            value={formData.daily_frequency}
            onChange={handleChange}
            required
            leftIcon={<span className="material-symbols-outlined text-[20px]">schedule</span>}
          />

          <Input
            label="Quantity Per Dose"
            id="quantity_per_dose"
            name="quantity_per_dose"
            type="number"
            min={1}
            value={formData.quantity_per_dose}
            onChange={handleChange}
            required
            leftIcon={<span className="material-symbols-outlined text-[20px]">pin</span>}
          />
        </div>

        <div>
          <label className="block text-body-sm font-semibold text-on-surface mb-1">
            Instructions & Notes (Optional)
          </label>
          <textarea
            name="notes"
            rows={3}
            placeholder="e.g. Take after breakfast with warm water"
            value={formData.notes}
            onChange={handleChange}
            className="w-full p-3 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface text-body-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
        </div>

        <Modal.Footer>
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Save Medicine
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
