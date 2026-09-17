/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PillSync — Centralized API Client
 * FastAPI Backend: http://localhost:8000
 * Auth: JWT (HttpOnly Cookies + Bearer Token fallback)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import axios from 'axios';

// ── Base Config ───────────────────────────────────────────────────────────────
const rawApiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').trim().replace(/\/+$/, '');
const BASE_URL = rawApiUrl.endsWith('/api/v1') ? rawApiUrl : `${rawApiUrl}/api/v1`;

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: true, // HttpOnly Cookie support
  timeout: 30000,
});

// ── Request Interceptor — Attach JWT Token & Strip duplicate prefix ────────────
apiClient.interceptors.request.use(
  (config) => {
    // Prevent accidental duplicate /api/v1 prefix
    if (config.url && config.url.startsWith('/api/v1/')) {
      config.url = config.url.replace(/^\/api\/v1/, '');
    }
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('pillsync_access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response Interceptor — Thread-Safe 401 Mutex & Queue ──────────────────────
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest) return Promise.reject(error);

    // Bypass refresh on auth endpoints to prevent recursion loops
    if (
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/refresh') ||
      originalRequest.url?.includes('/auth/register')
    ) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('pillsync_refresh_token') : null;
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        // Use raw axios to prevent interceptor recursion loop
        const res = await axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: refreshToken });
        const { access_token } = res.data;

        if (typeof window !== 'undefined') {
          localStorage.setItem('pillsync_access_token', access_token);
        }

        apiClient.defaults.headers.common.Authorization = `Bearer ${access_token}`;
        processQueue(null, access_token);

        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return apiClient(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('pillsync_access_token');
          localStorage.removeItem('pillsync_refresh_token');
          localStorage.removeItem('pillsync_user');
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

// ── Helper & Graceful Error Normalization ─────────────────────────────────────
// CodeRabbit Review Note: Toast Deduplication & Rate Limiting
// Prevents event storms when multiple concurrent async requests fail simultaneously (e.g. timeout storms).
let lastEmittedToast = '';
let lastEmittedTime = 0;

export const emitToast = (messageOrObj, typeOrMsg = 'error') => {
  if (typeof window !== 'undefined') {
    let finalMessage = messageOrObj;
    let finalType = typeOrMsg;

    const KNOWN_TYPES = ['error', 'success', 'info', 'warning'];

    // Handle ({ message, type }) signature
    if (messageOrObj && typeof messageOrObj === 'object') {
      finalMessage = messageOrObj.message || messageOrObj.detail || '';
      finalType = messageOrObj.type || 'error';
    } else if (KNOWN_TYPES.includes(messageOrObj) && !KNOWN_TYPES.includes(typeOrMsg)) {
      // Reverse argument order: emitToast(type, message)
      finalType = messageOrObj;
      finalMessage = typeOrMsg;
    }

    // Deduplicate identical toasts emitted within a 3-second throttle window
    const now = Date.now();
    if (finalMessage === lastEmittedToast && now - lastEmittedTime < 3000) {
      return;
    }
    lastEmittedToast = finalMessage;
    lastEmittedTime = now;

    window.dispatchEvent(
      new CustomEvent('pillsync:toast', {
        detail: { message: finalMessage, type: finalType, id: Date.now() },
      })
    );
  }
};

const handleError = (error) => {
  // Gracefully ignore intentional AbortController cancellations
  if (axios.isCancel(error) || error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
    return Promise.reject(error);
  }

  // Normalize Axios error response
  const status = error.response?.status;
  const data = error.response?.data;
  let msg =
    data?.detail ||
    data?.message ||
    error.message ||
    'An unexpected error occurred';

  // Fast-fail validation arrays from FastAPI (Pydantic 422 Unprocessable Entity)
  if (Array.isArray(msg)) {
    msg = msg.map((e) => e.msg || JSON.stringify(e)).join(', ');
  }

  // Graceful human-friendly guidance:
  // Intercept raw developer/network strings (e.g. 'timeout of 15000ms exceeded', 'ECONNABORTED')
  // and present reassuring, actionable guidance to patients and clinical users.
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout') || error.message?.includes('15000ms')) {
    msg = 'Network connection timed out. Loading local offline records.';
  } else if (status === 404) {
    const reqUrl = error.config?.url || '';
    if (reqUrl.includes('/ocr/') || reqUrl.includes('/prescriptions/')) {
      msg = 'The requested medical record or scan result was not found.';
    } else {
      msg = data?.detail || data?.message || 'The requested resource was not found.';
    }
  } else if (status === 413) {
    msg = 'Upload failed: Prescription image exceeds maximum allowed size (10 MB). Please upload a smaller or cropped image.';
  } else if (status === 429) {
    msg = 'Too many requests. Please slow down and try again shortly.';
  } else if (status === 503) {
    msg = 'Service temporarily unavailable. Please verify network connection or try again later.';
  }

  emitToast(msg, 'error');
  throw new Error(msg);
};

