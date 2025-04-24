from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.ext.declarative import declarative_base
from pydantic import BaseModel, Field, validator
from typing import Optional, List
import re
from datetime import datetime

# SQLAlchemy Base
Base = declarative_base()

# SQLAlchemy Models
class TagModel(Base):
    __tablename__ = "tags"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)
    color = Column(String(7), nullable=False, default="#3b82f6")  # Default blue color
    user_id = Column(String, nullable=True)  # Null for global tags
    global_tag = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class AnalysisTagModel(Base):
    __tablename__ = "analysis_tags"
    
    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(String, nullable=False, index=True)
    tag_id = Column(Integer, ForeignKey("tags.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Create a unique constraint for analysis_id, tag_id, and user_id
    __table_args__ = (
        UniqueConstraint('analysis_id', 'tag_id', 'user_id', name='unique_analysis_tag_user'),
    )

# Pydantic Models for API
class TagBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    color: str = Field(default="#3b82f6")  # Default blue color
    
    @validator('color')
    def validate_color(cls, v):
        if not re.match(r'^#([0-9A-F]{3}){1,2}$', v, re.IGNORECASE):
            raise ValueError('Invalid color hex code')
        return v

class TagCreate(TagBase):
    global_tag: bool = Field(default=False)  # Whether the tag is available to all users

class TagUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    color: Optional[str] = None
    
    @validator('color')
    def validate_color(cls, v):
        if v is not None and not re.match(r'^#([0-9A-F]{3}){1,2}$', v, re.IGNORECASE):
            raise ValueError('Invalid color hex code')
        return v

class Tag(TagBase):
    id: int
    user_id: Optional[str] = None
    global_tag: bool = False
    created_at: datetime
    updated_at: datetime
    
    class Config:
        orm_mode = True

class AnalysisTagCreate(BaseModel):
    analysis_id: str
    tag_id: int

class AnalysisTag(BaseModel):
    id: int
    analysis_id: str
    tag_id: int
    user_id: str
    created_at: datetime
    
    class Config:
        orm_mode = True

class AnalysisTagSearch(BaseModel):
    tag_ids: List[int]