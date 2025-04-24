"""
Routes package initialization.
This package contains API route handlers for various services.
"""

# Import route modules
from .analyze_contextual import router as analyze_contextual_router
try:
    from .chunker_monitoring import router as chunker_monitoring_router
except ImportError:
    chunker_monitoring_router = None
    
try:
    # This assumes you've adjusted tag_routes.py to use relative imports
    # e.g., from ..models.tag_models import Tag, TagCreate, etc.
    from .tag_routes import router as tag_routes_router
except ImportError:
    tag_routes_router = None

# Define what's available when importing from this package
__all__ = [
    'analyze_contextual_router'
]

# Add optional routers if they're available
if chunker_monitoring_router:
    __all__.append('chunker_monitoring_router')
    
if tag_routes_router:
    __all__.append('tag_routes_router')