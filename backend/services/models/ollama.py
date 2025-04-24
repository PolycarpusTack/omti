"""
Ollama Integration Service - Enterprise Edition

A robust, high-performance interface for interacting with Ollama LLM services
with enterprise-grade reliability, observability, and scalability features.

Features:
- Comprehensive error handling with custom exception hierarchy
- Sophisticated retry mechanisms with exponential backoff
- Intelligent model caching and validation
- Token-bucket rate limiting
- Detailed metrics and logging with performance analysis
- Health monitoring with automated recovery
- Connection pooling and HTTP/2 support
- Memory and performance optimizations
- Streaming support with proper backpressure
- Structured logging and tracing integration

Usage:
    async with OllamaModelService(model_name="llama3", base_url="http://ollama-host:11434") as service:
        # Simple completion
        response = await service.analyze("Explain quantum computing")
        
        # Streaming response
        async for chunk in service.analyze_stream("Write a story about robots"):
            print(chunk, end="", flush=True)
            
        # Advanced chat completion
        chat_response = await service.create_chat_completion([
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "What is the capital of France?"}
        ])
"""

from typing import Dict, Any, Optional, List, Union, Tuple, Callable, AsyncGenerator
import httpx
import asyncio
import time
import json
import logging
import traceback
import os
import uuid
import platform
import socket
import sys
from datetime import datetime, timedelta
from functools import wraps
from contextlib import asynccontextmanager

__version__ = "2.0.0"

# Configure structured logging
logger = logging.getLogger(__name__)

# Create a more detailed formatter for enterprise environments
formatter = logging.Formatter(
    '%(asctime)s [%(levelname)s] [%(name)s:%(lineno)d] '
    '%(message)s [trace_id=%(trace_id)s]'
)

# Set up handler if not already configured
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)

# Add trace ID to all log records
class TraceIDFilter(logging.Filter):
    def filter(self, record):
        if not hasattr(record, 'trace_id'):
            record.trace_id = getattr(asyncio.current_task(), 'trace_id', 'untraced')
        return True
        
logger.addFilter(TraceIDFilter())

# Global constants
DEFAULT_BASE_URL = "http://localhost:11434"
DEFAULT_TIMEOUT = 60.0
DEFAULT_RETRY_COUNT = 3
DEFAULT_CACHE_TTL = 300  # 5 minutes
MAX_CONSECUTIVE_ERRORS = 5
HEALTH_CHECK_INTERVAL = 60  # 1 minute
DEFAULT_USER_AGENT = f"OllamaModelService/{__version__} (Python/{platform.python_version()}; {platform.system()}/{platform.release()})"

# Custom exception hierarchy for better error handling
class OllamaServiceError(Exception):
    """Base exception for all Ollama service errors"""
    code = "ollama_error"
    retryable = False
    
    def __init__(self, message, status_code=None, response=None):
        super().__init__(message)
        self.status_code = status_code
        self.response = response
        self.timestamp = datetime.now()

class OllamaConnectionError(OllamaServiceError):
    """Raised when connection to Ollama service fails"""
    code = "connection_error"
    retryable = True

class OllamaModelNotFoundError(OllamaServiceError):
    """Raised when requested model is not available"""
    code = "model_not_found"
    retryable = False

class OllamaResponseError(OllamaServiceError):
    """Raised when Ollama returns an unexpected response"""
    code = "response_error"
    retryable = False

class OllamaTimeoutError(OllamaServiceError):
    """Raised when an Ollama request times out"""
    code = "timeout_error"
    retryable = True

class OllamaRateLimitError(OllamaServiceError):
    """Raised when rate limits are hit"""
    code = "rate_limit_error"
    retryable = True

class OllamaServerError(OllamaServiceError):
    """Raised for server-side errors (5XX)"""
    code = "server_error"
    retryable = True

class OllamaAuthenticationError(OllamaServiceError):
    """Raised for authentication failures"""
    code = "authentication_error"
    retryable = False

class MetricsCollector:
    """Collect and report performance metrics for Ollama service"""
    
    def __init__(self):
        self.request_count = 0
        self.error_count = 0
        self.total_latency = 0
        self.total_tokens_in = 0
        self.total_tokens_out = 0
        self.requests_by_model = {}
        self.errors_by_type = {}
        self.last_reset = datetime.now()
        self._lock = asyncio.Lock()
        
    async def record_request(self, model: str, latency: float, 
                            tokens_in: int = 0, tokens_out: int = 0, 
                            error: Exception = None):
        """Record metrics for a request"""
        async with self._lock:
            self.request_count += 1
            
            # Track per-model metrics
            if model not in self.requests_by_model:
                self.requests_by_model[model] = {
                    'count': 0, 
                    'latency': 0,
                    'tokens_in': 0,
                    'tokens_out': 0,
                    'errors': 0
                }
            
            self.requests_by_model[model]['count'] += 1
            
            # Record success metrics
            if error is None:
                self.total_latency += latency
                self.total_tokens_in += tokens_in
                self.total_tokens_out += tokens_out
                
                self.requests_by_model[model]['latency'] += latency
                self.requests_by_model[model]['tokens_in'] += tokens_in
                self.requests_by_model[model]['tokens_out'] += tokens_out
            else:
                # Record error metrics
                self.error_count += 1
                self.requests_by_model[model]['errors'] += 1
                
                error_type = type(error).__name__
                if error_type not in self.errors_by_type:
                    self.errors_by_type[error_type] = 0
                self.errors_by_type[error_type] += 1
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get current metrics"""
        success_count = self.request_count - self.error_count
        success_rate = (success_count / self.request_count * 100) if self.request_count > 0 else 0
        avg_latency = (self.total_latency / success_count) if success_count > 0 else 0
        
        # Calculate per-model stats
        model_stats = {}
        for model, stats in self.requests_by_model.items():
            success_count = stats['count'] - stats['errors']
            avg_model_latency = stats['latency'] / success_count if success_count > 0 else 0
            
            model_stats[model] = {
                'requests': stats['count'],
                'success_rate': (success_count / stats['count'] * 100) if stats['count'] > 0 else 0,
                'avg_latency': avg_model_latency,
                'tokens_in': stats['tokens_in'],
                'tokens_out': stats['tokens_out'],
            }
        
        return {
            'total_requests': self.request_count,
            'error_count': self.error_count,
            'success_rate': success_rate,
            'avg_latency': avg_latency,
            'total_tokens_in': self.total_tokens_in,
            'total_tokens_out': self.total_tokens_out,
            'models': model_stats,
            'errors': self.errors_by_type,
            'since': self.last_reset.isoformat()
        }
        
    def reset(self):
        """Reset all metrics"""
        self.request_count = 0
        self.error_count = 0
        self.total_latency = 0
        self.total_tokens_in = 0
        self.total_tokens_out = 0
        self.requests_by_model = {}
        self.errors_by_type = {}
        self.last_reset = datetime.now()


def retry_on_connection_error(max_tries=3, initial_wait=1, backoff_factor=2):
    """Decorator to retry functions on connection errors with exponential backoff"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Get trace ID for this task or create one
            current_task = asyncio.current_task()
            if not hasattr(current_task, 'trace_id'):
                current_task.trace_id = str(uuid.uuid4())
            
            retries = 0
            wait_time = initial_wait
            last_exception = None
            
            while True:
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    # Only retry on specific exceptions
                    if not (isinstance(e, (httpx.ConnectError, httpx.ReadTimeout, 
                                         OllamaConnectionError, OllamaTimeoutError, 
                                         OllamaRateLimitError, OllamaServerError)) or 
                           (hasattr(e, 'retryable') and e.retryable)):
                        raise
                    
                    retries += 1
                    last_exception = e
                    
                    if retries >= max_tries:
                        logger.error(
                            f"Max retries ({max_tries}) exceeded. "
                            f"Last error: {str(e)}",
                            extra={'trace_id': current_task.trace_id}
                        )
                        raise
                    
                    # Calculate jitter to avoid thundering herd problems
                    jitter = (0.5 + (asyncio.get_event_loop().time() % 1)) / 2
                    actual_wait = wait_time * (0.5 + jitter)
                    
                    logger.warning(
                        f"Retryable error (attempt {retries}/{max_tries}), "
                        f"retrying in {actual_wait:.2f}s: {str(e)}",
                        extra={'trace_id': current_task.trace_id}
                    )
                    
                    await asyncio.sleep(actual_wait)
                    wait_time *= backoff_factor
                    
        return wrapper
    return decorator


