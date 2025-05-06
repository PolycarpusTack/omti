from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks, Form, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import StreamingResponse, JSONResponse
from routes import tag_routes, analyze_contextual_router
import httpx
import asyncio
import logging
import json
import os
import random
import re
import statistics
from typing import Optional, Dict, Any, List, AsyncGenerator, Tuple
from datetime import datetime, timedelta, timezone
from contextlib import asynccontextmanager
from pydantic import BaseModel, Field, validator
from enum import Enum
from collections import Counter, defaultdict
from services.models import EnterpriseModelFactory
from fastapi.encoders import jsonable_encoder
from routes import chunker_monitoring

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("api.log")
    ]
)
logger = logging.getLogger(__name__)

# Constants for configuration
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
ALLOWED_ORIGINS = [os.environ.get("FRONTEND_URL", "http://localhost:3000")]
DEFAULT_MODEL = os.environ.get("DEFAULT_MODEL", "mistral")
DEFAULT_TIMEOUT = float(os.environ.get("DEFAULT_TIMEOUT", "1200.0"))
MAX_RETRIES = int(os.environ.get("MAX_RETRIES", "3"))
DEFAULT_MAX_TOKENS_PER_CHUNK = int(os.environ.get("MAX_TOKENS_PER_CHUNK", "8000"))

# OpenAI configuration
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
OPENAI_ENABLED = bool(OPENAI_API_KEY)

# Import the chunk splitter function from utils.py
try:
    from utils import split_file_into_chunks, estimate_token_count
except ImportError as e:
    logger.critical(f"Failed to import utils module: {str(e)}")
    raise

# Try to import tiktoken for more accurate token counting with OpenAI models
try:
    import tiktoken
    TIKTOKEN_AVAILABLE = True
except ImportError:
    logger.warning("tiktoken not available; falling back to simple token counting")
    TIKTOKEN_AVAILABLE = False

# Models for request/response validation
class ModelProvider(str, Enum):
    OLLAMA = "ollama"
    OPENAI = "openai"

class ModelSettings(BaseModel):
    """Model settings that can be configured from the frontend"""
    temperature: float = 0.7
    top_p: float = 0.9
    max_tokens_per_chunk: int = 4000
    max_output_tokens: int = 2000
    frequency_penalty: float = 0
    presence_penalty: float = 0
    timeout: float = 300.0

class OpenAIModelConfig(BaseModel):
    model_id: str
    display_name: str
    max_tokens: int = 4096
    context_window: int = 8192
    settings: ModelSettings = ModelSettings()

# OpenAI model configurations
OPENAI_MODELS = [
    OpenAIModelConfig(
        model_id="gpt-4o",
        display_name="GPT-4o",
        max_tokens=4096,
        context_window=128000,
        settings=ModelSettings(
            temperature=0.7,
            top_p=0.9,
            max_tokens_per_chunk=8000,
            max_output_tokens=4096,
            timeout=600.0
        )
    ),
    OpenAIModelConfig(
        model_id="gpt-4-turbo", 
        display_name="GPT-4 Turbo",
        max_tokens=4096,
        context_window=128000,
        settings=ModelSettings(
            temperature=0.7,
            top_p=0.9,
            max_tokens_per_chunk=8000,
            max_output_tokens=4096,
            timeout=600.0
        )
    ),
    OpenAIModelConfig(
        model_id="gpt-3.5-turbo", 
        display_name="GPT-3.5 Turbo",
        max_tokens=4096,
        context_window=16385,
        settings=ModelSettings(
            temperature=0.7,
            top_p=0.9,
            max_tokens_per_chunk=4000,
            max_output_tokens=2048,
            timeout=300.0
        )
    )
]

# Startup and shutdown events
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Check if Ollama is available and create database tables
    try:
        # Import and create database tables for tags
        from models.tag_models import Base
        from dependencies import engine
        
        # Create all tables
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created successfully")
        
        # Check Ollama availability
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{OLLAMA_BASE_URL}/api/version")
            if response.status_code == 200:
                logger.info(f"Ollama service available: {response.json().get('version')}")
            else:
                logger.warning("Ollama service responded but may not be ready")
    except Exception as e:
        logger.warning(f"Startup error: {str(e)}")
    
    # Check OpenAI availability
    if OPENAI_ENABLED:
        logger.info("OpenAI API integration enabled")
    else:
        logger.warning("OpenAI API key not set; OpenAI integration disabled")
    
    yield
    
    # Shutdown: Clean up any resources
    logger.info("API shutting down")



app = FastAPI(lifespan=lifespan)

# Example endpoint showing how to call your new splitter:
@app.post("/analyze_file")
async def analyze_file(file: UploadFile = File(...)):
    content = (await file.read()).decode("utf-8")
    try:
        # old: chunks = text_chunker.chunk_text(content, options)
        chunks = split_file_into_chunks(
            content,
            max_chunk_tokens=DEFAULT_MAX_TOKENS_PER_CHUNK,
            overlap_tokens=100
        )
        token_count = estimate_token_count(content)
    except Exception as e:
        logger.error(f"Error splitting file into chunks: {e}")
        raise HTTPException(status_code=400, detail=str(e))

    # ... rest of your endpoint logic remains unchanged ...
    return JSONResponse({"chunks": chunks, "token_count": token_count})

class AnalysisResult(BaseModel):
    chunk: int
    total_chunks: int
    timestamp: str
    technical_analysis: Optional[str] = None
    simplified_analysis: Optional[str] = None
    suggested_solutions: Optional[str] = None
    error: Optional[str] = None

    @validator('timestamp')
    def validate_timestamp(cls, v):
        # Ensure timestamp is in ISO format
        try:
            datetime.fromisoformat(v.replace('Z', '+00:00'))
        except ValueError:
            raise ValueError('Invalid timestamp format')
        return v

class FullAnalysisResult(BaseModel):
    crash_resolution_report: str
    diagnostic_overview_report: str
    timestamp: str

class HealthCheckResult(BaseModel):
    status: str
    ollama_version: Optional[str] = None
    openai_enabled: bool = False
    api_version: str = "1.0.0"  # API version for compatibility tracking

class ModelPerformanceMetrics(BaseModel):
    response_times: List[float] = Field(default_factory=list)
    throughputs: List[float] = Field(default_factory=list)
    errors: List[Dict[str, Any]] = Field(default_factory=list)
    last_check: Optional[datetime] = None
    last_error: Optional[str] = None
    error_count: int = 0
    success_count: int = 0

class ModelStatus(BaseModel):
    name: str
    loaded: bool = False
    status: str = "unknown"  # "healthy", "degraded", "error", "unknown"
    avg_response_time: Optional[float] = None
    throughput: Optional[float] = None
    last_error: Optional[str] = None
    last_check: Optional[datetime] = None
    provider: str = "ollama"
    
class ModelStatusResponse(BaseModel):
    models: List[ModelStatus]
    timestamp: str

class AnalyticsResponse(BaseModel):
    issues_by_category: List[Dict[str, Any]]
    root_causes: List[Dict[str, Any]]
    resolution_times: List[Dict[str, Any]]
    common_root_causes: List[Dict[str, Any]]
    model_performance: List[Dict[str, Any]]
    time_range: str

