from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
import asyncio
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import the chunk splitter function from utils.py
from utils import split_file_into_chunks

async def analyze_chunk(prompt, model="mistral", max_retries=3, timeout=900.0):
    retry_count = 0
    while retry_count < max_retries:
        try:
            logger.info(f"Sending request to Ollama for model {model} (attempt {retry_count+1}/{max_retries})")
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post("http://localhost:11434/api/generate", json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False
                })
                response.raise_for_status()
                logger.info("Successfully received response from Ollama")
                return response.json().get('response')
        except httpx.ReadTimeout:
            retry_count += 1
            if retry_count >= max_retries:
                logger.error(f"Ollama service timed out after {max_retries} attempts")
                raise HTTPException(status_code=504, detail=f"Ollama service timed out after {max_retries} attempts")
            wait_time = 2 ** retry_count
            logger.warning(f"Request timed out. Retrying in {wait_time} seconds...")
            await asyncio.sleep(wait_time)
        except httpx.HTTPError as e:
            logger.error(f"HTTP error communicating with Ollama: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error communicating with Ollama: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint to verify if Ollama service is available"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get("http://localhost:11434/api/version")
            response.raise_for_status()
            return {"status": "healthy", "ollama_version": response.json().get("version")}
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(status_code=503, detail=f"Ollama service unavailable: {str(e)}")

@app.post("/analyze/")
async def analyze(file: UploadFile = File(...), model: str = "mistral", max_tokens_per_chunk: int = 10000, timeout: float = 600.0):
    logger.info(f"Received file: {file.filename} for analysis using model {model}, max_tokens={max_tokens_per_chunk}, timeout={timeout}")
    
    try:
        content = (await file.read()).decode()
        file_size = len(content)
        logger.info(f"File size: {file_size} bytes")
        
        chunks = split_file_into_chunks(content, max_chunk_tokens=max_tokens_per_chunk)
        logger.info(f"Split into {len(chunks)} chunks")

        analyses = []
        for idx, chunk in enumerate(chunks, 1):
            logger.info(f"Processing chunk {idx}/{len(chunks)}")
            prompt = f"Analyze this WHATS'ON crash dump chunk {idx}/{len(chunks)}. Summarize briefly, clearly highlight potential causes, and recommended actions.\n\n{chunk}"
            try:
                analysis = await analyze_chunk(prompt, model=model, timeout=timeout)
                analyses.append(f"Chunk {idx} Analysis:\n{analysis}")
                logger.info(f"Successfully analyzed chunk {idx}/{len(chunks)}")
            except Exception as e:
                logger.error(f"Error analyzing chunk {idx}: {str(e)}")
                analyses.append(f"Chunk {idx} Analysis: Error - {str(e)}")

        combined_analysis = "\n\n---\n\n".join(analyses)
        logger.info("Analysis completed successfully")

        return {
            "full_analysis": combined_analysis,
            "metadata": {
                "total_chunks": len(chunks),
                "model_used": model,
                "timeout": timeout
            }
        }
    except Exception as e:
        logger.error(f"Error processing file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

# Add a model list endpoint to check available models
@app.get("/models")
async def list_models():
    """List all available models in Ollama"""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get("http://localhost:11434/api/tags")
            response.raise_for_status()
            return response.json()
    except Exception as e:
        logger.error(f"Failed to list models: {str(e)}")
        raise HTTPException(status_code=503, detail=f"Cannot retrieve model list: {str(e)}")