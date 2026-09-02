'use client';

import React, { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Camera,
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  ChevronLeft,
  X,
  Plus,
} from 'lucide-react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import AddMedicineModal from '@/components/forms/AddMedicineModal';
import { medicineAPI } from '@/lib/api';

function ScanPageInner() {
  const { addToast } = useToast();
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleScanFile = useCallback(async (fileToScan) => {
    const targetFile = fileToScan || selectedFile;
    if (!targetFile) return;
    setScanning(true);
    try {
      const formData = new FormData();
      formData.append('file', targetFile);

      const res = await medicineAPI.ocrScan(formData);
      const data = res?.data || res;
      setExtractedData(data);
      setIsModalOpen(true);

      addToast({
        title: 'Prescription Extracted',
        description: data.medicine_name
          ? `Detected ${data.medicine_name} (${data.dosage || ''}). Review & save to inventory.`
          : 'Text extracted successfully! Review details before saving.',
        variant: 'success',
      });
    } catch (err) {
      addToast({
        title: 'Scan Notice',
        description: err.message || 'Could not parse text automatically. You can enter details manually.',
        variant: 'info',
      });
      // Still open modal so the patient can enter or confirm the medication
      setIsModalOpen(true);
    } finally {
      setScanning(false);
    }
  }, [selectedFile, addToast]);

  const handleFileSelect = useCallback((file) => {
    if (!file) return;
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      addToast({
        title: 'Unsupported File',
        description: 'Please upload an image (JPEG, PNG, WebP) or prescription PDF.',
        variant: 'error',
      });
      return;
    }
    setSelectedFile(file);
    setExtractedData(null);

    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }

    // Automatically begin scan extraction
    handleScanFile(file);
  }, [addToast, handleScanFile]);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, [handleFileSelect]);

  const handleScan = () => handleScanFile(selectedFile);

  const handleClear = () => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setExtractedData(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
        <main className="max-w-5xl mx-auto px-gutter py-lg space-y-lg">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
            <div>
              <Link
                href="/dashboard/patient"
                className="inline-flex items-center gap-xs text-caption font-semibold text-on-surface-variant hover:text-primary transition-colors mb-xs"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to Dashboard
              </Link>
              <h1 className="text-headline-sm font-bold text-on-surface flex items-center gap-sm">
                <Sparkles className="w-6 h-6 text-primary" />
                AI Prescription Scanner
              </h1>
              <p className="text-caption text-on-surface-variant mt-1">
                Upload or capture a prescription label. AI OCR will extract medicine names, dosages, and schedules automatically.
              </p>
            </div>
            <div className="flex items-center gap-sm">
              <Link href="/medicines">
                <Button variant="outline" size="sm" leftIcon={<FileText className="w-4 h-4" />}>
                  Medicine Cabinet
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg">
            {/* Left Upload & Preview Box */}
            <div className="lg:col-span-7 space-y-md">
              <Card variant="default" padding="lg" className="border-2 border-dashed border-outline-variant/60">
                {!selectedFile ? (
                  <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    className={`flex flex-col items-center justify-center py-16 px-4 text-center rounded-xl transition-all ${
                      dragActive ? 'bg-primary/10 border-primary' : 'bg-surface-container-low/50'
                    }`}
                  >
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-md text-primary animate-bounce-gentle">
                      <Camera className="w-8 h-8" />
                    </div>
                    <h3 className="text-body-sm font-bold text-on-surface">Upload Prescription Image</h3>
                    <p className="text-caption text-on-surface-variant max-w-sm mt-1 mb-md">
                      Drag & drop a prescription photo here, or browse from your device
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-sm">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={(e) => handleFileSelect(e.target.files?.[0])}
                        accept="image/jpeg,image/png,image/webp,image/jpg,application/pdf"
                        className="hidden"
                      />
                      <input
                        type="file"
                        ref={cameraInputRef}
                        onChange={(e) => handleFileSelect(e.target.files?.[0])}
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                      />

                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        leftIcon={<Upload className="w-4 h-4" />}
                      >
                        Browse File
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => cameraInputRef.current?.click()}
                        leftIcon={<Camera className="w-4 h-4" />}
                      >
                        Take Photo
                      </Button>
                    </div>
                    <p className="text-[11px] text-on-surface-variant/70 mt-md">
                      Supports JPG, PNG, WebP, and PDF (Max 10MB)
                    </p>
                  </div>
                ) : (
                  <div className="space-y-md">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-sm">
                        <FileText className="w-5 h-5 text-primary" />
                        <div>
                          <p className="text-caption font-semibold text-on-surface truncate max-w-xs">
                            {selectedFile.name}
                          </p>
                          <p className="text-label-caps text-on-surface-variant">
                            {(selectedFile.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleClear}
                        className="p-1 rounded-full text-on-surface-variant hover:bg-surface-container hover:text-error transition-colors"
                        title="Remove file"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {previewUrl ? (
                      <div className="relative rounded-lg overflow-hidden border border-outline-variant bg-black/5 max-h-80 flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={previewUrl}
                          alt="Prescription preview"
                          className="max-h-80 w-auto object-contain rounded-lg shadow-sm"
                        />
                      </div>
                    ) : (
                      <div className="p-8 rounded-lg bg-surface-container text-center text-caption text-on-surface-variant">
                        PDF Document Ready for OCR Extraction
                      </div>
                    )}

                    <div className="flex items-center gap-sm pt-xs">
                      <Button
                        variant="primary"
                        size="md"
                        fullWidth
                        loading={scanning}
                        onClick={handleScan}
                        leftIcon={<Sparkles className="w-5 h-5" />}
                      >
                        {scanning ? 'Extracting Medication Data...' : 'Scan & Extract Details'}
                      </Button>
                      <Button variant="ghost" size="md" onClick={handleClear} disabled={scanning}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </div>

            {/* Right Information / Instructions */}
            <div className="lg:col-span-5 space-y-md">
              <Card variant="flat" padding="md" className="space-y-sm bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-sm text-primary font-semibold text-body-sm">
                  <ShieldCheck className="w-5 h-5" />
                  How AI OCR Works
                </div>
                <ul className="text-caption text-on-surface-variant space-y-2 list-disc list-inside">
                  <li><strong>Image Preprocessing:</strong> OpenCV optimizes contrast, removes shadow noise, and straightens text.</li>
                  <li><strong>Text Extraction:</strong> Tesseract neural OCR identifies prescription text, dosages, and frequency tags.</li>
                  <li><strong>Medical NLP:</strong> spaCy parsing extracts medicine names, dosages (e.g. 500mg), and frequencies (1-0-1).</li>
                  <li><strong>Verification:</strong> You review and approve the extracted details before they are saved to your active schedule.</li>
                </ul>
              </Card>

              {extractedData && (
                <Card variant="default" padding="md" className="border-tertiary/30 bg-tertiary/5 space-y-sm animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-caption font-bold text-tertiary flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Extracted Result
                    </span>
                    <Badge variant="taken" size="xs">Ready to Save</Badge>
                  </div>
                  <div className="space-y-1 text-caption text-on-surface">
                    <p><strong>Medicine:</strong> {extractedData.medicine_name || 'Not detected'}</p>
                    <p><strong>Dosage:</strong> {extractedData.dosage || 'Not detected'}</p>
                    <p><strong>Frequency:</strong> {extractedData.frequency || '1x daily'}</p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    fullWidth
                    onClick={() => setIsModalOpen(true)}
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                  >
                    Review & Add to Cabinet
                  </Button>
                </Card>
              )}
            </div>
          </div>

          {/* Prefilled Add Medicine Modal */}
          <AddMedicineModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            initialData={extractedData}
            onSuccess={() => {
              addToast({
                title: 'Medicine Saved',
                description: `${extractedData?.medicine_name || 'Medication'} added to inventory and schedules generated.`,
                variant: 'success',
              });
              handleClear();
            }}
          />
        </main>
      </div>
    </DashboardLayout>
  );
}

export default function ScanPage() {
  return (
    <ToastProvider position="top-center">
      <ScanPageInner />
    </ToastProvider>
  );
}
