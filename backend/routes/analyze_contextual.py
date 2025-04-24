from fastapi import APIRouter, Request, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse, JSONResponse
from datetime import datetime, timezone
import json
from typing import Optional
import logging
from utils import split_file_into_chunks, estimate_token_count
from utils.file_io import read_and_decode_file
from utils.resource_monitor import calculate_adaptive_timeout
from utils.analysis import analyze_chunk, validate_model, process_uploaded_file

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/contextual")
async def analyze_contextual(
    request: Request,
    file: UploadFile = File(...),
    model: str = Form("mistral"),
    max_tokens_per_chunk: int = Form(10000),
    timeout: float = Form(1200.0),
):
    """
    Perform contextual analysis of a file, considering the entire context of the file
    while analyzing each chunk.

    Args:
        request: The FastAPI request object
        file: The uploaded file to analyze
        model: The model to use for analysis
        max_tokens_per_chunk: Maximum tokens per chunk
        timeout: Request timeout in seconds

    Returns:
        StreamingResponse with analysis results
    """
    logger_extra = {"request_id": getattr(request.state, 'request_id', 'unknown')}
    try:
        # Validate model
        await validate_model(model, request)

        # Process file and calculate adaptive timeout
        content, chunks, adaptive_timeout = await process_uploaded_file(
            file, max_tokens_per_chunk, timeout, logger_extra
        )

        chunk_count = len(chunks)
        logger.info(
            "Split into %s chunks for contextual analysis", 
            chunk_count, 
            extra=logger_extra
        )

        if chunk_count == 0:
            raise HTTPException(
                status_code=400,
                detail="File content could not be processed into valid chunks",
            )

        async def stream_analysis():
            total_chunks = len(chunks)
            context = ""  # Maintain context between chunks

            for idx, chunk in enumerate(chunks, 1):
                try:
                    logger.info(
                        "Processing contextual chunk %s/%s",
                        idx,
                        total_chunks,
                        extra=logger_extra,
                    )

                    # Build prompt with previous context
                    prompt = (
                        "Analyze this WHATS'ON crash dump chunk %s/%s in context. "
                        "Previous context: %s\n\nCurrent chunk:\n%s"
                    ) % (idx, total_chunks, context, chunk)

                    # Get analysis
                    analysis = await analyze_chunk(
                        prompt, 
                        model=model, 
                        timeout=adaptive_timeout, 
                        request=request
                    )

                    # Update context with current analysis
                    context = analysis

                    result = {
                        "chunk": idx,
                        "total_chunks": total_chunks,
                        "analysis": analysis,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }

                    yield json.dumps(result) + "\n"

                    logger.info(
                        "Contextual analysis chunk %s/%s completed",
                        idx,
                        total_chunks,
                        extra=logger_extra,
                    )

                except Exception as e:
                    error_message = "Error analyzing chunk %s: %s" % (idx, str(e))
                    logger.error(error_message, extra=logger_extra)
                    yield json.dumps(
                        {
                            "chunk": idx,
                            "total_chunks": total_chunks,
                            "analysis": error_message,
                            "error": str(e),
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        }
                    ) + "\n"

        return StreamingResponse(
            stream_analysis(),
            media_type="application/json",
            headers={"X-Request-ID": getattr(request.state, 'request_id', 'unknown')},
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(
            "Unexpected error in contextual analysis: %s", 
            str(e), 
            extra=logger_extra
        )
        raise HTTPException(
            status_code=500, 
            detail=f"Error processing file: {str(e)}"
        ) from e

