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

export default function AddMedicineModal({ isOpen, onClose, onSuccess, initialData = null }) {
  const [formData, setFormData] = useState({
    name: '',
    disease_category: 'General Healthcare',
    dosage: '',
    initial_quantity: 30,
    daily_frequency: 1,
    quantity_per_dose: 1,
    notes: '',
  });

  React.useEffect(() => {
    if (initialData) {
      setFormData((prev) => ({
        ...prev,
        name: initialData.medicine_name || initialData.name || '',
        dosage: initialData.dosage || '',
        daily_frequency: initialData.frequency === '1-1-1' ? 3 : initialData.frequency === '1-0-1' ? 2 : 1,
        notes: initialData.raw_text ? `OCR Scanned: ${initialData.raw_text}` : (initialData.notes || ''),
        disease_category: initialData.disease_category || 'General Healthcare',
      }));
    }
  }, [initialData, isOpen]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? '' : Number(value)) : value,
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

    const newMedObj = {
      id: 'med-' + Date.now(),
      name: formData.name.trim(),
      disease_category: formData.disease_category,
      dosage: formData.dosage.trim(),
      dosage_form: 'Tablet',
      current_stock: Number(formData.initial_quantity) || 30,
      total_stock: Number(formData.initial_quantity) || 30,
      daily_frequency: Number(formData.daily_frequency) || 1,
      quantity_per_dose: Number(formData.quantity_per_dose) || 1,
      status: 'normal',
      notes: formData.notes ? formData.notes.trim() : null,
    };

    try {
      const res = await medicineAPI.create({
        name: formData.name.trim(),
        disease_category: formData.disease_category,
        dosage: formData.dosage.trim(),
        initial_quantity: Number(formData.initial_quantity) || 30,
        daily_frequency: Number(formData.daily_frequency) || 1,
        quantity_per_dose: Number(formData.quantity_per_dose) || 1,
        notes: formData.notes ? formData.notes.trim() : null,
      });

      // Reset form
      setFormData({
        name: '',
        disease_category: 'General Healthcare',
        dosage: '',
        initial_quantity: 30,
        daily_frequency: 1,
        quantity_per_dose: 1,
        notes: '',
      });

      onSuccess?.(res?.data || newMedObj);
      onClose?.();
    } catch (err) {
      console.log('Backend sync offline/fallback, adding locally:', err.message);
      onSuccess?.(newMedObj);
      onClose?.();
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
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          <Input
            label="Dosage Strength"
            id="dosage"
            name="dosage"
            placeholder="e.g. 500mg, 1 Tablet"
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
