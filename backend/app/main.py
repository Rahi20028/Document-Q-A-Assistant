"""
FastAPI application — entry point for the Document Q&A RAG backend.

Endpoints:
  POST   /upload              — upload & index a document
  POST   /ask                 — ask a question against indexed documents
  GET    /documents           — list all indexed documents
  DELETE /documents/{doc_id}  — remove a document from the index
  GET    /health              — health check
"""

import logging
import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.models import (
    AskRequest,
    AskResponse,
    DeleteResponse,
    DocumentListResponse,
    UploadResponse,
)
from app.document_loader import is_allowed_file, load_document
from app.rag_pipeline import (
    chunk_documents,
    embed_and_store,
    retrieve_and_answer,
    get_all_documents,
    delete_document,
)

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Load environment variables from .env (if present)
# ---------------------------------------------------------------------------
load_dotenv()

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Document Q&A RAG API",
    description=(
        "RAG-powered document question-answering backend. "
        "Upload documents, ask questions, get answers grounded in your content."
    ),
    version="1.0.0",
)

# ---------------------------------------------------------------------------
# CORS — allow Next.js dev server (localhost:3000)
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# File size limit (50 MB)
# ---------------------------------------------------------------------------
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
async def health_check():
    """Simple health-check endpoint."""
    return {"status": "ok", "message": "Document Q&A RAG API is running"}


@app.post("/upload", response_model=UploadResponse)
async def upload_document(file: UploadFile = File(...)):
    """
    Accept a document upload, parse it, chunk it, embed it, and store it
    in the FAISS vector index.

    Supported formats: PDF, DOCX, TXT, CSV
    Max file size: 50 MB
    """
    # --- Validate file presence & filename ---
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file must have a valid filename.",
        )
    filename = file.filename

    # --- Validate file type ---
    if not is_allowed_file(filename):
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported file type. "
                f"Allowed types: PDF, DOCX, TXT, CSV. "
                f"Got: '{Path(filename).suffix}'"
            ),
        )

    # --- Read file content & check size ---
    content = await file.read()
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum allowed size is 50 MB.",
        )
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    file_ext = Path(filename).suffix.lower()

    # --- Save to temp file (loaders require a file path) ---
    with tempfile.NamedTemporaryFile(
        delete=False,
        suffix=file_ext,
    ) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        # --- Parse document ---
        try:
            docs = load_document(tmp_path, filename)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))
        except RuntimeError as e:
            raise HTTPException(status_code=500, detail=str(e))

        # --- Chunk ---
        chunks = chunk_documents(docs)

        if not chunks:
            raise HTTPException(
                status_code=422,
                detail="Document produced no chunks after splitting. Is it empty?",
            )

        # --- Embed & store ---
        file_type = file_ext.lstrip(".")
        doc_info = embed_and_store(chunks, filename, file_type)

    finally:
        # Always clean up temp file
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    return UploadResponse(
        success=True,
        document=doc_info,
        message=f"Successfully indexed '{filename}' ({doc_info.chunk_count} chunks).",
    )


@app.post("/ask", response_model=AskResponse)
async def ask_question(request: AskRequest):
    """
    Answer a natural-language question using the indexed documents.

    Retrieves the top-k most relevant chunks from FAISS, then sends them
    along with the question to Groq's LLM to generate a grounded answer.
    """
    if not request.question or not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    # Clamp top_k between 1 and 20
    top_k = max(1, min(request.top_k, 20))

    try:
        answer, sources = retrieve_and_answer(
            question=request.question.strip(),
            top_k=top_k,
        )
    except ValueError as e:
        # No documents indexed, or no relevant chunks found
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        # LLM or API error
        raise HTTPException(status_code=502, detail=str(e))

    return AskResponse(
        answer=answer,
        sources=sources,
        question=request.question,
    )


@app.get("/documents", response_model=DocumentListResponse)
async def list_documents():
    """Return all currently indexed documents and their metadata."""
    docs, total_chunks = get_all_documents()
    return DocumentListResponse(documents=docs, total_chunks=total_chunks)


@app.delete("/documents/{doc_id}", response_model=DeleteResponse)
async def remove_document(doc_id: str):
    """
    Remove a document from the index by its ID.

    This rebuilds the FAISS index without the deleted document's chunks.
    """
    success = delete_document(doc_id)
    if not success:
        raise HTTPException(
            status_code=404,
            detail=f"Document with id '{doc_id}' not found.",
        )
    return DeleteResponse(
        success=True,
        message=f"Document '{doc_id}' successfully removed from the index.",
    )