class CircuitBreaker:
    """Circuit breaker pattern implementation to prevent repeated failures"""
    
    # States
    CLOSED = 'closed'     # Normal operation
    OPEN = 'open'         # Failing, no requests allowed
    HALF_OPEN = 'half_open'  # Testing if system recovered
    
    def __init__(self, failure_threshold=5, recovery_timeout=30, name="default"):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.state = self.CLOSED
        self.failure_count = 0
        self.last_failure_time = None
        self.name = name
        self._lock = asyncio.Lock()
    
    async def __call__(self, func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            await self.before_request()
            
            try:
                result = await func(*args, **kwargs)
                await self.on_success()
                return result
            except Exception as e:
                await self.on_failure(e)
                raise
                
        return wrapper
    
    async def before_request(self):
        """Check circuit state before making a request"""
        async with self._lock:
            now = time.time()
            
            if self.state == self.OPEN:
                if self.last_failure_time is None or (now - self.last_failure_time) > self.recovery_timeout:
                    logger.info(f"Circuit breaker '{self.name}' changing from OPEN to HALF_OPEN")
                    self.state = self.HALF_OPEN
                else:
                    raise OllamaServiceError(
                        f"Circuit breaker '{self.name}' is OPEN. "
                        f"Retry after {self.recovery_timeout - (now - self.last_failure_time):.1f}s"
                    )
    
    async def on_success(self):
        """Handle successful request"""
        async with self._lock:
            if self.state == self.HALF_OPEN:
                self.state = self.CLOSED
                self.failure_count = 0
                logger.info(f"Circuit breaker '{self.name}' reset to CLOSED after success")
            elif self.state == self.CLOSED:
                self.failure_count = 0
    
    async def on_failure(self, exception):
        """Handle failed request"""
        async with self._lock:
            self.last_failure_time = time.time()
            
            if self.state == self.HALF_OPEN:
                self.state = self.OPEN
                logger.warning(
                    f"Circuit breaker '{self.name}' back to OPEN after test request failed: {str(exception)}"
                )
            elif self.state == self.CLOSED:
                self.failure_count += 1
                if self.failure_count >= self.failure_threshold:
                    self.state = self.OPEN
                    logger.warning(
                        f"Circuit breaker '{self.name}' changed to OPEN after {self.failure_count} failures"
                    )


class ModelCacheManager:
    """Manages caching of model information with LRU eviction policy"""
    
    def __init__(self, cache_ttl: int = DEFAULT_CACHE_TTL, max_size: int = 100):
        self.models_cache = {}
        self.model_info_cache = {}
        self.last_refresh = None
        self.cache_ttl = cache_ttl
        self.max_size = max_size
        self._lock = asyncio.Lock()
        self.access_order = []  # For LRU tracking
        
        # Cache statistics
        self.hits = 0
        self.misses = 0
        self.evictions = 0
        
    async def get_models(self, fetch_func: Callable) -> List[Dict[str, Any]]:
        """Get models, either from cache or by calling the fetch function"""
        async with self._lock:
            current_time = datetime.now()
            cache_expired = (
                self.last_refresh is None or
                (current_time - self.last_refresh).total_seconds() > self.cache_ttl
            )
            
            if cache_expired:
                try:
                    self.models_cache = await fetch_func()
                    self.last_refresh = current_time
                    logger.debug(f"Models cache refreshed, found {len(self.models_cache)} models")
                    self.misses += 1
                except Exception as e:
                    logger.error(f"Error refreshing models cache: {str(e)}")
                    if not self.models_cache:
                        # Only re-raise if we don't have a previous cache to fall back to
                        raise
                    self.hits += 1  # Count as hit when using stale cache
            else:
                self.hits += 1
                        
            return self.models_cache
    
    async def get_model_info(self, model_name: str, fetch_func: Callable) -> Dict[str, Any]:
        """Get model information from cache or fetch it"""
        async with self._lock:
            # Update LRU tracking
            if model_name in self.access_order:
                self.access_order.remove(model_name)
            self.access_order.append(model_name)
            
            current_time = datetime.now()
            
            # Check if we have cached info and it's still valid
            if (model_name in self.model_info_cache and 
                (current_time - self.model_info_cache[model_name]['timestamp']).total_seconds() < self.cache_ttl):
                self.hits += 1
                return self.model_info_cache[model_name]['data']
            
            # Need to fetch the data
            self.misses += 1
            try:
                model_info = await fetch_func(model_name)
                
                # Cache the result
                self.model_info_cache[model_name] = {
                    'data': model_info,
                    'timestamp': current_time
                }
                
                # Enforce cache size limit with LRU eviction
                if len(self.model_info_cache) > self.max_size:
                    oldest = self.access_order.pop(0)
                    if oldest in self.model_info_cache:
                        del self.model_info_cache[oldest]
                        self.evictions += 1
                
                return model_info
            except Exception as e:
                logger.error(f"Error fetching model info for {model_name}: {str(e)}")
                # If we have stale data, return it rather than failing
                if model_name in self.model_info_cache:
                    logger.warning(f"Returning stale cache data for {model_name}")
                    return self.model_info_cache[model_name]['data']
                raise
            
    def clear_cache(self):
        """Clear the cache manually"""
        self.models_cache = {}
        self.model_info_cache = {}
        self.last_refresh = None
        self.access_order = []
        logger.debug("Cache cleared")
        
    def is_model_in_cache(self, model_name: str) -> bool:
        """Check if a specific model exists in the cache"""
        if not self.models_cache:
            return False
            
        for model in self.models_cache:
            if model["name"] == model_name:
                return True
        return False
    
    def invalidate_model(self, model_name: str):
        """Invalidate cache for a specific model"""
        if model_name in self.model_info_cache:
            del self.model_info_cache[model_name]
            if model_name in self.access_order:
                self.access_order.remove(model_name)
            logger.debug(f"Cache invalidated for model {model_name}")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        total_requests = self.hits + self.misses
        hit_rate = (self.hits / total_requests * 100) if total_requests > 0 else 0
        
        return {
            'size': len(self.model_info_cache),
            'max_size': self.max_size,
            'hits': self.hits,
            'misses': self.misses,
            'hit_rate': hit_rate,
            'evictions': self.evictions,
            'last_refresh': self.last_refresh.isoformat() if self.last_refresh else None
        }
    
    def get_cache_status(self) -> str:
        """Get cache status summary"""
        if not self.models_cache:
            return "empty"
        return f"{len(self.model_info_cache)}/{self.max_size} (hit rate: {self.get_stats()['hit_rate']:.1f}%)"


class RateLimiter:
    """Token bucket rate limiting for API calls with burst capability"""
    
    def __init__(self, max_calls: int = 20, period: int = 60, burst_factor: float = 1.5):
        self.max_calls = max_calls  # Maximum calls in the period
        self.period = period  # Period in seconds
        self.tokens = max_calls  # Start with full bucket
        self.burst_capacity = int(max_calls * burst_factor)  # Maximum tokens during burst
        self.last_refresh = time.monotonic()
        self._lock = asyncio.Lock()
        
        # Tracking stats
        self.total_acquired = 0
        self.total_waited = 0
        self.total_wait_time = 0
        self.max_wait_time = 0
        
    async def acquire(self, tokens: int = 1):
        """Acquire permission to make API calls, waiting if necessary
        
        Args:
            tokens: Number of tokens to acquire (for large batch operations)
        """
        if tokens <= 0:
            raise ValueError("Must request a positive number of tokens")
            
        start_time = time.monotonic()
        
        async with self._lock:
            current_time = time.monotonic()
            time_passed = current_time - self.last_refresh
            
            # Refill tokens based on time passed
            if time_passed > 0:
                new_tokens = time_passed * (self.max_calls / self.period)
                self.tokens = min(self.burst_capacity, self.tokens + new_tokens)
                self.last_refresh = current_time
            
            if self.tokens >= tokens:
                # We have enough tokens, proceed
                self.tokens -= tokens
                self.total_acquired += 1
                return
            
            # Calculate wait time to get enough tokens
            needed_tokens = tokens - self.tokens
            wait_time = needed_tokens * (self.period / self.max_calls)
            
            # Apply a small jitter to avoid thundering herd
            jitter = 0.1 * wait_time * (0.5 - (asyncio.get_event_loop().time() % 1))
            wait_time = max(0.01, wait_time + jitter)  # Ensure positive wait time
            
            logger.warning(f"Rate limit reached, waiting {wait_time:.2f}s before next call")
            
            # Update stats
            self.total_waited += 1
            self.total_wait_time += wait_time
            self.max_wait_time = max(self.max_wait_time, wait_time)
            
            # Release the lock while waiting
            self._lock.release()
            try:
                await asyncio.sleep(wait_time)
            finally:
                # Re-acquire the lock
                await self._lock.acquire()
            
            # After waiting, we should have enough tokens
            self.tokens = self.max_calls  # Refill
            self.tokens -= tokens  # Use requested tokens
            self.total_acquired += 1
            self.last_refresh = time.monotonic()
            
    def get_stats(self) -> Dict[str, Any]:
        """Get rate limiter statistics"""
        return {
            'total_requests': self.total_acquired,
            'waited_requests': self.total_waited,
            'wait_rate': (self.total_waited / self.total_acquired * 100) if self.total_acquired > 0 else 0,
            'avg_wait_time': (self.total_wait_time / self.total_waited) if self.total_waited > 0 else 0,
            'max_wait_time': self.max_wait_time,
            'current_tokens': self.tokens,
            'max_calls_per_period': self.max_calls,
            'period_seconds': self.period
        }


class HealthCheckResponse:
    """Structured health check response"""
    
    def __init__(
        self, 
        status: str, 
        model_loaded: bool, 
        models_available: int, 
        cache_status: str,
        api_latency: float,
        uptime: float,
        version: str
    ):
        self.status = status
        self.model_loaded = model_loaded
        self.models_available = models_available
        self.cache_status = cache_status
        self.api_latency = api_latency
        self.uptime = uptime
        self.version = version
        self.timestamp = datetime.now()
        
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation"""
        return {
            "status": self.status,
            "model_loaded": self.model_loaded,
            "models_available": self.models_available,
            "cache_status": self.cache_status,
            "api_latency_ms": round(self.api_latency * 1000, 2),
            "uptime_seconds": round(self.uptime, 1),
            "version": self.version,
            "timestamp": self.timestamp.isoformat()
        }


class OllamaModelService:
    """Enterprise-grade service for interacting with Ollama models.
    
    Features:
    - Comprehensive error handling with custom exception hierarchy
    - Sophisticated retry mechanisms with exponential backoff
    - Model caching and validation with LRU eviction
    - Token-bucket rate limiting with burst capacity
    - Health monitoring with automated recovery
    - Detailed metrics collection and reporting
    - Circuit breaker pattern to prevent cascading failures
    - Connection pooling and HTTP/2 support
    - Memory and performance optimizations
    """
    
    # Default context windows for common Ollama models
    DEFAULT_CONTEXT_WINDOWS = {
        "mistral": 8192,
        "llama2": 4096,
        "llama3": 8192,
        "codellama": 16384,
        "deepcoder": 4096,
        "neural-chat": 4096,
        "phi": 2048,
        "mixtral": 32768,
        "orca": 4096,
        "vicuna": 2048,
        "wizard": 4096,
        "stablelm": 4096,
        "falcon": 2048,
        "gemma": 8192,
        "openchat": 8192,
        "qwen": 32768,
        "yi": 4096
    }
    
    # Default settings for different model types
    DEFAULT_SETTINGS = {
        "mistral": {
            "temperature": 0.7,
            "top_p": 0.9,
            "max_tokens": 4096,
            "timeout": 120.0,
            "repeat_penalty": 1.1
        },
        "llama2": {
            "temperature": 0.7,
            "top_p": 0.95,
            "max_tokens": 2048,
            "timeout": 120.0,
            "repeat_penalty": 1.1
        },
        "llama3": {
            "temperature": 0.6,
            "top_p": 0.9,
            "max_tokens": 4096,
            "timeout": 120.0,
            "repeat_penalty": 1.05
        },
        "codellama": {
            "temperature": 0.2,
            "top_p": 0.95,
            "max_tokens": 4096,
            "timeout": 180.0,
            "repeat_penalty": 1.2
        },
        "deepcoder": {
            "temperature": 0.1,
            "top_p": 0.95,
            "max_tokens": 2048,
            "timeout": 240.0,
            "repeat_penalty": 1.3
        },
        "mixtral": {
            "temperature": 0.7,
            "top_p": 0.9,
            "max_tokens": 8192,
            "timeout": 240.0,
            "repeat_penalty": 1.1
        },
        "gemma": {
            "temperature": 0.7,
            "top_p": 0.9,
            "max_tokens": 4096,
            "timeout": 120.0,
            "repeat_penalty": 1.1
        },
        "default": {
            "temperature": 0.7,
            "top_p": 0.9,
            "max_tokens": 2048,
            "timeout": 120.0,
            "repeat_penalty": 1.1,
            "frequency_penalty": 0.0,
            "presence_penalty": 0.0
        }
    }
    
    def __init__(
        self, 
        model_name: str,
        base_url: str = DEFAULT_BASE_URL, 
        timeout: float = DEFAULT_TIMEOUT,
        max_retries: int = DEFAULT_RETRY_COUNT,
        cache_ttl: int = DEFAULT_CACHE_TTL,
        cache_max_size: int = 100,
        rate_limit_calls: int = 20,
        rate_limit_period: int = 60,
        connection_pool_limits: int = 10,
        health_check_interval: int = HEALTH_CHECK_INTERVAL,
        verbose_logging: bool = False,
        http2: bool = True,
        api_key: Optional[str] = None,
        circuit_breaker_threshold: int = MAX_CONSECUTIVE_ERRORS,
        circuit_breaker_recovery: int = 30,
        metrics_enabled: bool = True
    ):
        """Initialize the Ollama model service
        
        Args:
            model_name: Name of the model to use
            base_url: Base URL for the Ollama API
            timeout: Default timeout for requests in seconds
            max_retries: Maximum number of retries for failed requests
            cache_ttl: How long to cache model information (seconds)
            cache_max_size: Maximum number of items in the cache
            rate_limit_calls: Maximum API calls in the rate limit period
            rate_limit_period: Rate limit period in seconds
            connection_pool_limits: Maximum concurrent connections
            health_check_interval: Interval for health checks in seconds
            verbose_logging: Enable more detailed logging
            http2: Enable HTTP/2 support
            api_key: API key for authentication, if required
            circuit_breaker_threshold: Failures before circuit breaker trips
            circuit_breaker_recovery: Seconds before testing recovery
            metrics_enabled: Enable detailed performance metrics
        """
        # Generate a trace ID for this service instance
        self.instance_id = str(uuid.uuid4())
        
        # Set up task context for logging
        current_task = asyncio.current_task()
        if current_task:
            current_task.trace_id = self.instance_id
            
        # Store configuration
        self.base_url = base_url.rstrip('/')
        self.model_name = model_name
        self.default_timeout = timeout
        self.max_retries = max_retries
        self.api_key = api_key
        
        # Set up detailed logging if requested
        if verbose_logging:
            logger.setLevel(logging.DEBUG)
            logger.debug(f"Verbose logging enabled for OllamaModelService")
        
        # Track initialization time for uptime calculation
        self.start_time = time.time()
        
        # Configure default headers
        self.default_headers = {
            "User-Agent": DEFAULT_USER_AGENT,
            "Accept": "application/json"
        }
        
        # Add API key if provided
        if api_key:
            self.default_headers["Authorization"] = f"Bearer {api_key}"
        
        # Create transport with proper connection pool limits
        limits = httpx.Limits(
            max_connections=connection_pool_limits,
            max_keepalive_connections=connection_pool_limits // 2
        )
        
        # Configure timeouts
        timeouts = httpx.Timeout(
            connect=min(10.0, timeout / 3),  # Connect timeout
            read=timeout,                    # Read timeout
            write=timeout,                   # Write timeout
            pool=60.0                        # Connection pool timeout
        )
        
        # Use httpx AsyncClient for async operations
        self.client = httpx.AsyncClient(
            timeout=timeouts,
            limits=limits,
            follow_redirects=True,
            http2=http2,
            headers=self.default_headers
        )
        
        # Set up enhanced caching
        self.cache_manager = ModelCacheManager(
            cache_ttl=cache_ttl,
            max_size=cache_max_size
        )
        
        # Set up token bucket rate limiting
        self.rate_limiter = RateLimiter(
            max_calls=rate_limit_calls,
            period=rate_limit_period,
            burst_factor=1.5  # Allow 50% burst capacity
        )
        
        # Set up circuit breaker
        self.circuit_breaker = CircuitBreaker(
            failure_threshold=circuit_breaker_threshold,
            recovery_timeout=circuit_breaker_recovery,
            name=f"ollama-{model_name}"
        )
        
        # Set up metrics collector if enabled
        self.metrics_collector = MetricsCollector() if metrics_enabled else None
        self.metrics_enabled = metrics_enabled
        
        # Track service health
        self.healthy = False
        self.last_health_check = None
        self.health_check_interval = health_check_interval
        
        # Track model loading status
        self.model_loaded = False
        
        # Request tracking
        self.request_count = 0
        self.consecutive_errors = 0
        self.last_request_time = None
        
        # Track service version
        self.ollama_version = None
        
        logger.info(f"Initialized OllamaModelService for model '{model_name}' at {base_url}")
        
    async def __aenter__(self):
        """Async context manager entry"""
        # Perform initial health check on context manager entry
        try:
            await self.health_check()
        except Exception as e:
            logger.warning(f"Initial health check failed: {str(e)}")
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.close()
        
    async def close(self):
        """Close the HTTP client and clean up resources"""
        if self.client:
            await self.client.aclose()
            logger.debug("Closed Ollama client connection")
            
    @asynccontextmanager
    async def _handle_request_errors(self, operation: str):
        """Context manager for handling request errors consistently"""
        current_task = asyncio.current_task()
        trace_id = getattr(current_task, 'trace_id', self.instance_id)
        
        try:
            start_time = time.time()
            yield
            # Reset consecutive errors on success
            self.consecutive_errors = 0
            
        except httpx.ConnectError as e:
            self.consecutive_errors += 1
            error_msg = f"Connection error during {operation}: {str(e)}"
            logger.error(error_msg, extra={'trace_id': trace_id})
            raise OllamaConnectionError(error_msg) from e
            
        except httpx.ReadTimeout as e:
            self.consecutive_errors += 1
            error_msg = f"Timeout during {operation}: {str(e)}"
            logger.error(error_msg, extra={'trace_id': trace_id})
            raise OllamaTimeoutError(error_msg) from e
            
        except httpx.HTTPStatusError as e:
            self.consecutive_errors += 1
            status_code = e.response.status_code
            error_msg = f"HTTP error during {operation}: {status_code} - {e.response.text}"
            
            # Map status codes to specific exceptions
            if status_code == 401 or status_code == 403:
                logger.error(f"Authentication error: {error_msg}", extra={'trace_id': trace_id})
                raise OllamaAuthenticationError(f"Authentication failed during {operation}", 
                                               status_code=status_code, 
                                               response=e.response) from e
                                               
            elif status_code == 404:
                if 'model' in operation.lower():
                    # Likely a model not found error
                    logger.error(f"Model not found: {self.model_name}", extra={'trace_id': trace_id})
                    raise OllamaModelNotFoundError(f"Model '{self.model_name}' not found", 
                                                 status_code=status_code,
                                                 response=e.response) from e
                else:
                    logger.error(f"API endpoint not found: {error_msg}", extra={'trace_id': trace_id})
                    raise OllamaResponseError(error_msg, 
                                            status_code=status_code,
                                            response=e.response) from e
                                            
            elif status_code == 429:
                logger.error(f"Rate limit exceeded: {error_msg}", extra={'trace_id': trace_id})
                raise OllamaRateLimitError(f"Rate limit exceeded during {operation}", 
                                         status_code=status_code,
                                         response=e.response) from e
                                         
            elif 500 <= status_code < 600:
                logger.error(f"Server error: {error_msg}", extra={'trace_id': trace_id})
                raise OllamaServerError(f"Ollama server error ({status_code}) during {operation}", 
                                      status_code=status_code,
                                      response=e.response) from e
                                      
            else:
                logger.error(error_msg, extra={'trace_id': trace_id})
                raise OllamaResponseError(error_msg, 
                                        status_code=status_code,
                                        response=e.response) from e
                                        
        except asyncio.TimeoutError as e:
            self.consecutive_errors += 1
            error_msg = f"Asyncio timeout during {operation}"
            logger.error(error_msg, extra={'trace_id': trace_id})
            raise OllamaTimeoutError(error_msg) from e
            
        except json.JSONDecodeError as e:
            self.consecutive_errors += 1
            error_msg = f"JSON parse error during {operation}: {str(e)}"
            logger.error(error_msg, extra={'trace_id': trace_id})
            raise OllamaResponseError(error_msg) from e
            
        except Exception as e:
            self.consecutive_errors += 1
            error_msg = f"Unexpected error during {operation}: {str(e)}"
            logger.error(f"{error_msg}\n{traceback.format_exc()}", extra={'trace_id': trace_id})
            
            # Check if it's one of our custom exceptions - if so, pass it through
            if isinstance(e, OllamaServiceError):
                raise
                
            # Otherwise wrap in our base exception
            raise OllamaServiceError(error_msg) from e
    
    @retry_on_connection_error(max_tries=3, initial_wait=1, backoff_factor=2)
    async def health_check(self, detailed: bool = False) -> Union[bool, HealthCheckResponse]:
        """Check if the Ollama service is healthy and the model is available
        
        Args:
            detailed: Return a detailed health check response object
            
        Returns:
            bool or HealthCheckResponse: Health status or detailed health check response
        """
        now = datetime.now()
        
        # Skip health check if we've done one recently
        if (self.last_health_check and 
            (now - self.last_health_check).total_seconds() < self.health_check_interval and
            self.healthy and
            not detailed):
            return self.healthy
            
        self.last_health_check = now
        api_latency = 0
        
        try:
            # First check if the API is responsive
            async with self._handle_request_errors("health check"):
                await self.rate_limiter.acquire()
                start_time = time.time()
                response = await self.client.get(
                    f"{self.base_url}/",
                    timeout=10.0  # Short timeout for health check
                )
                response.raise_for_status()
                api_latency = time.time() - start_time
                
                # Try to extract version information
                if not self.ollama_version and response.text:
                    try:
                        self.ollama_version = response.text.strip()
                    except:
                        pass
            
            # Then check if our model is available
            model_available = await self.validate()
            self.healthy = model_available
            
            if model_available:
                logger.debug(f"Health check passed: Ollama service is up and model '{self.model_name}' is available")
            else:
                logger.warning(f"Health check partial: Ollama service is up but model '{self.model_name}' is not available")
            
            # Reset consecutive errors counter on successful health check
            self.consecutive_errors = 0
            
            if detailed:
                models = await self.list_models()
                uptime = time.time() - self.start_time
                return HealthCheckResponse(
                    status="healthy" if self.healthy else "degraded",
                    model_loaded=self.model_loaded,
                    models_available=len(models),
                    cache_status=self.cache_manager.get_cache_status(),
                    api_latency=api_latency,
                    uptime=uptime,
                    version=self.ollama_version or "unknown"
                )
                
            return self.healthy
            
        except Exception as e:
            self.healthy = False
            logger.error(f"Health check failed: {str(e)}")
            
            # Increment consecutive errors
            self.consecutive_errors += 1
            
            if detailed:
                uptime = time.time() - self.start_time
                return HealthCheckResponse(
                    status="unhealthy",
                    model_loaded=False,
                    models_available=0,
                    cache_status="error",
                    api_latency=0.0,
                    uptime=uptime,
                    version=self.ollama_version or "unknown"
                )
                
            return False
    
    async def _fetch_models(self) -> List[Dict[str, Any]]:
        """Fetch available models from Ollama API"""
        async with self._handle_request_errors("fetch models"):
            await self.rate_limiter.acquire()
            response = await self.client.get(
                f"{self.base_url}/api/tags",
                timeout=self.default_timeout
            )
            response.raise_for_status()
            data = response.json()
            return data.get("models", [])
    
    @retry_on_connection_error(max_tries=2)
    async def list_models(self) -> List[Dict[str, Any]]:
        """List all available models with caching"""
        try:
            models = await self.cache_manager.get_models(self._fetch_models)
            logger.debug(f"Listed {len(models)} available models")
            return models
        except Exception as e:
            logger.error(f"Error listing models: {str(e)}")
            raise
    
    async def validate(self) -> bool:
        """Validate that the model is available and ready"""
        try:
            models = await self.list_models()
            is_available = any(model["name"] == self.model_name for model in models)
            
            if is_available:
                logger.debug(f"Model '{self.model_name}' is available")
                self.model_loaded = True
            else:
                logger.warning(f"Model '{self.model_name}' is not available")
                self.model_loaded = False
                
            return is_available
        except Exception as e:
            logger.error(f"Error validating model {self.model_name}: {str(e)}")
            self.model_loaded = False
            return False
            
    async def ensure_model_loaded(self, timeout: float = 300.0) -> bool:
        """Ensure the model is loaded, pulling it if necessary
        
        Args:
            timeout: Maximum time to wait for model to load in seconds
            
        Returns:
            bool: True if model is loaded successfully
        """
        # Check if model is already available
        if await self.validate():
            return True
            
        logger.info(f"Model '{self.model_name}' not loaded, attempting to pull")
        
        # Try to pull the model
        try:
            async with self._handle_request_errors(f"pull model {self.model_name}"):
                await self.rate_limiter.acquire(tokens=3)  # Higher token cost for pulling
                pull_start = time.time()
                
                # Start the pull request without waiting for it to complete
                response = await self.client.post(
                    f"{self.base_url}/api/pull",
                    json={"name": self.model_name},
                    timeout=60.0  # Just for initiating the pull
                )
                response.raise_for_status()
                
                logger.info(f"Pull request for model '{self.model_name}' initiated")
                
                # Poll for model availability
                start_time = time.time()
                check_interval = 5  # Start with 5 seconds
                
                while time.time() - start_time < timeout:
                    if await self.validate():
                        pull_duration = time.time() - pull_start
                        logger.info(f"Model '{self.model_name}' successfully loaded after {pull_duration:.1f}s")
                        # Clear the model cache to ensure we have fresh data
                        self.cache_manager.clear_cache()
                        return True
                        
                    logger.debug(f"Waiting for model '{self.model_name}' to load...")
                    
                    # Use exponential backoff for polling (5s, 10s, 15s, etc., up to 30s)
                    await asyncio.sleep(min(check_interval, 30))
                    check_interval = min(check_interval * 1.5, 30)
                    
                # If we get here, the model didn't load within the timeout
                logger.error(f"Timeout waiting for model '{self.model_name}' to load after {timeout}s")
                return False
                
        except Exception as e:
            logger.error(f"Error pulling model {self.model_name}: {str(e)}")
            return False
    
    async def get_context_window(self) -> int:
        """Get the context window size for this model"""
        # Try to get from defaults first based on model prefix
        for model_prefix, window in self.DEFAULT_CONTEXT_WINDOWS.items():
            if self.model_name.startswith(model_prefix):
                return window
                
        # If not found, query the model info
        try:
            model_info = await self.get_model_info()
            if model_info and "parameters" in model_info:
                context_window = model_info.get("parameters", {}).get("context_length")
                if context_window:
                    return int(context_window)
        except Exception as e:
            logger.warning(f"Could not get context window from model info: {str(e)}")
            
        # Fallback to a safe default
        logger.info(f"Using default context window (4096) for model '{self.model_name}'")
        return 4096
        
    async def get_model_settings(self) -> Dict[str, Any]:
        """Get the default settings for this model"""
        # Try to get model-specific settings based on prefix
        for model_prefix, settings in self.DEFAULT_SETTINGS.items():
            if self.model_name.startswith(model_prefix):
                return settings.copy()  # Return a copy to avoid modifying defaults
                
        # Fallback to default settings
        return self.DEFAULT_SETTINGS["default"].copy()
    
    async def _fetch_model_info(self, model_name: str) -> Dict[str, Any]:
        """Fetch model information from the API"""
        async with self._handle_request_errors(f"get model info for {model_name}"):
            await self.rate_limiter.acquire()
            response = await self.client.post(
                f"{self.base_url}/api/show",
                json={"name": model_name},
                timeout=self.default_timeout
            )
            response.raise_for_status()
            return response.json()
            
    @retry_on_connection_error(max_tries=2)
    async def get_model_info(self) -> Dict[str, Any]:
        """Get detailed information about the current model with caching"""
        try:
            fetch_func = lambda model_name: self._fetch_model_info(model_name)
            model_info = await self.cache_manager.get_model_info(self.model_name, 
                                                                lambda: fetch_func(self.model_name))
            return model_info
        except Exception as e:
            logger.error(f"Error getting model info for {self.model_name}: {str(e)}")
            raise
    
    # Core functionality methods
    @retry_on_connection_error(max_tries=2)
    async def analyze(self, prompt: str, **kwargs) -> str:
        """Analyze the given prompt using the Ollama model
        
        Args:
            prompt: The text prompt to analyze
            **kwargs: Additional parameters to override defaults
                - temperature: Sampling temperature (0.0 to 1.0)
                - top_p: Nucleus sampling parameter
                - max_tokens: Maximum tokens to generate
                - stop: List of strings that stop generation when encountered
                - repeat_penalty: Penalty for repeated tokens
                - presence_penalty: Penalty for token presence
                - frequency_penalty: Penalty for token frequency
                - timeout: Request timeout in seconds
                
        Returns:
            str: The model's response text
            
        Raises:
            OllamaConnectionError: When connection to Ollama fails
            OllamaModelNotFoundError: When the model is not found
            OllamaResponseError: When Ollama returns an unexpected response
            OllamaTimeoutError: When the request times out
            OllamaServiceError: For other Ollama service errors
        """
        if not prompt or not isinstance(prompt, str):
            raise ValueError("Prompt must be a non-empty string")
            
        # Ensure the Ollama service is healthy before proceeding
        if not await self.health_check():
            raise OllamaConnectionError("Ollama service is not healthy")
            
        # Get default settings for the model
        settings = await self.get_model_settings()
        
        # Prepare request parameters, allowing kwargs to override defaults
        request_params = {
            "model": self.model_name,
            "prompt": prompt,
            "stream": False,
            "temperature": kwargs.get("temperature", settings["temperature"]),
            "top_p": kwargs.get("top_p", settings["top_p"]),
            "num_predict": kwargs.get("max_tokens", settings["max_tokens"]),
            "repeat_penalty": kwargs.get("repeat_penalty", settings.get("repeat_penalty", 1.1)),
        }
        
        # Add optional parameters if provided
        if "stop" in kwargs:
            request_params["stop"] = kwargs["stop"]
            
        if "presence_penalty" in kwargs:
            request_params["presence_penalty"] = kwargs["presence_penalty"]
            
        if "frequency_penalty" in kwargs:
            request_params["frequency_penalty"] = kwargs["frequency_penalty"]
            
        # Set request timeout
        timeout = kwargs.get("timeout", settings["timeout"])
        
        # Log the request (exclude prompt for brevity)
        log_params = {k: v for k, v in request_params.items() if k != "prompt"}
        logger.debug(f"Sending request to {self.model_name} with params: {log_params}")
        
        # Generate request ID
        self.request_count += 1
        request_id = f"req-{int(time.time())}-{self.request_count}"
        current_task = asyncio.current_task()
        if current_task:
            current_task.trace_id = request_id
        
        start_time = time.time()
        
        try:
            # Apply circuit breaker pattern
            circuit_breaker_wrapper = await self.circuit_breaker(
                lambda: self._execute_analyze_request(request_params, timeout)
            )
            
            result = await circuit_breaker_wrapper()
            
            # Calculate and log performance metrics
            elapsed = time.time() - start_time
            prompt_tokens = result.get("prompt_tokens", 0)
            completion_tokens = result.get("completion_tokens", 0)
            total_tokens = prompt_tokens + completion_tokens
            
            # Record metrics if enabled
            if self.metrics_enabled:
                await self.metrics_collector.record_request(
                    model=self.model_name,
                    latency=elapsed,
                    tokens_in=prompt_tokens,
                    tokens_out=completion_tokens
                )
            
            logger.info(
                f"Analysis complete: {elapsed:.2f}s, {prompt_tokens} prompt tokens, "
                f"{completion_tokens} completion tokens, {total_tokens} total tokens"
            )
            
            # Return the response text
            return result.get("response", "")
                
        except Exception as e:
            if self.metrics_enabled:
                await self.metrics_collector.record_request(
                    model=self.model_name,
                    latency=time.time() - start_time,
                    error=e
                )
            
            logger.error(f"Error during analysis with {self.model_name}: {str(e)}")
            raise
            
    async def _execute_analyze_request(self, request_params, timeout):
        """Execute the actual analyze request to Ollama API"""
        async with self._handle_request_errors(f"analyze with {self.model_name}"):
            # Apply rate limiting
            await self.rate_limiter.acquire()
            
            # Send the request
            response = await self.client.post(
                f"{self.base_url}/api/generate",
                json=request_params,
                timeout=timeout
            )
            response.raise_for_status()
            return response.json()
    
    # Alias for analyze to maintain backward compatibility
    async def generate_response(self, prompt: str, **kwargs) -> str:
        """Alias for analyze method for backward compatibility"""
        return await self.analyze(prompt, **kwargs)
    
    @retry_on_connection_error(max_tries=2)
    async def analyze_stream(self, prompt: str, **kwargs) -> AsyncGenerator[str, None]:
        """Stream the response from the Ollama model
        
        Args:
            prompt: The text prompt to analyze
            **kwargs: Additional parameters (same as analyze method)
                
        Yields:
            str: Chunks of the generated text as they become available
        """
        if not prompt or not isinstance(prompt, str):
            raise ValueError("Prompt must be a non-empty string")
            
        # Ensure the Ollama service is healthy
        if not await self.health_check():
            raise OllamaConnectionError("Ollama service is not healthy")
            
        # Get default settings for the model
        settings = await self.get_model_settings()
        
        # Prepare request parameters
        request_params = {
            "model": self.model_name,
            "prompt": prompt,
            "stream": True,  # Enable streaming
            "temperature": kwargs.get("temperature", settings["temperature"]),
            "top_p": kwargs.get("top_p", settings["top_p"]),
            "num_predict": kwargs.get("max_tokens", settings["max_tokens"]),
            "repeat_penalty": kwargs.get("repeat_penalty", settings.get("repeat_penalty", 1.1)),
        }
        
        # Add optional parameters if provided
        if "stop" in kwargs:
            request_params["stop"] = kwargs["stop"]
            
        if "presence_penalty" in kwargs:
            request_params["presence_penalty"] = kwargs["presence_penalty"]
            
        if "frequency_penalty" in kwargs:
            request_params["frequency_penalty"] = kwargs["frequency_penalty"]
            
        # Set request timeout
        timeout = kwargs.get("timeout", settings["timeout"])
        
        # Log the request (exclude prompt for brevity)
        log_params = {k: v for k, v in request_params.items() if k != "prompt"}
        logger.debug(f"Sending streaming request to {self.model_name} with params: {log_params}")
        
        # Generate request ID for tracking
        self.request_count += 1
        request_id = f"stream-{int(time.time())}-{self.request_count}"
        current_task = asyncio.current_task()
        if current_task:
            current_task.trace_id = request_id
            
        logger.debug(f"Starting stream request {request_id}")
        
        start_time = time.time()
        total_chunks = 0
        prompt_tokens = 0
        completion_tokens = 0
        error = None
        
        try:
            # Apply circuit breaker pattern
            circuit_breaker_wrapper = await self.circuit_breaker(
                lambda: self._execute_stream_request(request_params, timeout, 
                                                   request_id, start_time)
            )
            
            async for chunk, meta in circuit_breaker_wrapper():
                total_chunks += 1
                # Update token counts
                if 'prompt_tokens' in meta and meta['prompt_tokens'] > prompt_tokens:
                    prompt_tokens = meta['prompt_tokens']
                if 'completion_tokens' in meta and meta['completion_tokens'] > completion_tokens:
                    completion_tokens = meta['completion_tokens']
                
                yield chunk
                
        except Exception as e:
            error = e
            logger.error(f"Error during streaming from {self.model_name}: {str(e)}")
            raise
        finally:
            # Log performance metrics
            elapsed = time.time() - start_time
            total_tokens = prompt_tokens + completion_tokens
            
            # Record metrics if enabled
            if self.metrics_enabled:
                await self.metrics_collector.record_request(
                    model=self.model_name,
                    latency=elapsed,
                    tokens_in=prompt_tokens,
                    tokens_out=completion_tokens,
                    error=error
                )
            
            if not error:  # Only log completion message if no error
                logger.info(
                    f"Stream complete: {elapsed:.2f}s, {prompt_tokens} prompt tokens, "
                    f"{completion_tokens} completion tokens, {total_tokens} total tokens, "
                    f"{total_chunks} chunks"
                )
                logger.debug(f"Completed stream request {request_id}")
    
    async def _execute_stream_request(self, request_params, timeout, request_id, start_time):
        """Execute streaming request and process results"""
        async with self._handle_request_errors(f"stream from {self.model_name}"):
            # Apply rate limiting
            await self.rate_limiter.acquire()
            
            # Send the request with streaming enabled
            async with self.client.stream(
                "POST",
                f"{self.base_url}/api/generate",
                json=request_params,
                timeout=timeout
            ) as response:
                response.raise_for_status()
                
                # Process the streaming response
                async for chunk in response.aiter_lines():
                    if not chunk:
                        continue
                        
                    try:
                        data = json.loads(chunk)
                        meta = {
                            'prompt_tokens': data.get('prompt_tokens', 0),
                            'completion_tokens': data.get('completion_tokens', 0),
                            'done': data.get('done', False)
                        }
                        
                        if "response" in data:
                            yield data["response"], meta
                            
                        # Handle end of stream
                        if data.get("done", False):
                            break
                            
                    except json.JSONDecodeError:
                        logger.warning(f"Could not parse streaming chunk: {chunk}")
                        continue
            
    # Alias for stream to maintain naming consistency
    async def generate_response_stream(self, prompt: str, **kwargs) -> AsyncGenerator[str, None]:
        """Alias for analyze_stream for naming consistency"""
        async for chunk in self.analyze_stream(prompt, **kwargs):
            yield chunk
    
    @retry_on_connection_error(max_tries=2)
    async def create_embedding(self, text: str, **kwargs) -> List[float]:
        """Create an embedding vector for the given text
        
        Args:
            text: The text to create an embedding for
            **kwargs: Additional parameters
                - model: Optional different model to use for embeddings
                - timeout: Request timeout in seconds
                
        Returns:
            List[float]: The embedding vector
        """
        if not text or not isinstance(text, str):
            raise ValueError("Text must be a non-empty string")
            
        # Use a specified embedding model or the current model
        model = kwargs.get("model", self.model_name)
        timeout = kwargs.get("timeout", self.default_timeout)
        
        logger.debug(f"Creating embedding for text of length {len(text)} with model {model}")
        start_time = time.time()
        
        try:
            # Apply circuit breaker
            circuit_breaker_wrapper = await self.circuit_breaker(
                lambda: self._execute_embedding_request(model, text, timeout)
            )
            
            embedding = await circuit_breaker_wrapper()
            
            # Record performance
            elapsed = time.time() - start_time
            if self.metrics_enabled:
                await self.metrics_collector.record_request(
                    model=model,
                    latency=elapsed,
                    tokens_in=len(text.split())  # Rough token count estimate
                )
                
            logger.debug(f"Created embedding with dimension {len(embedding)} in {elapsed:.2f}s")
            return embedding
                
        except Exception as e:
            if self.metrics_enabled:
                await self.metrics_collector.record_request(
                    model=model,
                    latency=time.time() - start_time,
                    error=e
                )
                
            logger.error(f"Error creating embedding with {model}: {str(e)}")
            raise
            
    async def _execute_embedding_request(self, model, text, timeout):
        """Execute the embedding request"""
        async with self._handle_request_errors(f"create embedding with {model}"):
            # Apply rate limiting
            await self.rate_limiter.acquire()
            
            # Send the request
            response = await self.client.post(
                f"{self.base_url}/api/embeddings",
                json={"model": model, "prompt": text},
                timeout=timeout
            )
            response.raise_for_status()
            result = response.json()
            
            # Return the embedding vector
            return result.get("embedding", [])
    
    async def get_tokenizer_encoding(self, text: str) -> List[int]:
        """Get the token encoding for the given text
        
        This is a helper method to understand how text is tokenized
        by the model. Useful for debugging and optimizing prompts.
        
        Args:
            text: Text to tokenize
            
        Returns:
            List[int]: Token IDs
        """
        if not text or not isinstance(text, str):
            raise ValueError("Text must be a non-empty string")
            
        logger.debug(f"Getting token encoding for text of length {len(text)}")
        
        # Use the analyze endpoint with a special flag to only get token info
        try:
            async with self._handle_request_errors("tokenize text"):
                # Apply rate limiting
                await self.rate_limiter.acquire()
                
                # Send a request with num_predict=0 to only get tokenization without generation
                response = await self.client.post(
                    f"{self.base_url}/api/generate",
                    json={
                        "model": self.model_name,
                        "prompt": text,
                        "raw": True,  # Request token IDs if supported
                        "num_predict": 0  # Don't generate any tokens
                    },
                    timeout=30.0  # Short timeout for tokenization
                )
                response.raise_for_status()
                result = response.json()
                
                # Extract token information if available
                tokens = result.get("tokens", [])
                if tokens:
                    logger.debug(f"Text tokenized into {len(tokens)} tokens")
                    return tokens
                else:
                    # Fallback: estimate tokens using simple heuristic
                    estimated_tokens = len(text.split()) * 1.3
                    logger.warning(
                        f"Token IDs not available from API, estimated {int(estimated_tokens)} tokens"
                    )
                    return []
                    
        except Exception as e:
            logger.error(f"Error tokenizing text: {str(e)}")
            raise
    
    async def count_tokens(self, text: str) -> int:
        """Count the number of tokens in the given text
        
        Args:
            text: Text to count tokens for
            
        Returns:
            int: Token count
        """
        try:
            tokens = await self.get_tokenizer_encoding(text)
            if tokens:
                return len(tokens)
                
            # Fallback to simple estimation
            return int(len(text.split()) * 1.3)
        except Exception as e:
            logger.warning(f"Error counting tokens: {str(e)}")
            # Very basic fallback estimate
            return int(len(text.split()) * 1.3)
    
    @retry_on_connection_error(max_tries=2)
    async def create_chat_completion(
        self, 
        messages: List[Dict[str, str]], 
        **kwargs
    ) -> Dict[str, Any]:
        """Create a chat completion using the Ollama model
        
        This method formats a list of chat messages into a prompt
        that works with Ollama's generate endpoint.
        
        Args:
            messages: List of message dictionaries with 'role' and 'content'
                Each message must have {'role': 'user'|'assistant'|'system', 'content': 'text'}
            **kwargs: Additional parameters (same as analyze method)
                
        Returns:
            Dict: Response containing the assistant's message
        """
        if not messages or not isinstance(messages, list):
            raise ValueError("Messages must be a non-empty list")
            
        # Format the chat messages into a prompt
        formatted_prompt = ""
        for msg in messages:
            role = msg.get("role", "").lower()
            content = msg.get("content", "")
            
            if role == "system":
                formatted_prompt += f"<s>\n{content}\n</s>\n\n"
            elif role == "user":
                formatted_prompt += f"<human>\n{content}\n</human>\n\n"
            elif role == "assistant":
                formatted_prompt += f"<assistant>\n{content}\n</assistant>\n\n"
            else:
                logger.warning(f"Unknown message role: {role}, ignoring message")
                
        # Add the final assistant prompt
        formatted_prompt += "<assistant>\n"
        
        logger.debug(f"Created chat prompt with {len(messages)} messages")
        
        # Generate the response
        response_text = await self.analyze(formatted_prompt, **kwargs)
        
        # Create a response in ChatGPT-like format
        chat_response = {
            "id": f"ollama-{int(time.time())}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": self.model_name,
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": response_text
                    },
                    "finish_reason": "stop"
                }
            ]
        }
        
        return chat_response
    
    async def create_chat_completion_stream(
        self, 
        messages: List[Dict[str, str]], 
        **kwargs
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Stream a chat completion using the Ollama model
        
        Args:
            messages: List of message dictionaries with 'role' and 'content'
            **kwargs: Additional parameters (same as analyze method)
                
        Yields:
            Dict: Stream response chunks in ChatGPT-compatible format
        """
        if not messages or not isinstance(messages, list):
            raise ValueError("Messages must be a non-empty list")
            
        # Format the chat messages into a prompt (same as non-streaming version)
        formatted_prompt = ""
        for msg in messages:
            role = msg.get("role", "").lower()
            content = msg.get("content", "")
            
            if role == "system":
                formatted_prompt += f"<s>\n{content}\n</s>\n\n"
            elif role == "user":
                formatted_prompt += f"<human>\n{content}\n</human>\n\n"
            elif role == "assistant":
                formatted_prompt += f"<assistant>\n{content}\n</assistant>\n\n"
            else:
                logger.warning(f"Unknown message role: {role}, ignoring message")
                
        # Add the final assistant prompt
        formatted_prompt += "<assistant>\n"
        
        # Generate a unique identifier for this completion
        completion_id = f"chatcmpl-{uuid.uuid4()}"
        created_timestamp = int(time.time())
        
        # Stream the response chunks
        async for chunk in self.analyze_stream(formatted_prompt, **kwargs):
            # Format each chunk in ChatGPT-compatible streaming format
            yield {
                "id": completion_id,
                "object": "chat.completion.chunk",
                "created": created_timestamp,
                "model": self.model_name,
                "choices": [
                    {
                        "index": 0,
                        "delta": {
                            "role": "assistant",
                            "content": chunk
                        },
                        "finish_reason": None
                    }
                ]
            }
            
        # Send the final chunk with finish_reason
        yield {
            "id": completion_id,
            "object": "chat.completion.chunk",
            "created": created_timestamp,
            "model": self.model_name,
            "choices": [
                {
                    "index": 0,
                    "delta": {},
                    "finish_reason": "stop"
                }
            ]
        }
    
    async def batch_process(
        self, 
        prompts: List[str], 
        concurrency: int = 3, 
        **kwargs
    ) -> List[str]:
        """Process multiple prompts in parallel with controlled concurrency
        
        Args:
            prompts: List of prompts to process
            concurrency: Maximum number of concurrent requests
            **kwargs: Parameters to pass to analyze
            
        Returns:
            List[str]: List of responses in the same order as prompts
        """
        if not prompts:
            return []
            
        logger.info(f"Starting batch processing of {len(prompts)} prompts with concurrency {concurrency}")
        
        # Use semaphore to control concurrency
        semaphore = asyncio.Semaphore(concurrency)
        
        async def process_prompt(prompt, index):
            task_id = f"batch-{index+1}"
            current_task = asyncio.current_task()
            if current_task:
                current_task.trace_id = task_id
                
            async with semaphore:
                logger.debug(f"Processing batch item {index+1}/{len(prompts)}")
                try:
                    return await self.analyze(prompt, **kwargs)
                except Exception as e:
                    logger.error(f"Error processing batch item {index}: {str(e)}")
                    return f"Error: {str(e)}"
                    
        # Create tasks for all prompts
        tasks = [
            process_prompt(prompt, i) 
            for i, prompt in enumerate(prompts)
        ]
        
        # Wait for all tasks to complete
        results = await asyncio.gather(*tasks)
        
        logger.info(f"Completed batch processing of {len(prompts)} prompts")
        return results
    
    async def compare_models(
        self,
        prompt: str,
        models: List[str],
        **kwargs
    ) -> Dict[str, str]:
        """Compare responses from multiple models for the same prompt
        
        Args:
            prompt: Prompt to send to all models
            models: List of model names to compare
            **kwargs: Parameters to pass to analyze
            
        Returns:
            Dict[str, str]: Map of model names to responses
        """
        if not prompt or not models:
            raise ValueError("Prompt and models list must not be empty")
            
        logger.info(f"Comparing {len(models)} models on the same prompt")
        
        async def get_model_response(model_name):
            # Create temporary service for the other model
            service = OllamaModelService(
                model_name=model_name,
                base_url=self.base_url,
                timeout=self.default_timeout,
                http2=True
            )
            
            try:
                return await service.analyze(prompt, **kwargs)
            finally:
                await service.close()
                
        # Process requests concurrently
        tasks = {model: asyncio.create_task(get_model_response(model)) for model in models}
        
        # Collect results
        results = {}
        for model, task in tasks.items():
            try:
                results[model] = await task
            except Exception as e:
                logger.error(f"Error getting response from model {model}: {str(e)}")
                results[model] = f"Error: {str(e)}"
                
        return results
    
    async def get_metrics(self) -> Dict[str, Any]:
        """Get service performance metrics
        
        Returns:
            Dict: Performance metrics and statistics
        """
        if not self.metrics_enabled:
            return {"metrics_enabled": False}
            
        # Get metrics from all components
        cache_stats = self.cache_manager.get_stats()
        rate_limit_stats = self.rate_limiter.get_stats()
        performance_metrics = self.metrics_collector.get_metrics()
        
        # Calculate current request rate
        now = time.time()
        if self.last_request_time:
            time_since_last = now - self.last_request_time
            request_rate = 0 if time_since_last == 0 else 1 / time_since_last
        else:
            request_rate = 0
        
        # System metrics
        system_metrics = {
            "uptime": now - self.start_time,
            "memory_usage_mb": self._get_memory_usage(),
            "request_rate": request_rate,
            "consecutive_errors": self.consecutive_errors,
            "circuit_breaker_state": self.circuit_breaker.state
        }
        
        return {
            "timestamp": datetime.now().isoformat(),
            "model": self.model_name,
            "performance": performance_metrics,
            "cache": cache_stats,
            "rate_limiter": rate_limit_stats,
            "system": system_metrics
        }
    
    def _get_memory_usage(self) -> float:
        """Get current memory usage in MB"""
        try:
            import psutil
            process = psutil.Process(os.getpid())
            return process.memory_info().rss / (1024 * 1024)
        except ImportError:
            # Fallback if psutil not available
            return 0


# Factory function to create an OllamaModelService instance with common configurations
async def create_ollama_service(
    model_name: str,  # Required parameter, no default
    base_url: str = DEFAULT_BASE_URL,
    ensure_loaded: bool = True,
    timeout: float = 120.0,
    verbose: bool = False,
    http2: bool = True,
    api_key: Optional[str] = None,
    metrics_enabled: bool = True
) -> OllamaModelService:
    """Create and initialize an OllamaModelService instance
    
    Args:
        model_name: Name of the model to use (required)
        base_url: Base URL for the Ollama API
        ensure_loaded: Whether to ensure the model is loaded
        timeout: Default timeout for requests
        verbose: Enable verbose logging
        http2: Enable HTTP/2 support
        api_key: API key for authentication, if required
        metrics_enabled: Enable performance metrics collection
        
    Returns:
        OllamaModelService: Initialized service instance
    """
    service = OllamaModelService(
        model_name=model_name,
        base_url=base_url,
        timeout=timeout,
        verbose_logging=verbose,
        http2=http2,
        api_key=api_key,
        metrics_enabled=metrics_enabled
    )
    
    # Check health and load the model if needed
    try:
        is_healthy = await service.health_check()
        if not is_healthy:
            logger.warning(f"Ollama service at {base_url} is not healthy")
            
        if ensure_loaded and is_healthy:
            model_loaded = await service.ensure_model_loaded()
            if not model_loaded:
                logger.warning(f"Could not load model {model_name}")
            
    except Exception as e:
        logger.error(f"Error initializing Ollama service: {str(e)}")
        
    return service


# Convenience function to create a model pool for load balancing
async def create_model_pool(
    model_name: str,
    base_urls: List[str],
    pool_size: int = 3
) -> List[OllamaModelService]:
    """Create a pool of model services for load balancing
    
    Args:
        model_name: Model to use across all services
        base_urls: List of Ollama API endpoints to connect to
        pool_size: Number of services to create per endpoint
        
    Returns:
        List[OllamaModelService]: Pool of model services
    """
    if not base_urls:
        raise ValueError("Must provide at least one base URL")
        
    # Create tasks to initialize services
    tasks = []
    for url in base_urls:
        for i in range(pool_size):
            tasks.append(create_ollama_service(
                model_name=model_name,
                base_url=url,
                ensure_loaded=True,
                http2=True
            ))
    
    # Wait for all services to initialize
    services = await asyncio.gather(*tasks)
    
    # Filter out any that failed to initialize properly
    valid_services = [svc for svc in services if svc.healthy]
    
    if not valid_services:
        raise OllamaConnectionError(f"None of the {len(services)} services in the pool initialized successfully")
        
    if len(valid_services) < len(services):
        logger.warning(f"Only {len(valid_services)}/{len(services)} services in the pool initialized successfully")
        
    return valid_services