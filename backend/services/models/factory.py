from typing import Optional, Dict, Any, List, Union, Callable, TypeVar, Generic, Tuple, Set, Awaitable, cast
from .base import BaseModelService
from .ollama import OllamaModelService, create_ollama_service
import logging
import time
import os
import json
import uuid
import random
import socket
import hashlib
import asyncio
import contextlib
import functools
import inspect
import platform
import warnings
from datetime import datetime, timedelta
from enum import Enum, auto
from fastapi import HTTPException, BackgroundTasks, Request
from fastapi.concurrency import run_in_threadpool
import httpx
from pydantic import BaseModel, ValidationError, AnyUrl, Field, field_validator, model_validator
import backoff
from opentelemetry import trace, metrics
from opentelemetry.trace import Span, Status, StatusCode
from opentelemetry.metrics import Counter, Histogram
from tenacity import (
    retry, stop_after_attempt, wait_exponential, retry_if_exception_type, 
    wait_random_exponential, RetryCallState, AsyncRetrying
)
from circuitbreaker import circuit
import aiocache
from prometheus_client import Counter as PromCounter, Histogram as PromHistogram, Gauge
import orjson
import aiofiles
import asyncio_pool
import cachetools
from aiolimiter import AsyncLimiter
from abc import ABC, abstractmethod
import dataclasses
from pathlib import Path
import ssl
#import netifaces

# Configure robust logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# OpenTelemetry setup
tracer = trace.get_tracer(__name__)
meter = metrics.get_meter(__name__)

# Configuration and constants
DEFAULT_TIMEOUT = float(os.environ.get("MODEL_FACTORY_TIMEOUT", "30.0"))
RETRY_ATTEMPTS = int(os.environ.get("MODEL_FACTORY_RETRY_ATTEMPTS", "3"))
CACHE_TTL_SECONDS = int(os.environ.get("MODEL_FACTORY_CACHE_TTL", "300"))
MODEL_REFRESH_INTERVAL = int(os.environ.get("MODEL_FACTORY_REFRESH_INTERVAL", "60"))
MAX_CACHE_SIZE = int(os.environ.get("MODEL_FACTORY_MAX_CACHE_SIZE", "100"))
DEFAULT_CONCURRENCY = int(os.environ.get("MODEL_FACTORY_CONCURRENCY", "5"))
HEALTH_CHECK_INTERVAL = int(os.environ.get("MODEL_FACTORY_HEALTH_CHECK_INTERVAL", "60"))
ENABLE_METRICS = os.environ.get("MODEL_FACTORY_ENABLE_METRICS", "true").lower() == "true"
CONFIG_PATH = os.environ.get("MODEL_FACTORY_CONFIG_PATH", "")
API_KEY = os.environ.get("OLLAMA_API_KEY", "")
SSL_VERIFY = os.environ.get("MODEL_FACTORY_SSL_VERIFY", "true").lower() == "true"
ENABLE_RESOURCE_MONITORING = os.environ.get("MODEL_FACTORY_RESOURCE_MONITORING", "true").lower() == "true"

# Type variables for generics
T = TypeVar('T')
ModelServiceT = TypeVar('ModelServiceT', bound=BaseModelService)

# ---------- Robust Enum Types ----------
class ModelStatus(str, Enum):
    """Model health and availability status"""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    LOADING = "loading"
    UNKNOWN = "unknown"
    
class ModelProvider(str, Enum):
    """Supported model providers"""
    OLLAMA = "ollama"
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    HUGGINGFACE = "huggingface"
    CUSTOM = "custom"

class CacheStrategy(str, Enum):
    """Caching strategies for models"""
    NONE = "none"
    LRU = "lru"
    LFU = "lfu"
    TTL = "ttl"
    ADAPTIVE = "adaptive"

class RoutingStrategy(str, Enum):
    """Load balancing strategies"""
    ROUND_ROBIN = "round_robin"
    LEAST_LOADED = "least_loaded"
    FASTEST = "fastest"
    RANDOM = "random"
    CONSISTENT_HASH = "consistent_hash"
    
class ResourcePriority(Enum):
    """Priority levels for resource allocation"""
    CRITICAL = auto()
    HIGH = auto()
    NORMAL = auto()
    LOW = auto()
    BACKGROUND = auto()

# ---------- Pydantic Models for Validation ----------
class ResourceLimits(BaseModel):
    """Resource limits for model instances"""
    max_concurrent_requests: int = 10
    request_timeout: float = 30.0
    tokens_per_minute: Optional[int] = None
    max_batch_size: int = 4
    
class ModelCapabilities(BaseModel):
    """Model capabilities and features"""
    text_generation: bool = True
    embeddings: bool = False
    chat: bool = False
    streaming: bool = True
    function_calling: bool = False
    vision: bool = False
    max_tokens: Optional[int] = None
    
class ModelMetrics(BaseModel):
    """Performance metrics for model monitoring"""
    avg_response_time: float = 0.0
    throughput: float = 0.0
    error_rate: float = 0.0
    tokens_per_second: float = 0.0
    last_latency: float = 0.0
    p95_latency: float = 0.0
    p99_latency: float = 0.0
    
class ModelMetadata(BaseModel):
    """Complete model definition and metadata"""
    id: str
    name: str
    provider: ModelProvider = ModelProvider.OLLAMA
    parameters: Dict[str, Any] = Field(default_factory=dict)
    context_window: Optional[int] = None
    modelfile: str = ""
    license: str = ""
    tags: List[str] = Field(default_factory=list)
    size: int = 0
    status: ModelStatus = ModelStatus.UNKNOWN
    capabilities: ModelCapabilities = Field(default_factory=ModelCapabilities)
    metrics: ModelMetrics = Field(default_factory=ModelMetrics)
    limits: ResourceLimits = Field(default_factory=ResourceLimits)
    version: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    @field_validator('created_at', 'updated_at', mode="before")
    def parse_datetime(cls, v):
        if isinstance(v, str):
            return datetime.fromisoformat(v.replace('Z', '+00:00'))
        return v
        
    class Config:
        json_loads = orjson.loads
        json_dumps = lambda v: orjson.dumps(v).decode('utf-8')

class FactoryConfig(BaseModel):
    """Configuration for the model factory"""
    cache_ttl: int = CACHE_TTL_SECONDS
    max_cache_size: int = MAX_CACHE_SIZE
    http_timeout: float = DEFAULT_TIMEOUT
    retry_attempts: int = RETRY_ATTEMPTS
    cache_strategy: CacheStrategy = CacheStrategy.LRU
    routing_strategy: RoutingStrategy = RoutingStrategy.LEAST_LOADED
    health_check_interval: int = HEALTH_CHECK_INTERVAL
    model_refresh_interval: int = MODEL_REFRESH_INTERVAL
    enable_metrics: bool = ENABLE_METRICS
    fallback_models: Dict[str, str] = Field(default_factory=dict)
    default_model_limits: ResourceLimits = Field(default_factory=ResourceLimits)
    enable_resource_monitoring: bool = ENABLE_RESOURCE_MONITORING
    ssl_verify: bool = SSL_VERIFY
    
    @model_validator(mode="after")
    def check_cache_ttl(self):
        # Ensure cache TTL is reasonable
        if self.cache_ttl < 10:
            warnings.warn("Cache TTL is very low, may impact performance")
        return self

class ModelRequest(BaseModel):
    """Parameters for model selection and routing"""
    model_name: str
    prefer_local: bool = True
    priority: ResourcePriority = ResourcePriority.NORMAL
    timeout: Optional[float] = None
    context_id: Optional[str] = None
    batch_size: int = 1
    tags: List[str] = Field(default_factory=list)
    capabilities: List[str] = Field(default_factory=list)

# ---------- Interface Definitions ----------
class HealthCheck(ABC):
    """Health check interface for components"""
    @abstractmethod
    async def check_health(self) -> Tuple[bool, Dict[str, Any]]:
        """Check health and return status plus details"""
        pass

class ResourceMonitor(ABC):
    """Resource monitoring interface"""
    @abstractmethod
    async def get_resource_usage(self) -> Dict[str, float]:
        """Get current resource usage metrics"""
        pass
        
    @abstractmethod
    async def is_resource_available(self, request: ModelRequest) -> bool:
        """Check if resources are available for a request"""
        pass

