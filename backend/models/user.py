"""
User model for authentication and tracking
"""

from dataclasses import dataclass
from typing import Optional, List


@dataclass
class User:
    """User model for the system"""
    id: str
    username: str
    email: Optional[str] = None
    roles: List[str] = None
    
    def __post_init__(self):
        if self.roles is None:
            self.roles = []