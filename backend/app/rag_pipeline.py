"""
RAG pipeline — core logic for the Document Q&A system.

Responsibilities:
  1. Chunking: split loaded documents using RecursiveCharacterTextSplitter
  2. Embedding: HuggingFace sentence-transformers/all-MiniLM-L6-v2 (local, no API key)
  3. Vector store: FAISS with disk persistence (vectorstore/ directory)
  4. Retrieval + generation: top-k FAISS search → ChatGroq (llama-3.1-8b-instant)

All uploaded documents are merged into a SINGLE FAISS index so users can
ask cross-document questions. The index is re-saved to disk after each upload.
"""

import os
import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Tuple, Dict, Any, Optional

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from app.models import DocumentInfo, SourceChunk

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
VECTORSTORE_DIR = BASE_DIR / "vectorstore"
VECTORSTORE_DIR.mkdir(parents=True, exist_ok=True)

# Metadata file tracks which documents have been indexed
DOCS_METADATA_FILE = VECTORSTORE_DIR / "documents.json"
# FAISS index lives here
FAISS_INDEX_PATH = str(VECTORSTORE_DIR / "faiss_index")

# ---------------------------------------------------------------------------
# Chunking settings
# ---------------------------------------------------------------------------
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200

# ---------------------------------------------------------------------------
# Embeddings model (loaded once at module level to avoid re-downloading)
# ---------------------------------------------------------------------------
logger.info("Loading HuggingFace embeddings model (all-MiniLM-L6-v2)…")
_embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2",
    model_kwargs={"device": "cpu"},
    encode_kwargs={"normalize_embeddings": True},
)
logger.info("Embeddings model ready.")

# ---------------------------------------------------------------------------
# In-memory FAISS index reference (populated on startup if index exists)
# ---------------------------------------------------------------------------
_faiss_index: Optional[FAISS] = None


def _load_existing_index() -> Optional[FAISS]:
    """Load FAISS index from disk if it exists."""
    if (VECTORSTORE_DIR / "faiss_index.faiss").exists():
        logger.info("Loading existing FAISS index from disk…")
        index = FAISS.load_local(
            FAISS_INDEX_PATH,
            _embeddings,
            allow_dangerous_deserialization=True,
        )
        logger.info("FAISS index loaded.")
        return index
    return None


def _save_index(index: FAISS) -> None:
    """Persist the FAISS index to disk."""
    index.save_local(FAISS_INDEX_PATH)
    logger.info("FAISS index saved to disk.")


# ---------------------------------------------------------------------------
# Document metadata helpers
# ---------------------------------------------------------------------------