class CacheManager(Generic[T]):
    """Generic cache manager with multiple strategies"""
    def __init__(self, strategy: CacheStrategy = CacheStrategy.LRU, 
                 max_size: int = MAX_CACHE_SIZE, ttl: int = CACHE_TTL_SECONDS):
        self.strategy = strategy
        self.max_size = max_size
        self.ttl = ttl
        self._lock = asyncio.Lock()
        
        # Initialize appropriate cache based on strategy
        if strategy == CacheStrategy.LRU:
            self._cache = cachetools.LRUCache(maxsize=max_size)
        elif strategy == CacheStrategy.LFU:
            self._cache = cachetools.LFUCache(maxsize=max_size)
        elif strategy == CacheStrategy.TTL:
            self._cache = cachetools.TTLCache(maxsize=max_size, ttl=ttl)
        elif strategy == CacheStrategy.ADAPTIVE:
            # Adaptive cache adjusts based on usage patterns
            self._cache = {}
            self._access_times = {}
            self._access_counts = {}
        else:
            # No caching
            self._cache = {}
            
        # Statistics
        self.hits = 0
        self.misses = 0
        self.evictions = 0
        
    async def get(self, key: str) -> Optional[T]:
        """Get item from cache"""
        async with self._lock:
            if key in self._cache:
                self.hits += 1
                if self.strategy == CacheStrategy.ADAPTIVE:
                    self._access_times[key] = time.time()
                    self._access_counts[key] = self._access_counts.get(key, 0) + 1
                return self._cache[key]
            self.misses += 1
            return None
            
    async def set(self, key: str, value: T) -> None:
        """Set item in cache"""
        async with self._lock:
            # Manage cache size for custom implementations
            if self.strategy == CacheStrategy.ADAPTIVE:
                if len(self._cache) >= self.max_size:
                    await self._adaptive_eviction()
                self._cache[key] = value
                self._access_times[key] = time.time()
                self._access_counts[key] = 1
            else:
                # Built-in cache types handle eviction automatically
                self._cache[key] = value
                
    async def remove(self, key: str) -> None:
        """Remove item from cache"""
        async with self._lock:
            if key in self._cache:
                del self._cache[key]
                if self.strategy == CacheStrategy.ADAPTIVE:
                    self._access_times.pop(key, None)
                    self._access_counts.pop(key, None)
                
    async def clear(self) -> None:
        """Clear all items from cache"""
        async with self._lock:
            self._cache.clear()
            if self.strategy == CacheStrategy.ADAPTIVE:
                self._access_times.clear()
                self._access_counts.clear()
                
    async def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        hit_rate = self.hits / (self.hits + self.misses) if (self.hits + self.misses) > 0 else 0
        return {
            "strategy": self.strategy.value,
            "size": len(self._cache),
            "max_size": self.max_size,
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate": hit_rate,
            "evictions": self.evictions
        }
        
    async def _adaptive_eviction(self) -> None:
        """Adaptive eviction strategy based on recency and frequency"""
        # Calculate scores based on recency and frequency
        now = time.time()
        scores = {}
        for key in self._cache.keys():
            recency = now - self._access_times.get(key, 0)
            frequency = self._access_counts.get(key, 0)
            # Lower score = higher priority to keep
            scores[key] = recency / (frequency + 1)
            
        # Evict item with highest score (least valuable)
        if scores:
            evict_key = max(scores.items(), key=lambda x: x[1])[0]
            del self._cache[evict_key]
            self._access_times.pop(evict_key, None)
            self._access_counts.pop(evict_key, None)
            self.evictions += 1

class LoadBalancer:
    """Load balancing and routing for model endpoints"""
    def __init__(self, strategy: RoutingStrategy = RoutingStrategy.LEAST_LOADED):
        self.strategy = strategy
        self.endpoints = {}  # mapping of model -> list of endpoints
        self.stats = {}  # mapping of endpoint -> performance stats
        self._round_robin_counters = {}  # for round-robin strategy
        self._hasher = hashlib.md5  # for consistent hashing
        self._lock = asyncio.Lock()
        
    async def register_endpoint(self, model: str, endpoint: str, 
                               metadata: Optional[Dict[str, Any]] = None) -> None:
        """Register a new endpoint for a model"""
        async with self._lock:
            if model not in self.endpoints:
                self.endpoints[model] = []
            
            if endpoint not in self.endpoints[model]:
                self.endpoints[model].append(endpoint)
                self.stats[endpoint] = {
                    "response_times": [],
                    "error_count": 0,
                    "success_count": 0,
                    "last_used": 0,
                    "created_at": time.time(),
                    "metadata": metadata or {}
                }
                
    async def unregister_endpoint(self, model: str, endpoint: str) -> None:
        """Unregister an endpoint"""
        async with self._lock:
            if model in self.endpoints and endpoint in self.endpoints[model]:
                self.endpoints[model].remove(endpoint)
                self.stats.pop(endpoint, None)
                
    async def get_endpoint(self, model: str, context_id: Optional[str] = None) -> Optional[str]:
        """Get the best endpoint for a model based on strategy"""
        async with self._lock:
            if model not in self.endpoints or not self.endpoints[model]:
                return None
                
            endpoints = self.endpoints[model]
            
            if self.strategy == RoutingStrategy.ROUND_ROBIN:
                if model not in self._round_robin_counters:
                    self._round_robin_counters[model] = 0
                
                idx = self._round_robin_counters[model] % len(endpoints)
                self._round_robin_counters[model] += 1
                return endpoints[idx]
                
            elif self.strategy == RoutingStrategy.LEAST_LOADED:
                # Find endpoint with best success/error ratio and response time
                best_endpoint = None
                best_score = float('-inf')
                
                for endpoint in endpoints:
                    stats = self.stats[endpoint]
                    error_rate = stats["error_count"] / (stats["success_count"] + stats["error_count"] + 1)
                    avg_response_time = (sum(stats["response_times"]) / len(stats["response_times"])) if stats["response_times"] else 1.0
                    
                    # Higher score is better
                    score = (1 - error_rate) / (avg_response_time + 0.1)
                    if score > best_score:
                        best_score = score
                        best_endpoint = endpoint
                
                return best_endpoint
                
            elif self.strategy == RoutingStrategy.FASTEST:
                # Simply pick endpoint with lowest average response time
                fastest = None
                best_time = float('inf')
                
                for endpoint in endpoints:
                    stats = self.stats[endpoint]
                    if not stats["response_times"]:
                        continue
                    
                    avg_time = sum(stats["response_times"]) / len(stats["response_times"])
                    if avg_time < best_time:
                        best_time = avg_time
                        fastest = endpoint
                
                return fastest or endpoints[0]
                
            elif self.strategy == RoutingStrategy.RANDOM:
                return random.choice(endpoints)
                
            elif self.strategy == RoutingStrategy.CONSISTENT_HASH:
                if not context_id:
                    # Fallback to random if no context provided
                    return random.choice(endpoints)
                    
                # Use consistent hashing for sticky sessions
                hash_val = int(self._hasher(context_id.encode()).hexdigest(), 16)
                return endpoints[hash_val % len(endpoints)]
                
            # Default to first endpoint if strategy not recognized
            return endpoints[0]
            
    async def update_stats(self, endpoint: str, response_time: float, success: bool) -> None:
        """Update performance statistics for an endpoint"""
        async with self._lock:
            if endpoint not in self.stats:
                return
                
            stats = self.stats[endpoint]
            
            # Keep last 10 response times
            stats["response_times"].append(response_time)
            if len(stats["response_times"]) > 10:
                stats["response_times"].pop(0)
                
            if success:
                stats["success_count"] += 1
            else:
                stats["error_count"] += 1
                
            stats["last_used"] = time.time()
            
    async def get_stats(self) -> Dict[str, Any]:
        """Get load balancer statistics"""
        async with self._lock:
            return {
                "strategy": self.strategy.value,
                "models": {model: len(endpoints) for model, endpoints in self.endpoints.items()},
                "endpoints": len(self.stats),
                "endpoint_stats": {
                    endpoint: {
                        "avg_response_time": sum(stats["response_times"]) / len(stats["response_times"]) if stats["response_times"] else 0,
                        "error_rate": stats["error_count"] / (stats["success_count"] + stats["error_count"]) if (stats["success_count"] + stats["error_count"]) > 0 else 0,
                        "age_seconds": time.time() - stats["created_at"],
                        "idle_seconds": time.time() - stats["last_used"]
                    }
                    for endpoint, stats in self.stats.items()
                }
            }

