from fastapi import APIRouter, Query, Path, HTTPException, UploadFile, File, Form, Depends, Request, BackgroundTasks
from fastapi.security import APIKeyHeader
import httpx
import os
import logging
import json
import secrets
import asyncio
import time
from typing import List, Dict, Any, Optional, Union
from pydantic import BaseModel, confloat, conint, validator
from tenacity import retry, stop_after_attempt, wait_exponential, RetryError
from circuitbreaker import circuit
from prometheus_client import Counter, Histogram
import aiocache
from datetime import datetime

# Configure logging
logger = logging.getLogger(__name__)

# Configuration settings
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
DEFAULT_TIMEOUT = float(os.environ.get("DEFAULT_TIMEOUT", "120.0"))
API_KEYS_ENABLED = os.environ.get("API_KEYS_ENABLED", "False").lower() == "true"
REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")
REDIS_PORT = int(os.environ.get("REDIS_PORT", "6379"))
MAX_FILE_SIZE = int(os.environ.get("MAX_FILE_SIZE", "10000000"))  # 10MB
CACHE_TTL = int(os.environ.get("CACHE_TTL", "300"))  # 5 minutes

# Initialize cache
try:
    cache = aiocache.Cache(aiocache.Cache.MEMORY)
    logger.info("Initialized memory cache for model routes")
    # Uncomment to use Redis instead of memory cache
    # cache = aiocache.Cache(aiocache.Cache.REDIS, 
    #                      endpoint=REDIS_HOST, 
    #                      port=REDIS_PORT, 
    #                      namespace="modelapi")
    # logger.info(f"Initialized Redis cache at {REDIS_HOST}:{REDIS_PORT}")
except Exception as e:
    logger.warning(f"Failed to initialize cache, falling back to no caching: {str(e)}")
    cache = None

# Configure HTTP client with optimized settings
HTTP_CLIENT = httpx.AsyncClient(
    limits=httpx.Limits(
        max_connections=100,
        max_keepalive_connections=20,
        keepalive_expiry=300
    ),
    timeout=httpx.Timeout(DEFAULT_TIMEOUT, connect=10.0)
)

# API Key security (if enabled)
api_key_header = APIKeyHeader(name="X-API-KEY", auto_error=False)

# Prometheus metrics
MODEL_REQUEST_COUNT = Counter(
    "model_request_count", 
    "Number of model API requests",
    ["endpoint", "model", "status"]
)

ANALYZE_DURATION = Histogram(
    "analyze_duration_seconds",
    "Time spent processing analyze requests",
    ["model"]
)

# Model schemas
class ModelInfo(BaseModel):
    id: str
    name: str
    provider: str = "ollama"
    context_window: Optional[int] = None
    max_tokens: Optional[int] = None
    capabilities: List[str] = []
    description: Optional[str] = None
    tags: List[str] = []

class ModelsResponse(BaseModel):
    models: List[ModelInfo]
    total: int
    available: int
    timestamp: str

class AnalyzeRequest(BaseModel):
    content: str
    model: str
    settings: Optional[Dict[str, Any]] = None

class AnalyzeResponse(BaseModel):
    analysis: str
    model: str
    processing_time: float
    request_id: str
    timestamp: str

class HealthCheckResponse(BaseModel):
    status: str
    services: Dict[str, Dict[str, Any]]
    timestamp: str

# Form with enhanced validation
class EnhancedAnalyzeForm:
    def __init__(
        self,
        model: str = Form(..., description="Model ID to use for analysis"),
        temperature: Optional[float] = Form(0.7, description="Temperature parameter (0.0-2.0)"),
        max_tokens: Optional[int] = Form(4000, description="Maximum tokens to generate"),
        content: Optional[str] = Form(None, description="Text content to analyze"),
        file: Optional[UploadFile] = File(None, description="File to analyze")
    ):
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.content = content
        self.file = file
        
        # Validate inputs
        if not model or not model.strip():
            raise HTTPException(status_code=400, detail="Model ID is required")
        
        if not content and not file:
            raise HTTPException(status_code=400, detail="Either content or file must be provided")
            
        if temperature is not None and (temperature < 0 or temperature > 2):
            raise HTTPException(status_code=400, detail="Temperature must be between 0 and 2")
            
        if max_tokens is not None and (max_tokens < 1 or max_tokens > 16000):
            raise HTTPException(status_code=400, detail="Max tokens must be between 1 and 16000")

