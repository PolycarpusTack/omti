from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime
import re
from bson import ObjectId

# Custom type for MongoDB ObjectId compatibility
class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

    @classmethod
    def __modify_schema__(cls, field_schema):
        field_schema.update(type="string")

# Models for tags and tag relationships
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

class TagInDB(TagBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    user_id: Optional[str] = None  # User ID who created the tag
    global_tag: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {
            ObjectId: str
        }

class Tag(TagBase):
    id: str
    user_id: Optional[str] = None
    global_tag: bool = False
    created_at: datetime
    updated_at: datetime
    
    class Config:
        orm_mode = True

class AnalysisTagCreate(BaseModel):
    analysis_id: str
    tag_id: str

class AnalysisTagInDB(BaseModel):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    analysis_id: str
    tag_id: PyObjectId
    user_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        allow_population_by_field_name = True
        arbitrary_types_allowed = True
        json_encoders = {
            ObjectId: str
        }

class AnalysisTag(BaseModel):
    id: str
    analysis_id: str
    tag_id: str
    user_id: str
    created_at: datetime
    
    class Config:
        orm_mode = True

class AnalysisTagSearch(BaseModel):
    tag_ids: List[str]