class MetricsRegistry:
    """Centralized metrics collection and reporting"""
    def __init__(self, enabled: bool = ENABLE_METRICS):
        self.enabled = enabled
        self.prefix = "model_factory"
        
        # Counters
        self.request_count = PromCounter(
            f"{self.prefix}_requests_total",
            "Total number of model requests",
            ["model", "operation", "status"]
        )
        
        self.model_errors = PromCounter(
            f"{self.prefix}_errors_total",
            "Total number of model errors",
            ["model", "error_type"]
        )
        
        self.cache_operations = PromCounter(
            f"{self.prefix}_cache_operations_total",
            "Cache operation counts",
            ["operation"]
        )
        
        # Histograms
        self.request_latency = PromHistogram(
            f"{self.prefix}_request_latency_seconds",
            "Model request latency in seconds",
            ["model", "operation"],
            buckets=(0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0)
        )
        
        self.retry_count = PromHistogram(
            f"{self.prefix}_retry_count",
            "Number of retries per request",
            ["model", "operation"],
            buckets=(0, 1, 2, 3, 4, 5)
        )
        
        # Gauges
        self.model_availability = Gauge(
            f"{self.prefix}_model_availability",
            "Model availability status (1=available, 0=unavailable)",
            ["model"]
        )
        
        self.cache_size = Gauge(
            f"{self.prefix}_cache_size",
            "Current cache size"
        )
        
        self.active_requests = Gauge(
            f"{self.prefix}_active_requests",
            "Number of active requests",
            ["model"]
        )
        
        # OpenTelemetry metrics
        self.otel_request_counter = meter.create_counter(
            f"{self.prefix}.requests",
            description="Number of model requests"
        )
        
        self.otel_latency = meter.create_histogram(
            f"{self.prefix}.latency",
            description="Request latency in seconds"
        )
        
    def record_request(self, model: str, operation: str, status: str = "success") -> None:
        """Record a model request"""
        if not self.enabled:
            return
            
        self.request_count.labels(model=model, operation=operation, status=status).inc()
        self.otel_request_counter.add(1, {"model": model, "operation": operation, "status": status})
        
    def record_latency(self, model: str, operation: str, seconds: float) -> None:
        """Record request latency"""
        if not self.enabled:
            return
            
        self.request_latency.labels(model=model, operation=operation).observe(seconds)
        self.otel_latency.record(seconds, {"model": model, "operation": operation})
        
    def record_error(self, model: str, error_type: str) -> None:
        """Record a model error"""
        if not self.enabled:
            return
            
        self.model_errors.labels(model=model, error_type=error_type).inc()
        
    def record_retry(self, model: str, operation: str, retry_count: int) -> None:
        """Record retry count for a request"""
        if not self.enabled:
            return
            
        self.retry_count.labels(model=model, operation=operation).observe(retry_count)
        
    def update_model_availability(self, model: str, available: bool) -> None:
        """Update model availability status"""
        if not self.enabled:
            return
            
        self.model_availability.labels(model=model).set(1 if available else 0)
        
    def update_cache_size(self, size: int) -> None:
        """Update current cache size"""
        if not self.enabled:
            return
            
        self.cache_size.set(size)
        
    def record_cache_operation(self, operation: str) -> None:
        """Record cache operation"""
        if not self.enabled:
            return
            
        self.cache_operations.labels(operation=operation).inc()
        
    def update_active_requests(self, model: str, count: int) -> None:
        """Update count of active requests"""
        if not self.enabled:
            return
            
        self.active_requests.labels(model=model).set(count)
        
    @contextlib.contextmanager
    def track_operation(self, model: str, operation: str):
        """Context manager to track operation metrics"""
        if not self.enabled:
            yield
            return
            
        start_time = time.time()
        self.update_active_requests(model, self.active_requests.labels(model=model)._value.get() + 1)
        
        try:
            yield
            elapsed = time.time() - start_time
            self.record_request(model, operation, "success")
            self.record_latency(model, operation, elapsed)
        except Exception as e:
            self.record_request(model, operation, "error")
            self.record_error(model, type(e).__name__)
            raise
        finally:
            self.update_active_requests(model, max(0, self.active_requests.labels(model=model)._value.get() - 1))

class SystemResourceMonitor(ResourceMonitor):
    """System resource monitoring implementation"""
    def __init__(self, enabled: bool = ENABLE_RESOURCE_MONITORING):
        self.enabled = enabled
        self.last_check = 0
        self.resource_stats = {
            "cpu_percent": 0.0,
            "memory_percent": 0.0,
            "disk_percent": 0.0,
            "network_usage": 0.0
        }
        self.check_interval = 5  # seconds between checks
        
    async def get_resource_usage(self) -> Dict[str, float]:
        """Get current resource usage metrics"""
        if not self.enabled:
            return self.resource_stats
            
        # Only refresh stats periodically to avoid overhead
        current_time = time.time()
        if current_time - self.last_check < self.check_interval:
            return self.resource_stats
            
        self.last_check = current_time
        
        try:
            # CPU usage
            cpu_usage = await run_in_threadpool(self._get_cpu_usage)
            
            # Memory usage
            memory_usage = await run_in_threadpool(self._get_memory_usage)
            
            # Disk usage
            disk_usage = await run_in_threadpool(self._get_disk_usage)
            
            # Network usage
            network_usage = await run_in_threadpool(self._get_network_usage)
            
            self.resource_stats = {
                "cpu_percent": cpu_usage,
                "memory_percent": memory_usage,
                "disk_percent": disk_usage,
                "network_usage": network_usage
            }
        except Exception as e:
            logger.warning(f"Failed to get resource usage: {str(e)}")
            
        return self.resource_stats
        
    async def is_resource_available(self, request: ModelRequest) -> bool:
        """Check if resources are available for a request"""
        if not self.enabled:
            return True
            
        # Get current resource usage
        usage = await self.get_resource_usage()
        
        # Define thresholds based on request priority
        if request.priority == ResourcePriority.CRITICAL:
            # Critical requests proceed regardless of resource state
            return True
        elif request.priority == ResourcePriority.HIGH:
            # High priority requests proceed unless system is extremely loaded
            return usage["cpu_percent"] < 95 and usage["memory_percent"] < 95
        elif request.priority == ResourcePriority.NORMAL:
            # Normal requests require reasonable resource availability
            return usage["cpu_percent"] < 80 and usage["memory_percent"] < 95
        elif request.priority == ResourcePriority.LOW:
            # Low priority requests need ample resources
            return usage["cpu_percent"] < 70 and usage["memory_percent"] < 75
        elif request.priority == ResourcePriority.BACKGROUND:
            # Background requests only when system is lightly loaded
            return usage["cpu_percent"] < 50 and usage["memory_percent"] < 60
            
        return True  # Default to available
        
    def _get_cpu_usage(self) -> float:
        """Get CPU usage percentage"""
        try:
            import psutil
            return psutil.cpu_percent(interval=0.1)
        except ImportError:
            return 0.0
            
    def _get_memory_usage(self) -> float:
        """Get memory usage percentage"""
        try:
            import psutil
            return psutil.virtual_memory().percent
        except ImportError:
            return 0.0
            
    def _get_disk_usage(self) -> float:
        """Get disk usage percentage"""
        try:
            import psutil
            return psutil.disk_usage("/").percent
        except ImportError:
            return 0.0
            
    def _get_network_usage(self) -> float:
        """Get network usage (bytes/sec)"""
        try:
            import psutil
            # This is a simple approximation
            net_io = psutil.net_io_counters()
            return (net_io.bytes_sent + net_io.bytes_recv) / 1024  # KB
        except ImportError:
            return 0.0
            
