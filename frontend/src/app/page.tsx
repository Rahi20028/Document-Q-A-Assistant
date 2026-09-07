"use client";

import { useState, useEffect } from "react";
import type { DocumentInfo } from "@/types";
import UploadPanel from "@/components/UploadPanel";
import ChatPanel from "@/components/ChatPanel";

export default function Home() {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Close drawer on ESC key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isDrawerOpen) {
        setIsDrawerOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDrawerOpen]);

  // Prevent background scroll when mobile drawer is open
  useEffect(() => {
    if (isDrawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isDrawerOpen]);

  return (
    <main className="flex flex-col h-[100dvh] w-full overflow-hidden bg-[#0E141B] text-[#EBF1F7]">
      {/* ── Top Navigation Bar ────────────────────────────────── */}
      <header className="flex-shrink-0 h-16 px-4 sm:px-6 flex items-center justify-between border-b border-[#22303E] bg-[#16202B]/90 backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          {/* Mobile Drawer Trigger */}
          <button
            id="mobile-drawer-toggle"
            type="button"
            aria-label="Open document list drawer"
            aria-expanded={isDrawerOpen}
            onClick={() => setIsDrawerOpen(true)}
            className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg text-[#8295A8] hover:text-[#EBF1F7] hover:bg-[#1C2A38] border border-[#22303E] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>

          {/* Book / Folio Brand Mark */}
          <div className="w-9 h-9 rounded-lg bg-[#1C2A38] border border-[#22303E] flex items-center justify-center text-[#2DD4BF] shadow-xs">
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
              />
            </svg>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif-title text-base sm:text-lg font-medium tracking-tight text-[#EBF1F7]">
                Document Q&amp;A Assistant
              </h1>
              <span className="hidden sm:inline-block text-[11px] px-2 py-0.5 rounded-full bg-[#1C2A38] border border-[#22303E] text-[#8295A8]">
                Atelier
              </span>
            </div>
            <p className="text-[11px] text-[#8295A8] tracking-normal font-sans">
              Calm reading &amp; synthesis with Groq &amp; LangChain
            </p>
          </div>
        </div>

        {/* Right Status Indicator */}
        <div className="flex items-center gap-2">
          {/* Mobile docs counter pill */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="md:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#1C2A38] border border-[#22303E] text-xs text-[#8295A8] hover:text-[#EBF1F7]"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#2DD4BF]" />
            <span>{documents.length} {documents.length === 1 ? "doc" : "docs"}</span>
          </button>

          {/* Desktop status pill */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#16202B] border border-[#22303E] text-xs">
            <span className={`w-2 h-2 rounded-full ${documents.length > 0 ? "bg-[#2DD4BF]" : "bg-[#8295A8]/50"}`} />
            <span className="text-[#8295A8]">
              {documents.length > 0
                ? `${documents.length} document${documents.length !== 1 ? "s" : ""} in folio`
                : "Folio empty"}
            </span>
          </div>
        </div>
      </header>

      {/* ── Main Layout Workspace ────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Slide-Over Drawer Backdrop */}
        {isDrawerOpen && (
          <div
            role="presentation"
            onClick={() => setIsDrawerOpen(false)}
            className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity"
          />
        )}

        {/* Mobile Slide-Over Drawer */}
        <div
          id="mobile-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Documents management"
          className={`
            md:hidden fixed inset-y-0 left-0 z-50 w-[88vw] max-w-[340px] bg-[#16202B] border-r border-[#22303E]
            flex flex-col shadow-2xl transform transition-transform duration-300 ease-in-out
            ${isDrawerOpen ? "translate-x-0" : "-translate-x-full"}
          `}
        >
          <div className="flex items-center justify-between p-4 border-b border-[#22303E]">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[#EBF1F7]">Document Folio</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#1C2A38] text-[#8295A8] border border-[#22303E]">
                {documents.length}
              </span>
            </div>
            <button
              onClick={() => setIsDrawerOpen(false)}
              aria-label="Close drawer"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8295A8] hover:text-[#EBF1F7] hover:bg-[#1C2A38] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 scrollbar-quiet">
            <UploadPanel onDocumentsChange={setDocuments} />
          </div>
        </div>

        {/* Desktop Left Sidebar */}
        <aside
          aria-label="Documents management"
          className="hidden md:flex md:w-80 lg:w-[360px] flex-shrink-0 flex-col border-r border-[#22303E] bg-[#16202B]/60 backdrop-blur-xs overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto p-5 scrollbar-quiet">
            <UploadPanel onDocumentsChange={setDocuments} />
          </div>
        </aside>

        {/* Central Reading / Chat Room */}
        <section
          aria-label="Reading and conversation room"
          className="flex-1 flex flex-col overflow-hidden bg-[#0E141B]"
        >
          <div className="flex-1 overflow-hidden flex flex-col p-3 sm:p-5 lg:p-6 max-w-5xl mx-auto w-full">
            <ChatPanel
              documents={documents}
              onOpenDrawer={() => setIsDrawerOpen(true)}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
