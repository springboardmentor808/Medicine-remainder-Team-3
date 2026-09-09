# 🎨 MasterDoc 2: Frontend Architecture, Design System & User Portals

**Platform:** AI Intelligent Medicine Reminder & Medication Tracking Platform (PillSync)  
**Classification:** Frontend Web Application, Mobile Shell & UI/UX Specification  
**Version:** 3.0.0 (Consolidated Master Document)  
**Scope:** Next.js 14 App Router, Google Stitch Design System (Vital Med Tracker), 55 Screens Breakdown, Patient Portal QA Audit, Admin Live Telemetry Portal, and State Management.

---

## 📋 Table of Contents
1. [Frontend Technology Stack & Architecture](#1-frontend-technology-stack--architecture)
2. [Google Stitch Design System & Vitality Core Tokens](#2-google-stitch-design-system--vitality-core-tokens)
3. [Complete 55 Screens Breakdown & Navigation Hierarchy](#3-complete-55-screens-breakdown--navigation-hierarchy)
4. [Patient Portal: Full Inspection, Features & QA Matrix](#4-patient-portal-full-inspection-features--qa-matrix)
5. [Caregiver & Clinical Monitoring Portal](#5-caregiver--clinical-monitoring-portal)
6. [Admin Portal: Real-Time Telemetry & Data Reality Matrix](#6-admin-portal-real-time-telemetry--data-reality-matrix)
7. [Client-Side State Management, Auth Flow & Offline Resiliency](#7-client-side-state-management-auth-flow--offline-resiliency)

---

## 1. Frontend Technology Stack & Architecture

### 1.1 Technology Foundation
* **Framework:** Next.js 14 (React 18, App Router with Server & Client Components)
* **Styling:** Tailwind CSS 3.4 + Vanilla CSS Custom Properties (`globals.css`)
* **Typography:** Modern Google Fonts (`Inter`, `Plus Jakarta Sans`, `Outfit`)
* **Iconography:** Lucide React (`lucide-react`)
* **Data Visualization:** Recharts (Radial Adherence Bars, Refill Trajectory Line Charts)
* **Mobile Packaging:** Capacitor JS (`@capacitor/core`, `@capacitor/local-notifications`)
* **HTTP Client:** Native fetch with Axios fallback, centralized in `frontend/src/lib/api.js`

### 1.2 Routing Structure (`frontend/src/app`)
```
frontend/src/app/
├── (auth)/
│   ├── login/page.jsx              # Dual Auth (Email/Username + Password)
│   └── register/page.jsx           # Onboarding + Role Selection
├── dashboard/
│   ├── patient/page.jsx            # Patient Master Command Center
│   ├── caregiver/page.jsx          # Caregiver Patient Roster & Alert Console
│   └── admin/page.jsx              # System Operations & Telemetry Overview
├── medicines/page.jsx              # Pill Inventory & Prescription Cabinet
├── reminders/page.jsx              # Time-blocked Medication Schedule
├── adherence/page.jsx              # Adherence Rate Analytics & Calendar Logs
├── refill/page.jsx                 # AI Runout Prediction & Nearby Pharmacy Map
├── interactions/page.jsx           # Real-Time Drug Safety & DDI Analyzer
├── notifications/page.jsx          # Multi-Channel Delivery Logs & Alerts
├── scan/page.jsx                   # Camera / OCR Prescription Scanner
├── help/page.jsx                   # Emergency Hotline & Support Tickets
├── layout.jsx                      # Root Application Layout & Theme Provider
├── globals.css                     # Global Styles, CSS Tokens & Keyframes
└── error.jsx                       # Global Crash Barrier & Error Boundary
```

---

## 2. Google Stitch Design System & Vitality Core Tokens

**Design Reference:** Google Stitch Project (`Vital Med Tracker` — ID: `11433898026932201853`)  
**Design Philosophy:** Clean, calming medical aesthetic designed for high legibility, accessible contrast ratios for elderly patients, and instant situational awareness.

### 2.1 Color Palette & Token Hierarchy
| Token Name | Hex Code | Tailwind Utility | Clinical Purpose |
| :--- | :--- | :--- | :--- |
| **Primary Brand** | `#00685F` / `#005C4B` | `bg-[#00685f]` | Primary brand actions, active headers, navigation pills |
| **Primary Accent** | `#10B981` / `#059669` | `text-emerald-600` | Taken dose status, optimal adherence rates, success toasts |
| **Warning Amber** | `#855300` / `#D97706` | `bg-amber-600` | Snooze indicators, low-stock alerts ($<3$ days), moderate DDI |
| **Emergency Red** | `#DC2626` / `#EF4444` | `bg-rose-600` | Missed dose alerts, severe DDI warnings, emergency helpline banners |
| **Medical Ice Mint**| `#F0FDF4` / `#F9F9FF`| `bg-[#f0fdf4]` | Clean dashboard background, calm surface elevation |
| **Surface Pure** | `#FFFFFF` | `bg-white` | Elevated clinical cards, input containers, modal sheets |
| **Text Primary** | `#0F172A` / `#1E293B` | `text-slate-900` | High-contrast body typography and metric headers |
| **Text Muted** | `#64748B` | `text-slate-500` | Secondary dosage instructions, timestamps, metadata |

### 2.2 Micro-Interactions & Elevation
* **Borders & Radii:** Buttons use `rounded-full` (capsule pill format). Cards use `rounded-2xl` (16px) or `rounded-3xl` (24px).
* **Elevation:** Subtle soft shadows (`shadow-sm`, `shadow-md`) with thin border lines (`border border-slate-100`).
* **Visual Transitions:** Hover zoom (`transition-all duration-200 hover:-translate-y-0.5`), active scale press (`active:scale-95`).

---

## 3. Complete 55 Screens Breakdown & Navigation Hierarchy

The application interface is organized across **6 Major Functional Modules comprising 55 Screens and State Variants**:

```
+---------------------------------------------------------------------------------------------------+
|                                 55 SCREENS ARCHITECTURAL TAXONOMY                                 |
+---------------------------------------------------------------------------------------------------+
| 1. AUTHENTICATION & ONBOARDING (8 Screens)                                                        |
|    - Welcome Landing, Patient Login, Register, Role Selector (Patient/Caregiver/Admin),           |
|      Multi-Channel OTP Verification, Forgot Password, Reset Password Success, Permission Dialogs.  |
|                                                                                                   |
| 2. PATIENT CARE PORTAL (12 Screens)                                                               |
|    - Home Overview, Hero Next Dose Card, Dosage Intake Modal (Taken/Snooze/Skip), Circular        |
|      Adherence Progress, Daily Timeline Slots, Medicine Cabinet View, Add Medicine Wizard,        |
|      OCR Camera Capture, OCR Preview & Crop, Manual Refinement Modal, Generic Alternative Modal.   |
|                                                                                                   |
| 3. REMINDER & ADHERENCE ANALYTICS (10 Screens)                                                    |
|    - Active Schedules List, Create Custom Pattern (1-0-1, 1-1-1), Weekly Adherence Heatmap,      |
|      Monthly History Log, Dose Filter Matrix, Missed Dose Analysis, Adherence Export Preview.     |
|                                                                                                   |
| 4. REFILL & PHARMACY LOCATOR (8 Screens)                                                          |
|    - Stock Depletion Gauge, Runout Date Forecast Card, 1-Tap Refill Dispatcher, OpenStreetMap      |
|      Live Locator, Pharmacy Details Card, Emergency Store Hotline, Delivery Tracking Modal.       |
|                                                                                                   |
| 5. DRUG SAFETY & DDI ANALYZER (7 Screens)                                                         |
|    - Regimen Comparison Queue, Radial Safety Meter, Severe Interaction Warnings, Food/Dietary    |
|      Contraindication Grid, AI Pharmacological Advisory, Custom Drug Quick-Search, Presets.      |
|                                                                                                   |
| 6. CAREGIVER & CLINICAL MONITORING (10 Screens)                                                   |
|    - Caregiver Roster, Patient Health Summary, Missed Dose SOS Banner, Vital Signs Indicators,   |
|      Quick Re-Ping Dispatcher, Caregiver Master PDF Export, Emergency Escalation Audit Log.       |
+---------------------------------------------------------------------------------------------------+
```

---

## 4. Patient Portal: Full Inspection, Features & QA Matrix

### 4.1 Master Inspection Results (42+ Interactive Controls Audited)
A comprehensive functional audit of the Patient Portal verified end-to-end operation across 8 key modules:

1. **Patient Dashboard (`/dashboard/patient`):**
   * **Hero Next Dose Reminder:** Displays medicine name, dosage, time window, and primary action buttons.
   * **Immediate Intake Buttons:** Clicking **`Taken`** decrements stock, updates the radial adherence meter, and inserts a `DoseLog` row. Clicking **`Snooze`** defaults to a 15-minute delay.
   * **Circular Adherence Ring:** Recharts animated radial bar showing real-time adherence percentage ($94\%$).
2. **Medicine Cabinet (`/medicines`):**
   * Displays pill cards categorized by disease (`Blood Pressure`, `Diabetes`, `Thyroid`).
   * Low-stock badge (`<3 pills left`) automatically highlights depleting medicines.
   * Search input with instant client-side filtering.
3. **Medication Schedule (`/reminders`):**
   * Categorized into Morning, Afternoon, Evening, and Night dose slots.
   * Daily schedule synchronizer populating the local browser alarm queue.
4. **Adherence Analytics (`/adherence`):**
   * Daily tracking table with action timestamps.
   * Download buttons for CSV and PDF compliance reports.
5. **Refill Tracker & Pharmacy Map (`/refill`):**
   * Leaflet / OpenStreetMap integration centering on user's real GPS coordinates.
   * Fallback to New Delhi (`28.6139, 77.2090`) when geolocation permission is withheld.
6. **Notification Center (`/notifications`):**
   * In-app notification bell with unread badge counter.
   * Mark as Read action with optimistic UI state update.
7. **Clinical Safety Analyzer (`/interactions`):**
   * Real-time multi-drug comparison engine.
   * Calculates Regimen Safety Score dynamically ($0\text{--}100\%$).
8. **Help & Medical Support (`/help`):**
   * High-visibility Emergency Red Disclaimer (`For life-threatening emergencies, dial 911 / 108 immediately`).
   * Support ticket submission form with category and priority selectors.

---

## 5. Caregiver & Clinical Monitoring Portal

### 5.1 Caregiver Dashboard (`/dashboard/caregiver`)
* **Multi-Patient Roster:** Renders cards for each assigned patient displaying their adherence percentage, active medication count, and recent alerts.
* **Escalation Notification Banner:** Flashes high-priority amber/red alert when a patient has not acknowledged a scheduled dose within 45 minutes.
* **One-Tap Re-Ping Button:** Allows the caregiver to trigger an immediate SMS or push reminder directly to the patient's device (`POST /api/v1/reminders/notify-patient`).
* **Caregiver Patient Dossier:** Generates combined multi-patient clinical PDF exports containing adherence histories and stock levels for clinical reviews.

---

## 6. Admin Portal: Real-Time Telemetry & Data Reality Matrix

### 6.1 Telemetry Integration Status
The Admin Portal (`/dashboard/admin` and `/admin/health`) provides operations engineers and facility administrators with live infrastructure metrics:

```
+---------------------------------------------------------------------------------------------------+
|                               ADMIN DATA CLASSIFICATION BREAKDOWN                                 |
+---------------------------------------------------------------------------------------------------+
|  100% REAL-TIME LIVE METRICS (11 Items)           |  SIMULATED BASELINE FALLBACKS (4 Items)       |
+---------------------------------------------------+-----------------------------------------------+
|  * Active Patients Count (Live Postgres Query)    |  * Incident Log History List (INC-8891...)    |
|  * Total Caregivers Count (Live Postgres Query)   |  * Twilio SMS Delivery Success Rate (%)       |
|  * Prescriptions Tracked (Live Postgres Query)    |  * OCR Pipeline Baseline Latency (340ms)      |
|  * User Management Directory & Search Table       |  * S3 Cloud Backup Sync Timestamp             |
|  * CPU Core Utilization % (psutil OS Kernel)      |                                               |
|  * RAM Memory Usage GB & % (psutil Memory)        |                                               |
|  * PostgreSQL Query Latency (SELECT 1 Timing)     |                                               |
|  * FastAPI Engine Status & Process Time Header    |                                               |
|  * SQLAlchemy Database Connection Pool (12/100)   |                                               |
|  * Audit PDF & CSV Report Downloads               |                                               |
|  * API Sub-Millisecond Ping Latency               |                                               |
+---------------------------------------------------+-----------------------------------------------+
```

### 6.2 User Management Console (`/admin/users`)
* Full tabular view of all registered accounts with role badges (`patient`, `caregiver`, `admin`).
* Live search by email or name.
* Administrative password reset and account deactivation toggles executing real SQL mutations.

---

## 7. Client-Side State Management, Auth Flow & Offline Resiliency

### 7.1 Authentication Lifecycle & Session Interception
* **Login Dispatch:** Authenticates credentials via `POST /api/v1/auth/login`. Returns JWT `access_token` and `refresh_token`.
* **API Interceptor (`api.js`):** Injects `Authorization: Bearer <token>` into outbound HTTP requests. Catches `401 Unauthorized` responses and triggers transparent token refresh or login redirection.

### 7.2 Offline Local Alarms (`alarm_service.js`)
* Leverages Web Audio API (`AudioContext`) to generate high-frequency alert tones even when external network connectivity drops.
* Utilizes `@capacitor/local-notifications` to schedule hardware-level device notifications on Android/iOS when compiled via Capacitor.

---
*End of MasterDoc 2. Fully synthesized from frontend specifications, Stitch UI tokens, patient portal audit reports, and admin telemetry guides.*
