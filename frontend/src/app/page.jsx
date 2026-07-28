'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Pill, Bell, Shield, Camera, Cpu, Activity, Clock, CheckCircle } from 'lucide-react';

export default function Home() {
  const [status, setStatus] = useState('Connecting to Backend...');
  const [reminders, setReminders] = useState([
    { id: 1, name: 'Amoxicillin 500mg', time: '08:00 AM', status: 'Taken', type: 'Antibiotic' },
    { id: 2, name: 'Metformin 850mg', time: '01:30 PM', status: 'Pending', type: 'Diabetes' },
    { id: 3, name: 'Atorvastatin 20mg', time: '09:00 PM', status: 'Upcoming', type: 'Cholesterol' }
  ]);

  useEffect(() => {
    axios.get('http://localhost:8000/health')
      .then(res => setStatus(`Backend Status: ${res.data.status || 'Healthy'}`))
      .catch(() => setStatus('Backend Standby (Start FastAPI on port 8000)'));
  }, []);

  return (
    <main className="min-h-screen p-6 md:p-12 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-teal-500/20 rounded-xl border border-teal-500/30 text-teal-400">
            <Pill className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-indigo-400">
              AI Intelligent Medicine Reminder
            </h1>
            <p className="text-sm text-slate-400">Smart Prescription OCR & Medication Tracking System</p>
          </div>
        </div>
        <div className="mt-4 md:mt-0 px-4 py-2 bg-slate-800/90 rounded-full border border-slate-700 text-xs text-teal-300 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span>
          {status}
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Section 1: Today's Reminders */}
        <section className="md:col-span-2 p-6 bg-slate-900/60 rounded-2xl border border-slate-800 backdrop-blur-sm space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-slate-200">
              <Clock className="w-5 h-5 text-teal-400" /> Today's Medication Schedule
            </h2>
            <button className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-medium transition">
              + Add Medicine
            </button>
          </div>

          <div className="space-y-3">
            {reminders.map(item => (
              <div key={item.id} className="p-4 bg-slate-800/50 hover:bg-slate-800/80 rounded-xl border border-slate-700/50 flex justify-between items-center transition">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg ${item.status === 'Taken' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                    <Pill className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-medium text-slate-100">{item.name}</h3>
                    <p className="text-xs text-slate-400">{item.type} • Scheduled for {item.time}</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  item.status === 'Taken' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                  item.status === 'Pending' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                  'bg-slate-700 text-slate-300'
                }`}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: AI & OCR Prescription Scanner */}
        <section className="p-6 bg-slate-900/60 rounded-2xl border border-slate-800 backdrop-blur-sm space-y-6 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2 text-slate-200">
              <Camera className="w-5 h-5 text-indigo-400" /> AI Prescription Scanner
            </h2>
            <p className="text-xs text-slate-400 mt-1">Upload prescription image for Tesseract OCR & OpenCV parsing.</p>
            
            <div className="mt-6 border-2 border-dashed border-slate-700 rounded-xl p-6 text-center hover:border-indigo-500/50 transition cursor-pointer bg-slate-800/30">
              <Cpu className="w-10 h-10 text-indigo-400 mx-auto mb-2 opacity-80" />
              <p className="text-xs text-slate-300 font-medium">Drop prescription image here</p>
              <p className="text-[10px] text-slate-500 mt-1">Supports PNG, JPG, Medical Scans</p>
            </div>
          </div>

          <div className="p-4 bg-indigo-950/40 rounded-xl border border-indigo-900/50 space-y-2">
            <h4 className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
              <Shield className="w-4 h-4" /> Security & Auth
            </h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              JWT with HttpOnly Cookies & OAuth2 authenticated endpoints. Push Reminders active via Twilio SMS & SendGrid.
            </p>
          </div>
        </section>
      </div>

      {/* Footer Info */}
      <footer className="text-center text-xs text-slate-500 pt-6 border-t border-slate-800/60">
        AI Intelligent Medicine Reminder System • Next.js, FastAPI, OpenCV, spaCy, PostgreSQL, MongoDB, Redis
      </footer>
    </main>
  );
}