# In-memory storage for analytics and model performance
model_performance_cache: Dict[str, ModelPerformanceMetrics] = {}
analysis_records = []

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tag_routes.router)
app.include_router(analyze_contextual_router)
app.include_router(chunker_monitoring.router)

# Custom exception handler for better error responses
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    logger.error(f"HTTPException: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "timestamp": datetime.utcnow().isoformat() + "Z"},
    )

async def verify_ollama_available():
    """Dependency to verify Ollama is available before processing requests"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{OLLAMA_BASE_URL}/api/version")
            response.raise_for_status()
            return True
    except Exception as e:
        logger.error(f"Ollama service unavailable: {str(e)}")
        raise HTTPException(
            status_code=503, 
            detail="Ollama service is currently unavailable. Please try again later."
        )

# Helper function to estimate token count more accurately
def estimate_token_count_for_model(text: str, model: str) -> int:
    """
    Estimate the number of tokens in a text for a specific model.
    Uses tiktoken for OpenAI models or falls back to the simple method for others.
    """
    # For OpenAI models, use tiktoken
    if TIKTOKEN_AVAILABLE and model.startswith("gpt-"):
        try:
            encoding = tiktoken.encoding_for_model(model)
            return len(encoding.encode(text))
        except Exception as e:
            logger.warning(f"Error using tiktoken for token counting: {str(e)}")
    
    # Fallback to simple estimation
    return estimate_token_count(text)

async def get_model_context_window(model: str) -> int:
    """Get the context window size for a model"""
    # For OpenAI models
    if model.startswith("gpt-"):
        for model_config in OPENAI_MODELS:
            if model_config.model_id == model:
                return model_config.context_window
        
        # Default values if model not found
        if "gpt-4" in model:
            return 8192
        return 4096
    
    # For Ollama models (we'd need to get this from Ollama API if possible)
    # These are approximations
    if "70b" in model.lower():
        return 4096
    elif "13b" in model.lower():
        return 4096
    elif "7b" in model.lower():
        return 4096
    elif "mixtral" in model.lower():
        return 8192
    
    # Default
    return 4096

async def measure_model_performance(model_name: str) -> ModelPerformanceMetrics:
    """Test the performance of a model and return metrics"""
    if model_name in model_performance_cache:
        # If we've checked recently, return cached results
        if (model_performance_cache[model_name].last_check and 
            datetime.now() - model_performance_cache[model_name].last_check < timedelta(minutes=5)):
            return model_performance_cache[model_name]
    
    # Initialize metrics if not exists
    if model_name not in model_performance_cache:
        model_performance_cache[model_name] = ModelPerformanceMetrics()
    
    try:
        # Use a simple test prompt
        test_prompt = "Analyze this log snippet: Application startup complete."
        
        # Measure response time and throughput
        start_time = datetime.now()
        
        if model_name.startswith("gpt-") and OPENAI_ENABLED:
            # Use OpenAI API
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {OPENAI_API_KEY}"
            }
            
            data = {
                "model": model_name,
                "messages": [{"role": "user", "content": test_prompt}],
                "temperature": 0.7,
                "max_tokens": 100  # Limit tokens for performance testing
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    json=data,
                    headers=headers
                )
                
                response.raise_for_status()
                response_data = response.json()
                response_text = response_data['choices'][0]['message']['content']
        else:
            # Use Ollama API
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{OLLAMA_BASE_URL}/api/generate", 
                    json={
                        "model": model_name,
                        "prompt": test_prompt,
                        "stream": False
                    }
                )
                
                response.raise_for_status()
                response_data = response.json()
                response_text = response_data.get('response', '')
            
        end_time = datetime.now()
        
        # Calculate metrics
        response_time = (end_time - start_time).total_seconds()
        token_count = len(response_text.split())
        throughput = token_count / response_time if response_time > 0 else 0
        
        # Store in performance cache (keep last 10 measurements)
        metrics = model_performance_cache[model_name]
        metrics.response_times = (metrics.response_times + [response_time])[-10:]
        metrics.throughputs = (metrics.throughputs + [throughput])[-10:]
        metrics.last_check = datetime.now()
        metrics.success_count += 1
        
        return metrics
        
    except Exception as e:
        logger.error(f"Error measuring performance for model {model_name}: {str(e)}")
        
        # Record the error
        metrics = model_performance_cache[model_name]
        metrics.errors.append({
            "timestamp": datetime.now().isoformat(),
            "error": str(e)
        })
        metrics.errors = metrics.errors[-10:]  # Keep only last 10 errors
        metrics.last_error = str(e)
        metrics.last_check = datetime.now()
        metrics.error_count += 1
        
        return metrics

def determine_model_status(metrics: ModelPerformanceMetrics) -> str:
    """Determine the health status of a model based on its metrics"""
    if not metrics.response_times:
        return "unknown"
    
    # If more than 50% of recent requests failed
    if metrics.error_count > metrics.success_count:
        return "error"
    
    # If there were any errors in the last 5 attempts
    if len(metrics.errors) > 0 and metrics.errors[-1].get("timestamp"):
        last_error_time = datetime.fromisoformat(metrics.errors[-1].get("timestamp").replace('Z', '+00:00'))
        if datetime.now() - last_error_time < timedelta(minutes=30):
            return "degraded"
    
    # Check for performance degradation
    if len(metrics.response_times) >= 5:
        avg_response_time = statistics.mean(metrics.response_times)
        if avg_response_time > 10.0:  # More than 10 seconds is considered slow
            return "degraded"
    
    return "healthy"

async def resolve_model_id_to_name(model_id: str) -> str:
    """
    Convert a model ID to the corresponding model name with robust fallback mechanisms.
    
    This function implements a multi-stage resolution strategy:
    1. Convert model_id to string for consistent comparison
    2. Check if the ID is already a valid model name in Ollama
    3. Check if the ID maps to a model in the application's model list
    4. If no match is found, fall back to appropriate defaults
    
    Args:
        model_id: The ID or name of the model from the frontend
        
    Returns:
        The name of a valid model to use with Ollama
        
    Raises:
        HTTPException: Only if all fallback mechanisms fail
    """
    # Convert model_id to string if it's not already
    model_id_str = str(model_id).strip()
    
    # Log for debugging
    logger.info(f"Resolving model ID: '{model_id_str}'")
    
    try:
        # 1. First check if model_id is already a valid model name in Ollama
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
                response.raise_for_status()
                ollama_models = response.json().get("models", [])
                
                # Log available Ollama models for debugging
                model_names = [m.get("name") for m in ollama_models]
                logger.info(f"Available Ollama models: {model_names}")
                
                # Check if model_id matches a model name
                for model in ollama_models:
                    if model.get("name") == model_id_str:
                        logger.info(f"Found direct model name match: {model_id_str}")
                        return model_id_str
        except Exception as e:
            logger.warning(f"Error checking Ollama models: {str(e)}")
        
        # 2. Check if the model_id maps to a model in our application's model list
        try:
            all_models = await list_all_models()
            
            # Log all available models from our application for debugging
            app_model_ids = [(m.get("id"), m.get("name")) for m in all_models.get("models", [])]
            logger.info(f"All application models: {app_model_ids}")
            
            # Try both string and numeric comparison
            for model in all_models.get("models", []):
                if str(model.get("id")) == model_id_str:
                    model_name = model.get("name")
                    logger.info(f"Found model by ID {model_id_str} -> {model_name}")
                    
                    # Verify the model exists in Ollama before returning
                    if model_name in model_names:
                        return model_name
                    else:
                        logger.warning(f"Model {model_name} found by ID {model_id_str} is not available in Ollama")
                        # Continue to fallback mechanisms
        except Exception as e:
            logger.warning(f"Error checking application models: {str(e)}")
        
        # 3. Handle numeric IDs with direct index lookup fallback
        # If the model_id is numeric, try to use it as an index in the Ollama models list
        if model_id_str.isdigit() and ollama_models:
            index = int(model_id_str)
            if 0 <= index < len(ollama_models):
                model_name = ollama_models[index].get("name")
                logger.info(f"Using index-based fallback for ID {model_id_str} -> {model_name}")
                return model_name
        
        # 4. Fall back to model name prefixes - if model_id is something like "llama" or "mistral",
        # find the first available model that starts with that prefix
        if len(model_id_str) >= 3 and not model_id_str.isdigit():
            for model in ollama_models:
                if model.get("name", "").startswith(model_id_str):
                    model_name = model.get("name")
                    logger.info(f"Using prefix match fallback for '{model_id_str}' -> {model_name}")
                    return model_name
        
        # 5. Ultimate fallback - if we have models available, use the first one
        if ollama_models:
            default_model = ollama_models[0].get("name")
            logger.warning(f"Model with ID {model_id_str} not found - falling back to {default_model}")
            return default_model
        
        # 6. If all else fails, use the DEFAULT_MODEL from configuration
        logger.warning(f"No models found in Ollama - falling back to configured default: {DEFAULT_MODEL}")
        return DEFAULT_MODEL
        
    except Exception as e:
        logger.error(f"Error resolving model ID {model_id_str}: {str(e)}")
        # Still fall back to DEFAULT_MODEL even after error
        return DEFAULT_MODEL

async def analyze_chunk(prompt: str, model: str = DEFAULT_MODEL, max_retries: int = MAX_RETRIES, timeout: float = DEFAULT_TIMEOUT) -> str:
    """
    Send a text chunk to Ollama for analysis with retry logic.
    """
    if not prompt or not prompt.strip():
        logger.error("Empty prompt provided to analyze_chunk")
        raise ValueError("Empty prompt provided")
        
    retry_delay = 15
    error_messages = []
    
    async with httpx.AsyncClient(timeout=timeout) as client:
        for attempt in range(max_retries):
            try:
                logger.info(f"Sending request to Ollama for model {model} (attempt {attempt+1}/{max_retries})")
                response = await client.post(f"{OLLAMA_BASE_URL}/api/generate", json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False
                })
                response.raise_for_status()
                
                response_data = response.json()
                if not response_data or 'response' not in response_data:
                    error_msg = f"Invalid response from Ollama: {response_data}"
                    logger.warning(error_msg)
                    error_messages.append(error_msg)
                    await asyncio.sleep(retry_delay)
                    retry_delay *= 2  # exponential backoff
                    continue
                    
                logger.info("Successfully received response from Ollama")
                return response_data.get('response', '')
            except (httpx.ReadTimeout, httpx.RequestError, httpx.HTTPStatusError) as e:
                error_msg = f"Request attempt {attempt+1} failed: {str(e)}"
                logger.warning(f"{error_msg}, retrying in {retry_delay} seconds...")
                error_messages.append(error_msg)
                await asyncio.sleep(retry_delay)
                retry_delay *= 2  # exponential backoff
        
        # All retries failed
        error_detail = "; ".join(error_messages)
        logger.error(f"Failed after {max_retries} retries: {error_detail}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to analyze content after {max_retries} retries. Last error: {error_messages[-1] if error_messages else 'Unknown error'}"
        )

async def analyze_with_openai(prompt: str, model: str = "gpt-3.5-turbo", 
                             max_retries: int = MAX_RETRIES, 
                             timeout: float = DEFAULT_TIMEOUT) -> str:
    """
    Send a text prompt to OpenAI API for analysis with retry logic.
    """
    if not OPENAI_API_KEY:
        raise ValueError("OpenAI API key not configured")
        
    if not prompt or not prompt.strip():
        logger.error("Empty prompt provided to analyze_with_openai")
        raise ValueError("Empty prompt provided")
        
    retry_delay = 10
    error_messages = []
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {OPENAI_API_KEY}"
    }
    
    async with httpx.AsyncClient(timeout=timeout) as client:
        for attempt in range(max_retries):
            try:
                logger.info(f"Sending request to OpenAI for model {model} (attempt {attempt+1}/{max_retries})")
                
                data = {
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.7,
                    "top_p": 1.0,
                    "n": 1
                }
                
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    json=data,
                    headers=headers
                )
                response.raise_for_status()
                
                response_data = response.json()
                if not response_data or 'choices' not in response_data or not response_data['choices']:
                    error_msg = f"Invalid response from OpenAI: {response_data}"
                    logger.warning(error_msg)
                    error_messages.append(error_msg)
                    await asyncio.sleep(retry_delay)
                    retry_delay *= 2  # exponential backoff
                    continue
                    
                logger.info("Successfully received response from OpenAI")
                return response_data['choices'][0]['message']['content']
                
            except (httpx.ReadTimeout, httpx.RequestError, httpx.HTTPStatusError) as e:
                error_msg = f"OpenAI request attempt {attempt+1} failed: {str(e)}"
                logger.warning(f"{error_msg}, retrying in {retry_delay} seconds...")
                error_messages.append(error_msg)
                await asyncio.sleep(retry_delay)
                retry_delay *= 2  # exponential backoff
        
        # All retries failed
        error_detail = "; ".join(error_messages)
        logger.error(f"Failed OpenAI request after {max_retries} retries: {error_detail}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to analyze content with OpenAI after {max_retries} retries. Last error: {error_messages[-1] if error_messages else 'Unknown error'}"
        )

async def analyze_with_provider(prompt: str, model: str = DEFAULT_MODEL, 
                               max_retries: int = MAX_RETRIES, 
                               timeout: float = DEFAULT_TIMEOUT) -> str:
    """
    Route analysis requests to the appropriate provider (Ollama or OpenAI).
    """
    if not prompt or not prompt.strip():
        logger.error("Empty prompt provided to analyze_with_provider")
        raise ValueError("Empty prompt provided")
    
    try:
        # Resolve the model ID to a model name
        model_name = await resolve_model_id_to_name(model)
        
        # Determine provider based on model name
        if model_name.startswith("gpt-") and OPENAI_ENABLED:
            logger.info(f"Routing request to OpenAI for model {model_name}")
            return await analyze_with_openai(prompt, model_name, max_retries, timeout)
        else:
            logger.info(f"Routing request to Ollama for model {model_name}")
            return await analyze_chunk(prompt, model_name, max_retries, timeout)
    except Exception as e:
        logger.error(f"Error in analyze_with_provider: {str(e)}")
        raise

async def read_and_decode_file(file: UploadFile) -> str:
    """Helper function to read and decode file content with proper error handling"""
    if not file:
        raise HTTPException(status_code=400, detail="No file provided")
        
    try:
        file_content = await file.read()
        if not file_content:
            raise HTTPException(status_code=400, detail="Empty file provided")
            
        try:
            content = file_content.decode('utf-8')
        except UnicodeDecodeError:
            logger.warning(f"UTF-8 decoding failed for {file.filename}, trying with error handling")
            content = file_content.decode('utf-8', errors='replace')
            
        logger.info(f"File {file.filename} successfully read, size: {len(content)} bytes")
        return content
    except Exception as e:
        logger.error(f"Error reading file {file.filename}: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error reading file: {str(e)}")
    finally:
        await file.close()

def extract_root_causes(text: str) -> List[str]:
    """Extract potential root causes from analysis text."""
    root_causes = []
    
    # Look for phrases like "caused by X", "due to X", etc.
    cause_patterns = [
        r"caused by\s+([^.]+)",
        r"due to\s+([^.]+)",
        r"result of\s+([^.]+)",
        r"root cause(?:\s+is|\s+was|\s+appears to be)?\s+([^.]+)",
        r"appears to be caused by\s+([^.]+)"
    ]
    
    for pattern in cause_patterns:
        matches = re.finditer(pattern, text, re.IGNORECASE)
        for match in matches:
            if match.group(1):
                root_causes.append(match.group(1).strip())
    
    # If no explicit causes found, look for common error patterns
    if not root_causes:
        error_patterns = {
            "memory leak": r"memory\s+leak|out\s+of\s+memory|memory\s+allocation\s+failure",
            "null pointer": r"null\s+pointer|nullptr|null\s+reference|NullPointerException",
            "timeout": r"timeout|timed\s+out|exceeded\s+.*time\s+limit",
            "network error": r"network\s+error|connection\s+refused|unable\s+to\s+connect",
            "configuration error": r"config(uration)?\s+error|misconfigured|incorrect\s+settings",
            "permission denied": r"permission\s+denied|access\s+denied|unauthorized",
            "race condition": r"race\s+condition|concurrency\s+issue|deadlock",
            "version mismatch": r"version\s+mismatch|incompatible\s+version|dependency\s+conflict"
        }
        
        for cause, pattern in error_patterns.items():
            if re.search(pattern, text, re.IGNORECASE):
                root_causes.append(cause)
    
    return root_causes

def determine_severity(text: str) -> str:
    """Determine the severity level based on analysis text."""
    if re.search(r"crash|fatal|exception|critical|severe\s+error", text, re.IGNORECASE):
        return "critical"
    elif re.search(r"error|failure|serious|high\s+priority", text, re.IGNORECASE):
        return "high"
    elif re.search(r"warning|potential\s+issue|might|could", text, re.IGNORECASE):
        return "medium"
    else:
        return "low"

def record_analysis_data(analysis_result, model: str, processing_time: float):
    """Record analytics data when an analysis is performed."""
    try:
        timestamp = datetime.fromisoformat(analysis_result.timestamp.replace('Z', '+00:00')) if hasattr(analysis_result, 'timestamp') else datetime.utcnow()
        
        # Determine severity from analysis text
        severity = "unknown"
        if hasattr(analysis_result, "technical_analysis") and analysis_result.technical_analysis:
            severity = determine_severity(analysis_result.technical_analysis)
        elif hasattr(analysis_result, "crash_resolution_report") and analysis_result.crash_resolution_report:
            severity = determine_severity(analysis_result.crash_resolution_report)
        
        # Extract root causes
        root_causes = []
        if hasattr(analysis_result, "technical_analysis") and analysis_result.technical_analysis:
            root_causes = extract_root_causes(analysis_result.technical_analysis)
        elif hasattr(analysis_result, "crash_resolution_report") and analysis_result.crash_resolution_report:
            root_causes = extract_root_causes(analysis_result.crash_resolution_report)
        
        # Store the analysis record
        analysis_records.append({
            "timestamp": timestamp,
            "model": model,
            "severity": severity,
            "root_causes": root_causes,
            "processing_time": processing_time,
            "resolution_time": None,  # To be filled in later if/when issue is resolved
            "resolution_attempts": 1  # Start with 1, increment if same issue is analyzed again
        })
        
        # Log for debugging
        logger.info(f"Recorded analytics data: {severity} issue, model: {model}, causes: {root_causes}")
        
    except Exception as e:
        logger.error(f"Error recording analytics data: {str(e)}")

def parse_iso_date(date_string: str) -> Optional[datetime]:
    """Parse an ISO format date string, handling various formats."""
    try:
        return datetime.fromisoformat(date_string.replace('Z', '+00:00'))
    except (ValueError, AttributeError):
        return None

@app.get("/health", response_model=HealthCheckResult)
async def health_check():
    """Health check endpoint to verify if Ollama service is available"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{OLLAMA_BASE_URL}/api/version")
            response.raise_for_status()
            return HealthCheckResult(
                status="healthy", 
                ollama_version=response.json().get("version"),
                openai_enabled=OPENAI_ENABLED
            )
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return JSONResponse(
            status_code=503,
            content=HealthCheckResult(
                status="unhealthy",
                openai_enabled=OPENAI_ENABLED,
                api_version="1.0.0"
            ).dict()
        )

