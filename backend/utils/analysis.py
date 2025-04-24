# utils/analysis.py
import logging
import httpx
import asyncio
from typing import Dict, Any, List, Tuple
from fastapi import HTTPException, Request, UploadFile

from .file_io import read_and_decode_file
from .chunking_adapter import split_file_into_chunks
from .resource_monitor import calculate_adaptive_timeout

import os

logger = logging.getLogger(__name__)

# Constants
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
MAX_RETRIES = int(os.environ.get("MAX_RETRIES", "3"))

async def validate_model(model: str, request: Request) -> bool:
    """
    Validate that the specified model is available.
    
    Args:
        model: Name of the model to validate
        request: The FastAPI request object
        
    Returns:
        True if the model is valid and available
        
    Raises:
        HTTPException: If the model is not available
    """
    logger_extra = {"request_id": getattr(request.state, 'request_id', 'unknown')}
    
    try:
        # If model is an OpenAI model, check if API key is configured
        if model.startswith("gpt-"):
            if not os.environ.get("OPENAI_API_KEY"):
                logger.error(
                    "OpenAI model requested but API key not configured", 
                    extra=logger_extra
                )
                raise HTTPException(
                    status_code=400,
                    detail="OpenAI API is not configured. Please select an Ollama model or configure OpenAI API key."
                )
            logger.info(f"Validated OpenAI model: {model}", extra=logger_extra)
            return True
        
        # For Ollama models, check if the model is available
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            response.raise_for_status()
            
            models_data = response.json()
            available_models = [m["name"] for m in models_data.get("models", [])]
            
            if model not in available_models:
                logger.error(
                    f"Model {model} not found in available models: {available_models}", 
                    extra=logger_extra
                )
                raise HTTPException(
                    status_code=400,
                    detail=f"Model '{model}' is not available. Available models: {', '.join(available_models)}"
                )
            
            logger.info(f"Validated Ollama model: {model}", extra=logger_extra)
            return True
    
    except httpx.HTTPError as e:
        logger.error(f"HTTP error validating model: {str(e)}", extra=logger_extra)
        raise HTTPException(
            status_code=503,
            detail=f"Error connecting to model service: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Unexpected error validating model: {str(e)}", extra=logger_extra)
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error validating model: {str(e)}"
        )

