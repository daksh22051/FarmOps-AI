"""
Enumerations for FarmOps AI Domain Models and Access Control
"""

from enum import Enum


class UserRole(str, Enum):
    OWNER = "owner"
    MANAGER = "manager"
    AGRONOMIST = "agronomist"
    OPERATOR = "operator"
    VIEWER = "viewer"
    ADMIN = "admin"

    @classmethod
    def from_str(cls, value: str) -> "UserRole":
        if not value:
            return cls.VIEWER
        val_clean = value.strip().lower()
        for member in cls:
            if member.value == val_clean or member.name.lower() == val_clean:
                return member
        return cls.VIEWER