@app.get("/models/status", response_model=ModelStatusResponse)
async def get_models_status():
    """Get detailed status of all models including load state, throughput, and latency"""
    try:
        # Get basic model list
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
                response.raise_for_status()
                models_data = response.json()
        except Exception as e:
            logger.error(f"Failed to get Ollama models: {str(e)}")
            models_data = {"models": []}
        
        # Measure performance for each model
        model_statuses = []
        
        # Process each model (up to 3 concurrently to avoid overloading the server)
        tasks = []
        
        for model_info in models_data.get('models', []):
            model_name = model_info.get('name')
            if model_name:
                tasks.append(measure_model_performance(model_name))
        
        # Run performance tests concurrently (but limit to 3 at a time)
        semaphore = asyncio.Semaphore(3)
        
        async def measure_with_semaphore(model_name):
            async with semaphore:
                return await measure_model_performance(model_name)
        
        performance_results = []
        if tasks:
            performance_results = await asyncio.gather(
                *[measure_with_semaphore(model_info.get('name')) 
                for model_info in models_data.get('models', []) 
                if model_info.get('name')]
            )
        
        # Create status objects for each model
        for model_info, metrics in zip(models_data.get('models', []), performance_results):
            model_name = model_info.get('name')
            if not model_name:
                continue
                
            # Calculate average metrics
            avg_response_time = (
                statistics.mean(metrics.response_times) 
                if metrics.response_times else None
            )
            
            avg_throughput = (
                statistics.mean(metrics.throughputs)
                if metrics.throughputs else None
            )
            
            status = determine_model_status(metrics)
            
            model_statuses.append(
                ModelStatus(
                    name=model_name,
                    loaded=True,  # If it's in the list, it's loaded
                    status=status,
                    avg_response_time=avg_response_time,
                    throughput=avg_throughput,
                    last_error=metrics.last_error,
                    last_check=metrics.last_check,
                    provider="ollama"
                )
            )
        
        # Add status info for OpenAI models if enabled
        if OPENAI_ENABLED:
            # Mock data for OpenAI models since we can't easily check their status
            openai_models = [
                ModelStatus(
                    name="gpt-4o",
                    loaded=True,
                    status="healthy",
                    avg_response_time=2.5,
                    throughput=48.2,
                    last_error=None,
                    last_check=datetime.now(),
                    provider="openai"
                ),
                ModelStatus(
                    name="gpt-4-turbo",
                    loaded=True,
                    status="healthy",
                    avg_response_time=2.8,
                    throughput=45.2,
                    last_error=None,
                    last_check=datetime.now(),
                    provider="openai"
                ),
                ModelStatus(
                    name="gpt-3.5-turbo",
                    loaded=True,
                    status="healthy",
                    avg_response_time=1.1,
                    throughput=65.5,
                    last_error=None,
                    last_check=datetime.now(),
                    provider="openai"
                )
            ]
            model_statuses.extend(openai_models)
            
        return ModelStatusResponse(
            models=model_statuses,
            timestamp=datetime.utcnow().isoformat() + "Z"
        )
    except Exception as e:
        logger.error(f"Failed to get model status: {str(e)}")
        raise HTTPException(status_code=503, detail=f"Cannot retrieve model status: {str(e)}")

