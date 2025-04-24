# chunking_adapter.py

import logging
from typing import List
import re

# enterprise_chunker imports
from enterprise_chunker.chunker import EnterpriseChunker
from enterprise_chunker.orchestrator import SmartParallelChunker
from enterprise_chunker.config import ChunkingOptions
from enterprise_chunker.utils.token_estimation import BalancedTokenEstimator
from enterprise_chunker.models.enums import ContentFormat  # Add this import to fix the error
from routes.chunker_monitoring import register_chunker  # Import the registration function

logger = logging.getLogger(__name__)

# Global chunker instances to reuse
_default_chunker = None
_smart_chunker = None
_token_estimator = BalancedTokenEstimator()

def get_default_chunker() -> EnterpriseChunker:
    """Get or create the default chunker instance"""
    global _default_chunker
    if _default_chunker is None:
        _default_chunker = EnterpriseChunker()
        # Register for monitoring
        register_chunker("default", _default_chunker)
    return _default_chunker

def get_smart_chunker() -> SmartParallelChunker:
    """Get or create a smart parallel chunker instance"""
    global _smart_chunker
    if _smart_chunker is None:
        options = ChunkingOptions(
            max_tokens_per_chunk=4000,
            overlap_tokens=200
        )
        _smart_chunker = SmartParallelChunker(options=options)
        # Register for monitoring
        register_chunker("smart_parallel", _smart_chunker)
    return _smart_chunker

def split_file_into_chunks(
    file_content: str,
    max_chunk_tokens: int = 4000,
    overlap_tokens: int = 100
) -> List[str]:
    """
    Split file_content into chunks using enterprise_chunker.
    Uses the default chunker for standard operations.

    Args:
        file_content: full text to split
        max_chunk_tokens: maximum tokens per chunk
        overlap_tokens: tokens of overlap between chunks

    Returns:
        List of chunk strings
    """
    if not file_content:
        logger.warning("Empty content passed to split_file_into_chunks")
        return []

    try:
        chunker = get_default_chunker()
        # enterprise_chunker.adaptive_chunk_text respects these override params
        chunks = chunker.adaptive_chunk_text(
            file_content,
            max_tokens_per_chunk=max_chunk_tokens,
            overlap_tokens=overlap_tokens
        )
        logger.info(f"enterprise_chunker produced {len(chunks)} chunks")
        return chunks

    except Exception as e:
        logger.error(f"enterprise_chunker failed, falling back: {e}")
        # Add a simple fallback chunker instead of raising an exception
        return _simple_fallback_chunker(file_content, max_chunk_tokens, overlap_tokens)

def _simple_fallback_chunker(
    text: str, 
    max_tokens: int = 4000,
    overlap_tokens: int = 100
) -> List[str]:
    """
    Simple fallback chunker that splits text by paragraph boundaries.
    
    Args:
        text: Text to chunk
        max_tokens: Maximum tokens per chunk
        overlap_tokens: Tokens to overlap between chunks
        
    Returns:
        List of chunks
    """
    if not text:
        return []
        
    # Split by paragraph breaks
    paragraphs = re.split(r'\n\s*\n', text)
    
    # Estimate tokens per character (approximation)
    chars_per_token = 4.0
    
    chunks = []
    current_chunk = []
    current_length = 0
    
    for para in paragraphs:
        para_tokens = len(para) / chars_per_token
        
        # If this paragraph alone exceeds max tokens, split it by sentences
        if para_tokens > max_tokens:
            # Split by sentences
            sentences = re.split(r'(?<=[.!?])\s+', para)
            for sentence in sentences:
                sentence_tokens = len(sentence) / chars_per_token
                
                # Add to current chunk if it fits
                if current_length + sentence_tokens <= max_tokens:
                    current_chunk.append(sentence)
                    current_length += sentence_tokens
                # Otherwise start a new chunk
                else:
                    if current_chunk:
                        chunks.append(' '.join(current_chunk))
                    current_chunk = [sentence]
                    current_length = sentence_tokens
        # If adding this paragraph exceeds max tokens, start a new chunk
        elif current_length + para_tokens > max_tokens:
            chunks.append(' '.join(current_chunk))
            current_chunk = [para]
            current_length = para_tokens
        # Otherwise add to current chunk
        else:
            current_chunk.append(para)
            current_length += para_tokens
    
    # Add the last chunk if not empty
    if current_chunk:
        chunks.append(' '.join(current_chunk))
    
    # If we got no chunks, return the original text as one chunk
    if not chunks:
        return [text]
    
    return chunks

def split_file_with_smart_chunker(
    file_content: str,
    max_chunk_tokens: int = 4000,
    overlap_tokens: int = 200
) -> List[str]:
    """
    Split file content using the smart parallel chunker for more advanced chunking.
    
    Args:
        file_content: full text to split
        max_chunk_tokens: maximum tokens per chunk
        overlap_tokens: tokens of overlap between chunks
        
    Returns:
        List of chunk strings
    """
    if not file_content:
        logger.warning("Empty content passed to split_file_with_smart_chunker")
        return []
        
    try:
        smart_chunker = get_smart_chunker()
        # Override the default options if needed
        options = ChunkingOptions(
            max_tokens_per_chunk=max_chunk_tokens,
            overlap_tokens=overlap_tokens
        )
        chunks = smart_chunker.chunk_document(file_content, options=options)
        logger.info(f"smart_chunker produced {len(chunks)} chunks")
        return chunks
        
    except Exception as e:
        logger.error(f"smart_chunker failed, falling back to default chunker: {e}")
        # Fall back to the default chunker
        return split_file_into_chunks(file_content, max_chunk_tokens, overlap_tokens)

def estimate_token_count(text: str) -> int:
    """
    Estimate token count using the library's BalancedTokenEstimator
    so you get consistent counts with enterprise_chunker.

    Args:
        text: the text to estimate

    Returns:
        Estimated number of tokens
    """
    try:
        return _token_estimator.estimate(text)
    except Exception as e:
        logger.error(f"Token estimation failed: {e}")
        # Fallback to naive whitespace count
        return len(text.split())