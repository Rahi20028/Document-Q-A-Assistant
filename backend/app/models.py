"""
Pydantic models defining the API request/response contracts
for the Document Q&A RAG backend.
"""

from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class DocumentInfo(BaseModel):
    """Represents a single uploaded and indexed document."""
    id: str
    filename: str
    file_type: str
    chunk_count: int
    uploaded_at: str


class UploadResponse(BaseModel):
    """Response returned after a successful document upload."""
    success: bool
    document: DocumentInfo
    message: str


class SourceChunk(BaseModel):
    """A single retrieved document chunk used to generate an answer."""
    content: str
    source: str          # filename the chunk came from
    chunk_index: int     # position of this chunk in the document


class AskRequest(BaseModel):
    """Request body for the /ask endpoint."""
    question: str
    top_k: int = 5       # number of chunks to retrieve (default 5)


class AskResponse(BaseModel):
    """Response returned after answering a question."""
    answer: str
    sources: List[SourceChunk]  # chunks used to generate the answer
    question: str


class DeleteResponse(BaseModel):
    """Response returned after deleting a document."""
    success: bool
    message: str


class DocumentListResponse(BaseModel):
    """Response for the GET /documents endpoint."""
    documents: List[DocumentInfo]
    total_chunks: int