@app.get("/models/all")
async def list_all_models():
    """List all available models from all providers (Ollama and OpenAI if enabled) with numerical IDs"""
    try:
        models = []
        model_index_map = {}  # To keep track of numeric IDs
        
        # Get Ollama models
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
                response.raise_for_status()
                ollama_models = response.json().get('models', [])
                
                # Assign numeric IDs to Ollama models
                for index, model in enumerate(ollama_models):
                    model_name = model.get('name')
                    if not model_name:
                        continue
                        
                    # Default settings for Ollama models
                    model_settings = ModelSettings(
                        temperature=0.7,
                        top_p=0.9,
                        max_tokens_per_chunk=4000,
                        max_output_tokens=2000,
                        timeout=300.0
                    )
                    
                    # Use index as the numeric ID
                    numeric_id = str(index)
                    model_index_map[model_name] = numeric_id
                    
                    models.append({
                        "id": numeric_id,  # Use string ID for consistency
                        "name": model_name,
                        "provider": "ollama",
                        "tags": model.get('tags', []),
                        "settings": model_settings.dict()
                    })
                    
                    logger.info(f"Added Ollama model: {model_name} with ID: {numeric_id}")
        except Exception as e:
            logger.warning(f"Failed to get Ollama models: {str(e)}")
        
        # Add OpenAI models if enabled (with different ID range to avoid conflicts)
        if OPENAI_ENABLED:
            start_id = 100  # Start at a high number to avoid conflicts with Ollama model IDs
            for idx, model_config in enumerate(OPENAI_MODELS):
                numeric_id = str(start_id + idx)
                model_index_map[model_config.model_id] = numeric_id
                
                models.append({
                    "id": numeric_id,
                    "name": model_config.display_name,
                    "provider": "openai",
                    "context_window": model_config.context_window,
                    "max_tokens": model_config.max_tokens,
                    "settings": model_config.settings.dict()
                })
                
                logger.info(f"Added OpenAI model: {model_config.display_name} with ID: {numeric_id}")
        
        # Store the model_index_map for later reference
        # This could be persisted or stored in a more permanent way if needed
        app.state.model_index_map = model_index_map
        
        return {"models": models}
    except Exception as e:
        logger.error(f"Failed to list all models: {str(e)}")
        raise HTTPException(status_code=503, detail=f"Cannot retrieve model list: {str(e)}")