class ConfigManager:
    """Dynamic configuration management with hot reloading"""
    def __init__(self, config_path: str = CONFIG_PATH):
        self.config_path = config_path
        self._config = FactoryConfig()
        self._watch_task = None
        self._subscribers = set()
        self._last_modified = 0
        self._lock = asyncio.Lock()
        
    async def initialize(self) -> None:
        """Initialize configuration manager"""
        if self.config_path:
            # Load configuration from file
            await self.load_config()
            
            # Start watching for changes if the file exists
            if os.path.exists(self.config_path):
                self._watch_task = asyncio.create_task(self._watch_config_file())
        
    async def load_config(self) -> None:
        """Load configuration from file"""
        if not self.config_path or not os.path.exists(self.config_path):
            logger.warning(f"Config file not found: {self.config_path}")
            return
            
        try:
            async with self._lock:
                async with aiofiles.open(self.config_path, mode='r') as f:
                    config_data = await f.read()
                    
                try:
                    # Try JSON format
                    config_dict = json.loads(config_data)
                except json.JSONDecodeError:
                    # Try YAML format if JSON fails
                    try:
                        import yaml
                        config_dict = yaml.safe_load(config_data)
                    except (ImportError, yaml.YAMLError):
                        logger.error("Failed to parse config file")
                        return
                
                # Create new config instance
                self._config = FactoryConfig(**config_dict)
                self._last_modified = os.path.getmtime(self.config_path)
                
                # Notify subscribers of config changes
                await self._notify_subscribers()
                
                logger.info(f"Loaded configuration from {self.config_path}")
        except Exception as e:
            logger.error(f"Error loading configuration: {str(e)}")
            
    async def _watch_config_file(self) -> None:
        """Watch config file for changes"""
        try:
            while True:
                # Check if file exists
                if os.path.exists(self.config_path):
                    current_mtime = os.path.getmtime(self.config_path)
                    
                    # Reload if modified
                    if current_mtime > self._last_modified:
                        logger.info(f"Config file changed, reloading")
                        await self.load_config()
                
                # Check every 10 seconds
                await asyncio.sleep(10)
        except asyncio.CancelledError:
            logger.debug("Config file watcher stopped")
        except Exception as e:
            logger.error(f"Error in config file watcher: {str(e)}")
            
    async def _notify_subscribers(self) -> None:
        """Notify subscribers of config changes"""
        for callback in self._subscribers:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(self._config)
                else:
                    callback(self._config)
            except Exception as e:
                logger.error(f"Error notifying subscriber: {str(e)}")
                
    def subscribe(self, callback: Callable[[FactoryConfig], Any]) -> None:
        """Subscribe to config changes"""
        self._subscribers.add(callback)
        
    def unsubscribe(self, callback: Callable[[FactoryConfig], Any]) -> None:
        """Unsubscribe from config changes"""
        self._subscribers.discard(callback)
        
    @property
    def config(self) -> FactoryConfig:
        """Get current configuration"""
        return self._config
        
    async def update_config(self, new_config: Dict[str, Any]) -> None:
        """Update configuration (in-memory only)"""
        async with self._lock:
            # Create new config with updated values
            updated_config = self._config.dict()
            updated_config.update(new_config)
            self._config = FactoryConfig(**updated_config)
            
            # Notify subscribers
            await self._notify_subscribers()
            
    async def save_config(self) -> None:
        """Save current configuration to file"""
        if not self.config_path:
            logger.warning("No config path set, cannot save")
            return
            
        try:
            async with self._lock:
                async with aiofiles.open(self.config_path, mode='w') as f:
                    await f.write(self._config.json(indent=2))
                self._last_modified = os.path.getmtime(self.config_path)
                logger.info(f"Saved configuration to {self.config_path}")
        except Exception as e:
            logger.error(f"Error saving configuration: {str(e)}")
            
    async def close(self) -> None:
        """Clean up resources"""
        if self._watch_task and not self._watch_task.done():
            self._watch_task.cancel()
            try:
                await self._watch_task
            except asyncio.CancelledError:
                pass

