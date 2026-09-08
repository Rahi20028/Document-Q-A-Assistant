"use client";

import React, { useCallback, useRef, useState, useEffect } from "react";
import type { DocumentInfo } from "@/types";
import { uploadDocument, getDocuments, deleteDocument } from "@/lib/api";

interface Props {
  onDocumentsChange: (docs: DocumentInfo[]) => void;
}

const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt", ".csv"];
const MAX_SIZE_MB = 50;

function FileTypeBadge({ ext }: { ext: string }) {
  const normalized = ext.toLowerCase().replace(".", "");
  const styles: Record<string, { bg: string; text: string; border: string }> = {
    pdf: { bg: "bg-[#E06C75]/10", text: "text-[#E06C75]", border: "border-[#E06C75]/25" },
    docx: { bg: "bg-[#38BDF8]/10", text: "text-[#38BDF8]", border: "border-[#38BDF8]/25" },
    txt: { bg: "bg-[#34D399]/10", text: "text-[#34D399]", border: "border-[#34D399]/25" },
    csv: { bg: "bg-[#E5A93C]/10", text: "text-[#E5A93C]", border: "border-[#E5A93C]/25" },
  };

  const style = styles[normalized] ?? {
    bg: "bg-[#8295A8]/10",
    text: "text-[#8295A8]",
    border: "border-[#8295A8]/25",
  };

  return (
    <span
      className={`font-mono font-semibold uppercase text-[10px] tracking-wider px-2 py-1 rounded border ${style.bg} ${style.text} ${style.border}`}
    >
      {normalized}
    </span>
  );
}

