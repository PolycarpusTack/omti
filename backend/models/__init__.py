"""
Models package initialization.
This package contains database models for the application.
"""

# Import the Python models
from .user import User
from .tag_models import (
    TagModel, 
    AnalysisTagModel,
    Tag, 
    TagCreate, 
    TagUpdate, 
    AnalysisTag, 
    AnalysisTagCreate,
    AnalysisTagSearch
)

# Export all model classes
__all__ = [
    # User model
    'User',
    
    # Tag ORM models
    'TagModel',
    'AnalysisTagModel',
    
    # Tag Pydantic schema models
    'Tag',
    'TagCreate',
    'TagUpdate',
    'AnalysisTag',
    'AnalysisTagCreate',
    'AnalysisTagSearch'
]