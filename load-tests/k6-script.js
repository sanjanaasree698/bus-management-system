import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 100 }, // ramp-up to 100 VUs
    { duration: '40s', target: 100 }, // stay at 100 VUs
    { duration: '10s', target: 0 },   // ramp-down to 0
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'], // failure rate < 5%
    http_req_duration: ['p(95)<500'], // 95% of requests < 500ms
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:8081';

export default function () {
  // Flow 1: Home Page
  const homeRes = http.get(`${BASE_URL}/`);
  check(homeRes, {
    'home status is 200': (r) => r.status === 200,
  });

  sleep(0.5);

  // Flow 2: Login Page / Check
  const loginRes = http.get(`${BASE_URL}/login`);
  check(loginRes, {
    'login status is 200 or 404': (r) => r.status === 200 || r.status === 404,
  });

  sleep(0.5);

  // Flow 3: Routes & Stops Screen
  const routesRes = http.get(`${BASE_URL}/routes`);
  check(routesRes, {
    'routes status is 200 or 404': (r) => r.status === 200 || r.status === 404,
  });

  sleep(0.5);
}