# Authentication dependency
async def verify_api_key(api_key: str = Depends(api_key_header)):
    if not API_KEYS_ENABLED:
        return True
        
    if not api_key:
        raise HTTPException(
            status_code=401,
            detail="API key required",
            headers={"WWW-Authenticate": "ApiKey"},
        )
    
    # Replace with your actual API key validation logic
    valid_keys = os.environ.get("VALID_API_KEYS", "").split(",")
    if api_key not in valid_keys:
        raise HTTPException(
            status_code=403,
            detail="Invalid API key",
            headers={"WWW-Authenticate": "ApiKey"},
        )
    
    return True

# File validation dependency  
async def validate_file_size(file: Optional[UploadFile] = None):
    if not file:
        return None
        
    # Check the file size - this requires reading the file, so we need to reset it
    content = await file.read()
    await file.seek(0)
    
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE/1_000_000} MB"
        )
    
    return file

# Resilient Ollama API calls with retries and circuit breaker
@retry(
    stop=stop_after_attempt(3), 
    wait=wait_exponential(multiplier=1, min=4, max=10),
    reraise=True
)
async def safe_ollama_call(method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
    """Make a resilient API call to Ollama with retries and error handling"""
    start_time = time.time()
    url = f"{OLLAMA_BASE_URL}{endpoint}"
    
    try:
        if method.lower() == "get":
            response = await HTTP_CLIENT.get(url, **kwargs)
        elif method.lower() == "post":
            response = await HTTP_CLIENT.post(url, **kwargs)
        else:
            raise ValueError(f"Unsupported HTTP method: {method}")
            
        response.raise_for_status()
        result = response.json()
        
        logger.debug(f"Ollama API call to {endpoint} successful in {time.time()-start_time:.2f}s")
        return result
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error from Ollama API {endpoint}: {e.response.status_code} - {e.response.text}")
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Error from Ollama API: {e.response.text}"
        )
    except httpx.RequestError as e:
        logger.error(f"Request error to Ollama API {endpoint}: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail=f"Could not connect to Ollama service: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Unexpected error calling Ollama API {endpoint}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error: {str(e)}"
        )

@circuit(failure_threshold=5, recovery_timeout=60)
async def circuit_protected_fetch_models() -> List[ModelInfo]:
    """Fetch models with circuit breaker protection"""
    result = await safe_ollama_call("get", "/api/tags")
    models_data = result.get('models', [])
    
    models = []
    for model_data in models_data:
        model_name = model_data.get('name')
        if model_name:
            try:
                model_info_response = await safe_ollama_call(
                    "get", "/api/show", params={"name": model_name}
                )
                context_size = model_info_response.get('parameters', {}).get('context_length')
                desc = model_info_response.get('details', {}).get('description', f"Ollama model: {model_name}")
                
                models.append(ModelInfo(
                    id=model_name,
                    name=model_name,
                    provider="ollama",
                    context_window=context_size,
                    description=desc,
                    tags=model_data.get('tags', []),
                    capabilities=["text-generation", "chat", "analysis"]
                ))
            except Exception as e:
                logger.warning(f"Error fetching details for model {model_name}: {str(e)}")
                # Fallback with limited info
                models.append(ModelInfo(
                    id=model_name,
                    name=model_name,
                    provider="ollama",
                    tags=model_data.get('tags', []),
                    capabilities=["text-generation", "chat", "analysis"]
                ))
    
    return models

