from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from typing import List
from datetime import datetime

from models.tag_models import Tag, TagCreate, TagUpdate, AnalysisTag, AnalysisTagCreate
from models.tag_models import TagModel, AnalysisTagModel
from dependencies import get_db, get_current_user

# Create router
router = APIRouter(
    prefix="/api/tags",
    tags=["tags"],
    responses={404: {"description": "Not found"}},
)

@router.get("/", response_model=List[Tag])
async def get_tags(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Get all tags available to the user (global + user's personal tags)
    """
    # Query for both global tags and user-specific tags
    tags = db.query(TagModel).filter(
        or_(
            TagModel.global_tag == True,
            TagModel.user_id == current_user["id"]
        )
    ).order_by(TagModel.name).all()
    
    return tags

@router.post("/", response_model=Tag, status_code=status.HTTP_201_CREATED)
async def create_tag(
    tag: TagCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Create a new tag
    """
    # Check if a tag with this name already exists for this user
    existing_tag = db.query(TagModel).filter(
        and_(
            TagModel.name == tag.name,
            or_(
                TagModel.global_tag == True,
                TagModel.user_id == current_user["id"]
            )
        )
    ).first()
    
    if existing_tag:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A tag with this name already exists"
        )
    
    # Create new tag
    new_tag = TagModel(
        name=tag.name,
        color=tag.color,
        user_id=current_user["id"],
        # Only allow admin users to create global tags
        global_tag=tag.global_tag and current_user.get("is_admin", False)
    )
    
    db.add(new_tag)
    db.commit()
    db.refresh(new_tag)
    
    return new_tag

@router.put("/{tag_id}", response_model=Tag)
async def update_tag(
    tag_id: int,
    tag: TagUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Update an existing tag
    """
    # Find the tag
    db_tag = db.query(TagModel).filter(TagModel.id == tag_id).first()
    
    if not db_tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found"
        )
    
    # Check permissions
    if db_tag.global_tag and not current_user.get("is_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update global tags"
        )
    
    if not db_tag.global_tag and db_tag.user_id != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this tag"
        )
    
    # Update fields
    if tag.name is not None:
        db_tag.name = tag.name
    if tag.color is not None:
        db_tag.color = tag.color
    
    db_tag.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(db_tag)
    
    return db_tag

@router.delete("/{tag_id}", status_code=status.HTTP_200_OK)
async def delete_tag(
    tag_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Delete a tag and all its associations
    """
    # Find the tag
    db_tag = db.query(TagModel).filter(TagModel.id == tag_id).first()
    
    if not db_tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found"
        )
    
    # Check permissions
    if db_tag.global_tag and not current_user.get("is_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete global tags"
        )
    
    if not db_tag.global_tag and db_tag.user_id != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this tag"
        )
    
    # Delete tag
    # Note: We don't need to delete associations explicitly since we have
    # CASCADE configured on the foreign key
    db.delete(db_tag)
    db.commit()
    
    return {"message": "Tag deleted successfully"}

@router.get("/analysis/{analysis_id}", response_model=List[Tag])
async def get_analysis_tags(
    analysis_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Get all tags for a specific analysis
    """
    # Join query to get tags through analysis_tags
    tags = db.query(TagModel).join(
        AnalysisTagModel,
        TagModel.id == AnalysisTagModel.tag_id
    ).filter(
        AnalysisTagModel.analysis_id == analysis_id,
        AnalysisTagModel.user_id == current_user["id"]
    ).all()
    
    return tags

@router.post("/analysis/{analysis_id}", status_code=status.HTTP_201_CREATED)
async def add_tag_to_analysis(
    analysis_id: str,
    tag_data: AnalysisTagCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Add a tag to an analysis
    """
    # Verify tag exists
    db_tag = db.query(TagModel).filter(TagModel.id == tag_data.tag_id).first()
    
    if not db_tag:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found"
        )
    
    # Check if tag is already applied to this analysis
    existing = db.query(AnalysisTagModel).filter(
        AnalysisTagModel.analysis_id == analysis_id,
        AnalysisTagModel.tag_id == tag_data.tag_id,
        AnalysisTagModel.user_id == current_user["id"]
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tag already applied to this analysis"
        )
    
    # Create new association
    analysis_tag = AnalysisTagModel(
        analysis_id=analysis_id,
        tag_id=tag_data.tag_id,
        user_id=current_user["id"]
    )
    
    db.add(analysis_tag)
    db.commit()
    
    return {"message": "Tag added to analysis successfully"}

@router.delete("/analysis/{analysis_id}/{tag_id}", status_code=status.HTTP_200_OK)
async def remove_tag_from_analysis(
    analysis_id: str,
    tag_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Remove a tag from an analysis
    """
    # Delete the association
    result = db.query(AnalysisTagModel).filter(
        AnalysisTagModel.analysis_id == analysis_id,
        AnalysisTagModel.tag_id == tag_id,
        AnalysisTagModel.user_id == current_user["id"]
    ).delete()
    
    if result == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tag not found on this analysis"
        )
    
    db.commit()
    
    return {"message": "Tag removed from analysis successfully"}

@router.get("/search/", response_model=List[str])
async def search_analyses_by_tags(
    tag_ids: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Search for analyses that have all the specified tags
    """
    # Parse tag IDs from query parameter
    tag_id_list = []
    
    try:
        tag_id_list = [int(tid) for tid in tag_ids.split(',') if tid.strip()]
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid tag ID format. Use comma-separated integers."
        )
    
    if not tag_id_list:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid tag IDs provided"
        )
    
    # Use subquery to count tags per analysis
    from sqlalchemy import func
    
    # Create a subquery that counts tags per analysis
    subq = db.query(
        AnalysisTagModel.analysis_id,
        func.count(AnalysisTagModel.tag_id).label('tag_count')
    ).filter(
        AnalysisTagModel.tag_id.in_(tag_id_list),
        AnalysisTagModel.user_id == current_user["id"]
    ).group_by(
        AnalysisTagModel.analysis_id
    ).having(
        func.count(AnalysisTagModel.tag_id) >= len(tag_id_list)
    ).subquery()
    
    # Main query to get analysis IDs
    results = db.query(subq.c.analysis_id).all()
    
    # Extract analysis IDs
    analysis_ids = [result[0] for result in results]
    
    return analysis_ids