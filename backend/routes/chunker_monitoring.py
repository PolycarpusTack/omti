from fastapi import APIRouter, Depends
from typing import Dict, Any, Optional
from pydantic import BaseModel

# Import your existing dependencies and auth
from dependencies import get_current_user
from enterprise_chunker.models import User

# Import for the new visualization endpoint
from enterprise_chunker.chunker import EnterpriseChunker
from enterprise_chunker.models.enums import ChunkingStrategy

# Global storage for chunker instances
# This will let us track metrics across requests
chunker_instances = {}

router = APIRouter(
    prefix="/api/chunker",
    tags=["chunker"],
    responses={404: {"description": "Not found"}},
)

class VisualizeRequest(BaseModel):
    text: str
    max_tokens: int = 4000
    strategy: Optional[str] = None

@router.get("/metrics", response_model=Dict[str, Any])
async def get_chunker_metrics(current_user: User = Depends(get_current_user)):
    """Get metrics from all active chunker instances"""
    metrics = {}
    
    # Collect metrics from all registered chunkers
    for name, chunker in chunker_instances.items():
        # Check if it has a get_metrics method (SmartParallelChunker has this)
        if hasattr(chunker, 'get_metrics'):
            metrics[name] = chunker.get_metrics()
        # For regular EnterpriseChunker, provide basic stats
        elif hasattr(chunker, 'options'):
            metrics[name] = {
                "options": {
                    "max_tokens_per_chunk": chunker.options.max_tokens_per_chunk,
                    "overlap_tokens": chunker.options.overlap_tokens,
                    "chunking_strategy": str(chunker.options.chunking_strategy),
                }
            }
    
    # If we have no metrics yet, return some defaults
    if not metrics:
        metrics["system"] = {
            "status": "No active chunkers registered"
        }
        
    return metrics

@router.post("/visualize", response_model=Dict[str, Any])
async def visualize_chunking(request: VisualizeRequest, current_user: User = Depends(get_current_user)):
    """Visualize how a document would be chunked"""
    chunker = EnterpriseChunker()
    
    # Apply strategy if specified
    if request.strategy:
        try:
            strategy = ChunkingStrategy(request.strategy)
            chunks = chunker.adaptive_chunk_text(
                request.text, 
                max_tokens_per_chunk=request.max_tokens,
                strategy=strategy
            )
        except ValueError:
            # Invalid strategy name
            chunks = chunker.adaptive_chunk_text(
                request.text, 
                max_tokens_per_chunk=request.max_tokens
            )
    else:
        chunks = chunker.adaptive_chunk_text(
            request.text, 
            max_tokens_per_chunk=request.max_tokens
        )
    
    # Find positions of chunks in the original text
    chunk_positions = []
    for chunk in chunks:
        # Find starting position of chunk in original text
        # This is a bit simplified - might need adjustment for real-world use
        start_pos = request.text.find(chunk[:min(50, len(chunk))])
        if start_pos >= 0:
            chunk_positions.append({
                "start": start_pos,
                "end": start_pos + len(chunk),
                "length": len(chunk)
            })
        else:
            # If we can't find it, approximate
            chunk_positions.append({
                "start": -1,
                "end": -1,
                "length": len(chunk)
            })
    
    return {
        "original_text": request.text,
        "chunks": chunks,
        "chunk_count": len(chunks),
        "chunk_sizes": [len(chunk) for chunk in chunks],
        "chunk_positions": chunk_positions
    }

# Add a registration function for your chunkers
def register_chunker(name: str, chunker_instance):
    """Register a chunker instance for monitoring"""
    chunker_instances[name] = chunker_instance
    return chunker_instance