@aiocache.cached(ttl=CACHE_TTL, key="available_models", cache=aiocache.SimpleMemoryCache)
async def get_available_models() -> List[ModelInfo]:
    """Get available models with caching"""
    try:
        return await circuit_protected_fetch_models()
    except Exception as e:
        logger.error(f"Error fetching available models: {str(e)}")
        return []

async def check_ollama_health() -> Dict[str, Any]:
    """Check Ollama service health"""
    try:
        start_time = time.time()
        result = await safe_ollama_call("get", "/api/version")
        response_time = time.time() - start_time
        
        return {
            "status": "healthy",
            "version": result.get("version", "unknown"),
            "response_time": f"{response_time:.3f}s"
        }
    except Exception as e:
        logger.error(f"Ollama health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "error": str(e)
        }

async def check_cache_health() -> Dict[str, Any]:
    """Check cache health"""
    if not cache:
        return {"status": "disabled"}
        
    try:
        start_time = time.time()
        test_key = f"health_check_{secrets.token_hex(4)}"
        await cache.set(test_key, "OK", ttl=10)
        result = await cache.get(test_key)
        response_time = time.time() - start_time
        
        if result == "OK":
            return {
                "status": "healthy",
                "type": cache.NAME,
                "response_time": f"{response_time:.3f}s" 
            }
        else:
            return {
                "status": "degraded",
                "error": "Cache returned unexpected value"
            }
    except Exception as e:
        logger.error(f"Cache health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "error": str(e)
        }