@app.get("/api/model-mapping")
async def get_model_mapping():
    """
    Return the mapping between model IDs and names for debugging purposes.
    This helps frontend developers understand which IDs map to which model names.
    """
    try:
        # First, ensure we have the latest models
        await list_all_models()
        
        # Get the model mapping from app state
        model_map = getattr(app.state, "model_index_map", {})
        
        # If no mapping exists, generate a basic one
        if not model_map:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
                response.raise_for_status()
                ollama_models = response.json().get('models', [])
                
                # Create a simple mapping
                model_map = {
                    model.get('name'): str(idx) 
                    for idx, model in enumerate(ollama_models) 
                    if model.get('name')
                }
        
        # Return both directions of the mapping for maximum usefulness
        return {
            "id_to_name": {id: name for name, id in model_map.items()},
            "name_to_id": model_map,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "default_model": DEFAULT_MODEL
        }
    except Exception as e:
        logger.error(f"Error getting model mapping: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error getting model mapping: {str(e)}")

@app.get("/analytics/overview", response_model=AnalyticsResponse)
async def get_analytics_overview(
    time_range: str = "7d"
):
    """Get analytics data for the dashboard."""
    try:
        # Determine date range
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=7)  # Default to 7 days
        
        if time_range == "30d":
            start_date = end_date - timedelta(days=30)
        elif time_range == "90d":
            start_date = end_date - timedelta(days=90)
        
        # Filter records by date range
        filtered_records = [
            record for record in analysis_records 
            if isinstance(record["timestamp"], datetime) and start_date <= record["timestamp"] <= end_date
        ]
        
        if not filtered_records:
            # Return empty data if no records found
            return AnalyticsResponse(
                issues_by_category=[],
                root_causes=[],
                resolution_times=[],
                common_root_causes=[],
                model_performance=[],
                time_range=time_range
            )
        
        # Group by day and severity for issues_by_category
        issues_by_day = defaultdict(lambda: {"critical": 0, "high": 0, "medium": 0, "low": 0})
        for record in filtered_records:
            day = record["timestamp"].date().isoformat()
            severity = record["severity"]
            issues_by_day[day][severity] += 1
        
        issues_by_category = [
            {"date": day, **counts} 
            for day, counts in sorted(issues_by_day.items())
        ]
        
        # Count root causes
        all_causes = []
        for record in filtered_records:
            all_causes.extend(record["root_causes"])
        
        cause_counter = Counter(all_causes)
        root_causes = [
            {"name": cause, "value": count}
            for cause, count in cause_counter.most_common(10)
        ]
        
        # Calculate resolution times (mock data for now)
        # In a real system, you'd track when issues are marked as resolved
        resolution_times = [
            {"name": "First attempt", "value": 65},
            {"name": "Second attempt", "value": 25},
            {"name": "Multiple attempts", "value": 8},
            {"name": "Unresolved", "value": 2}
        ]
        
        # Model performance
        model_performance_data = defaultdict(lambda: {"accuracy": [], "speed": [], "count": 0})
        
        for record in filtered_records:
            model = record["model"]
            # In a real system, you'd track actual accuracy metrics
            # For now, use processing time as an inverse proxy for speed
            speed = min(100, max(50, 100 - (record["processing_time"] / 2)))
            
            model_performance_data[model]["speed"].append(speed)
            model_performance_data[model]["count"] += 1
            # Mock accuracy - would be based on user feedback in a real system
            model_performance_data[model]["accuracy"].append(random.uniform(75, 98))
        
        model_performance = [
            {
                "name": model,
                "accuracy": statistics.mean(data["accuracy"]),
                "speed": statistics.mean(data["speed"]),
                "count": data["count"]
            }
            for model, data in model_performance_data.items()
            if data["count"] > 0  # Only include models with data
        ]
        
        # Common root causes (same as root_causes but in a different format for the API)
        common_root_causes = root_causes
        
        return AnalyticsResponse(
            issues_by_category=issues_by_category,
            root_causes=root_causes,
            resolution_times=resolution_times,
            common_root_causes=common_root_causes,
            model_performance=model_performance,
            time_range=time_range
        )
        
    except Exception as e:
        logger.error(f"Error generating analytics overview: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating analytics: {str(e)}")

