# utils/file_io.py
import logging
from fastapi import UploadFile, HTTPException

logger = logging.getLogger(__name__)

async def read_and_decode_file(file: UploadFile) -> str:
    """
    Read and decode file content with proper error handling.
    
    Args:
        file: The FastAPI UploadFile object
        
    Returns:
        The decoded file content as a string
        
    Raises:
        HTTPException: If the file is empty or cannot be read
    """
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