// ═════════════════════════════════════════════════════════════════════════════
// 1. SYSTEM / HEALTH
// ═════════════════════════════════════════════════════════════════════════════
export const systemAPI = {
  /** GET /health — Backend liveness check (root-level, not under /api/v1) */
  health: () => axios.get((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000') + '/health').catch(handleError),

  /** GET /admin/health — System health metrics (Admin only) */
  adminHealth: () => apiClient.get('/admin/health').catch(handleError),
};

// ═════════════════════════════════════════════════════════════════════════════
// 2. AUTH & ONBOARDING
// ═════════════════════════════════════════════════════════════════════════════
export const authAPI = {
  /**
   * POST /auth/register
   * @param {{ name, email, username, phone, password, role: 'patient'|'caregiver'|'admin' }} data
   */
  register: (data) => {
    // Sanitize username: strip non-alphanumeric, enforce min 3 chars, add suffix for uniqueness
    const sanitizeUsername = (email, name) => {
      const raw = (email ? email.split('@')[0] : (name || 'user'))
        .replace(/[^a-zA-Z0-9_]/g, '')
        .toLowerCase();
      // Pad short usernames to meet backend min_length=3
      const base = raw.length >= 3 ? raw : `${raw}_${Math.random().toString(36).substring(2, 5)}`;
      // Add random suffix to avoid cross-domain collision (john@gmail vs john@yahoo)
      const suffix = Math.random().toString(36).substring(2, 6);
      return `${base}_${suffix}`.substring(0, 50);
    };

    const payload = {
      username: data.username ? data.username.trim() : sanitizeUsername(data.email, data.name),
      email: (data.email || '').trim().toLowerCase(),
      password: data.password,
      full_name: (data.full_name || data.name || 'User').trim(),
      phone: data.phone ? data.phone.trim() : null,
      role: data.role || 'patient',
    };
    return apiClient.post('/auth/register', payload).catch(handleError);
  },

  /**
   * POST /auth/login
   * @param {{ email, username, password }} data
   */
  login: (data) => {
    const payload = {
      username: (data.username || data.email || '').trim().toLowerCase(),
      password: data.password,
    };
    return apiClient.post('/auth/login', payload).catch(handleError);
  },

  /** POST /auth/logout */
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('pillsync_access_token');
      localStorage.removeItem('pillsync_refresh_token');
      localStorage.removeItem('pillsync_user');
      localStorage.removeItem('pillsync_remember');
      sessionStorage.removeItem('pillsync_selected_role');
    }
    return apiClient.post('/auth/logout').catch(() => ({ data: { message: 'Logged out' } }));
  },

  /** POST /auth/refresh — Refresh JWT using HttpOnly cookie */
  refresh: () => apiClient.post('/auth/refresh').catch(handleError),

  /**
   * POST /auth/forgot-password
   * @param {{ email }} data
   */
  forgotPassword: (data) =>
    apiClient.post('/auth/forgot-password', data).catch(handleError),

  /**
   * POST /auth/reset-password
   * @param {{ token, new_password }} data
   */
  resetPassword: (data) =>
    apiClient.post('/auth/reset-password', data).catch(handleError),

  /**
   * POST /auth/send-otp
   * @param {{ channel: 'email'|'phone', destination: string, purpose?: string }} data
   */
  sendOtp: (data) =>
    apiClient.post('/auth/send-otp', data).catch(handleError),

  /**
   * POST /auth/verify-otp
   * @param {{ otp: string, channel?: 'email'|'phone', destination?: string, email?: string }} data
   */
  verifyOtp: (data) =>
    apiClient.post('/auth/verify-otp', data).catch(handleError),

  /**
   * POST /auth/resend-otp
   * @param {{ email?: string, destination?: string, channel?: 'email'|'phone' }} data
   */
  resendOtp: (data) =>
    apiClient.post('/auth/resend-otp', data).catch(handleError),
};


