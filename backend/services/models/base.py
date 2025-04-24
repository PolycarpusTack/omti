from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
import httpx
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class BaseModelService(ABC):
    """Base class for all model services"""
    
    def __init__(self, model_name: str, base_url: str):
        self.model_name = model_name
        self.base_url = base_url
        self.client = httpx.AsyncClient(timeout=30.0)
        
    async def __aenter__(self):
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()
        
    @abstractmethod
    async def analyze(self, prompt: str, **kwargs) -> str:
        """Analyze the given prompt and return the response"""
        pass
        
    @abstractmethod
    async def validate(self) -> bool:
        """Validate that the model is available and ready"""
        pass
        
    @abstractmethod
    async def get_context_window(self) -> int:
        """Get the context window size for this model"""
        pass
        
    @abstractmethod
    async def get_model_settings(self) -> Dict[str, Any]:
        """Get the default settings for this model"""
        pass 