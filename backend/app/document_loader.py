"""
Document loader — handles parsing of uploaded files into plain text.

Supported formats:
  - PDF  → via LangChain PyPDFLoader
  - DOCX → via LangChain Docx2txtLoader
  - TXT  → via LangChain TextLoader
  - CSV  → via LangChain CSVLoader
"""

import os
import csv
import logging
from pathlib import Path
from typing import List

from langchain_core.documents import Document
from langchain_community.document_loaders import (
    PyPDFLoader,
    Docx2txtLoader,
    TextLoader,
    CSVLoader,
)

logger = logging.getLogger(__name__)

# Allowed MIME types / extensions
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".csv"}


def is_allowed_file(filename: str) -> bool:
    """Return True if the file extension is supported."""
    suffix = Path(filename).suffix.lower()
    return suffix in ALLOWED_EXTENSIONS


def load_document(file_path: str, filename: str) -> List[Document]:
    """
    Load a document from disk and return a list of LangChain Document objects.

    Args:
        file_path: Absolute path to the saved upload file.
        filename:  Original filename (used to determine file type).

    Returns:
        List of LangChain Document objects with page_content and metadata.

    Raises:
        ValueError: If the file type is unsupported or the document is empty.
        RuntimeError: If the file cannot be parsed.
    """
    suffix = Path(filename).suffix.lower()

    if suffix not in ALLOWED_EXTENSIONS:
        raise ValueError(
            f"Unsupported file type '{suffix}'. "
            f"Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    logger.info(f"Loading document: {filename} (type: {suffix})")

    try:
        if suffix == ".pdf":
            docs = _load_pdf(file_path)
        elif suffix == ".docx":
            docs = _load_docx(file_path)
        elif suffix == ".txt":
            docs = _load_txt(file_path)
        elif suffix == ".csv":
            docs = _load_csv(file_path)
        else:
            raise ValueError(f"Unhandled extension: {suffix}")
    except Exception as e:
        logger.error(f"Failed to parse '{filename}': {e}")
        raise RuntimeError(f"Could not parse '{filename}': {str(e)}") from e

    # Attach the original filename to every document's metadata
    for doc in docs:
        doc.metadata["source"] = filename

    # Guard: ensure we extracted some content
    total_chars = sum(len(d.page_content.strip()) for d in docs)
    if total_chars == 0:
        raise ValueError(
            f"Document '{filename}' appears to be empty or contains no extractable text."
        )

    logger.info(f"Loaded {len(docs)} page(s) from '{filename}' ({total_chars} chars)")
    return docs


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _load_pdf(file_path: str) -> List[Document]:
    """Load PDF using PyPDFLoader (one Document per page)."""
    loader = PyPDFLoader(file_path)
    return loader.load()


def _load_docx(file_path: str) -> List[Document]:
    """Load DOCX using Docx2txtLoader (one Document for the whole file)."""
    loader = Docx2txtLoader(file_path)
    return loader.load()


def _load_txt(file_path: str) -> List[Document]:
    """Load plain text file using TextLoader."""
    loader = TextLoader(file_path, encoding="utf-8")
    return loader.load()


def _load_csv(file_path: str) -> List[Document]:
    """
    Load CSV using CSVLoader.
    Each row becomes a separate LangChain Document, making retrieval row-level.
    """
    loader = CSVLoader(file_path, encoding="utf-8")
    return loader.load()