@app.post("/analyze/simple")
async def analyze_simple(
    file: UploadFile = File(...), 
    language: str = Form("en"),
    model: str = Form(DEFAULT_MODEL)
):
    """
    Simplified analysis endpoint that returns a single response for the entire file.
    """
    try:
        # Resolve the model ID to a model name
        model_name = await resolve_model_id_to_name(model)
        logger.info(f"Resolved model ID '{model}' to model name '{model_name}'")
        
        # Check if OpenAI is required but not configured
        if model_name.startswith("gpt-") and not OPENAI_ENABLED:
            raise HTTPException(
                status_code=400,
                detail="OpenAI API is not configured. Please select an Ollama model or configure OpenAI API key."
            )
        
        # Verify Ollama is available if using Ollama model
        if not model_name.startswith("gpt-"):
            await verify_ollama_available()
            
        logger.info(f"Received file: {file.filename} for simple analysis. Language: {language}, Model: {model_name}")
        content = await read_and_decode_file(file)
        
        prompt = (
            f"Explain this WHATS'ON crash in very simple terms and provide a bullet list of clear, step-by-step solutions that a non-technical team member can follow. "
            f"Use plain language. Language: {language}\n\n{content}"
        )
        
        start_time = datetime.now()
        
        try:
            ai_result = await analyze_with_provider(prompt, model=model_name, timeout=DEFAULT_TIMEOUT)
            
            end_time = datetime.now()
            processing_time = (end_time - start_time).total_seconds()
            
            logger.info("Simple analysis generated successfully")
            
            # Create a simple analysis result for recording
            result = type('AnalysisResult', (), {
                'timestamp': datetime.utcnow().isoformat() + "Z",
                'technical_analysis': ai_result
            })
            
            # Record analytics
            record_analysis_data(result, model_name, processing_time)
            
            return {
                "analysis": ai_result, 
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }
        except Exception as e:
            logger.error(f"Error generating analysis: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error generating analysis: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in analyze_simple: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

@app.post("/analyze/")
async def analyze(
    file: UploadFile = File(...), 
    model: str = Form(DEFAULT_MODEL), 
    max_tokens_per_chunk: int = Form(DEFAULT_MAX_TOKENS_PER_CHUNK), 
    timeout: float = Form(DEFAULT_TIMEOUT),
    language: str = Form("en"),
    temperature: float = Form(0.7),
    top_p: float = Form(0.9),
    max_output_tokens: int = Form(2000),
    frequency_penalty: float = Form(0),
    presence_penalty: float = Form(0),
    background_tasks: BackgroundTasks = None
):
    """Analyze a file with configurable model settings"""
    try:
        # Resolve the model ID to a model name
        model_name = await resolve_model_id_to_name(model)
        logger.info(f"Resolved model ID '{model}' to model name '{model_name}'")
        
        # Get model service with the resolved model name
        model_service = await model_factory.get_model_service(model_name)
        
        # Get model-specific settings
        model_settings = await model_service.get_model_settings()
        context_window = await model_service.get_context_window()
        
        # Calculate effective max tokens
        effective_max_tokens = min(max_tokens_per_chunk, int(context_window * 0.7))
        
        logger.info(f"Received file: {file.filename} for analysis using model {model_name}. Language: {language}")
        
        content = await read_and_decode_file(file)
        
        if background_tasks:
            background_tasks.add_task(logger.info, f"Processing file {file.filename} completed")
        
        try:
            chunks = split_file_into_chunks(content, max_chunk_tokens=effective_max_tokens)
            chunk_count = len(chunks)
            logger.info(f"Split into {chunk_count} chunks (max {effective_max_tokens} tokens per chunk)")
            
            if chunk_count == 0:
                raise HTTPException(status_code=400, detail="File content could not be processed into valid chunks")
                
            chunks = [chunk for chunk in chunks if chunk.strip()]
            if not chunks:
                raise HTTPException(status_code=400, detail="All chunks were empty after filtering")
        except Exception as e:
            logger.error(f"Error splitting file into chunks: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Error processing file content: {str(e)}")

        async def stream_analysis() -> AsyncGenerator[str, None]:
            total_chunks = len(chunks)
            for idx, chunk in enumerate(chunks, 1):
                try:
                    start_time = datetime.now()
                    logger.info(f"Processing chunk {idx}/{total_chunks}")
                    
                    technical_prompt = (
                        f"Please analyze the following WHATS'ON crash dump (chunk {idx}/{total_chunks}) in plain language. "
                        f"Provide a clear explanation of the issue, including a simple summary of the problem, potential root causes, "
                        f"and which parts of the system might be affected. Language: {language}\n\n{chunk}"
                    )
                    technical_analysis = await model_service.generate_response(prompt=technical_prompt, **model_settings)
                    
                    simplification_prompt = (
                        f"Rewrite the above analysis in very simple, everyday language so that someone with no technical knowledge can understand it. "
                        f"Language: {language}\n\n{technical_analysis}"
                    )
                    simplified_analysis = await model_service.generate_response(prompt=simplification_prompt, **model_settings)
                    
                    solutions_prompt = (
                        f"Based on the above analysis, please provide a bullet list of clear, step-by-step actionable solutions to resolve the issue. "
                        f"Each step should be explained in simple terms that a non-technical team member can follow. Language: {language}\n\n{technical_analysis}"
                    )
                    suggested_solutions = await model_service.generate_response(prompt=solutions_prompt, **model_settings)
                    
                    end_time = datetime.now()
                    processing_time = (end_time - start_time).total_seconds()
                    
                    result = AnalysisResult(
                        chunk=idx,
                        total_chunks=total_chunks,
                        timestamp=datetime.utcnow().isoformat() + "Z",
                        technical_analysis=technical_analysis,
                        simplified_analysis=simplified_analysis,
                        suggested_solutions=suggested_solutions
                    )
                    
                    # Record analytics
                    record_analysis_data(result, model_name, processing_time)
                    
                    yield json.dumps(result.dict()) + "\n"
                    logger.info(f"Chunk {idx}/{total_chunks} successfully analyzed.")
                except Exception as e:
                    error_msg = f"Error processing chunk {idx}/{total_chunks}: {str(e)}"
                    logger.error(error_msg)
                    error_result = AnalysisResult(
                        chunk=idx,
                        total_chunks=total_chunks,
                        timestamp=datetime.utcnow().isoformat() + "Z",
                        error=error_msg,
                        technical_analysis="Analysis failed",
                        simplified_analysis="Analysis failed",
                        suggested_solutions="Analysis failed"
                    )
                    yield json.dumps(error_result.dict()) + "\n"
        
        return StreamingResponse(
            stream_analysis(), 
            media_type="application/x-ndjson",
            headers={"Content-Disposition": f"attachment; filename=analysis-{file.filename}.ndjson"}
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in analyze endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Unexpected error processing file: {str(e)}")

# Initialize model factory
model_factory = EnterpriseModelFactory(OLLAMA_BASE_URL)

@app.post("/analyze/stream")
async def analyze_stream(
    file: UploadFile = File(...),
    model: str = Form(DEFAULT_MODEL),
    max_tokens_per_chunk: int = Form(DEFAULT_MAX_TOKENS_PER_CHUNK),
    timeout: float = Form(DEFAULT_TIMEOUT),
):
    """Stream analysis results for a file"""
    try:
        # Resolve the model ID to a model name
        model_name = await resolve_model_id_to_name(model)
        logger.info(f"Resolved model ID '{model}' to model name '{model_name}'")
        
        # Get model service with the resolved model name
        model_service = await model_factory.get_model_service(model_name)
        
        # Get model-specific settings
        model_settings = await model_service.get_model_settings()
        context_window = await model_service.get_context_window()
        
        # Calculate effective max tokens
        effective_max_tokens = min(max_tokens_per_chunk, int(context_window * 0.7))
        
        logger.info(f"Received file: {file.filename} for streaming analysis using model {model_name}")
        content = await read_and_decode_file(file)
        
        try:
            chunks = split_file_into_chunks(content, max_chunk_tokens=effective_max_tokens)
            chunks = [chunk for chunk in chunks if chunk.strip()]
            
            if not chunks:
                raise HTTPException(status_code=400, detail="No valid content chunks found in file")
                
            logger.info(f"Split into {len(chunks)} chunks for streaming")
        except Exception as e:
            logger.error(f"Error splitting file into chunks: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Error processing file content: {str(e)}")
        
        async def stream_analysis():
            total_chunks = len(chunks)
            for idx, chunk in enumerate(chunks, 1):
                try:
                    logger.info(f"Processing stream chunk {idx}/{total_chunks}")
                    prompt = f"Analyze this WHATS'ON crash dump chunk {idx}/{total_chunks}. Summarize clearly, highlight causes and actions in plain language:\n\n{chunk}"
                    
                    start_time = datetime.now()
                    analysis = await model_service.analyze(
                        prompt,
                        timeout=timeout,
                        temperature=model_settings["temperature"],
                        top_p=model_settings["top_p"]
                    )
                    
                    end_time = datetime.now()
                    processing_time = (end_time - start_time).total_seconds()
                    
                    timestamp = datetime.utcnow().isoformat() + "Z"
                    
                    result = {
                        "chunk": idx,
                        "total_chunks": total_chunks,
                        "analysis": analysis,
                        "timestamp": timestamp
                    }
                    
                    # Create a simple result object for analytics recording
                    result_obj = type('AnalysisResult', (), {
                        'timestamp': timestamp,
                        'technical_analysis': analysis
                    })
                    
                    # Record analytics
                    record_analysis_data(result_obj, model_name, processing_time)
                    
                    yield json.dumps(result) + "\n"
                    logger.info(f"Streamed analysis chunk {idx}/{total_chunks}")
                except Exception as e:
                    error_message = f"Error analyzing chunk {idx}: {str(e)}"
                    logger.error(error_message)
                    yield json.dumps({
                        "chunk": idx,
                        "total_chunks": total_chunks,
                        "analysis": f"Analysis failed: {str(e)}",
                        "error": error_message,
                        "timestamp": datetime.utcnow().isoformat() + "Z"
                    }) + "\n"
        
        return StreamingResponse(
            stream_analysis(),
            media_type="application/x-ndjson",
            headers={"Content-Disposition": f"attachment; filename=stream-analysis-{file.filename}.ndjson"}
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in analyze_stream endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

@app.post("/analyze/full", response_model=FullAnalysisResult)
async def analyze_full(
    file: UploadFile = File(...),
    model: str = Form(DEFAULT_MODEL),
    timeout: float = Form(DEFAULT_TIMEOUT),
    language: str = Form("en")
):
    """
    Analyze the file and generate two separate reports:
    1. Crash Resolution Report (focusing on the crash details and fix recommendations)
    2. Comprehensive Diagnostic Overview (covering overall errors and performance/functionality improvements)
    """
    try:
        # Resolve the model ID to a model name
        model_name = await resolve_model_id_to_name(model)
        logger.info(f"Resolved model ID '{model}' to model name '{model_name}'")
        
        # Check if OpenAI is required but not configured
        if model_name.startswith("gpt-") and not OPENAI_ENABLED:
            raise HTTPException(
                status_code=400,
                detail="OpenAI API is not configured. Please select an Ollama model or configure OpenAI API key."
            )
        
        # Verify Ollama is available if using Ollama model
        if not model_name.startswith("gpt-"):
            await verify_ollama_available()
            
        logger.info(f"Received file: {file.filename} for full analysis. Language: {language}, Model: {model_name}")
        
        content = await read_and_decode_file(file)
        
        start_time = datetime.now()
        
        crash_prompt = (
            f"You are a highly experienced software diagnostic engineer specializing in analyzing system crash logs. "
            f"I am providing you with a crash log file from the Whats'On application. Please review the log carefully and create a report that can be understood by non-technical team members. "
            f"Your report should include the following sections:\n\n"
            f"1. **Summary of Crash**: A brief, plain language description of what went wrong.\n"
            f"2. **Key Error Details**: Extract and explain the most important error messages and parts of the stack trace in simple terms.\n"
            f"3. **Root Cause Analysis**: Identify the likely reasons for the crash (for example, missing functionality, configuration errors, or version mismatches), explained in everyday language.\n"
            f"4. **Actionable Recommendations**: Provide a bullet list of clear, step-by-step actions to resolve the issue. Each step should be explained in simple language so that anyone can follow it.\n\n"
            f"Language: {language}\n\n{content}"
        )

        overview_prompt = (
            f"You are a senior system analyst and crash diagnostics expert. I have provided you with a complete crash log file from the Whats'On application. "
            f"Your task is to produce a comprehensive diagnostic overview that is clear for both technical and non-technical team members. "
            f"Please include the following sections in your report:\n\n"
            f"1. **Executive Summary**: A high-level description of what happened at the time of the crash, using plain language.\n"
            f"2. **Detailed Breakdown**: A step-by-step explanation of the significant events, errors, and warnings in the log, with simple explanations for any technical terms.\n"
            f"3. **Analysis of Recurring Issues**: Identify any patterns or common problems in the log, described in everyday language.\n"
            f"4. **Root Cause Identification**: Explain the most likely underlying issues that led to the crash in clear, non-technical terms.\n"
            f"5. **Step-by-Step Action Plan**: Provide a bullet list of clear, actionable steps for both immediate fixes and long-term improvements. Each step should be explained in simple terms.\n\n"
            f"Please format your report with clear headings and subheadings for each section, so the information is well-organized and easy to follow.\n\n"
            f"Language: {language}\n\n{content}"
        )
            
        crash_resolution_report, diagnostic_overview_report = await asyncio.gather(
            analyze_with_provider(crash_prompt, model=model_name, timeout=timeout),
            analyze_with_provider(overview_prompt, model=model_name, timeout=timeout)
        )
        
        end_time = datetime.now()
        processing_time = (end_time - start_time).total_seconds()
            
        result = FullAnalysisResult(
            crash_resolution_report=crash_resolution_report,
            diagnostic_overview_report=diagnostic_overview_report,
            timestamp=datetime.utcnow().isoformat() + "Z"
        )
        
        # Record analytics
        record_analysis_data(result, model_name, processing_time)
        
        return result
            
    except Exception as e:
        logger.error(f"Error generating full analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating analysis: {str(e)}")

@app.post("/analyze/mistral", response_model=FullAnalysisResult)
async def analyze_mistral(
    file: UploadFile = File(...),
    model: str = Form(DEFAULT_MODEL),
    timeout: float = Form(DEFAULT_TIMEOUT),
    language: str = Form("en")
):
    """
    Advanced analysis endpoint using Mistral.
    
    Act as a senior VisualWorks engineer with 15+ years of experience in enterprise SmallTalk systems and mission-critical diagnostics.
    Analyze the provided WHATS'ON crash file and generate a comprehensive report that addresses both technical depth and business impact.
    The report will include:
      1. Executive Summary
      2. Image-State & Memory Forensics
      3. VM & Runtime Environment Analysis
      4. Business Continuity Assessment
      5. Root Cause Analysis
      6. Remediation Strategy
      7. Prevention & Knowledge Transfer
      
    Follow the guidelines precisely.
    """
    try:
        # Resolve the model ID to a model name
        model_name = await resolve_model_id_to_name(model)
        logger.info(f"Resolved model ID '{model}' to model name '{model_name}'")
        
        # Check if OpenAI is required but not configured
        if model_name.startswith("gpt-") and not OPENAI_ENABLED:
            raise HTTPException(
                status_code=400,
                detail="OpenAI API is not configured. Please select an Ollama model or configure OpenAI API key."
            )
        
        # Verify Ollama is available if using Ollama model
        if not model_name.startswith("gpt-"):
            await verify_ollama_available()
            
        logger.info(f"Received file: {file.filename} for advanced Mistral analysis. Language: {language}, Model: {model_name}")

        content = await read_and_decode_file(file)
        
        start_time = datetime.now()

        detailed_prompt = (
            "Act as a senior VisualWorks engineer with 15+ years of experience in enterprise SmallTalk systems and mission-critical diagnostics. "
            "Analyze the provided WHATS'ON crash file and generate a comprehensive report that addresses both technical depth and business impact. Follow these guidelines precisely:\n\n"
            "1. Executive Summary [Weight: Essential]\n"
            "Provide a concise 3–5 sentence overview of the crash, categorizing it by type (e.g., VM crash, image corruption, FFI failure).\n"
            "Assign a severity level (P0-Critical, P1-High, P2-Medium, P3-Low) along with an estimated business impact timeframe.\n"
            "Include a CRITICAL ACTION ITEMS section with 1–3 bullet points detailing immediate remediation steps.\n\n"
            "2. Image-State & Memory Forensics [Weight: Technical]\n"
            "Parse the crash snapshot to extract corrupted object references and memory addresses.\n"
            "Identify SmallTalk-specific patterns such as doesNotUnderstand: recursion chains, metaclass hierarchy conflicts, and anomalies with become:/becomeForward:.\n"
            "Analyze heap fragmentation and object allocation patterns immediately preceding the crash.\n"
            "Audit FFI boundary calls (e.g., Alien, OSProcess, callbacks) and report any precise error codes.\n\n"
            "3. VM & Runtime Environment Analysis [Weight: Technical]\n"
            "Parse JIT compilation logs to detect method optimization failures or deoptimization events.\n"
            "Evaluate garbage collection metrics including generational collection timings, tenuring distribution, and GC pause durations in relation to the crash.\n"
            "Flag any problematic VM plugin integrations (e.g., OpenSSL, ODBC) and perform a version compatibility check.\n"
            "Cross-reference VM thread states with process priorities at the time of failure.\n\n"
            "4. Business Continuity Assessment [Weight: Strategic]\n"
            "Provide concrete estimates for recovery time (with recommended approaches), potential data loss, and transaction integrity impact.\n"
            "Map the technical issues to specific business workflows using VisualWorks-specific terminology.\n"
            "Assess compliance implications, particularly for regulated industries such as fintech or healthcare.\n\n"
            "5. Root Cause Analysis [Weight: Diagnostic]\n"
            "Employ an elimination methodology to systematically evaluate and rank all possible causes, assigning a confidence level (in percentage) to each potential root cause.\n"
            "Reference similar incidents from the SmallTalk community knowledge base with precise citations where available.\n"
            "Identify any triggering conditions and outline reproduction parameters if determinable.\n\n"
            "6. Remediation Strategy [Weight: Actionable]\n"
            "SHORT-TERM (within 24 hours): Detail specific image recovery techniques and provide emergency patch instructions (including exact SmallTalk syntax).\n"
            "MEDIUM-TERM (1–2 weeks): Propose targeted refactoring and defensive programming patterns to mitigate identified vulnerabilities.\n"
            "LONG-TERM (1–3 months): Offer architectural recommendations, monitoring enhancements, and testing framework improvements.\n"
            "Include relevant code snippets in proper SmallTalk syntax for critical fixes where applicable.\n\n"
            "7. Prevention & Knowledge Transfer [Weight: Strategic]\n"
            "Design 2–3 specific test cases that validate the fix and prevent regression.\n"
            "Document early warning indicators that might have predicted this failure.\n"
            "Recommend precise VM/image tuning parameters (with configuration syntax) to optimize system stability.\n"
            "Suggest team training focus areas to address any technical gaps revealed by the incident.\n\n"
            "Additional Guidelines:\n"
            "Present your analysis with precision and confidence; prioritize actionable insights over abstract theory.\n"
            "When uncertain, clearly state your confidence level and specify any additional information required to enhance the diagnosis.\n"
            "Use clear, professional language accessible to both technical experts and executive stakeholders.\n\n"
            f"Language: {language}\n\n{content}"
        )

        analysis_result = await analyze_with_provider(detailed_prompt, model=model_name, timeout=timeout)
        
        end_time = datetime.now()
        processing_time = (end_time - start_time).total_seconds()
        
        timestamp = datetime.utcnow().isoformat() + "Z"
        
        result = FullAnalysisResult(
            crash_resolution_report=analysis_result,
            diagnostic_overview_report=analysis_result,
            timestamp=timestamp
        )
        
        # Record analytics
        record_analysis_data(result, model_name, processing_time)
        
        return result

    except Exception as e:
        logger.error(f"Error generating advanced analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating analysis: {str(e)}")

@app.get("/models")
async def list_models():
    """List all available models in Ollama"""
    try:
        models = []
        
        # Get Ollama models
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
                response.raise_for_status()
                ollama_response = response.json()
                models = ollama_response
        except Exception as e:
            logger.error(f"Failed to list Ollama models: {str(e)}")
            models = {"models": []}
            
        return models
    except Exception as e:
        logger.error(f"Failed to list models: {str(e)}")
        raise HTTPException(status_code=503, detail=f"Cannot retrieve model list: {str(e)}")

print("🚀 Importing analyze_contextual...")
from routes import analyze_contextual

# Import the model routes module
from routes.model_routes import register_model_routes

# Register the model-related endpoints
register_model_routes(app)

# Log confirmation
logger.info("Registered model routes for enhanced Ollama integration")