def register_model_routes(app):
    """Register model-related routes with the FastAPI app"""
    router = APIRouter(prefix="/api", tags=["Models"])
    
    @router.get(
        "/models/available", 
        response_model=ModelsResponse,
        summary="List Available Models",
        description="Retrieves available models from Ollama with their capabilities and technical specifications.",
        responses={
            200: {"description": "List of available models"},
            503: {"description": "Ollama service unavailable"}
        }
    )
    async def get_models(request: Request, _: bool = Depends(verify_api_key)):
        """Get available models from Ollama"""
        request_id = getattr(request.state, "request_id", "unknown")
        logger.info(f"Request {request_id}: Fetching available models")
        
        try:
            start_time = time.time()
            models = await get_available_models()
            
            response = ModelsResponse(
                models=models,
                total=len(models),
                available=len(models),
                timestamp=datetime.utcnow().isoformat() + "Z"
            )
            
            MODEL_REQUEST_COUNT.labels(
                endpoint="models/available", 
                model="all", 
                status="success"
            ).inc()
            
            logger.info(f"Request {request_id}: Returned {len(models)} models in {time.time()-start_time:.2f}s")
            return response
            
        except Exception as e:
            MODEL_REQUEST_COUNT.labels(
                endpoint="models/available", 
                model="all", 
                status="error"
            ).inc()
            
            logger.error(f"Request {request_id}: Error fetching models: {str(e)}")
            raise
    
    @router.post(
        "/analyze",
        response_model=AnalyzeResponse,
        summary="Analyze Content",
        description="Analyzes content using the specified model. Either file or content parameter must be provided.",
        responses={
            200: {"description": "Analysis results"},
            400: {"description": "Invalid request parameters"},
            413: {"description": "File too large"},
            503: {"description": "Ollama service unavailable"}
        }
    )
    async def analyze_content(
        request: Request,
        form: EnhancedAnalyzeForm = Depends(),
        file: Optional[UploadFile] = Depends(validate_file_size),
        _: bool = Depends(verify_api_key)
    ):
        """Analyze content using specified model"""
        request_id = getattr(request.state, "request_id", secrets.token_urlsafe(8))
        logger.info(f"Request {request_id}: Analyzing content with model {form.model}")
        
        with ANALYZE_DURATION.labels(model=form.model).time():
            try:
                # Get content from either file or direct input
                text_to_analyze = ""
                if form.file:
                    file_content = await form.file.read()
                    text_to_analyze = file_content.decode("utf-8", errors="replace")
                    await form.file.seek(0)  # Reset file position
                else:
                    text_to_analyze = form.content
                
                # Make sure we have content to analyze
                if not text_to_analyze or not text_to_analyze.strip():
                    MODEL_REQUEST_COUNT.labels(
                        endpoint="analyze", 
                        model=form.model, 
                        status="error"
                    ).inc()
                    
                    raise HTTPException(
                        status_code=400,
                        detail="No content provided for analysis"
                    )
                
                start_time = time.time()
                
                # Call Ollama API with resilient method
                result = await safe_ollama_call(
                    "post",
                    "/api/generate",
                    json={
                        "model": form.model,
                        "prompt": f"Analyze the following content and provide insights:\n\n{text_to_analyze}",
                        "stream": False,
                        "temperature": form.temperature,
                        "max_tokens": form.max_tokens
                    }
                )
                
                processing_time = time.time() - start_time
                
                if "response" not in result:
                    MODEL_REQUEST_COUNT.labels(
                        endpoint="analyze", 
                        model=form.model, 
                        status="error"
                    ).inc()
                    
                    raise HTTPException(
                        status_code=500,
                        detail="Invalid response format from Ollama API"
                    )
                
                MODEL_REQUEST_COUNT.labels(
                    endpoint="analyze", 
                    model=form.model, 
                    status="success"
                ).inc()
                
                logger.info(f"Request {request_id}: Analysis completed in {processing_time:.2f}s")
                
                return AnalyzeResponse(
                    analysis=result["response"],
                    model=form.model,
                    processing_time=result.get("total_duration", processing_time),
                    request_id=request_id,
                    timestamp=datetime.utcnow().isoformat() + "Z"
                )
                
            except HTTPException:
                # Re-raise existing HTTP exceptions
                raise
            except Exception as e:
                MODEL_REQUEST_COUNT.labels(
                    endpoint="analyze", 
                    model=form.model, 
                    status="error"
                ).inc()
                
                logger.error(f"Request {request_id}: Error analyzing content: {str(e)}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Error analyzing content: {str(e)}"
                )
    
    @router.get(
        "/health",
        response_model=HealthCheckResponse,
        summary="API Health Check",
        description="Check health status of the API and its dependencies",
        include_in_schema=False
    )
    async def health_check():
        """Check API health status"""
        ollama_health = await check_ollama_health()
        cache_health = await check_cache_health()
        
        overall_status = "healthy"
        if ollama_health.get("status") != "healthy":
            overall_status = "degraded"
            
        return HealthCheckResponse(
            status=overall_status,
            services={
                "ollama": ollama_health,
                "cache": cache_health
            },
            timestamp=datetime.utcnow().isoformat() + "Z"
        )
    
    # Chaos engineering endpoints (protected from accidental use)
    if os.environ.get("ENABLE_CHAOS", "False").lower() == "true":
        global FAILURE_MODE
        FAILURE_MODE = False
        
        @router.post("/chaos/proxy-failure", include_in_schema=False)
        async def simulate_failure(
            duration: int = 60,
            background_tasks: BackgroundTasks = None
        ):
            """Simulate service failure for chaos testing"""
            global FAILURE_MODE
            FAILURE_MODE = True
            
            if background_tasks:
                background_tasks.add_task(reset_failure_mode, duration)
            
            return {"status": "chaos enabled", "duration_seconds": duration}
    
        async def reset_failure_mode(duration: int):
            """Reset failure mode after specified duration"""
            await asyncio.sleep(duration)
            global FAILURE_MODE
            FAILURE_MODE = False
            logger.info(f"Chaos mode disabled after {duration}s")
    
    # Handle graceful shutdown of the HTTP client
    @app.on_event("shutdown")
    async def shutdown_event():
        await HTTP_CLIENT.aclose()
        logger.info("HTTP client closed on shutdown")
    
    # Register routes with the app
    app.include_router(router)
    
    logger.info("Model routes registered successfully")
    return router