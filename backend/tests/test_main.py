from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "Healthy"

def test_login_and_cookie():
    response = client.post("/api/v1/auth/login", json={"username": "testuser", "password": "password123"})
    assert response.status_code == 200
    assert "access_token" in response.headers.get("set-cookie", "")

def test_send_reminder_simulation():
    response = client.post("/api/v1/send-reminder", json={
        "medicine_name": "Paracetamol",
        "dosage": "500mg",
        "recipient": "user@example.com",
        "channel": "email"
    })
    assert response.status_code == 200
    assert response.json()["success"] is True
