# 📱 Vital Med Tracker - Complete 55 Screens Breakdown, File Inventory & Team Task Allocation Plan

**Design System Source**: Google Stitch Project — `Vital Med Tracker` (ID: `11433898026932201853`)  
**Design Tokens**: `Vitality Core` (Primary Teal `#00685f`, Warning Amber `#855300`, Success Emerald `#006947`, Slate `#f9f9ff`)  
**Total Screens & Variants in Stitch**: **55 Screens** (Organized across 6 Major Modules)

---

## 📁 1. Existing Frontend File & Folder Inventory

Currently, the `frontend/` directory contains **22 Files across 13 Folders**:

### 📄 Existing Config & Root Files (8 Files):
1. `frontend/package.json` — Dependency manifest
2. `frontend/package-lock.json` — Lockfile
3. `frontend/next.config.js` — Next.js configuration
4. `frontend/tailwind.config.js` — Tailwind CSS config
5. `frontend/postcss.config.js` — PostCSS config
6. `frontend/jest.config.js` — Jest test runner config
7. `frontend/jest.setup.js` — Test setup
8. `frontend/capacitor.config.json` — Mobile Capacitor JS config

### 📄 Existing App Pages & Layouts (12 Files in `frontend/src/app/`):
9. `src/app/layout.jsx` — Root App Layout
10. `src/app/globals.css` — Global CSS Styles
11. `src/app/page.jsx` — Landing Page
12. `src/app/(auth)/login/page.jsx` — Login Page
13. `src/app/(auth)/register/page.jsx` — Register Page
14. `src/app/dashboard/patient/page.jsx` — Patient Dashboard
15. `src/app/dashboard/caregiver/page.jsx` — Caregiver Dashboard
16. `src/app/dashboard/admin/page.jsx` — Admin Dashboard
17. `src/app/medicines/page.jsx` — Medicine Cabinet
18. `src/app/reminders/page.jsx` — Reminders Schedule
19. `src/app/adherence/page.jsx` — Adherence Reports
20. `src/app/refill/page.jsx` — Stock Refill & Nearby Pharmacy Map

### 📄 Existing Lib & Test Files (2 Files):
21. `src/lib/alarm_service.js` — Local alarm notification service
22. `src/app/__tests__/page.test.jsx` — Landing page unit test

---

## 🆕 2. New Files & Folders Required to be Created

To cover all **55 screens** and build a scalable component architecture, we need to create **20 New Files** across **5 New Directories**:

### 📁 New Directory Paths to Create (5 Folders):
1. `frontend/src/app/(auth)/select-role/`
2. `frontend/src/app/(auth)/forgot-password/`
3. `frontend/src/app/help/`
4. `frontend/src/app/notifications/`
5. `frontend/src/app/admin/users/`

### 📄 New Files to Create (20 Files):

#### A. New App Pages (6 Files):
1. `src/app/(auth)/select-role/page.jsx` — Role selection UI (Patient / Caregiver / Admin)
2. `src/app/(auth)/forgot-password/page.jsx` — Password recovery flow
3. `src/app/help/page.jsx` — Support center, FAQs & Emergency Disclaimer Banner (`#EF4444`)
4. `src/app/notifications/page.jsx` — System status & notification delivery logs (Push, SMS, WhatsApp)
5. `src/app/admin/users/page.jsx` — Admin User Management & Role assignment table
6. `src/app/admin/health/page.jsx` — Admin System Health & Connection audit logs

#### B. New Reusable UI Components in `src/components/ui/` (8 Files):
7. `src/components/ui/Button.jsx` — Primary Teal (`#00685f`), Secondary, Ghost, Danger buttons
8. `src/components/ui/Card.jsx` — Slate/White surface card container
9. `src/components/ui/Input.jsx` — Text, Email, Password & Search input fields
10. `src/components/ui/Badge.jsx` — Pill chips (`Taken`, `Missed`, `Low Stock`, `Pending`)
11. `src/components/ui/Modal.jsx` — Accessible backdrop modal overlay
12. `src/components/ui/BottomSheet.jsx` — Mobile action sheet overlay
13. `src/components/ui/Toast.jsx` — Toast notification banners
14. `src/components/ui/AdherenceRing.jsx` — Circular progress ring dial chart

#### C. New Form Components in `src/components/forms/` (4 Files):
15. `src/components/forms/AddMedicineModal.jsx` — Prescription entry & camera OCR scan modal
16. `src/components/forms/EditMedicineModal.jsx` — Edit medicine details modal
17. `src/components/forms/RoleSelectorForm.jsx` — Role selection card form
18. `src/components/forms/SupportTicketForm.jsx` — Support ticket submit form