class EnterpriseModelFactory:
    """Ultimate enterprise-grade model service factory with comprehensive capabilities"""
    
    def __init__(self, ollama_base_url: str):
        # Initialize core components
        self.ollama_base_url = ollama_base_url
        self.instance_id = str(uuid.uuid4())
        self.start_time = datetime.now()
        self.hostname = socket.gethostname()
        self._shutdown_event = asyncio.Event()
        
        # Initialize configuration
        self.config_manager = ConfigManager()
        
        # Initialize HTTP client
        self._http_client: Optional[httpx.AsyncClient] = None
        
        # Initialize model cache with locking
        self._model_cache: Dict[str, BaseModelService] = {}
        self._cache_lock = asyncio.Lock()
        self._available_models = None
        self._last_models_refresh = 0
        self._models_refresh_lock = asyncio.Lock()
        
        # Initialize enhanced components
        self.metrics = MetricsRegistry()
        self.cache_manager = CacheManager(CacheStrategy.ADAPTIVE)
        self.load_balancer = LoadBalancer()
        self.resource_monitor = SystemResourceMonitor()
        
        # Initialize rate limiters
        self.global_limiter = AsyncLimiter(100, 1)  # 100 per second
        self.model_limiters = {}
        
        # Statistics and monitoring
        self.request_count = 0
        self.error_count = 0
        self.concurrent_requests = 0
        self.max_concurrent_requests = 0
        self._http_client = None
        self._initialization_complete = False
        self._background_tasks = set()
        
        # Registry of model handlers and plugins
        self._model_handlers = {}
        self._plugins = []
        
        # Track active operations
        self._active_operations = {}
        self._operations_lock = asyncio.Lock()
        
        logger.info(f"EnterpriseModelFactory initialized with ID {self.instance_id} on host {self.hostname}")
        
    # ---------- Initialization and Configuration ----------
    async def initialize(self) -> None:
        """Initialize the factory and its components"""
        if self._initialization_complete:
            return
            
        try:
            # Initialize configuration
            await self.config_manager.initialize()
            self.config_manager.subscribe(self._on_config_changed)
            
            # Initialize HTTP client
            await self.get_http_client()
            
            # Initialize health monitoring
            health_check_interval = self.config_manager.config.health_check_interval
            self._start_background_task(self._health_monitoring_task(health_check_interval))
            
            # Initialize model cache warming
            self._start_background_task(self._model_cache_warming_task())
            
            # Register built-in plugins
            self._register_builtin_plugins()
            
            # Detect network interfaces and IPs
            await self._detect_network_info()
            
            # Initialize successful
            self._initialization_complete = True
            logger.info("EnterpriseModelFactory initialization complete")
        except Exception as e:
            logger.error(f"Error during initialization: {str(e)}")
            raise
            
    def _start_background_task(self, coro):
        """Start and track a background task"""
        task = asyncio.create_task(coro)
        self._background_tasks.add(task)
        task.add_done_callback(self._background_tasks.discard)
        
    async def _on_config_changed(self, new_config: FactoryConfig) -> None:
        """Handle configuration changes"""
        logger.info("Configuration changed, updating factory components")
        
        # Update HTTP client timeout
        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None
            await self.get_http_client()
            
        # Update cache strategy if changed
        if new_config.cache_strategy != self.cache_manager.strategy:
            # Transfer items from old cache to new cache
            old_items = {}
            async with self._cache_lock:
                for key in self._model_cache:
                    old_items[key] = self._model_cache[key]
                    
            # Create new cache with updated strategy
            self.cache_manager = CacheManager(new_config.cache_strategy, 
                                           new_config.max_cache_size,
                                           new_config.cache_ttl)
            
            # Repopulate cache
            for key, value in old_items.items():
                await self.cache_manager.set(key, value)
            
        # Update load balancer strategy if changed
        if new_config.routing_strategy != self.load_balancer.strategy:
            self.load_balancer = LoadBalancer(new_config.routing_strategy)
            
        # Apply other configuration changes
        self.metrics.enabled = new_config.enable_metrics
        self.resource_monitor.enabled = new_config.enable_resource_monitoring
        
    async def _health_monitoring_task(self, interval: int = HEALTH_CHECK_INTERVAL) -> None:
        """Background task for health monitoring"""
        try:
            while not self._shutdown_event.is_set():
                try:
                    # Check service health
                    health_status = await self.check_health()
                    
                    # Log health issues
                    if not health_status.get("healthy", False):
                        logger.warning(f"Health check failed: {health_status}")
                        
                    # Update metrics based on health status
                    for model_name, status in health_status.get("models", {}).items():
                        available = status.get("available", False)
                        self.metrics.update_model_availability(model_name, available)
                        
                except Exception as e:
                    logger.error(f"Error in health monitoring: {str(e)}")
                    
                # Wait for the next interval
                await asyncio.sleep(interval)
        except asyncio.CancelledError:
            logger.debug("Health monitoring task stopped")
            
    async def _model_cache_warming_task(self) -> None:
        """Background task for cache warming"""
        try:
            # Initial delay to let system stabilize
            await asyncio.sleep(5)
            
            while not self._shutdown_event.is_set():
                try:
                    # Get available models
                    models = await self.list_available_models()
                    if not models:
                        await asyncio.sleep(10)
                        continue
                        
                    # Find most popular models to warm
                    popular_models = sorted(models.get("models", []), 
                                         key=lambda m: m.get("popularity", 0), 
                                         reverse=True)[:3]
                    
                    # Warm up cache for popular models
                    for model in popular_models:
                        model_name = model.get("name")
                        if model_name and model_name not in self._model_cache:
                            logger.info(f"Warming cache for model {model_name}")
                            try:
                                await self.get_model_service(model_name)
                            except Exception as e:
                                logger.warning(f"Failed to warm cache for {model_name}: {str(e)}")
                    
                except Exception as e:
                    logger.error(f"Error in cache warming: {str(e)}")
                    
                # Wait before next warming cycle
                await asyncio.sleep(300)  # 5 minutes
                
        except asyncio.CancelledError:
            logger.debug("Cache warming task stopped")
    
    async def _detect_network_info(self) -> None:
        """Detect network interfaces and IP addresses"""
        try:
            interfaces = netifaces.interfaces()
            network_info = {}
            
            for interface in interfaces:
                addresses = netifaces.ifaddresses(interface)
                
                # Get IPv4 addresses
                if netifaces.AF_INET in addresses:
                    for addr in addresses[netifaces.AF_INET]:
                        if 'addr' in addr:
                            network_info[interface] = addr['addr']
                            
            logger.info(f"Detected network interfaces: {network_info}")
            self.network_info = network_info
        except Exception as e:
            logger.warning(f"Failed to detect network info: {str(e)}")
            self.network_info = {}
    
    # ---------- HTTP Client Management ----------
    async def get_http_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client with connection pooling and retries"""
        if self._http_client is None or self._http_client.is_closed:
            # Create SSL context if verification is enabled
            ssl_context = None
            if self.config_manager.config.ssl_verify:
                ssl_context = ssl.create_default_context()
            else:
                ssl_context = ssl.create_default_context()
                ssl_context.check_hostname = False
                ssl_context.verify_mode = ssl.CERT_NONE
                
            # Configure client with optimized settings
            self._http_client = httpx.AsyncClient(
                timeout=httpx.Timeout(
                    self.config_manager.config.http_timeout,
                    connect=min(5.0, self.config_manager.config.http_timeout / 3),
                    read=self.config_manager.config.http_timeout,
                    write=self.config_manager.config.http_timeout,
                    pool=60.0
                ),
                limits=httpx.Limits(
                    max_connections=100,
                    max_keepalive_connections=20,
                    keepalive_expiry=60
                ),
                follow_redirects=True,
                verify=ssl_context,
                http2=True
            )
            
            # Add default headers
            if API_KEY:
                self._http_client.headers["Authorization"] = f"Bearer {API_KEY}"
                
            # Add user agent for diagnostics
            self._http_client.headers["User-Agent"] = (
                f"EnterpriseModelFactory/{self.instance_id} "
                f"Python/{platform.python_version()} "
                f"{platform.system()}/{platform.release()}"
            )
                
        return self._http_client
        
    # ---------- Enhanced API Calls ----------
    @retry(
        stop=stop_after_attempt(RETRY_ATTEMPTS),
        wait=wait_random_exponential(multiplier=1, min=1, max=20),
        retry=retry_if_exception_type((httpx.ConnectError, httpx.ReadTimeout))
    )
    async def _safe_api_call(self, method: str, endpoint: str, 
                           model: Optional[str] = None, 
                           operation: str = "api_call", 
                           **kwargs) -> Dict[str, Any]:
        """Resilient API call with comprehensive error handling and metrics"""
        with tracer.start_as_current_span(operation) as span:
            # Add request tracking info
            request_id = str(uuid.uuid4())
            span.set_attribute("request_id", request_id)
            if model:
                span.set_attribute("model", model)
            span.set_attribute("endpoint", endpoint)
            
            start_time = time.time()
            client = await self.get_http_client()
            
            # Track operation
            async with self._operations_lock:
                self._active_operations[request_id] = {
                    "endpoint": endpoint,
                    "model": model,
                    "operation": operation,
                    "start_time": start_time
                }
                
            try:
                # Apply rate limiting
                await self.global_limiter.acquire()
                if model and model in self.model_limiters:
                    await self.model_limiters[model].acquire()
                    
                # Make the request
                if method.lower() == "get":
                    response = await client.get(endpoint, **kwargs)
                elif method.lower() == "post":
                    response = await client.post(endpoint, **kwargs)
                elif method.lower() == "put":
                    response = await client.put(endpoint, **kwargs)
                elif method.lower() == "delete":
                    response = await client.delete(endpoint, **kwargs)
                else:
                    raise ValueError(f"Unsupported HTTP method: {method}")
                    
                # Check for errors
                response.raise_for_status()
                
                # Process response
                try:
                    result = response.json()
                except ValueError:
                    # Not JSON, return text
                    result = {"text": response.text}
                    
                # Record metrics
                elapsed = time.time() - start_time
                if model:
                    self.metrics.record_request(model, operation, "success")
                    self.metrics.record_latency(model, operation, elapsed)
                    
                # Record success in span
                span.set_status(Status(StatusCode.OK))
                
                return result
                
            except httpx.HTTPStatusError as e:
                # Record error details
                span.set_status(Status(StatusCode.ERROR, f"HTTP {e.response.status_code}"))
                span.record_exception(e)
                
                if model:
                    self.metrics.record_request(model, operation, "error")
                    self.metrics.record_error(model, f"http_{e.response.status_code}")
                
                # Map status codes to specific errors
                if e.response.status_code == 404:
                    error_msg = f"Resource not found: {endpoint}"
                    logger.warning(error_msg)
                    raise HTTPException(status_code=404, detail=error_msg)
                elif e.response.status_code >= 500:
                    error_msg = f"Server error {e.response.status_code}: {e.response.text}"
                    logger.error(error_msg)
                    raise HTTPException(status_code=503, detail=error_msg)
                else:
                    error_msg = f"HTTP error {e.response.status_code}: {e.response.text}"
                    logger.error(error_msg)
                    raise HTTPException(status_code=e.response.status_code, detail=error_msg)
                    
            except (httpx.ConnectError, httpx.ReadTimeout) as e:
                # Network or timeout errors
                span.set_status(Status(StatusCode.ERROR, str(e)))
                span.record_exception(e)
                
                if model:
                    self.metrics.record_request(model, operation, "error")
                    self.metrics.record_error(model, type(e).__name__)
                
                logger.error(f"Connection error to {endpoint}: {str(e)}")
                raise HTTPException(status_code=503, detail=f"Service unavailable: {str(e)}")
                
            except Exception as e:
                # Unexpected errors
                span.set_status(Status(StatusCode.ERROR, str(e)))
                span.record_exception(e)
                
                if model:
                    self.metrics.record_request(model, operation, "error")
                    self.metrics.record_error(model, type(e).__name__)
                
                logger.error(f"Unexpected error calling {endpoint}: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
                
            finally:
                # Remove from active operations
                async with self._operations_lock:
                    self._active_operations.pop(request_id, None)
                    
    # ---------- Enhanced Model Resolution ----------
    async def refresh_available_models(self, force: bool = False) -> Dict[str, Any]:
        """Refresh available models with enhanced resilience and validation"""
        async with self._models_refresh_lock:
            current_time = asyncio.get_event_loop().time()
            refresh_interval = self.config_manager.config.model_refresh_interval
            
            if force or not self._available_models or (current_time - self._last_models_refresh) > refresh_interval:
                try:
                    # Fetch models with resilient API call
                    response = await self._safe_api_call(
                        "GET", 
                        f"{self.ollama_base_url}/api/tags",
                        operation="refresh_models"
                    )
                    
                    # Validate and process models
                    models_data = response.get("models", [])
                    validated_models = []
                    
                    for model_data in models_data:
                        try:
                            # Basic validation
                            if not model_data.get("name"):
                                continue
                                
                            # Add to validated models
                            validated_models.append(model_data)
                            
                            # Update model rate limiters
                            model_name = model_data.get("name")
                            if model_name and model_name not in self.model_limiters:
                                # Create model-specific rate limiter
                                # Default to 10 requests per second
                                self.model_limiters[model_name] = AsyncLimiter(10, 1)
                                
                        except Exception as e:
                            logger.warning(f"Error validating model data: {str(e)}")
                    
                    # Update available models
                    self._available_models = {"models": validated_models}
                    self._last_models_refresh = current_time
                    
                    # Update metrics
                    self.metrics.update_cache_size(len(validated_models))
                    
                    logger.info(f"Refreshed {len(validated_models)} models")
                    
                except Exception as e:
                    logger.error(f"Failed to refresh models: {str(e)}")
                    if not self._available_models:
                        self._available_models = {"models": []}
                    # Don't re-raise, use last known good data
            
            return self._available_models
            
    async def _resolve_model_name(self, model_name: str) -> str:
        """Resolve model name with comprehensive validation and fallback"""
        # Ensure we have fresh model data
        await self.refresh_available_models()
        
        # Normalize input
        model_name_str = str(model_name).strip()
        
        # Fast path for exact match
        if any(model.get("name") == model_name_str 
             for model in self._available_models.get("models", [])):
            logger.debug(f"Found exact model match: {model_name_str}")
            return model_name_str
        
        # Handle numeric IDs
        if model_name_str.isdigit() and self._available_models.get("models"):
            try:
                index = int(model_name_str)
                if 0 <= index < len(self._available_models["models"]):
                    resolved_name = self._available_models["models"][index]["name"]
                    logger.info(f"Resolved numeric ID {model_name_str} to '{resolved_name}'")
                    return resolved_name
            except (ValueError, IndexError) as e:
                logger.warning(f"Error resolving numeric ID {model_name_str}: {str(e)}")
        
        # Try prefix matching for partial model names
        if len(model_name_str) >= 3 and not model_name_str.isdigit():
            for model in self._available_models.get("models", []):
                if model.get("name", "").startswith(model_name_str):
                    resolved_name = model.get("name")
                    logger.info(f"Using prefix match for '{model_name_str}' -> '{resolved_name}'")
                    return resolved_name
        
        # Check fallback configuration
        fallbacks = self.config_manager.config.fallback_models
        if model_name_str in fallbacks and fallbacks[model_name_str]:
            fallback = fallbacks[model_name_str]
            logger.info(f"Using configured fallback for '{model_name_str}' -> '{fallback}'")
            return fallback
        
        # Last resort: use first available model
        if self._available_models.get("models"):
            fallback = self._available_models["models"][0]["name"]
            logger.warning(f"Model '{model_name_str}' not found, falling back to '{fallback}'")
            return fallback
        
        # If all else fails, return the original name
        logger.error(f"Failed to resolve model '{model_name_str}' and no fallbacks available")
        return model_name_str
    
    # ---------- Enhanced Model Service Creation ----------
    async def get_model_service(self, model_name: str, request: Optional[ModelRequest] = None) -> BaseModelService:
        """Get model service with advanced capabilities, caching and fallbacks"""
        with tracer.start_as_current_span("get_model_service") as span:
            span.set_attribute("model", model_name)
            
            # Create default request if none provided
            if not request:
                request = ModelRequest(model_name=model_name)
            
            # Check if resources are available for this request
            if not await self.resource_monitor.is_resource_available(request):
                logger.warning(f"Insufficient resources for request with priority {request.priority}")
                if request.priority not in (ResourcePriority.CRITICAL, ResourcePriority.HIGH):
                    raise HTTPException(
                        status_code=429, 
                        detail="Insufficient resources, please try again later"
                    )
            
            # Check cache first
            cache_key = model_name
            cached_service = await self.cache_manager.get(cache_key)
            if cached_service:
                # Update statistics
                self.metrics.record_cache_operation("hit")
                span.set_attribute("cache", "hit")
                
                # Touch the service to update last accessed time
                cached_service.last_accessed = datetime.now()
                
                return cached_service
            
            # Record cache miss
            self.metrics.record_cache_operation("miss")
            span.set_attribute("cache", "miss")
            
            # Resolve the model name
            resolved_model = await self._resolve_model_name(model_name)
            span.set_attribute("resolved_model", resolved_model)
            
            try:
                # Check if we need to create a new service
                async with self._cache_lock:
                    # Check one more time if it's in cache (could have been added while waiting for lock)
                    cached_service = await self.cache_manager.get(resolved_model)
                    if cached_service:
                        return cached_service
                    
                    # Create and validate the service
                    logger.info(f"Creating new service for model {resolved_model}")
                    service = await self._create_model_service(resolved_model)
                    
                    # Add to cache
                    await self.cache_manager.set(resolved_model, service)
                    
                    # Trigger model pulled event
                    await self._notify_model_pulled(resolved_model)
                    
                    # Update metrics
                    self.metrics.update_cache_size(len(self._model_cache))
                    
                    return service
                    
            except Exception as e:
                logger.error(f"Error creating service for {resolved_model}: {str(e)}")
                
                # Try fallback models
                if resolved_model != model_name:
                    # Already using a fallback, don't try again
                    raise
                    
                # Check configured fallbacks
                fallbacks = self.config_manager.config.fallback_models
                if model_name in fallbacks and fallbacks[model_name]:
                    fallback = fallbacks[model_name]
                    logger.info(f"Using fallback model {fallback} after creation failure")
                    return await self.get_model_service(fallback, request)
                
                # Try any available model as last resort
                await self.refresh_available_models(force=True)
                if self._available_models.get("models"):
                    # Skip the failed model
                    for model in self._available_models["models"]:
                        if model.get("name") and model.get("name") != resolved_model:
                            fallback = model.get("name")
                            logger.info(f"Using emergency fallback to {fallback}")
                            return await self.get_model_service(fallback, request)
                
                # Nothing worked, re-raise the original error
                raise
    
    @circuit(failure_threshold=5, recovery_timeout=60)
    async def _create_model_service(self, model_name: str) -> BaseModelService:
        """Create a new model service with retry and circuit breaker protection"""
        logger.info(f"Creating new service for model {model_name}")
        
        # Check if we have a custom handler for this model type
        for pattern, handler in self._model_handlers.items():
            if pattern in model_name:
                logger.debug(f"Using custom handler for {model_name}")
                return await handler(model_name, self.ollama_base_url)
        
        # Default to OllamaModelService
        service = await create_ollama_service(
            model_name=model_name,
            base_url=self.ollama_base_url,
            ensure_loaded=True,
            timeout=self.config_manager.config.http_timeout,
            http2=True
        )
        
        # Validate the service
        if not await service.validate():
            logger.warning(f"Initial validation failed for {model_name}")
            
            # Try to pull the model
            try:
                await self._pull_model(model_name)
                
                # Re-validate after pull
                if await service.validate():
                    logger.info(f"Model {model_name} validated after pull")
                else:
                    raise ValueError(f"Model {model_name} still invalid after pull")
                    
            except Exception as e:
                logger.error(f"Failed to pull and validate model {model_name}: {str(e)}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to initialize model {model_name}: {str(e)}"
                )
        
        return service
    
    async def _pull_model(self, model_name: str) -> None:
        """Pull a model with progress tracking"""
        logger.info(f"Pulling model {model_name}")
        
        try:
            # Track the pull in metrics
            self.metrics.record_request(model_name, "pull", "start")
            
            # Send pull request
            client = await self.get_http_client()
            
            # Use streaming request to monitor progress
            async with client.stream(
                "POST",
                f"{self.ollama_base_url}/api/pull",
                json={"name": model_name},
                timeout=300.0  # Longer timeout for pulls
            ) as response:
                response.raise_for_status()
                
                # Process progress updates
                async for line in response.aiter_lines():
                    try:
                        progress = json.loads(line)
                        logger.debug(f"Pull progress for {model_name}: {progress}")
                    except (json.JSONDecodeError, UnicodeDecodeError):
                        pass
                        
            # Record successful pull
            self.metrics.record_request(model_name, "pull", "success")
            logger.info(f"Successfully pulled model {model_name}")
            
        except Exception as e:
            # Record failed pull
            self.metrics.record_request(model_name, "pull", "error")
            self.metrics.record_error(model_name, "pull_error")
            
            logger.error(f"Failed to pull model {model_name}: {str(e)}")
            raise
    
    async def _notify_model_pulled(self, model_name: str) -> None:
        """Notify plugins when a model is pulled"""
        for plugin in self._plugins:
            try:
                if hasattr(plugin, "on_model_pulled"):
                    await plugin.on_model_pulled(model_name)
            except Exception as e:
                logger.error(f"Error in plugin on_model_pulled: {str(e)}")
    
    # ---------- Enhanced Model Listing ----------
    async def list_available_models(self) -> Dict[str, Any]:
        """List available models with metadata and statistics"""
        await self.refresh_available_models()
        
        # Prepare model data with enhanced information
        models_with_metadata = []
        models_data = self._available_models.get("models", [])
        
        # Process each model with parallel detail fetching
        model_details_tasks = []
        
        for model in models_data:
            model_name = model.get("name", "")
            if not model_name:
                continue
                
            # Create task to fetch model details
            task = asyncio.create_task(self._get_model_details(model_name))
            model_details_tasks.append((model_name, task))
        
        # Wait for all detail tasks to complete
        for model_name, task in model_details_tasks:
            try:
                details = await task
                
                # Get base model data
                base_model = next((m for m in models_data if m.get("name") == model_name), {})
                
                # Create enhanced model info
                model_info = {
                    "id": model_name,
                    "name": model_name,
                    "provider": "ollama",
                    "parameters": details.get("parameters", {}),
"context_window": details.get("parameters", {}).get("context_length"),
                    "modelfile": details.get("modelfile", ""),
                    "license": details.get("license", ""),
                    "tags": base_model.get("tags", []),
                    "size": details.get("size", 0),
                    "status": self._determine_model_status(model_name),
                    "popularity": self._get_model_popularity(model_name),
                    "last_used": self._get_model_last_used(model_name),
                    "capabilities": self._infer_model_capabilities(model_name, details),
                    "metadata": {
                        "family": self._determine_model_family(model_name),
                        "variant": self._determine_model_variant(model_name),
                        "quantization": self._determine_model_quantization(model_name),
                        "version": self._extract_model_version(model_name)
                    }
                }
                
                models_with_metadata.append(model_info)
            except Exception as e:
                logger.warning(f"Error getting details for model {model_name}: {str(e)}")
                # Add with minimal info
                models_with_metadata.append({
                    "id": model_name,
                    "name": model_name,
                    "provider": "ollama",
                    "tags": next((m.get("tags", []) for m in models_data if m.get("name") == model_name), []),
                    "status": self._determine_model_status(model_name)
                })
        
        # Sort models by popularity (most popular first)
        models_with_metadata.sort(key=lambda m: m.get("popularity", 0), reverse=True)
        
        return {
            "models": models_with_metadata,
            "total": len(models_with_metadata),
            "timestamp": datetime.now().isoformat() + "Z",
            "cached": True,
            "registry_id": self.instance_id
        }
    
    @circuit(failure_threshold=3, recovery_timeout=30)
    async def _get_model_details(self, model_name: str) -> Dict[str, Any]:
        """Get detailed information about a model with caching and resilience"""
        # Check cache for model details first
        cache_key = f"model_details:{model_name}"
        
        try:
            # Try to get from cache
            cached_result = await self.cache_manager.get(cache_key)
            if cached_result:
                return cached_result
                
            # Call API to get model details
            result = await self._safe_api_call(
                "POST",
                f"{self.ollama_base_url}/api/show",
                model=model_name,
                operation="get_model_details",
                json={"name": model_name},
                timeout=10.0  # Short timeout for details
            )
            
            # Cache result
            await self.cache_manager.set(cache_key, result)
            
            return result
        except Exception as e:
            logger.warning(f"Error getting details for {model_name}: {str(e)}")
            # Return minimal info
            return {"name": model_name}
            
    def _determine_model_status(self, model_name: str) -> str:
        """Determine the current status of a model"""
        if model_name in self._model_cache:
            return "loaded"
        return "available"
        
    def _get_model_popularity(self, model_name: str) -> int:
        """Get the popularity score for a model based on usage statistics"""
        # This would be connected to actual usage metrics in a production system
        # For now, use a simple heuristic
        if model_name in self._model_cache:
            return 10  # Highest score for cached models
            
        # Base score on model name recognition
        if "gpt" in model_name.lower():
            return 9
        if "llama" in model_name.lower():
            return 8
        if "mistral" in model_name.lower():
            return 7
        if "mixtral" in model_name.lower():
            return 7
        if "claude" in model_name.lower():
            return 8
        if "stable" in model_name.lower():
            return 6
        
        return 5  # Default score
        
    def _get_model_last_used(self, model_name: str) -> Optional[str]:
        """Get the timestamp when model was last used"""
        if model_name in self._model_cache:
            service = self._model_cache[model_name]
            if hasattr(service, "last_accessed"):
                return service.last_accessed.isoformat() + "Z"
        return None
        
    def _infer_model_capabilities(self, model_name: str, details: Dict[str, Any]) -> Dict[str, bool]:
        """Infer model capabilities based on name and parameters"""
        capabilities = {
            "text_generation": True,  # Base capability
            "chat": False,
            "embeddings": False,
            "vision": False,
            "audio": False,
            "function_calling": False
        }
        
        # Infer from model name
        name_lower = model_name.lower()
        
        if "chat" in name_lower:
            capabilities["chat"] = True
            
        if "vision" in name_lower or "vit" in name_lower or "visual" in name_lower:
            capabilities["vision"] = True
            
        if "embed" in name_lower:
            capabilities["embeddings"] = True
            
        if "audio" in name_lower or "whisper" in name_lower or "voice" in name_lower:
            capabilities["audio"] = True
            
        # Infer from model parameters if available
        params = details.get("parameters", {})
        if params:
            # Large context window suggests more capabilities
            context_len = params.get("context_length", 0)
            if isinstance(context_len, str):
                try:
                    context_len = int(context_len)
                except (ValueError, TypeError):
                    context_len = 0
                    
            if context_len > 8000:
                capabilities["chat"] = True
                
        return capabilities
        
    def _determine_model_family(self, model_name: str) -> str:
        """Determine the model family from the name"""
        name_lower = model_name.lower()
        
        if "gpt-4" in name_lower:
            return "gpt-4"
        elif "gpt-3.5" in name_lower:
            return "gpt-3.5"
        elif "llama" in name_lower:
            if "llama-2" in name_lower:
                return "llama-2"
            elif "llama-3" in name_lower:
                return "llama-3"
            else:
                return "llama"
        elif "mistral" in name_lower:
            return "mistral"
        elif "mixtral" in name_lower:
            return "mixtral"
        elif "codellama" in name_lower:
            return "codellama"
        elif "falcon" in name_lower:
            return "falcon"
        elif "vicuna" in name_lower:
            return "vicuna"
        elif "wizard" in name_lower:
            return "wizard"
        elif "phi" in name_lower:
            return "phi"
        elif "qwen" in name_lower:
            return "qwen"
        elif "gemma" in name_lower:
            return "gemma"
        else:
            return "other"
            
    def _determine_model_variant(self, model_name: str) -> str:
        """Determine the model variant from the name"""
        name_lower = model_name.lower()
        
        if "instruct" in name_lower:
            return "instruct"
        elif "chat" in name_lower:
            return "chat"
        elif "base" in name_lower:
            return "base"
        elif "code" in name_lower:
            return "code"
        else:
            return "default"
            
    def _determine_model_quantization(self, model_name: str) -> str:
        """Determine the model quantization from the name"""
        name_lower = model_name.lower()
        
        # Look for common quantization patterns
        if "q4_0" in name_lower:
            return "q4_0"
        elif "q4_1" in name_lower:
            return "q4_1"
        elif "q5_0" in name_lower:
            return "q5_0"
        elif "q5_1" in name_lower:
            return "q5_1"
        elif "q8_0" in name_lower:
            return "q8_0"
        elif "q2_k" in name_lower:
            return "q2_k"
        elif "q3_k" in name_lower:
            return "q3_k"
        elif "q4_k" in name_lower:
            return "q4_k"
        elif "q5_k" in name_lower:
            return "q5_k"
        elif "q6_k" in name_lower:
            return "q6_k"
        elif "k_quant" in name_lower:
            return "k_quant"
        elif "gptq" in name_lower:
            return "gptq"
        elif "gguf" in name_lower:
            return "gguf"
        elif "ggml" in name_lower:
            return "ggml"
        else:
            # Try to find bit precision
            for bit in ["4bit", "5bit", "6bit", "8bit"]:
                if bit in name_lower:
                    return bit
                    
            return "unknown"
            
    def _extract_model_version(self, model_name: str) -> Optional[str]:
        """Extract the model version from the name if present"""
        import re
        
        # Look for semantic versioning patterns (e.g., v1.0.0, 2.0, etc.)
        patterns = [
            r'v(\d+\.\d+\.\d+)',  # v1.0.0
            r'v(\d+\.\d+)',       # v1.0
            r'[^0-9](\d+\.\d+\.\d+)',  # 1.0.0
            r'[^0-9](\d+\.\d+)[^0-9]'  # 1.0
        ]
        
        for pattern in patterns:
            match = re.search(pattern, model_name)
            if match:
                return match.group(1)
                
        return None
        
    # ---------- Enhanced Cache Management ----------
    async def clear_cache(self, model_name: Optional[str] = None) -> None:
        """Clear model cache with graceful handling and optional targeting"""
        async with self._cache_lock:
            if model_name:
                # Clear specific model
                if model_name in self._model_cache:
                    logger.info(f"Clearing cache for model {model_name}")
                    service = self._model_cache.pop(model_name)
                    
                    # Properly close service
                    try:
                        if hasattr(service, "close"):
                            await service.close()
                        elif hasattr(service, "__aexit__"):
                            await service.__aexit__(None, None, None)
                    except Exception as e:
                        logger.warning(f"Error closing service for {model_name}: {str(e)}")
                    
                    # Update metrics
                    self.metrics.update_cache_size(len(self._model_cache))
                    self.metrics.record_cache_operation("clear_item")
            else:
                # Clear all models
                logger.info("Clearing entire model cache")
                
                # First close all services
                for model_name, service in list(self._model_cache.items()):
                    try:
                        if hasattr(service, "close"):
                            await service.close()
                        elif hasattr(service, "__aexit__"):
                            await service.__aexit__(None, None, None)
                    except Exception as e:
                        logger.warning(f"Error closing service for {model_name}: {str(e)}")
                
                # Then clear the cache
                self._model_cache.clear()
                self._available_models = None
                self._last_models_refresh = 0
                
                # Update metrics
                self.metrics.update_cache_size(0)
                self.metrics.record_cache_operation("clear_all")
                
    # ---------- Plugin System ----------
    def _register_builtin_plugins(self) -> None:
        """Register built-in plugins"""
        # Register built-in plugins here
        pass
        
    def register_plugin(self, plugin: Any) -> None:
        """Register a plugin with the factory"""
        if not hasattr(plugin, "name"):
            logger.warning("Attempted to register plugin without a name attribute")
            return
            
        logger.info(f"Registering plugin: {plugin.name}")
        self._plugins.append(plugin)
        
        # Call initialization hook if present
        if hasattr(plugin, "initialize") and callable(plugin.initialize):
            try:
                if asyncio.iscoroutinefunction(plugin.initialize):
                    # Create task to initialize the plugin
                    self._start_background_task(plugin.initialize(self))
                else:
                    plugin.initialize(self)
            except Exception as e:
                logger.error(f"Error initializing plugin {plugin.name}: {str(e)}")
                
    def register_model_handler(self, pattern: str, handler: Callable) -> None:
        """Register a custom model handler for specific model types"""
        self._model_handlers[pattern] = handler
        logger.info(f"Registered custom model handler for pattern: {pattern}")
        
    # ---------- Health Checking ----------
    async def check_health(self) -> Dict[str, Any]:
        """Comprehensive health check with service and model status"""
        health_info = {
            "healthy": True,
            "timestamp": datetime.now().isoformat() + "Z",
            "uptime_seconds": (datetime.now() - self.start_time).total_seconds(),
            "instance_id": self.instance_id,
            "hostname": self.hostname,
            "version": "1.0.0",  # Replace with actual version
            "services": {},
            "models": {},
            "resources": {},
            "active_operations": len(self._active_operations)
        }
        
        # Check Ollama service health
        try:
            ollama_health = await self._check_ollama_health()
            health_info["services"]["ollama"] = ollama_health
            
            if ollama_health.get("status") != "healthy":
                health_info["healthy"] = False
        except Exception as e:
            logger.error(f"Error checking Ollama health: {str(e)}")
            health_info["services"]["ollama"] = {
                "status": "unhealthy",
                "error": str(e)
            }
            health_info["healthy"] = False
            
        # Check model health
        for model_name, service in list(self._model_cache.items()):
            try:
                model_healthy = await self._check_model_health(model_name, service)
                health_info["models"][model_name] = model_healthy
                
                # Update metrics
                self.metrics.update_model_availability(
                    model_name, 
                    model_healthy.get("available", False)
                )
            except Exception as e:
                logger.error(f"Error checking health for model {model_name}: {str(e)}")
                health_info["models"][model_name] = {
                    "available": False,
                    "status": "error",
                    "error": str(e)
                }
                
                # Update metrics
                self.metrics.update_model_availability(model_name, False)
        
        # Check system resources
        try:
            health_info["resources"] = await self.resource_monitor.get_resource_usage()
        except Exception as e:
            logger.error(f"Error checking resource usage: {str(e)}")
            health_info["resources"] = {"error": str(e)}
            
        return health_info
        
    async def _check_ollama_health(self) -> Dict[str, Any]:
        """Check Ollama service health"""
        try:
            start_time = time.time()
            
            # Check API connection
            response = await self._safe_api_call(
                "GET",
                f"{self.ollama_base_url}/api/version",
                operation="health_check",
                timeout=5.0  # Short timeout for health check
            )
            
            # Calculate response time
            response_time = time.time() - start_time
            
            return {
                "status": "healthy",
                "version": response.get("version", "unknown"),
                "response_time_ms": round(response_time * 1000, 2),
                "endpoint": self.ollama_base_url
            }
        except Exception as e:
            logger.error(f"Ollama health check failed: {str(e)}")
            return {
                "status": "unhealthy",
                "error": str(e),
                "endpoint": self.ollama_base_url
            }
            
    async def _check_model_health(self, model_name: str, service: BaseModelService) -> Dict[str, Any]:
        """Check health of a specific model"""
        try:
            # Use service's validate method
            start_time = time.time()
            is_valid = await service.validate()
            validation_time = time.time() - start_time
            
            if is_valid:
                return {
                    "available": True,
                    "status": "ready",
                    "validation_time_ms": round(validation_time * 1000, 2),
                    "last_accessed": service.last_accessed.isoformat() + "Z" if hasattr(service, "last_accessed") else None
                }
            else:
                return {
                    "available": False,
                    "status": "invalid",
                    "validation_time_ms": round(validation_time * 1000, 2)
                }
        except Exception as e:
            logger.error(f"Error validating model {model_name}: {str(e)}")
            return {
                "available": False,
                "status": "error",
                "error": str(e)
            }
            
    # ---------- Statistics and Diagnostics ----------
    async def get_statistics(self) -> Dict[str, Any]:
        """Get comprehensive statistics and diagnostics"""
        # Cache statistics
        cache_stats = await self.cache_manager.get_stats()
        
        # Load balancer statistics
        load_balancer_stats = await self.load_balancer.get_stats()
        
        # Resource statistics
        resource_stats = await self.resource_monitor.get_resource_usage()
        
        # Performance metrics
        performance = {
            "request_count": self.request_count,
            "error_count": self.error_count,
            "error_rate": self.error_count / max(1, self.request_count),
            "concurrent_requests": self.concurrent_requests,
            "max_concurrent_requests": self.max_concurrent_requests,
            "active_operations": len(self._active_operations)
        }
        
        # System information
        system_info = {
            "hostname": self.hostname,
            "instance_id": self.instance_id,
            "uptime_seconds": (datetime.now() - self.start_time).total_seconds(),
            "python_version": platform.python_version(),
            "platform": f"{platform.system()} {platform.release()}",
            "network_interfaces": self.network_info
        }
        
        return {
            "timestamp": datetime.now().isoformat() + "Z",
            "cache": cache_stats,
            "load_balancer": load_balancer_stats,
            "resources": resource_stats,
            "performance": performance,
            "system": system_info,
            "models": {
                "total": len(self._model_cache),
                "details": [
                    {
                        "name": model_name,
                        "last_accessed": service.last_accessed.isoformat() + "Z" if hasattr(service, "last_accessed") else None,
                        "status": "loaded"
                    }
                    for model_name, service in self._model_cache.items()
                ]
            }
        }
        
    # ---------- Cleanup and Shutdown ----------
    async def shutdown(self) -> None:
        """Graceful shutdown of all components"""
        logger.info("Initiating factory shutdown")
        
        # Signal shutdown to background tasks
        self._shutdown_event.set()
        
        # Wait for background tasks to complete (with timeout)
        if self._background_tasks:
            pending_tasks = list(self._background_tasks)
            logger.info(f"Waiting for {len(pending_tasks)} background tasks to complete")
            try:
                _, pending = await asyncio.wait(pending_tasks, timeout=10)
                if pending:
                    logger.warning(f"{len(pending)} background tasks did not complete gracefully")
                    for task in pending:
                        if not task.done():
                            task.cancel()
            except Exception as e:
                logger.error(f"Error waiting for background tasks: {str(e)}")
        
        # Close HTTP client
        if self._http_client is not None:
            logger.info("Closing HTTP client")
            await self._http_client.aclose()
            self._http_client = None
        
        # Clear model cache (will close all services)
        logger.info("Clearing model cache")
        await self.clear_cache()
        
        # Shutdown plugins
        for plugin in self._plugins:
            try:
                if hasattr(plugin, "shutdown") and callable(plugin.shutdown):
                    if asyncio.iscoroutinefunction(plugin.shutdown):
                        await plugin.shutdown()
                    else:
                        plugin.shutdown()
            except Exception as e:
                logger.error(f"Error shutting down plugin {getattr(plugin, 'name', 'unknown')}: {str(e)}")
        
        # Close config manager
        await self.config_manager.close()
        
        logger.info("Factory shutdown complete")
        
    # ---------- Context Manager Support ----------
    async def __aenter__(self):
        """Async context manager entry"""
        await self.initialize()
        return self
        
    async def __aexit__(self, exc_type, exc_value, traceback):
        """Async context manager exit"""
        await self.shutdown()
                    