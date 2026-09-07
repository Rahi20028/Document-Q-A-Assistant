// TypeScript interfaces matching the FastAPI backend Pydantic models

export interface DocumentInfo {
  id: string;
  filename: string;
  file_type: string;
  chunk_count: number;
  uploaded_at: string;
}

export interface UploadResponse {
  success: boolean;
  document: DocumentInfo;
  message: string;
}

export interface SourceChunk {
  content: string;
  source: string;
  chunk_index: number;
}

export interface AskRequest {
  question: string;
  top_k?: number;
}

export interface AskResponse {
  answer: string;
  sources: SourceChunk[];
  question: string;
}

export interface DocumentListResponse {
  documents: DocumentInfo[];
  total_chunks: number;
}

export interface DeleteResponse {
  success: boolean;
  message: string;
}

// Chat UI types (frontend-only)
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceChunk[];
  timestamp: Date;
  isLoading?: boolean;
}
