# PillSync (Intelligent Medicine Reminder & Tracking) - Stitch UI Design System Specifications

**Source Reference**: Google Stitch Project ([https://stitch.withgoogle.com/projects/8343473834800165839](https://stitch.withgoogle.com/projects/8343473834800165839))  
**Saved Date**: August 6, 2026  
**Status**: Saved & Ready for Implementation

---

## 🎨 1. Design System & Tokens

### Color Palette
- **Primary Brand Color**: Dark Emerald / Teal (`#005C4B`, `#059669`)
- **Secondary / Accent**: Mint Green (`#10B981`, `#34D399`)
- **Background (Light)**: Medical Ice Mint (`#F0FDF4`, `#F8FAFC`)
- **Surface / Cards**: Pure White (`#FFFFFF`) with subtle border (`#E2E8F0`)
- **Emergency Alert Accent**: Crimson Red (`#DC2626`, `#EF4444`) - used for medical disclaimers & missed dose urgency
- **Text Primary**: Slate Charcoal (`#0F172A`)
- **Text Secondary**: Muted Slate (`#64748B`)

### Typography & Structure
- **Font Family**: Google Sans / Inter
- **Border Radius**: 
  - Buttons & Pills: `rounded-full` (9999px)
  - Cards & Containers: `rounded-2xl` (16px) or `rounded-3xl` (24px)
- **Shadows**: Soft elevation (`shadow-sm`, `shadow-md`)

---

## 📱 2. Core Screens & Architecture Saved

### 1. Home Dashboard (Mobile & Web)
- **Header**: PillSync Branding, Date & Greeting, User Avatar.
- **Hero Card**: Next Dosage Reminder (Medicine Name, Dose, Time, "Taken" / "Snooze" / "Skip" buttons).
- **Daily Progress**: Circular Adherence Chart (e.g., 94% Adherence Rate).
- **Schedule Timeline**: Time-blocked medication slots (Morning, Afternoon, Evening, Night).

### 2. Caregiver & Clinical Dashboard
- **Role Context**: Dr. Sarah Chen (Clinical Director) / Family Caregiver View.
- **Navigation**: Search bar for patients/prescriptions, Alert Bell with badge.
- **Patient Roster**: Patient status cards, missed dose alerts, vital indicators, quick call/message buttons.

### 3. Medicine Cabinet & Pill Inventory
- **Prescription List**: Active medicines, dosage instructions, prescribing doctor.
- **Inventory Monitor**: Remaining pill counts, automatic refill warnings ("3 pills left").
- **Add Medicine Flow**: OCR/Camera pill bottle scanner + manual entry modal.

### 4. Help Center & Medical Support
- **Search Bar**: Article & FAQ search.
- **Emergency Disclaimer Banner**: Red high-visibility banner ("MEDICAL DISCLAIMER: For emergencies call 911/108").
- **Support Ticket System**: Category, Priority dropdown, ticket creation form.
- **Live Chat / Emergency Contact**: Quick action triggers.

### 5. Notification & Status Portal
- **System Health**: "All Systems Operational" badge.
- **Channel Delivery Metrics**: Push, SMS, Email, WhatsApp delivery percentage logs.

---

## 🛠️ 3. Frontend Technology Stack
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS + CSS Custom Properties
- **Icons**: Lucide React (`lucide-react`)
- **Mobile Integration**: Capacitor JS (`@capacitor/core`, `@capacitor/local-notifications`)
- **Directory**: `d:\Ai_intelligent-medicine-remainder-and-medication-tracking-\frontend`

---

## 🚀 4. Next Steps for Tomorrow
1. User provides prompt list used in Stitch.
2. Step-by-step UI component generation & pixel-perfect screen replication.
3. Backend API integration with FastAPI (`d:\Ai_intelligent-medicine-remainder-and-medication-tracking-\backend`).
