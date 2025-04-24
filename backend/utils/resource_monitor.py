# utils/resource_monitor.py
import logging
import psutil
import os
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

def calculate_adaptive_timeout(base_timeout: float, content_length: int) -> float:
    """
    Calculate an adaptive timeout based on content length and system load.
    
    Args:
        base_timeout: The base timeout in seconds
        content_length: The length of the content to process
        
    Returns:
        An adjusted timeout value in seconds
    """
    try:
        # Get system metrics
        cpu_load = psutil.cpu_percent(interval=0.1) / 100.0  # 0.0 to 1.0
        memory_available = psutil.virtual_memory().available / psutil.virtual_memory().total
        
        # Scale timeout based on content length
        # Longer content needs more time
        content_factor = min(3.0, max(1.0, content_length / 10000))
        
        # Scale based on system load
        # High CPU usage or low memory should increase timeout
        system_load_factor = 1.0 + (cpu_load * 0.5) + ((1.0 - memory_available) * 0.5)
        
        # Calculate final timeout
        adjusted_timeout = base_timeout * content_factor * system_load_factor
        
        # Add some logging
        logger.info(
            f"Adaptive timeout: {adjusted_timeout:.2f}s (base: {base_timeout}s, "
            f"content: {content_length} chars, CPU: {cpu_load*100:.1f}%, "
            f"Mem: {memory_available*100:.1f}% free)"
        )
        
        # Ensure reasonable bounds
        return min(3600.0, max(base_timeout, adjusted_timeout))
    
    except Exception as e:
        logger.warning(f"Error calculating adaptive timeout: {str(e)}, using base timeout")
        return base_timeout