// ═════════════════════════════════════════════════════════════════════════════
// 3. USER PROFILE
// ═════════════════════════════════════════════════════════════════════════════
export const userAPI = {
  /** GET /users/me */
  getProfile: () => apiClient.get('/users/me').catch(handleError),

  /**
   * PUT /users/me
   * @param {object} data — Profile fields to update
   */
  updateProfile: (data) =>
    apiClient.put('/users/me', data).catch(handleError),

  /**
   * POST /users/me/avatar
   * @param {FormData} formData — { file }
   */
  uploadAvatar: (formData) =>
    apiClient.post('/users/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).catch(handleError),

  /** DELETE /users/me */
  deleteAccount: () => apiClient.delete('/users/me').catch(handleError),
};

// ═════════════════════════════════════════════════════════════════════════════
// 4. MEDICINES / PRESCRIPTION
// ═════════════════════════════════════════════════════════════════════════════
export const medicineAPI = {
  /** GET /medicines — Patient's medicine cabinet */
  list: (params) =>
    apiClient.get('/medicines', { params }).then((r) => r.data || r).catch(handleError),

  /** GET /medicines — Get all medicines */
  getAll: (params) =>
    apiClient.get('/medicines', { params }).then((r) => r.data || r).catch(handleError),

  /**
   * POST /medicines — Add medicine manually
   * @param {{ name, dosage, frequency, instructions, start_date, end_date, stock }} data
   */
  create: (data) => apiClient.post('/medicines', data).then((r) => r.data || r).catch(handleError),

  /**
   * GET /medicines/:id — Medicine details
   * @param {string} id
   */
  get: (id) => apiClient.get(`/medicines/${id}`).catch(handleError),

  /**
   * PUT /medicines/:id — Update medicine
   * @param {string} id
   * @param {object} data
   */
  update: (id, data) =>
    apiClient.put(`/medicines/${id}`, data).catch(handleError),

  /**
   * DELETE /medicines/:id
   * @param {string} id
   */
  delete: (id) => apiClient.delete(`/medicines/${id}`).then((r) => r.data || r).catch(handleError),

  /**
   * DELETE /medicines/:id — Alias for delete
   * @param {string} id
   */
  remove: (id) => apiClient.delete(`/medicines/${id}`).then((r) => r.data || r).catch(handleError),

  /**
   * PATCH /medicines/:id/stock — Update/adjust stock
   * Accepts number (treated as new_stock) or object { new_stock, adjustment }
   * @param {string} id
   * @param {number|object} stock
   */
  updateStock: (id, stock) => {
    const payload = typeof stock === 'object' ? stock : { new_stock: Number(stock) };
    return apiClient.patch(`/medicines/${id}/stock`, payload).then((r) => r.data || r).catch(handleError);
  },

  /**
   * PATCH /medicines/:id/stock — Adjust stock alias
   * @param {string} id
   * @param {number|object} payload
   */
  adjustStock: (id, payload) => {
    const body = typeof payload === 'number' ? { new_stock: payload } : payload;
    return apiClient.patch(`/medicines/${id}/stock`, body).then((r) => r.data || r).catch(handleError);
  },

  /**
   * GET /medicines/grouped/by-disease — Group medicines by disease
   * @param {{ patient_id }} [params]
   */
  getGroupedByDisease: (params) =>
    apiClient
      .get('/medicines/grouped/by-disease', { params })
      .then((r) => {
        const data = r?.data !== undefined ? r.data : r;
        if (data && (data.error || data.detail)) {
          throw new Error(data.message || data.detail || 'Failed to retrieve grouped medicines');
        }
        return data;
      })
      .catch(handleError),

  /**
   * POST /ocr/scan — Upload prescription image for OCR
   * @param {FormData} formData — { file }
   */
  ocrScan: (formData) =>
    apiClient.post('/ocr/scan', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    }).then(r => r.data || r).catch(handleError),

  /**
   * POST /medicines/check-interactions — DDInter safety & risk scoring
   * @param {string[]} medicines — Array of medicine names or generic salts
   */
  checkInteractions: (medicines) =>
    apiClient.post('/medicines/check-interactions', { medicines })
      .then(r => r.data || r)
      .catch(handleError),

  /**
   * POST /medicines/:id/take — Log a taken dose
   * @param {string} id
   * @param {{ scheduled_time, taken_at, notes }} data
   */
  logDose: (id, data) =>
    apiClient.post(`/medicines/${id}/take`, data).catch(handleError),

  /**
   * POST /medicines/:id/skip — Log a skipped/missed dose
   * @param {string} id
   * @param {{ reason, scheduled_time }} data
   */
  skipDose: (id, data) =>
    apiClient.post(`/medicines/${id}/skip`, data).catch(handleError),

  /**
   * POST /medicines/:id/snooze — Snooze a reminder
   * @param {string} id
   * @param {{ snooze_minutes }} data
   */
  snoozeReminder: (id, minutes = 15) =>
    apiClient.post(`/medicines/${id}/snooze`, { minutes }).catch(handleError),

  /** GET /medicines/today — Today's medication schedule */
  todaySchedule: () =>
    apiClient.get('/medicines/today').catch(handleError),
};

