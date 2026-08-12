# AI Intelligent Medicine Reminder & Medication Tracking

An end-to-end full-stack AI-driven application for smart medication tracking, prescription image OCR processing, clinical NLP entity extraction, and automated notification reminders.

---

## 🛠️ Technology Stack & Installed Components

| Layer | Technologies & Tools Installed |
| :--- | :--- |
| **Frontend** | Next.js 14, Tailwind CSS, Axios, Jest, React Testing Library |
| **Backend** | Python, FastAPI, Django REST Framework, Uvicorn, Pytest |
| **AI & Vision** | OpenAI API, OpenCV, spaCy (NLP), Tesseract OCR (`pytesseract`) |
| **Authentication** | JWT Token with HttpOnly Cookies, OAuth2 Security Handlers |
| **Database & Cache** | PostgreSQL (`psycopg2`/`asyncpg`), MongoDB (`pymongo`/`motor`), Redis |
| **Reminders & Push** | Twilio (SMS/Voice), SendGrid (Email), Web Push API |
| **DevOps & Testing** | Docker, Docker Compose, Git, GitHub Actions (CI/CD), Postman |

---

## 🚀 Quick Start Guide

### 1. Backend Service (`backend/`)
```bash
cd backend
# Virtual environment is already initialized at .venv
.venv\Scripts\activate

# Run FastAPI Development Server
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend Application (`frontend/`)
```bash
cd frontend
# Install Node dependencies
npm install

# Start Next.js Development Server
npm run dev
```
Open `http://localhost:3000` in your browser.

### 3. Docker Infrastructure (PostgreSQL, MongoDB, Redis)
```bash
docker compose up -d
```

### 4. Running Unit Tests
- **Backend Tests (Pytest)**:
  ```bash
  cd backend
  .venv\Scripts\pytest
  ```
- **Frontend Tests (Jest & RTL)**:
  ```bash
  cd frontend
  npm test
  ```

---

## 📬 Postman Collection
Import `postman/medicine_tracker.postman_collection.json` into Postman to test backend endpoints.