def _load_docs_metadata() -> Dict[str, Dict]:
    """Load document registry from disk."""
    if DOCS_METADATA_FILE.exists():
        with open(DOCS_METADATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def _save_docs_metadata(metadata: Dict[str, Dict]) -> None:
    """Persist document registry to disk."""
    with open(DOCS_METADATA_FILE, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def chunk_documents(documents: List[Document]) -> List[Document]:
    """
    Split a list of LangChain Documents into smaller chunks.

    Args:
        documents: Raw documents from document_loader.load_document().

    Returns:
        List of chunked Documents, each ≤ CHUNK_SIZE chars.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    chunks = splitter.split_documents(documents)
    logger.info(f"Split into {len(chunks)} chunks (size={CHUNK_SIZE}, overlap={CHUNK_OVERLAP})")
    return chunks


def embed_and_store(
    chunks: List[Document],
    filename: str,
    file_type: str,
) -> DocumentInfo:
    """
    Embed document chunks and merge them into the global FAISS index.

    Args:
        chunks:    Chunked LangChain Documents.
        filename:  Original filename (for metadata).
        file_type: File extension (e.g. '.pdf').

    Returns:
        DocumentInfo describing the newly indexed document.
    """
    global _faiss_index

    # Assign a unique document ID and tag every chunk with it
    doc_id = str(uuid.uuid4())
    for i, chunk in enumerate(chunks):
        chunk.metadata["doc_id"] = doc_id
        chunk.metadata["chunk_index"] = i
        chunk.metadata["source"] = filename

    # Build or merge into existing FAISS index
    if _faiss_index is None:
        logger.info("Creating new FAISS index…")
        _faiss_index = FAISS.from_documents(chunks, _embeddings)
    else:
        logger.info("Merging new chunks into existing FAISS index…")
        new_index = FAISS.from_documents(chunks, _embeddings)
        _faiss_index.merge_from(new_index)

    _save_index(_faiss_index)

    # Register document in metadata store
    meta = _load_docs_metadata()
    meta[doc_id] = {
        "id": doc_id,
        "filename": filename,
        "file_type": file_type,
        "chunk_count": len(chunks),
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }
    _save_docs_metadata(meta)

    logger.info(f"Indexed doc '{filename}' (id={doc_id}, chunks={len(chunks)})")
    return DocumentInfo(**meta[doc_id])


def retrieve_and_answer(
    question: str,
    top_k: int = 5,
) -> Tuple[str, List[SourceChunk]]:
    """
    Retrieve relevant chunks from FAISS and generate an answer using Groq.

    Args:
        question: The user's natural-language question.
        top_k:    Number of chunks to retrieve.

    Returns:
        Tuple of (answer_text, list_of_source_chunks).

    Raises:
        ValueError: If no documents have been indexed yet.
        RuntimeError: If Groq API call fails.
    """
    global _faiss_index

    # Lazy-load index on first query (handles server restarts)
    if _faiss_index is None:
        _faiss_index = _load_existing_index()

    if _faiss_index is None:
        raise ValueError(
            "No documents have been indexed yet. "
            "Please upload at least one document before asking questions."
        )

    # FAISS similarity search
    logger.info(f"Retrieving top-{top_k} chunks for: '{question[:80]}…'")
    retrieved_docs = _faiss_index.similarity_search(question, k=top_k)

    if not retrieved_docs:
        raise ValueError(
            "No relevant content found in the indexed documents for your question."
        )

    # Build source chunk objects
    source_chunks = [
        SourceChunk(
            content=doc.page_content,
            source=doc.metadata.get("source", "unknown"),
            chunk_index=doc.metadata.get("chunk_index", 0),
        )
        for doc in retrieved_docs
    ]

    # Build context string from retrieved chunks
    context = "\n\n---\n\n".join(
        f"[Source: {sc.source}, chunk #{sc.chunk_index}]\n{sc.content}"
        for sc in source_chunks
    )

    # Build the prompt
    prompt = ChatPromptTemplate.from_messages([
        (
            "system",
            (
                "You are a helpful assistant that answers questions based strictly "
                "on the provided document context. "
                "If the answer cannot be found in the context, say so clearly. "
                "Do not make up information. Be concise and accurate."
            ),
        ),
        (
            "human",
            (
                "Context from the uploaded documents:\n\n"
                "{context}\n\n"
                "---\n\n"
                "Question: {question}\n\n"
                "Answer:"
            ),
        ),
    ])

    # Initialise Groq LLM (reads GROQ_API_KEY from environment)
    groq_api_key = os.environ.get("GROQ_API_KEY")
    if not groq_api_key:
        raise RuntimeError(
            "GROQ_API_KEY environment variable is not set. "
            "Please add it to your .env file."
        )

    llm = ChatGroq(
        model="openai/gpt-oss-20b",
        api_key=groq_api_key,
        temperature=0.1,          # low temperature for factual answers
        max_tokens=1024,
    )

    # Chain: prompt → LLM → string output
    chain = prompt | llm | StrOutputParser()

    logger.info("Calling Groq API…")
    try:
        answer = chain.invoke({"context": context, "question": question})
    except Exception as e:
        logger.error(f"Groq API error: {e}")
        raise RuntimeError(f"LLM generation failed: {str(e)}") from e

    logger.info("Answer generated successfully.")
    return answer, source_chunks


def get_all_documents() -> Tuple[List[DocumentInfo], int]:
    """
    Return all indexed documents and the total chunk count.

    Returns:
        Tuple of (list_of_DocumentInfo, total_chunk_count).
    """
    meta = _load_docs_metadata()
    docs = [DocumentInfo(**v) for v in meta.values()]
    total_chunks = sum(d.chunk_count for d in docs)
    return docs, total_chunks


def delete_document(doc_id: str) -> bool:
    """
    Remove a document from the registry.

    Because FAISS does not support selective deletion efficiently, we rebuild
    the index from scratch by re-embedding all remaining documents' chunks
    that are already stored (we filter by doc_id metadata at search time).

    NOTE: For simplicity, we mark the document as deleted in metadata and
    rebuild the in-memory index from the remaining stored vectors by
    re-loading and filtering. Since FAISS Community edition doesn't expose
    per-vector deletion, we rebuild the entire index on delete.

    Returns:
        True if the document was found and removed, False otherwise.
    """
    global _faiss_index

    meta = _load_docs_metadata()
    if doc_id not in meta:
        return False

    # Remove from metadata registry
    del meta[doc_id]
    _save_docs_metadata(meta)

    # Rebuild FAISS index from remaining documents
    # We use the stored chunks in the current in-memory index and filter by doc_id
    if _faiss_index is not None and meta:
        # Retrieve ALL vectors from the current index and filter out deleted doc
        all_docs_and_scores = _faiss_index.similarity_search_with_score("", k=100_000)
        remaining_docs = [
            doc for doc, _ in all_docs_and_scores
            if doc.metadata.get("doc_id") != doc_id
        ]
        if remaining_docs:
            _faiss_index = FAISS.from_documents(remaining_docs, _embeddings)
            _save_index(_faiss_index)
        else:
            # No documents left — clear the index
            _faiss_index = None
            # Remove FAISS files from disk
            for ext in [".faiss", ".pkl"]:
                p = Path(FAISS_INDEX_PATH + ext)
                if p.exists():
                    p.unlink()
    elif not meta:
        # Last document deleted — clear everything
        _faiss_index = None
        for ext in [".faiss", ".pkl"]:
            p = Path(FAISS_INDEX_PATH + ext)
            if p.exists():
                p.unlink()

    logger.info(f"Document {doc_id} deleted. Remaining docs: {len(meta)}")
    return True


# ---------------------------------------------------------------------------
# Initialise on import — load existing index if present
# ---------------------------------------------------------------------------
_faiss_index = _load_existing_index()