// ═════════════════════════════════════════════════════════════════════════════
// 5. REMINDERS
// ═════════════════════════════════════════════════════════════════════════════
export const reminderAPI = {
  /** GET /reminders */
  list: (params) =>
    apiClient.get('/reminders', { params }).catch(handleError),

  /**
   * POST /reminders
   * @param {{ medicine_id, time, channels: ['push','sms','whatsapp'], repeat }} data
   */
  create: (data) => apiClient.post('/reminders', data).catch(handleError),

  /**
   * PUT /reminders/:id
   * @param {string} id
   * @param {object} data
   */
  update: (id, data) =>
    apiClient.put(`/reminders/${id}`, data).catch(handleError),

  /**
   * DELETE /reminders/:id
   * @param {string} id
   */
  delete: (id) =>
    apiClient.delete(`/reminders/${id}`).catch(handleError),
};

// ═════════════════════════════════════════════════════════════════════════════
// 6. ADHERENCE & SCHEDULES
// ═════════════════════════════════════════════════════════════════════════════
export const adherenceAPI = {
  /**
   * GET /adherence/daily-tracking?target_date=YYYY-MM-DD
   * @param {string} dateStr
   * @param {import('axios').AxiosRequestConfig} [config]
   */
  getDailyTracking: (dateStr, config = {}) =>
    apiClient
      .get('/adherence/daily-tracking', {
        params: { target_date: dateStr },
        ...config,
      })
      .then((r) => r.data || r)
      .catch(handleError),

  /**
   * GET /adherence/summary
   * @param {{ period: '7d'|'30d'|'90d' }} params
   */
  summary: (params) =>
    apiClient.get('/adherence/summary', { params }).then((r) => r.data || r).catch(handleError),

  /** GET /adherence/history */
  history: (params) =>
    apiClient.get('/adherence/history', { params }).then((r) => r.data || r).catch(handleError),

  /** GET /adherence/streak — Current adherence streak */
  streak: () => apiClient.get('/adherence/streak').then((r) => r.data || r).catch(handleError),

  /** GET /adherence/schedules — Get medication schedules */
  getSchedules: (params) =>
    apiClient.get('/adherence/schedules', { params }).then((r) => r.data || r).catch(handleError),

  /** POST /adherence/record — Record Taken, Missed, or Snoozed */
  recordAction: (data) =>
    apiClient.post('/adherence/record', data).then((r) => r.data || r).catch(handleError),
};

// ═════════════════════════════════════════════════════════════════════════════
// 6b. PATIENT SCHEDULE & ADHERENCE (Frontend convenience client)
// ═════════════════════════════════════════════════════════════════════════════
export const patientAPI = {
  /** GET /adherence/schedules — Get today's medication schedule */
  getTodaySchedule: () =>
    apiClient.get('/adherence/schedules').then((r) => r.data || r).catch(handleError),

  /** POST /adherence/record — Record dose action */
  recordAction: (data) =>
    apiClient.post('/adherence/record', data).then((r) => r.data || r).catch(handleError),

  /** GET /adherence/report — 7/30/90 day adherence summary */
  getWeeklyAdherence: (params) =>
    apiClient.get('/adherence/report', { params }).then((r) => r.data || r).catch(handleError),

  /** GET /adherence/daily-tracking */
  getDailyTracking: (dateStr) =>
    apiClient
      .get('/adherence/daily-tracking', { params: { target_date: dateStr } })
      .then((r) => r.data || r)
      .catch(handleError),

  /** GET /adherence/history */
  getHistory: (params) =>
    apiClient.get('/adherence/history', { params }).then((r) => r.data || r).catch(handleError),

  /** POST /adherence/schedules */
  createSchedule: (data) =>
    apiClient.post('/adherence/schedules', data).then((r) => r.data || r).catch(handleError),

  /** DELETE /adherence/schedules/:id */
  deleteSchedule: (id) =>
    apiClient.delete(`/adherence/schedules/${id}`).then((r) => r.data || r).catch(handleError),
};

// ═════════════════════════════════════════════════════════════════════════════
// 6c. ANALYTICS API
// ═════════════════════════════════════════════════════════════════════════════
export const analyticsAPI = {
  /** GET /analytics/adherence — Real adherence summary and streak from dose logs */
  getAdherence: (params) =>
    apiClient.get('/analytics/adherence', { params }).then((r) => r.data || r).catch(handleError),

  /** GET /analytics/trends — 7-day or 30-day trends */
  getTrends: (params) =>
    apiClient.get('/analytics/trends', { params }).then((r) => r.data || r).catch(handleError),

  /** GET /analytics/summary — Overall adherence summary */
  getSummary: (params) =>
    apiClient.get('/analytics/summary', { params }).then((r) => r.data || r).catch(handleError),

  /** GET /analytics/stock-health — Stock level risk breakdown */
  getStockHealth: () =>
    apiClient.get('/analytics/stock-health').then((r) => r.data || r).catch(handleError),

  /** GET /analytics/caregiver-report — Assigned patients report */
  getCaregiverReport: () =>
    apiClient.get('/analytics/caregiver-report').then((r) => r.data || r).catch(handleError),
};

