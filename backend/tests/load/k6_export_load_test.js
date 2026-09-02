import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 20 },  // Ramp up to 20 users
    { duration: '30s', target: 50 },  // Peak at 50 concurrent export users
    { duration: '10s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<250'], // 95% of requests must complete in < 250ms
    http_req_failed: ['rate<0.01'],   // Error rate must be under 1%
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:8000';

export function setup() {
  const uid = Math.random().toString(36).substring(7);
  const registerPayload = JSON.stringify({
    email: `k6_${uid}@pillsync.test`,
    password: 'K6TestPassword123!',
    full_name: `K6 Tester ${uid}`,
    role: 'PATIENT',
  });

  const res = http.post(`${BASE_URL}/api/v1/auth/register`, registerPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  const token = res.json('access_token');
  return { token };
}

export default function (data) {
  const params = {
    headers: {
      Authorization: `Bearer ${data.token}`,
    },
  };

  // 1. Export CSV
  const exportRes = http.get(`${BASE_URL}/api/v1/export/medicines/csv`, params);
  check(exportRes, {
    'export status is 200': (r) => r.status === 200,
    'has attachment header': (r) => r.headers['Content-Disposition'] !== undefined,
  });

  // 2. Interleaved lightweight check (verifies zero pool starvation)
  const meRes = http.get(`${BASE_URL}/api/v1/auth/me`, params);
  check(meRes, {
    'auth/me status is 200': (r) => r.status === 200,
    'latency under 200ms': (r) => r.timings.duration < 200,
  });

  sleep(0.2);
}
