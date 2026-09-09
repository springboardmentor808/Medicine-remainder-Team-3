# 🏛️ PillSync — AI Intelligent Medicine Reminder & Medication Tracking Platform

An end-to-end full-stack AI-driven healthcare platform for smart medication tracking, prescription image OCR perception, clinical Drug-Drug Interaction (DDI) safety analysis, behavioral refill forecasting, and multi-channel reminder delivery.

---

## 📚 Master Documentation Suite (`docs/`)

All project documentation has been consolidated into three comprehensive master documents:

| Document | Focus & Coverage Areas | Path |
| :--- | :--- | :--- |
| **MasterDoc 1** | **System Architecture, Backend Engineering & Clinical AI Models**<br>• Asynchronous FastAPI Layer & Polyglot Storage (PostgreSQL, MongoDB, Redis)<br>• Deterministic Clinical Safety & Drug-Drug Interaction (DDI) Engine<br>• Track 1: Vision Perception (OpenCV CLAHE, Auto-Deskew & TrOCR)<br>• Track 2: Clinical NLP, HL7 FHIR R4 & Indian Vernacular Guidance<br>• Track 3: Predictive ML Behavioral Refill Forecasting (Quantile Loss)<br>• Enterprise Concurrency Hardening & Pessimistic Row Locking | [docs/MasterDoc_1_Architecture_and_Backend.md](docs/MasterDoc_1_Architecture_and_Backend.md) |
| **MasterDoc 2** | **Frontend Architecture, Design System & User Portals**<br>• Next.js 14 App Router Architecture & Tailwind Design Tokens<br>• Google Stitch Design System (`Vital Med Tracker` — 55 Screens Taxonomy)<br>• Patient Portal Inspection, Controls & Quality Assurance Matrix<br>• Caregiver & Clinical Monitoring Roster with SOS Re-Ping<br>• Admin Portal: Live Telemetry (CPU, RAM, DB Latency) vs Simulated Metrics | [docs/MasterDoc_2_Frontend_and_UI.md](docs/MasterDoc_2_Frontend_and_UI.md) |
| **MasterDoc 3** | **Project Management, System Roadmap, Code Audits & Operational Guides**<br>• Evaluator Scorecard (Overall Rating: 8.95/10 - Production Viable Prototype)<br>• Comprehensive Data Reality Matrix (100% Live Data vs Stubs)<br>• Senior Code Review Historical Problem Matrix (Security, DB, Concurrency)<br>• 6-Minute Mentor / Evaluator Demonstration Sequence<br>• Hindi Vernacular Clinical Guide (ड्रग सेफ्टी एवं इंटरेक्शन गाइड) | [docs/MasterDoc_3_Project_Management_and_Misc.md](docs/MasterDoc_3_Project_Management_and_Misc.md) |

---

## 🛠️ Technology Stack

| Layer | Technologies & Frameworks |
| :--- | :--- |
| **Frontend Web & Mobile** | Next.js 14, React 18, Tailwind CSS, Lucide React, Capacitor JS, Recharts |
| **Backend API Engine** | Python 3.11+, FastAPI, Uvicorn (ASGI), Pydantic v2, Alembic |
| **AI / ML & Perception** | OpenCV (CLAHE, Deskew), Tesseract OCR, TrOCR, spaCy NLP, XGBoost / LightGBM |
| **Database & Caching** | PostgreSQL 16 (`asyncpg`), MongoDB 7.0 (`motor`), Redis 7.2 (`aioredis`) |
| **Security & Authentication** | JWT Bearer & Cookie Auth, Role-Based Access Control (RBAC), bcrypt |
| **Messaging & Telemetry** | Twilio SMS/WhatsApp, Inbound Webhooks, SendGrid, ReportLab PDF, psutil |

---

## 🚀 Quick Start Guide

### 1. Backend Service (`backend/`)
```bash
cd backend
# Virtual environment activation
.venv\Scripts\activate

# Run database migrations
alembic upgrade head

# Start FastAPI development server
uvicorn app.main:app --reload --port 8000
```
Interactive Swagger API Documentation: `http://localhost:8000/docs`.

### 2. Frontend Application (`frontend/`)
```bash
cd frontend
# Install Node dependencies
npm install

# Start Next.js development server
npm run dev
```
Client Portal: `http://localhost:3000`.

### 3. Docker Infrastructure (PostgreSQL, MongoDB, Redis)
```bash
docker compose up -d
```

### 4. Running Automated Test Suites
* **Backend Pytest Suite:**
  ```bash
  cd backend
  .venv\Scripts\pytest -v --tb=short
  ```
* **Frontend Jest Suite:**
  ```bash
  cd frontend
  npm test
  ```

---
*Architectural diagram available at [docs/pillsync_architecture_diagram.png](docs/pillsync_architecture_diagram.png).*
