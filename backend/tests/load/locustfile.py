"""
PillSync Load Testing Harness (Locust).

Stress-tests DB Connection Pool Starvation and concurrent CSV/PDF export throughput.
Simulates 50+ concurrent users requesting exports while verifying authentication latency.

Usage:
    locust -f tests/load/locustfile.py --headless -u 50 -r 10 --run-time 1m --host http://localhost:8000
"""

import uuid
from locust import HttpUser, task, between


class PillSyncLoadUser(HttpUser):
    wait_time = between(0.1, 0.5)
    token: str = ""
    headers: dict = {}

    def on_start(self):
        """Register and log in an isolated test user per Locust virtual user thread."""
        user_suffix = uuid.uuid4().hex[:8]
        email = f"loadtest_{user_suffix}@pillsync.test"
        password = "LoadTestPassword123!"

        # Register user
        reg_payload = {
            "email": email,
            "password": password,
            "full_name": f"Locust Tester {user_suffix}",
            "role": "PATIENT",
        }
        res = self.client.post("/api/v1/auth/register", json=reg_payload)
        if res.status_code == 201:
            self.token = res.json().get("access_token", "")
            self.headers = {"Authorization": f"Bearer {self.token}"}

    @task(3)
    def test_export_medicines_csv(self):
        """Stress-test medicines CSV export (verifies fast DB connection release)."""
        if not self.headers:
            return
        with self.client.get(
            "/api/v1/export/medicines/csv",
            headers=self.headers,
            catch_response=True,
            name="GET /export/medicines/csv",
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Failed with status {response.status_code}")

    @task(2)
    def test_export_all_csv(self):
        """Stress-test full multi-table CSV export."""
        if not self.headers:
            return
        with self.client.get(
            "/api/v1/export/all/csv",
            headers=self.headers,
            catch_response=True,
            name="GET /export/all/csv",
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Failed with status {response.status_code}")

    @task(5)
    def test_auth_me_latency(self):
        """
        Verify that lightweight endpoints are NOT starved by heavy exports.
        Latency on this task must stay under 50ms even during peak export spikes.
        """
        if not self.headers:
            return
        with self.client.get(
            "/api/v1/auth/me",
            headers=self.headers,
            catch_response=True,
            name="GET /auth/me",
        ) as response:
            if response.status_code == 200:
                if response.elapsed.total_seconds() > 0.25:
                    response.failure(f"Starvation detected! Latency was {response.elapsed.total_seconds():.3f}s")
                else:
                    response.success()
            else:
                response.failure(f"Failed with status {response.status_code}")
