"""
PillSync Phase 0 — Core API Tests.

Tests the health check, root endpoint, auth endpoints (register, login, me),
and RBAC-protected user management endpoints.

Note: These tests use FastAPI's TestClient (synchronous) which works
without a live PostgreSQL database for basic import/route validation.
Full integration tests require a running PostgreSQL instance.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


# ===================================================================
# Infrastructure Endpoints
# ===================================================================

class TestHealthAndRoot:
    """Test basic infrastructure endpoints that don't need auth."""

    def test_health_check(self):
        """GET /health should return 200 with status=healthy."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["app"] == "PillSync"

    def test_root_endpoint(self):
        """GET / should return app info with docs URL."""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["app"] == "PillSync"
        assert data["docs"] == "/docs"
        assert data["health"] == "/health"

    def test_openapi_docs_accessible(self):
        """GET /docs should return the Swagger UI page."""
        response = client.get("/docs")
        assert response.status_code == 200

    def test_openapi_schema(self):
        """GET /openapi.json should return valid OpenAPI schema."""
        response = client.get("/openapi.json")
        assert response.status_code == 200
        schema = response.json()
        assert "paths" in schema
        assert "/api/v1/auth/register" in schema["paths"]
        assert "/api/v1/auth/login" in schema["paths"]
        assert "/api/v1/auth/me" in schema["paths"]
        assert "/api/v1/users/profile" in schema["paths"]


# ===================================================================
# Auth Endpoint Validation (Schema validation — no DB required)
# ===================================================================

class TestAuthValidation:
    """Test auth endpoint request validation (no DB connection needed)."""

    def test_register_missing_fields(self):
        """POST /register with empty body should return 422."""
        response = client.post("/api/v1/auth/register", json={})
        assert response.status_code == 422

    def test_register_invalid_email(self):
        """POST /register with invalid email should return 422."""
        response = client.post("/api/v1/auth/register", json={
            "username": "testuser",
            "email": "not-an-email",
            "password": "TestPass123",
            "full_name": "Test User",
        })
        assert response.status_code == 422

    def test_register_short_password(self):
        """POST /register with password < 8 chars should return 422."""
        response = client.post("/api/v1/auth/register", json={
            "username": "testuser",
            "email": "test@pillsync.com",
            "password": "short",
            "full_name": "Test User",
        })
        assert response.status_code == 422

    def test_register_invalid_role(self):
        """POST /register with invalid role should return 422."""
        response = client.post("/api/v1/auth/register", json={
            "username": "testuser",
            "email": "test@pillsync.com",
            "password": "TestPass123",
            "full_name": "Test User",
            "role": "superadmin",
        })
        assert response.status_code == 422

    def test_login_missing_fields(self):
        """POST /login with empty body should return 422."""
        response = client.post("/api/v1/auth/login", json={})
        assert response.status_code == 422

    def test_me_without_token(self):
        """GET /me without Authorization header should return 401."""
        response = client.get("/api/v1/auth/me")
        assert response.status_code == 401

    def test_me_with_invalid_token(self):
        """GET /me with garbage token should return 401."""
        response = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer garbage-token"},
        )
        assert response.status_code == 401


# ===================================================================
# RBAC Validation (no DB required — tests auth enforcement)
# ===================================================================

class TestRBACEnforcement:
    """Test that RBAC-protected endpoints reject unauthenticated requests."""

    def test_list_users_requires_auth(self):
        """GET /users/ without token should return 401."""
        response = client.get("/api/v1/users/")
        assert response.status_code == 401

    def test_user_profile_requires_auth(self):
        """GET /users/profile without token should return 401."""
        response = client.get("/api/v1/users/profile")
        assert response.status_code == 401

    def test_assign_patient_requires_auth(self):
        """POST /users/assign-patient without token should return 401."""
        response = client.post("/api/v1/users/assign-patient", json={
            "caregiver_id": "00000000-0000-0000-0000-000000000001",
            "patient_id": "00000000-0000-0000-0000-000000000002",
        })
        assert response.status_code == 401


# ===================================================================
# Security Module Unit Tests
# ===================================================================

class TestSecurityModule:
    """Test password hashing and JWT token creation/validation."""

    def test_password_hash_and_verify(self):
        """Password hashing should produce verifiable bcrypt hash."""
        from app.core.security import hash_password, verify_password
        password = "MySecurePass123!"
        hashed = hash_password(password)
        assert hashed != password
        assert hashed.startswith("$2b$")
        assert verify_password(password, hashed) is True
        assert verify_password("WrongPassword", hashed) is False

    def test_access_token_creation_and_decode(self):
        """Access token should encode/decode with correct claims."""
        from app.core.security import create_access_token, decode_token
        token = create_access_token({"sub": "user-123", "role": "patient"})
        assert isinstance(token, str)
        assert len(token) > 50

        payload = decode_token(token)
        assert payload["sub"] == "user-123"
        assert payload["role"] == "patient"
        assert payload["type"] == "access"

    def test_refresh_token_creation(self):
        """Refresh token should have type=refresh."""
        from app.core.security import create_refresh_token, decode_token
        token = create_refresh_token({"sub": "user-456", "role": "admin"})
        payload = decode_token(token)
        assert payload["type"] == "refresh"
        assert payload["sub"] == "user-456"

    def test_invalid_token_raises_401(self):
        """Decoding an invalid token should raise HTTPException 401."""
        from fastapi import HTTPException
        from app.core.security import decode_token
        with pytest.raises(HTTPException) as exc_info:
            decode_token("this-is-not-a-valid-jwt")
        assert exc_info.value.status_code == 401
