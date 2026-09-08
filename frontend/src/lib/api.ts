import type {
  AskRequest,
  AskResponse,
  DeleteResponse,
  DocumentInfo,
  DocumentListResponse,
  UploadResponse,
} from "@/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      // ignore parse errors
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

/**
 * Upload a document file to the backend for indexing.
 * Accepts PDF, DOCX, TXT, or CSV files up to 50 MB.
 */
export async function uploadDocument(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${BASE_URL}/upload`, {
    method: "POST",
    body: form,
  });
  return handleResponse<UploadResponse>(res);
}

/**
 * Ask a question against all indexed documents.
 * Returns the LLM-generated answer and the source chunks used.
 */
export async function askQuestion(request: AskRequest): Promise<AskResponse> {
  const res = await fetch(`${BASE_URL}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  return handleResponse<AskResponse>(res);
}

/**
 * Fetch the list of all currently indexed documents.
 */
export async function getDocuments(): Promise<DocumentListResponse> {
  const res = await fetch(`${BASE_URL}/documents`);
  return handleResponse<DocumentListResponse>(res);
}

/**
 * Delete a document from the index by its ID.
 */
export async function deleteDocument(docId: string): Promise<DeleteResponse> {
  const res = await fetch(`${BASE_URL}/documents/${docId}`, {
    method: "DELETE",
  });
  return handleResponse<DeleteResponse>(res);
}