#### D. New Dashboard & Utility Components in `src/components/dashboard/` & `src/lib/` (2 Files):
19. `src/components/dashboard/PatientRosterCard.jsx` — Caregiver patient monitoring card
20. `src/lib/api.js` — Centralized API client for FastAPI backend calls

---

## 📱 3. Complete Breakdown of 55 Screens (6 Functional Modules)

### 📊 Module 1: Dashboards (3 Primary Views)
1. **Patient Dashboard** *(Today's Schedule, Adherence Dial, Quick Intake)*
2. **Caregiver Supervision Dashboard** *(Patient Roster, Missed Dose Alerts, Direct Messaging)*
3. **Admin & Clinical Dashboard** *(System Health, Analytics Overview, Clinical Controls)*

### 🔐 Module 2: Auth & Onboarding Flow (6 Screens)
4. **Welcome / Landing Screen**
5. **Select Role Screen** *(Patient / Caregiver / Admin)*
6. **Login Screen** *(Phone / Email Login)*
7. **Registration Screen** *(Account setup)*
8. **Verify OTP Screen** *(Mobile/Email Verification)*
9. **Password Recovery & Change Password Modal**

### 💊 Module 3: Medicine Management & Inventory (14 Screens & Modals)
10. **Medicine Cabinet / Search View**
11. **Medicine Details View** *(Dosage, Prescribing Doctor, Instructions)*
12. **Daily Medication Timeline** *(Morning, Noon, Evening, Night blocks)*
13. **Add Medicine Form** *(Manual Entry)*
14. **OCR Pill Scanner Modal** *(Camera Upload & Auto-fill)*
15. **Edit Medicine Details Modal**
16. **Inventory Stock Overview** *(Pill Count Monitor)*
17. **Low-Stock Alert Card / Warning Sheet**
18. **Dose Intake Action Modal** *("Taken" Confirmation)*
19. **Dose Snooze Dialog**
20. **Dose Skip / Missed Log Form**
21. **Stock Refill Overview**
22. **Nearby Pharmacy Finder** *(OpenStreetMap Integration)*
23. **Refill Order / Prescription Auto-Suggest Sheet**

### 💬 Module 4: Support & Help Center (8 Screens)
24. **Help Center Home & Search Bar**
25. **High-Visibility Emergency Disclaimer Banner** *(911/108 Call Action)*
26. **Support Category Directory**
27. **Help Article / FAQ Detail View**
28. **Create Support Ticket Form**
29. **Support Ticket History & Status**
30. **Live Chat Interface with Medical Support**
31. **User Feedback & Rating Center**

### ⚙️ Module 5: Admin & System Management (10 Screens)
32. **System Health Monitor**
33. **Notification Delivery Log** *(Push, SMS, Email, WhatsApp Queue)*
34. **Channel Metric Analytics**
35. **User Management Table**
36. **User Profile Edit & Role Assignment**
37. **Audit Logs & Trace History**
38. **Database & Connection Pool Status**
39. **Security Policy & Access Control Sheet**
40. **API Rate Limit Status**
41. **System Maintenance Banner / Modal**

### 🎨 Module 6: Component Libraries & Design Variants (14 Variants)
42 to 55. Mobile/Desktop Design Tokens, Button States, Input States, Pill Chip Badges, Toasts, Bottom Sheets, and Dark/Light Mode Layout Variants.

---

## 👥 4. Updated Team Task Allocation (For 55 Screens)

* **Developer 1 (UI Base & Tokens)**: Design Tokens (`Vitality Core` Teal `#00685f`), Tailwind Setup, Reusable UI Library (Buttons, Cards, Badges, Modals, Toasts) — *Screens 42 to 55; New Files 7-14*.
* **Developer 2 (Patient & Auth Flow)**: Login/Register, Role Selector, OTP, Patient Home Schedule, Medicine Cabinet, Add Medicine, OCR Scanner — *Screens 4 to 20; New Files 1, 2, 15, 16, 17*.
* **Developer 3 (Caregiver & Analytics)**: Caregiver Patient Roster, Missed Dose Alerts, Adherence Analytics Charts, Refill & Nearby Pharmacy Finder — *Screens 1 to 3 & 21 to 23; New File 19*.
* **Developer 4 (Support & Admin System)**: Help Center, Emergency Disclaimer Banner, Live Support Chat, System Health & Notification Logs — *Screens 24 to 41; New Files 3, 4, 5, 6, 18, 20*.
