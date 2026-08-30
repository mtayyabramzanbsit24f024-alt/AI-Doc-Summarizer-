"""
main.py
-------
FastAPI backend + frontend server for the Document Summarizer.

Endpoints:
  GET  /                -> frontend
  GET  /api/health     -> health check
  POST /api/upload     -> upload PDF/DOCX/TXT/MD
  POST /api/summarize  -> generate AI summary
  POST /api/chat       -> ask questions about uploaded document
"""

import os
import uuid
import shutil
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from utils.extract_text import extract_text
from utils.ai_service import summarize_document, chat_with_document


# ============================================================
# APP
# ============================================================

app = FastAPI(title="Document Summarizer API")


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent

FRONTEND_DIR = PROJECT_DIR / "frontend"
UPLOAD_DIR = BASE_DIR / "uploads"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================
# DOCUMENT STORE
# ============================================================

# Demo/single-user in-memory storage.
# doc_id -> document information
DOCUMENTS: dict[str, dict] = {}


# ============================================================
# REQUEST MODELS
# ============================================================

class ChatRequest(BaseModel):
    doc_id: str
    message: str
    history: list = []


class SummarizeRequest(BaseModel):
    doc_id: str


# ============================================================
# FRONTEND
# ============================================================

@app.get("/", include_in_schema=False)
async def serve_frontend():
    """
    Serve the frontend directly from the FastAPI server.
    """

    index_file = FRONTEND_DIR / "index.html"

    if not index_file.exists():
        raise HTTPException(
            status_code=500,
            detail="Frontend index.html was not found."
        )

    return FileResponse(index_file)


# Serve frontend CSS, JS and other static files.
if FRONTEND_DIR.exists():
    app.mount(
        "/static",
        StaticFiles(directory=str(FRONTEND_DIR)),
        name="static"
    )


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/api/health")
def health():
    return {
        "status": "ok"
    }


# ============================================================
# UPLOAD DOCUMENT
# ============================================================

@app.post("/api/upload")
async def upload_document(file: UploadFile = File(...)):

    allowed_ext = (
        ".pdf",
        ".docx",
        ".txt",
        ".md"
    )

    filename = file.filename or ""

    if not filename.lower().endswith(allowed_ext):
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported file type. "
                "Please upload a PDF, DOCX, TXT or MD file."
            ),
        )

    doc_id = str(uuid.uuid4())

    # Prevent problematic path characters from being used directly.
    safe_filename = Path(filename).name

    saved_path = UPLOAD_DIR / f"{doc_id}_{safe_filename}"

    try:

        with open(saved_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Extract document text.
        text = extract_text(
            str(saved_path),
            safe_filename
        )

    except ValueError as e:

        if saved_path.exists():
            saved_path.unlink()

        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

    except Exception:

        if saved_path.exists():
            saved_path.unlink()

        raise HTTPException(
            status_code=400,
            detail=(
                f"Could not read '{safe_filename}'. "
                "Make sure it is a valid, unprotected "
                "PDF, DOCX, TXT or MD file. "
                "Old .doc files are not supported; "
                "please save them as .docx first."
            ),
        )

    finally:

        await file.close()

    # Store document in memory.
    DOCUMENTS[doc_id] = {
        "filename": safe_filename,
        "text": text,
        "path": str(saved_path),
    }

    word_count = len(text.split())

    return {
        "doc_id": doc_id,
        "filename": safe_filename,
        "word_count": word_count,
        "preview": text[:400],
    }


# ============================================================
# SUMMARIZE
# ============================================================

@app.post("/api/summarize")
def summarize(req: SummarizeRequest):

    doc = DOCUMENTS.get(req.doc_id)

    if not doc:
        raise HTTPException(
            status_code=404,
            detail="Document not found. Please re-upload."
        )

    try:

        summary = summarize_document(
            doc["text"]
        )

    except RuntimeError as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"Summarization failed: {e}"
        )

    return {
        "doc_id": req.doc_id,
        "filename": doc["filename"],
        "summary": summary,
    }


# ============================================================
# CHAT
# ============================================================

@app.post("/api/chat")
def chat(req: ChatRequest):

    doc = DOCUMENTS.get(req.doc_id)

    if not doc:
        raise HTTPException(
            status_code=404,
            detail="Document not found. Please re-upload."
        )

    if not req.message.strip():
        raise HTTPException(
            status_code=400,
            detail="Message cannot be empty."
        )

    try:

        reply = chat_with_document(
            doc["text"],
            req.message,
            req.history
        )

    except RuntimeError as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"Chat failed: {e}"
        )

    return {
        "reply": reply
    }


# ============================================================
# RUN DIRECTLY
# ============================================================

if __name__ == "__main__":

    import uvicorn

    port = int(
        os.getenv(
            "PORT",
            "8000"
        )
    )

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True
    )