// ═════════════════════════════════════════════════════════════════════════════
// 7. REFILL & PHARMACY
// ═════════════════════════════════════════════════════════════════════════════
export const refillAPI = {
  /** GET /refill/low-stock — Medicines with low stock */
  lowStock: () => apiClient.get('/refill/low-stock').catch(handleError),

  /**
   * GET /refill/nearby-pharmacies — Nearby pharmacies (OpenStreetMap)
   * @param {{ lat, lng, radius_km }} params
   */
  nearbyPharmacies: (params) => {
    // Backend expects 'lon' not 'lng'
    const corrected = { ...params };
    if (corrected.lng !== undefined) {
      corrected.lon = corrected.lng;
      delete corrected.lng;
    }
    return apiClient.get('/refill/nearby-pharmacies', { params: corrected }).catch(handleError);
  },

  /**
   * POST /refill/order — Request refill order
   * @param {{ medicine_id, pharmacy_id, quantity }} data
   */
  requestRefill: (data) =>
    apiClient.post('/refill/order', data).catch(handleError),
};

// ═════════════════════════════════════════════════════════════════════════════
// 8. CAREGIVER
// ═════════════════════════════════════════════════════════════════════════════
export const caregiverAPI = {
  /** GET /users/patients — Patient roster */
  patients: () => apiClient.get('/users/patients').catch(handleError),
  getPatients: () => apiClient.get('/users/patients').catch(handleError),

  /**
   * GET /adherence/schedules?patient_id=:id
   * @param {string} patientId
   */
  getPatientSchedule: (patientId) =>
    apiClient.get('/adherence/schedules', { params: { patient_id: patientId } }).catch(handleError),

  /**
   * GET /analytics/caregiver-report
   * @param {string} [patientId]
   */
  patientOverview: (patientId) =>
    apiClient.get('/analytics/caregiver-report').catch(handleError),

  /** GET /reminders/notifications — Missed dose alerts & queue */
  alerts: () => apiClient.get('/reminders/notifications').catch(handleError),

  /**
   * POST /users/link-patient
   * @param {object} payload — { code, email, phone, ... }
   */
  linkPatient: async (payload) => {
    const res = await apiClient.post('/users/link-patient', payload);
    return res?.data !== undefined ? res.data : res;
  },

  /**
   * POST /reminders/notify-patient
   * @param {string} patientId
   * @param {string} [message]
   */
  sendPatientReminder: (patientId, message) =>
    apiClient.post('/reminders/notify-patient', { patient_id: patientId, message }).catch(handleError),

  /** GET /adherence/caregiver/queue — Multi-patient live scheduled dose queue */
  getCaregiverQueue: (date = null) =>
    apiClient
      .get('/adherence/caregiver/queue', { params: date ? { target_date: date } : {} })
      .then((r) => {
        const data = r?.data !== undefined ? r.data : r;
        if (data && (data.error || data.detail)) {
          throw new Error(data.message || data.detail || 'Failed to load caregiver queue');
        }
        return data;
      })
      .catch(handleError),
};