async def analyze_chunk(
    prompt: str, 
    model: str, 
    timeout: float, 
    request: Request
) -> str:
    """
    Analyze a text chunk using the specified model.
    
    Args:
        prompt: The prompt to send to the model
        model: Name of the model to use
        timeout: Request timeout in seconds
        request: The FastAPI request object
        
    Returns:
        The model's response text
        
    Raises:
        HTTPException: If analysis fails
    """
    logger_extra = {"request_id": getattr(request.state, 'request_id', 'unknown')}
    
    if not prompt or not prompt.strip():
        logger.error("Empty prompt provided", extra=logger_extra)
        raise ValueError("Empty prompt provided")
    
    retry_delay = 5
    error_messages = []
    
    # Determine if we're using OpenAI or Ollama
    if model.startswith("gpt-"):
        # OpenAI API
        openai_api_key = os.environ.get("OPENAI_API_KEY")
        if not openai_api_key:
            raise HTTPException(
                status_code=400,
                detail="OpenAI API key not configured"
            )
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {openai_api_key}"
        }
        
        for attempt in range(MAX_RETRIES):
            try:
                logger.info(
                    f"Sending request to OpenAI for model {model} (attempt {attempt+1}/{MAX_RETRIES})",
                    extra=logger_extra
                )
                
                async with httpx.AsyncClient(timeout=timeout) as client:
                    response = await client.post(
                        "https://api.openai.com/v1/chat/completions",
                        json={
                            "model": model,
                            "messages": [{"role": "user", "content": prompt}],
                            "temperature": 0.7,
                            "max_tokens": 4000
                        },
                        headers=headers
                    )
                    response.raise_for_status()
                    
                    response_data = response.json()
                    if not response_data or 'choices' not in response_data or not response_data['choices']:
                        error_msg = f"Invalid response from OpenAI: {response_data}"
                        logger.warning(error_msg, extra=logger_extra)
                        error_messages.append(error_msg)
                        await asyncio.sleep(retry_delay)
                        retry_delay *= 2  # exponential backoff
                        continue
                    
                    logger.info("Successfully received response from OpenAI", extra=logger_extra)
                    return response_data['choices'][0]['message']['content']
            
            except (httpx.ReadTimeout, httpx.RequestError, httpx.HTTPStatusError) as e:
                error_msg = f"OpenAI request attempt {attempt+1} failed: {str(e)}"
                logger.warning(f"{error_msg}, retrying in {retry_delay}s...", extra=logger_extra)
                error_messages.append(error_msg)
                await asyncio.sleep(retry_delay)
                retry_delay *= 2  # exponential backoff
    else:
        # Ollama API
        for attempt in range(MAX_RETRIES):
            try:
                logger.info(
                    f"Sending request to Ollama for model {model} (attempt {attempt+1}/{MAX_RETRIES})",
                    extra=logger_extra
                )
                
                async with httpx.AsyncClient(timeout=timeout) as client:
                    response = await client.post(
                        f"{OLLAMA_BASE_URL}/api/generate",
                        json={
                            "model": model,
                            "prompt": prompt,
                            "stream": False
                        }
                    )
                    response.raise_for_status()
                    
                    response_data = response.json()
                    if not response_data or 'response' not in response_data:
                        error_msg = f"Invalid response from Ollama: {response_data}"
                        logger.warning(error_msg, extra=logger_extra)
                        error_messages.append(error_msg)
                        await asyncio.sleep(retry_delay)
                        retry_delay *= 2  # exponential backoff
                        continue
                    
                    logger.info("Successfully received response from Ollama", extra=logger_extra)
                    return response_data.get('response', '')
            
            except (httpx.ReadTimeout, httpx.RequestError, httpx.HTTPStatusError) as e:
                error_msg = f"Ollama request attempt {attempt+1} failed: {str(e)}"
                logger.warning(f"{error_msg}, retrying in {retry_delay}s...", extra=logger_extra)
                error_messages.append(error_msg)
                await asyncio.sleep(retry_delay)
                retry_delay *= 2  # exponential backoff
    
    # If we get here, all retries failed
    error_detail = "; ".join(error_messages[-2:])  # Only include most recent errors
    logger.error(
        f"Failed to analyze content after {MAX_RETRIES} retries: {error_detail}", 
        extra=logger_extra
    )
    raise HTTPException(
        status_code=500,
        detail=f"Failed to analyze content after {MAX_RETRIES} retries. Last error: {error_messages[-1] if error_messages else 'Unknown error'}"
    )

async def process_uploaded_file(
    file: UploadFile, 
    max_tokens_per_chunk: int, 
    timeout: float, 
    logger_extra: Dict[str, Any]
) -> Tuple[str, List[str], float]:
    """
    Process an uploaded file and prepare it for analysis.
    
    Args:
        file: The uploaded file
        max_tokens_per_chunk: Maximum tokens per chunk
        timeout: The base timeout value
        logger_extra: Logger extra context dict
        
    Returns:
        Tuple of (file content, chunks, adaptive timeout)
    """
    try:
        # Read file content
        content = await read_and_decode_file(file)
        
        # Calculate adaptive timeout based on content length
        adaptive_timeout = calculate_adaptive_timeout(timeout, len(content))
        
        # Split content into chunks
        chunks = adaptive_chunk_text(content, max_tokens_per_chunk)
        
        # Filter out empty chunks
        chunks = [chunk for chunk in chunks if chunk.strip()]
        
        if not chunks:
            raise HTTPException(
                status_code=400,
                detail="No valid content found in uploaded file"
            )
        
        logger.info(
            f"Successfully processed file {file.filename}: {len(content)} chars, "
            f"{len(chunks)} chunks, {adaptive_timeout:.1f}s timeout",
            extra=logger_extra
        )
        
        return content, chunks, adaptive_timeout
    
    except HTTPException:
        # Pass through HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error processing uploaded file: {str(e)}", extra=logger_extra)
        raise HTTPException(
            status_code=500,
            detail=f"Error processing file: {str(e)}"
        )