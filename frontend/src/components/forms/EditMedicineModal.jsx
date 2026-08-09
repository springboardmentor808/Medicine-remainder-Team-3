'use client';

import React, { useState, useEffect } from 'react';
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

export default function EditMedicineModal({ isOpen, onClose, medicine, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    disease_category: 'General Healthcare',
    dosage: '',
    daily_frequency: 1,
    quantity_per_dose: 1,
    notes: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (medicine) {
      setFormData({
        name: medicine.name || '',
        disease_category: medicine.disease_category || 'General Healthcare',
        dosage: medicine.dosage || '',
        daily_frequency: medicine.daily_frequency || 1,
        quantity_per_dose: medicine.quantity_per_dose || 1,
        notes: medicine.notes || '',
      });
    }
  }, [medicine]);

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
    if (!medicine?.id) return;

    if (!formData.name.trim()) {
      setError('Medicine name is required.');
      return;
    }
    if (!formData.dosage.trim()) {
      setError('Dosage strength is required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await medicineAPI.update(medicine.id, {
        name: formData.name.trim(),
        disease_category: formData.disease_category,
        dosage: formData.dosage.trim(),
        daily_frequency: Number(formData.daily_frequency) || 1,
        quantity_per_dose: Number(formData.quantity_per_dose) || 1,
        notes: formData.notes ? formData.notes.trim() : null,
      });

      onSuccess?.();
      onClose?.();
    } catch (err) {
      setError(err.message || 'Failed to update medicine details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Medicine Details"
      description="Update dosage schedule, category, or instructions for this medicine."
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
          id="edit-name"
          name="name"
          placeholder="e.g. Metformin"
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
            id="edit-dosage"
            name="dosage"
            placeholder="e.g. 500mg"
            value={formData.dosage}
            onChange={handleChange}
            required
            leftIcon={<span className="material-symbols-outlined text-[20px]">pill</span>}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Daily Frequency (times/day)"
            id="edit-daily_frequency"
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
            id="edit-quantity_per_dose"
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
            placeholder="e.g. Take with food"
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
            Update Changes
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