// ═════════════════════════════════════════════════════════════════════════════
// 9. NOTIFICATIONS
// ═════════════════════════════════════════════════════════════════════════════
export const notificationAPI = {
  /** GET /reminders/notifications — User notification log */
  list: (params) =>
    apiClient.get('/reminders/notifications', { params }).catch(handleError),

  /**
   * PATCH /reminders/notifications/:id/read
   * @param {string} id
   */
  markRead: (id) =>
    apiClient.patch(`/reminders/notifications/${id}/read`).catch(handleError),

  /** PATCH /notifications/read-all */
  markAllRead: () =>
    apiClient.patch('/reminders/notifications/read-all').catch(() => ({ data: { message: 'All read' } })),

  /** GET /notifications/settings — Notification preferences */
  settings: () =>
    apiClient.get('/users/profile').catch(handleError),

  /**
   * PUT /notifications/settings
   * @param {{ push, sms, email, whatsapp }} data
   */
  updateSettings: (data) =>
    apiClient.put('/users/profile', data).catch(handleError),

  /**
   * POST /reminders/notify — Dispatch broadcast announcement across channels
   * @param {{ channel, channels, priority, title, message, patient_id }} data
   */
  broadcast: (data) =>
    apiClient.post('/reminders/notify', data).catch(handleError),

  /**
   * POST /reminders/webhook/inbound-sms — Real Twilio Inbound Webhook
   * @param {{ From, Body, MessageSid }} data
   */
  inboundWebhook: (data) =>
    apiClient.post('/reminders/webhook/inbound-sms', data).catch(handleError),

  /**
   * GET /reminders/cohort-recipients — Get recipient cohort for broadcast
   */
  getCohortRecipients: () =>
    apiClient.get('/reminders/cohort-recipients').catch(handleError),

  /**
   * POST /reminders/re-ping — Re-alert unacknowledged patient
   * @param {{ recipient_id, recipient_phone, message }} data
   */
  reping: (data) =>
    apiClient.post('/reminders/re-ping', data).catch(handleError),

  /**
   * POST /reminders/notify — Trigger a test or broadcast notification
   * @param {{ channel, title, message, patient_id }} data
   */
  sendTest: (data) =>
    apiClient.post('/reminders/notify', data).catch(handleError),
};

// ═════════════════════════════════════════════════════════════════════════════
// 10. HELP & SUPPORT
// ═════════════════════════════════════════════════════════════════════════════
export const supportAPI = {
  /** GET /help/articles — FAQ articles */
  articles: (params) =>
    apiClient.get('/help/articles', { params }).catch(handleError),

  /**
   * GET /help/articles/:id
   * @param {string} id
   */
  article: (id) =>
    apiClient.get(`/help/articles/${id}`).catch(handleError),

  /**
   * POST /support/tickets — Submit a care assistance / grievance request
   * @param {{ subject, category, priority, description }} data
   */
  createTicket: (data) =>
    apiClient.post('/support/tickets', data).then((r) => r.data || r).catch(handleError),

  /** GET /support/tickets — Support ticket history */
  tickets: () => apiClient.get('/support/tickets').then((r) => r.data || r).catch(handleError),
  listTickets: () => apiClient.get('/support/tickets').then((r) => r.data || r).catch(handleError),

  /** GET /support/all — Admin view of all platform assistance requests */
  adminListTickets: () => apiClient.get('/support/all').then((r) => r.data || r).catch(handleError),

  /**
   * POST /help/feedback
   * @param {{ rating, comment }} data
   */
  feedback: (data) =>
    apiClient.post('/help/feedback', data).catch(handleError),
};

// ═════════════════════════════════════════════════════════════════════════════
// 11. ADMIN
// ═════════════════════════════════════════════════════════════════════════════
export const adminAPI = {
  /** GET /users/ — User management table */
  users: (params) =>
    apiClient.get('/users/', { params }).catch(handleError),
  getUsers: (params) =>
    apiClient.get('/users/', { params }).catch(handleError),

  /**
   * PATCH /users/:userId — Update role
   * @param {{ userId: string, role: string }} param0
   */
  updateRole: ({ userId, role }) =>
    apiClient.patch(`/users/${userId}`, { role }).catch(handleError),

  /**
   * PATCH /users/:id — Update user fields
   * @param {string} id
   * @param {object} data
   */
  updateUserRole: (id, data) =>
    apiClient.patch(`/users/${id}`, data).catch(handleError),

  /**
   * POST /users/:userId/reset-password — Admin password reset
   * @param {{ userId: string, temp_password?: string }} param0
   */
  resetUserPassword: ({ userId, temp_password }) =>
    apiClient.post(`/users/${userId}/reset-password`, { temp_password }).catch(handleError),

  /**
   * PATCH /users/:id/status — Toggle user active / suspended status
   * @param {string} id
   * @param {boolean} is_active
   */
  toggleStatus: (id, is_active) =>
    apiClient.patch(`/users/${id}/status`, { is_active }).catch(handleError),

  /**
   * DELETE /users/:id
   * @param {string} id
   */
  deleteUser: (id) =>
    apiClient.delete(`/users/${id}`).catch(handleError),

  /** GET /analytics/summary — System health / overview metrics */
  systemHealth: () =>
    apiClient.get('/analytics/summary').catch(handleError),

  /** GET /analytics/telemetry — Live hardware and subsystem telemetry */
  telemetry: () =>
    apiClient.get('/analytics/telemetry').catch(handleError),


  /** GET /reminders/stats — Reminder queue stats */
  notificationLogs: (params) =>
    apiClient.get('/reminders/stats', { params }).catch(handleError),

  /** GET /analytics/audit-logs — Live dynamic audit events */
  auditLogs: (params) =>
    apiClient.get('/analytics/audit-logs', { params }).catch(handleError),
  getAuditLogs: (params) =>
    apiClient.get('/analytics/audit-logs', { params }).catch(handleError),

  /** GET /analytics/trends */
  trends: (params) =>
    apiClient.get('/analytics/trends', { params }).catch(handleError),

  /** GET /analytics/summary */
  analytics: (params) =>
    apiClient.get('/analytics/summary', { params }).catch(handleError),
};

