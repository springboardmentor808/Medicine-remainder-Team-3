"""
PillSync Role-Based Access Control (RBAC) Module.

Provides reusable FastAPI dependencies that enforce role-level permissions
on protected endpoints. Works in conjunction with get_current_user.
"""

from fastapi import Depends, HTTPException, status

from app.core.security import get_current_user


class RoleChecker:
    """
    Callable FastAPI dependency that verifies the authenticated user
    has one of the allowed roles.

    Usage:
        @router.get("/admin-only", dependencies=[Depends(allow_admin)])
        async def admin_endpoint():
            ...

        @router.get("/caregiver-view")
        async def caregiver_view(user = Depends(allow_caregiver)):
            ...
    """

    def __init__(self, allowed_roles: list[str]):
        self.allowed_roles = allowed_roles

    async def __call__(self, current_user=Depends(get_current_user)):
        if current_user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Access denied. Required role(s): {', '.join(self.allowed_roles)}. "
                    f"Your role: {current_user.role}."
                ),
            )
        return current_user


# ---------------------------------------------------------------------------
# Pre-configured Role Checkers — Use these in endpoint dependencies
# ---------------------------------------------------------------------------

# Any authenticated user (patient, caregiver, or admin)
allow_any_authenticated = RoleChecker(["patient", "caregiver", "admin"])

# Patients and above (same as any authenticated, explicit for readability)
allow_patient = RoleChecker(["patient", "caregiver", "admin"])

# Caregivers and admins only — blocks patients
allow_caregiver = RoleChecker(["caregiver", "admin"])

# Admins only — full system access
allow_admin = RoleChecker(["admin"])
