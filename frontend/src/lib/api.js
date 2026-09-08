/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PillSync — Centralized API Client
 * FastAPI Backend: http://localhost:8000
 * Auth: JWT (HttpOnly Cookies + Bearer Token fallback)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import axios from 'axios';

// ── Base Config ───────────────────────────────────────────────────────────────
const BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000') + '/api/v1';

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: true, // HttpOnly Cookie support
  timeout: 15000,
});

// ── Request Interceptor — Attach JWT Token ────────────────────────────────────
apiClient.interceptors.request.use(
  (config) => {
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
export const emitToast = (message, type = 'error') => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('pillsync:toast', {
        detail: { message, type, id: Date.now() },
      })
    );
  }
};

const handleError = (error) => {
  // Gracefully ignore intentional AbortController cancellations
  if (axios.isCancel(error) || error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
    return Promise.reject(error);
  }

  const status = error.response?.status;
  let msg =
    error.response?.data?.detail ||
    error.response?.data?.message ||
    error.message ||
    'An unexpected error occurred';

  // Format Pydantic validation errors array
  if (Array.isArray(msg)) {
    msg = msg.map((e) => e.msg || JSON.stringify(e)).join(', ');
  }

  // Graceful status-specific user guidance
  if (status === 404) {
    msg = 'The requested medical record or scan result was not found.';
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
    apiClient.get('/medicines', { params }).catch(handleError),

  /**
   * POST /medicines — Add medicine manually
   * @param {{ name, dosage, frequency, instructions, start_date, end_date, stock }} data
   */
  create: (data) => apiClient.post('/medicines', data).catch(handleError),

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
  delete: (id) => apiClient.delete(`/medicines/${id}`).catch(handleError),

  /**
   * POST /ocr/scan — Upload prescription image for OCR
   * @param {FormData} formData — { file }
   */
  ocrScan: (formData) =>
    apiClient.post('/ocr/scan', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).catch(handleError),

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
  snoozeDose: (id, data) =>
    apiClient.post(`/medicines/${id}/snooze`, data).catch(handleError),

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
   * @param {object} data
   */
  linkPatient: (data) =>
    apiClient.post('/users/link-patient', data).catch(handleError),

  /**
   * POST /reminders/notify-patient
   * @param {string} patientId
   * @param {string} [message]
   */
  sendPatientReminder: (patientId, message) =>
    apiClient.post('/reminders/notify-patient', { patient_id: patientId, message }).catch(handleError),
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

// ═════════════════════════════════════════════════════════════════════════════
// 12. DATA EXPORT
// ═════════════════════════════════════════════════════════════════════════════
export const exportAPI = {
  /** Download medicines as CSV */
  medicinesCSV: () => {
    const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000') + '/api/v1';
    const token = typeof window !== 'undefined' ? localStorage.getItem('pillsync_access_token') : '';
    window.open(`${base}/export/medicines/csv?token=${encodeURIComponent(token || '')}`, '_blank');
  },

  /** Download medicines as PDF (styled HTML) */
  medicinesPDF: () => {
    const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000') + '/api/v1';
    const token = typeof window !== 'undefined' ? localStorage.getItem('pillsync_access_token') : '';
    window.open(`${base}/export/medicines/pdf?token=${encodeURIComponent(token || '')}`, '_blank');
  },

  /** Download adherence history as CSV */
  adherenceCSV: () => {
    const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000') + '/api/v1';
    const token = typeof window !== 'undefined' ? localStorage.getItem('pillsync_access_token') : '';
    window.open(`${base}/export/adherence/csv?token=${encodeURIComponent(token || '')}`, '_blank');
  },

  /** Download all data as CSV */
  allCSV: () => {
    const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000') + '/api/v1';
    const token = typeof window !== 'undefined' ? (localStorage.getItem('pillsync_access_token') || localStorage.getItem('access_token')) : '';
    window.open(`${base}/export/all/csv?token=${encodeURIComponent(token || '')}`, '_blank');
  },

  /** Download complete dossier as clinical PDF */
  allPDF: () => {
    const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000') + '/api/v1';
    const token = typeof window !== 'undefined' ? (localStorage.getItem('pillsync_access_token') || localStorage.getItem('access_token')) : '';
    window.open(`${base}/export/all/pdf?token=${encodeURIComponent(token || '')}`, '_blank');
  },

  /** Download system audit logs as CSV */
  auditCSV: () => {
    const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000') + '/api/v1';
    const token = typeof window !== 'undefined' ? (localStorage.getItem('pillsync_access_token') || localStorage.getItem('access_token')) : '';
    window.open(`${base}/export/audit/csv?token=${encodeURIComponent(token || '')}`, '_blank');
  },

  /** Download system audit logs as PDF */
  auditPDF: () => {
    const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000') + '/api/v1';
    const token = typeof window !== 'undefined' ? (localStorage.getItem('pillsync_access_token') || localStorage.getItem('access_token')) : '';
    window.open(`${base}/export/audit/pdf?token=${encodeURIComponent(token || '')}`, '_blank');
  },

  /** Download system health diagnostics as CSV */
  healthCSV: () => {
    const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000') + '/api/v1';
    const token = typeof window !== 'undefined' ? (localStorage.getItem('pillsync_access_token') || localStorage.getItem('access_token')) : '';
    window.open(`${base}/export/health/csv?token=${encodeURIComponent(token || '')}`, '_blank');
  },

  /** Download system health diagnostics as PDF */
  healthPDF: () => {
    const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000') + '/api/v1';
    const token = typeof window !== 'undefined' ? (localStorage.getItem('pillsync_access_token') || localStorage.getItem('access_token')) : '';
    window.open(`${base}/export/health/pdf?token=${encodeURIComponent(token || '')}`, '_blank');
  },

  /** Download multi-channel notification telemetry as CSV */
  telemetryCSV: () => {
    const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000') + '/api/v1';
    const token = typeof window !== 'undefined' ? (localStorage.getItem('pillsync_access_token') || localStorage.getItem('access_token')) : '';
    window.open(`${base}/export/telemetry/csv?token=${encodeURIComponent(token || '')}`, '_blank');
  },

  /** Download comprehensive 8-10 page Master Platform Dossier as PDF */
  masterPDF: (scope = '30d') => {
    const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000') + '/api/v1';
    const token = typeof window !== 'undefined' ? (localStorage.getItem('pillsync_access_token') || localStorage.getItem('access_token')) : '';
    window.open(`${base}/export/master/pdf?scope=${encodeURIComponent(scope)}&token=${encodeURIComponent(token || '')}`, '_blank');
  },

  /** Caregiver: Download assigned patients medication & schedule report as CSV */
  caregiverPatientsCSV: (patientId = null) => {
    const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000') + '/api/v1';
    const token = typeof window !== 'undefined' ? (localStorage.getItem('pillsync_access_token') || localStorage.getItem('access_token')) : '';
    const patientQuery = patientId ? `&patient_id=${encodeURIComponent(patientId)}` : '';
    window.open(`${base}/export/caregiver/patients/csv?token=${encodeURIComponent(token || '')}${patientQuery}`, '_blank');
  },

  /** Caregiver: Download assigned patients clinical dossier as PDF */
  caregiverPatientsPDF: (patientId = null) => {
    const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000') + '/api/v1';
    const token = typeof window !== 'undefined' ? (localStorage.getItem('pillsync_access_token') || localStorage.getItem('access_token')) : '';
    const patientQuery = patientId ? `&patient_id=${encodeURIComponent(patientId)}` : '';
    window.open(`${base}/export/caregiver/patients/pdf?token=${encodeURIComponent(token || '')}${patientQuery}`, '_blank');
  },

  /** Caregiver: Download combined personal cabinet + assigned patients as CSV */
  caregiverCombinedCSV: () => {
    const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000') + '/api/v1';
    const token = typeof window !== 'undefined' ? (localStorage.getItem('pillsync_access_token') || localStorage.getItem('access_token')) : '';
    window.open(`${base}/export/caregiver/combined/csv?token=${encodeURIComponent(token || '')}`, '_blank');
  },

  /** Caregiver: Download combined personal cabinet + assigned patients as PDF */
  caregiverCombinedPDF: () => {
    const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000') + '/api/v1';
    const token = typeof window !== 'undefined' ? (localStorage.getItem('pillsync_access_token') || localStorage.getItem('access_token')) : '';
    window.open(`${base}/export/caregiver/combined/pdf?token=${encodeURIComponent(token || '')}`, '_blank');
  },

  /** Admin: Download complete system database archive (all users, medicines, schedules) as CSV */
  adminAllCSV: () => {
    const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000') + '/api/v1';
    const token = typeof window !== 'undefined' ? (localStorage.getItem('pillsync_access_token') || localStorage.getItem('access_token')) : '';
    window.open(`${base}/export/admin/all/csv?token=${encodeURIComponent(token || '')}`, '_blank');
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
};

// ── Default Export ────────────────────────────────────────────────────────────
export default apiClient;