// Helper to trigger browser file download from Blob
function triggerDownload(blobData, filename) {
  if (typeof window === 'undefined') return;
  const blob = blobData instanceof Blob ? blobData : new Blob([blobData]);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

// ═════════════════════════════════════════════════════════════════════════════
// 12. DATA EXPORT
// ═════════════════════════════════════════════════════════════════════════════
export const exportAPI = {
  /** Standard blob PDF report download */
  downloadPdf: async () => {
    try {
      const response = await apiClient.get('/export/medicines/pdf', { responseType: 'blob' });
      triggerDownload(response.data, 'PillSync_Prescription_Report.pdf');
    } catch (err) {
      handleError(err);
    }
  },

  /** Standard blob CSV report download */
  downloadCsv: async () => {
    try {
      const response = await apiClient.get('/export/all/csv', { responseType: 'blob' });
      triggerDownload(response.data, 'PillSync_Adherence_Report.csv');
    } catch (err) {
      handleError(err);
    }
  },

  /** Download medicines as CSV */
  medicinesCSV: async () => {
    try {
      const response = await apiClient.get('/export/medicines/csv', { responseType: 'blob' });
      triggerDownload(response.data, 'PillSync_Medicines.csv');
    } catch (err) {
      handleError(err);
    }
  },

  /** Download medicines as PDF */
  medicinesPDF: async () => {
    try {
      const response = await apiClient.get('/export/medicines/pdf', { responseType: 'blob' });
      triggerDownload(response.data, 'PillSync_Prescription_Report.pdf');
    } catch (err) {
      handleError(err);
    }
  },

  /** Download adherence history as CSV */
  adherenceCSV: async () => {
    try {
      const response = await apiClient.get('/export/adherence/csv', { responseType: 'blob' });
      triggerDownload(response.data, 'PillSync_Adherence_Report.csv');
    } catch (err) {
      handleError(err);
    }
  },

  /** Download all data as CSV */
  allCSV: async () => {
    try {
      const response = await apiClient.get('/export/all/csv', { responseType: 'blob' });
      triggerDownload(response.data, 'PillSync_Adherence_Report.csv');
    } catch (err) {
      handleError(err);
    }
  },

  /** Download complete dossier as clinical PDF */
  allPDF: async () => {
    try {
      const response = await apiClient.get('/export/all/pdf', { responseType: 'blob' });
      triggerDownload(response.data, 'PillSync_Health_Dossier.pdf');
    } catch (err) {
      handleError(err);
    }
  },

  /** Download system audit logs as CSV */
  auditCSV: async () => {
    try {
      const response = await apiClient.get('/export/audit/csv', { responseType: 'blob' });
      triggerDownload(response.data, 'PillSync_Audit_Logs.csv');
    } catch (err) {
      handleError(err);
    }
  },

  /** Download system audit logs as PDF */
  auditPDF: async () => {
    try {
      const response = await apiClient.get('/export/audit/pdf', { responseType: 'blob' });
      triggerDownload(response.data, 'PillSync_Audit_Logs.pdf');
    } catch (err) {
      handleError(err);
    }
  },

  /** Download system health diagnostics as CSV */
  healthCSV: async () => {
    try {
      const response = await apiClient.get('/export/health/csv', { responseType: 'blob' });
      triggerDownload(response.data, 'PillSync_System_Health.csv');
    } catch (err) {
      handleError(err);
    }
  },

  /** Download system health diagnostics as PDF */
  healthPDF: async () => {
    try {
      const response = await apiClient.get('/export/health/pdf', { responseType: 'blob' });
      triggerDownload(response.data, 'PillSync_System_Health.pdf');
    } catch (err) {
      handleError(err);
    }
  },

  /** Download multi-channel notification telemetry as CSV */
  telemetryCSV: async () => {
    try {
      const response = await apiClient.get('/export/telemetry/csv', { responseType: 'blob' });
      triggerDownload(response.data, 'PillSync_Notification_Telemetry.csv');
    } catch (err) {
      handleError(err);
    }
  },

  /** Download comprehensive 8-10 page Master Platform Dossier as PDF */
  masterPDF: async (scope = '30d') => {
    try {
      const response = await apiClient.get('/export/master/pdf', { params: { scope }, responseType: 'blob' });
      triggerDownload(response.data, `PillSync_Master_Dossier_${scope}.pdf`);
    } catch (err) {
      handleError(err);
    }
  },

  /** Caregiver: Download assigned patients medication & schedule report as CSV */
  caregiverPatientsCSV: async (patientId = null) => {
    try {
      const params = patientId ? { patient_id: patientId } : {};
      const response = await apiClient.get('/export/caregiver/patients/csv', { params, responseType: 'blob' });
      triggerDownload(response.data, 'PillSync_Caregiver_Patients.csv');
    } catch (err) {
      handleError(err);
    }
  },

  /** Caregiver: Download assigned patients clinical dossier as PDF */
  caregiverPatientsPDF: async (patientId = null) => {
    try {
      const params = patientId ? { patient_id: patientId } : {};
      const response = await apiClient.get('/export/caregiver/patients/pdf', { params, responseType: 'blob' });
      triggerDownload(response.data, 'PillSync_Caregiver_Patients.pdf');
    } catch (err) {
      handleError(err);
    }
  },

  /** Caregiver: Download combined personal cabinet + assigned patients as CSV */
  caregiverCombinedCSV: async () => {
    try {
      const response = await apiClient.get('/export/caregiver/combined/csv', { responseType: 'blob' });
      triggerDownload(response.data, 'PillSync_Caregiver_Summary.csv');
    } catch (err) {
      handleError(err);
    }
  },

  /** Caregiver: Download combined personal cabinet + assigned patients as PDF */
  caregiverCombinedPDF: async () => {
    try {
      const response = await apiClient.get('/export/caregiver/combined/pdf', { responseType: 'blob' });
      triggerDownload(response.data, 'PillSync_Caregiver_Summary.pdf');
    } catch (err) {
      handleError(err);
    }
  },

  /** Admin: Download complete system database archive (all users, medicines, schedules) as CSV */
  adminAllCSV: async () => {
    try {
      const response = await apiClient.get('/export/admin/all/csv', { responseType: 'blob' });
      triggerDownload(response.data, 'PillSync_Admin_All.csv');
    } catch (err) {
      handleError(err);
    }
  },
};


// ═════════════════════════════════════════════════════════════════════════════
// 12. AI MEDICAL ASSISTANT (GROUNDED RAG CHATBOT)
// ═════════════════════════════════════════════════════════════════════════════
export const assistantAPI = {
  /**
   * Send chat messages to grounded assistant
   * POST /assistant/chat
   * @param {{ messages: Array<{role: string, content: string}>, locale?: 'en'|'hi' }} data
   */
  chat: (data) =>
    apiClient
      .post('/assistant/chat', data)
      .then((r) => r.data || r)
      .catch(handleError),

  /**
   * Get dynamic suggestion chips based on user's live dashboard data
   * GET /assistant/suggestions?locale=en|hi
   * @param {'en'|'hi'} [locale='en']
   */
  getSuggestions: (locale = 'en') =>
    apiClient
      .get('/assistant/suggestions', { params: { locale } })
      .then((r) => r.data || r)
      .catch(handleError),

  suggestions: (locale = 'en') =>
    apiClient
      .get('/assistant/suggestions', { params: { locale } })
      .then((r) => r.data || r)
      .catch(handleError),
};

// ═════════════════════════════════════════════════════════════════════════════
// 13. OCR & PRESCRIPTION SCANNING API
// ═════════════════════════════════════════════════════════════════════════════
export const ocrAPI = {
  /**
   * POST /ocr/scan — Upload prescription image for OCR
   * @param {FormData} formData
   */
  uploadPrescription: (formData) =>
    apiClient.post('/ocr/scan', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    }).then(r => r.data || r).catch(handleError),

  scan: (formData) =>
    apiClient.post('/ocr/scan', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    }).then(r => r.data || r).catch(handleError),

  /**
   * GET /ocr/history
   * @param {object|string} params
   */
  getHistory: (params) => {
    if (typeof params === 'string' && (!params || params === 'undefined' || params === 'null')) {
      return Promise.resolve(null);
    }
    return apiClient.get('/ocr/history', { params }).then(r => r.data || r).catch(handleError);
  },

  /**
   * GET /ocr/history/{scan_id}
   * @param {string} scanId
   */
  getScanDetail: (scanId) => {
    if (!scanId || scanId === 'undefined' || scanId === 'null') {
      return Promise.resolve(null);
    }
    return apiClient.get(`/ocr/history/${scanId}`).then(r => r.data || r).catch(handleError);
  },
};

// ── Default and Named Aliases ─────────────────────────────────────────────────
export const api = apiClient;
export default apiClient;