export default function UploadPanel({ onDocumentsChange }: Props) {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch documents on mount
  useEffect(() => {
    fetchDocuments();
  }, []);

  async function fetchDocuments() {
    try {
      const { documents: docs } = await getDocuments();
      setDocuments(docs);
      onDocumentsChange(docs);
    } catch {
      // Backend not ready yet
    }
  }

  function validateFile(file: File): string | null {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return `Unsupported format "${ext}". Allowed: PDF, DOCX, TXT, CSV.`;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return `File exceeds ${MAX_SIZE_MB} MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB).`;
    }
    if (file.size === 0) {
      return "Selected file is empty.";
    }
    return null;
  }

  async function handleFiles(files: FileList | File[]) {
    setUploadError(null);
    setUploadSuccess(null);
    const file = files[0];
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      setUploadError(validationError);
      return;
    }

    setUploading(true);
    setCurrentFileName(file.name);
    setUploadProgress(12);

    try {
      const progressTimer = setInterval(() => {
        setUploadProgress((p) => Math.min(p + 16, 88));
      }, 350);

      const result = await uploadDocument(file);
      clearInterval(progressTimer);
      setUploadProgress(100);

      setUploadSuccess(result.message || `Indexed "${file.name}"`);
      await fetchDocuments();

      setTimeout(() => {
        setUploadProgress(0);
        setUploading(false);
        setCurrentFileName(null);
        setUploadSuccess(null);
      }, 2200);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Failed to upload document.");
      setUploadProgress(0);
      setUploading(false);
      setCurrentFileName(null);
    }
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    []
  );

  async function executeDelete(docId: string) {
    setDeletingId(docId);
    setConfirmingDeleteId(null);
    try {
      await deleteDocument(docId);
      await fetchDocuments();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Failed to delete document.");
    } finally {
      setDeletingId(null);
    }
  }

  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  }

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Panel Header */}
      <div>
        <h2 className="font-serif-title text-lg font-medium text-[#EBF1F7]">
          Document Folio
        </h2>
        <p className="text-xs text-[#8295A8] mt-1 leading-relaxed">
          Upload reference manuscripts to build your grounded knowledge index.
        </p>
      </div>

      {/* State-Driven Drag & Drop Zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload document dropzone"
        onDragEnter={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !uploading) {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        className={`
          relative rounded-xl p-5 flex flex-col items-center justify-center text-center
          transition-all duration-200 cursor-pointer select-none min-h-[140px]
          border ${
            isDragging
              ? "border-[#2DD4BF] bg-[#2DD4BF]/5 ring-2 ring-[#2DD4BF]/20 scale-[1.01]"
              : "border-[#22303E] bg-[#16202B] hover:border-[#314457] hover:bg-[#1C2A38]"
          }
          ${uploading ? "pointer-events-none opacity-85" : ""}
          focus-visible:ring-2 focus-visible:ring-[#2DD4BF] focus-visible:outline-none
        `}
      >
        <input
          ref={fileInputRef}
          id="file-upload-input"
          type="file"
          className="hidden"
          accept=".pdf,.docx,.txt,.csv"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />

        {uploading ? (
          /* Uploading State */
          <div className="w-full flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-[#2DD4BF] border-t-transparent animate-spin" />
            <div className="w-full text-center">
              <p className="text-xs font-medium text-[#EBF1F7] truncate max-w-[240px] mx-auto">
                {currentFileName ?? "Processing document…"}
              </p>
              <p className="text-[11px] text-[#8295A8] mt-0.5">
                {uploadProgress < 75 ? "Extracting passages & indexing chunks…" : "Generating embeddings…"}
              </p>
            </div>
            {/* Progress track */}
            <div className="w-full bg-[#0E141B] rounded-full h-1.5 overflow-hidden border border-[#22303E]">
              <div
                className="h-full bg-[#2DD4BF] rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        ) : (
          /* Idle / Dragging State */
          <div className="flex flex-col items-center gap-2.5">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                isDragging ? "bg-[#2DD4BF]/15 text-[#2DD4BF]" : "bg-[#1C2A38] text-[#8295A8]"
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-[#EBF1F7]">
                {isDragging ? "Drop to ingest document" : "Select or drag file"}
              </p>
              <p className="text-[11px] text-[#8295A8] mt-0.5">
                PDF, DOCX, TXT, CSV · Up to {MAX_SIZE_MB} MB
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Upload Feedback Banners */}
      {uploadError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 p-3 rounded-lg bg-[#E06C75]/10 border border-[#E06C75]/30 text-xs text-[#E06C75]"
        >
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
          </svg>
          <span className="flex-1 leading-relaxed">{uploadError}</span>
          <button
            type="button"
            onClick={() => setUploadError(null)}
            className="text-[#E06C75] hover:text-white p-0.5"
            aria-label="Dismiss alert"
          >
            ✕
          </button>
        </div>
      )}

      {uploadSuccess && (
        <div
          role="status"
          className="flex items-start gap-2.5 p-3 rounded-lg bg-[#2DD4BF]/10 border border-[#2DD4BF]/30 text-xs text-[#2DD4BF]"
        >
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="flex-1 leading-relaxed">{uploadSuccess}</span>
        </div>
      )}

      {/* Indexed Document List */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between pb-2 border-b border-[#22303E] mb-3">
          <span className="text-xs font-medium text-[#8295A8] tracking-normal">
            Indexed Sources
          </span>
          <span className="text-[11px] font-mono text-[#8295A8] bg-[#1C2A38] px-2 py-0.5 rounded border border-[#22303E]">
            {documents.length}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 scrollbar-quiet">
          {documents.length === 0 ? (
            <div className="py-10 text-center flex flex-col items-center justify-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-[#16202B] border border-[#22303E] flex items-center justify-center text-[#536475]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <p className="text-xs text-[#8295A8]">No documents in folio yet</p>
              <p className="text-[11px] text-[#536475]">Uploaded files will appear here for reference.</p>
            </div>
          ) : (
            documents.map((doc) => {
              const isConfirming = confirmingDeleteId === doc.id;
              const isDeleting = deletingId === doc.id;

              return (
                <div
                  key={doc.id}
                  className="group relative rounded-lg border border-[#22303E] bg-[#16202B] hover:bg-[#1C2A38] p-3 transition-colors"
                >
                  {isConfirming ? (
                    /* Inline Delete Confirmation */
                    <div className="flex items-center justify-between gap-2 py-1">
                      <span className="text-xs text-[#E06C75] font-medium">Remove file?</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmingDeleteId(null)}
                          className="px-2 py-1 text-[11px] rounded bg-[#16202B] text-[#8295A8] hover:text-[#EBF1F7] border border-[#22303E]"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => executeDelete(doc.id)}
                          className="px-2 py-1 text-[11px] rounded bg-[#E06C75]/15 text-[#E06C75] hover:bg-[#E06C75]/25 border border-[#E06C75]/30 font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Standard Document Item */
                    <div className="flex items-start gap-3">
                      <div className="pt-0.5">
                        <FileTypeBadge ext={doc.file_type} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p
                          className="text-xs font-medium text-[#EBF1F7] truncate"
                          title={doc.filename}
                        >
                          {doc.filename}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="flex items-center gap-1 text-[10px] text-[#2DD4BF]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#2DD4BF]" />
                            Indexed
                          </span>
                          <span className="text-[10px] text-[#536475]">·</span>
                          <span className="text-[10px] text-[#8295A8]">
                            {doc.chunk_count} chunks
                          </span>
                          <span className="text-[10px] text-[#536475]">·</span>
                          <span className="text-[10px] text-[#8295A8]">
                            {formatDate(doc.uploaded_at)}
                          </span>
                        </div>
                      </div>

                      {/* Delete action button with minimum 36px touch target */}
                      <button
                        type="button"
                        id={`delete-doc-${doc.id}`}
                        aria-label={`Delete ${doc.filename}`}
                        onClick={() => setConfirmingDeleteId(doc.id)}
                        disabled={isDeleting}
                        className="w-8 h-8 -mr-1 flex items-center justify-center rounded-md text-[#536475] hover:text-[#E06C75] hover:bg-[#E06C75]/10 transition-colors opacity-80 sm:opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-40"
                      >
                        {isDeleting ? (
                          <div className="w-3.5 h-3.5 border-2 border-[#E06C75] border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
