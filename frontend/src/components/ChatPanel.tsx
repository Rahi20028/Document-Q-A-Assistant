"use client";

import React, { useEffect, useRef, useState } from "react";
import type { ChatMessage, DocumentInfo } from "@/types";
import { askQuestion } from "@/lib/api";
import MessageBubble from "./MessageBubble";

interface Props {
  documents: DocumentInfo[];
  onOpenDrawer?: () => void;
}

export default function ChatPanel({ documents, onOpenDrawer }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const hasDocuments = documents.length > 0;

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
  }

  async function sendMessage(questionText?: string) {
    const question = (questionText ?? input).trim();
    if (!question || isLoading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: question,
      timestamp: new Date(),
    };

    const loadingMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setInput("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
    setIsLoading(true);

    try {
      const response = await askQuestion({ question, top_k: 5 });

      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingMsg.id
            ? {
                ...m,
                content: response.answer,
                sources: response.sources,
                isLoading: false,
              }
            : m
        )
      );
    } catch (err: unknown) {
      const errorText =
        err instanceof Error ? err.message : "An unexpected error occurred.";

      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingMsg.id
            ? {
                ...m,
                content: `Unable to retrieve answer: ${errorText}`,
                isLoading: false,
              }
            : m
        )
      );
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function clearChat() {
    setMessages([]);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Reading Room Header */}
      <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-[#22303E] mb-3 sm:mb-4 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-serif-title text-base sm:text-lg font-medium text-[#EBF1F7]">
              Reading Room
            </h2>
            {hasDocuments && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1C2A38] text-[#2DD4BF] border border-[#22303E]">
                {documents.length} {documents.length === 1 ? "source active" : "sources active"}
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#8295A8] mt-0.5">
            {hasDocuments
              ? "Inquiries are cross-referenced with your indexed folios."
              : "Awaiting documents before synthesis can begin."}
          </p>
        </div>

        {messages.length > 0 && (
          <button
            id="clear-chat-btn"
            type="button"
            onClick={clearChat}
            className="text-xs text-[#8295A8] hover:text-[#EBF1F7] px-2.5 py-1.5 rounded-md hover:bg-[#16202B] border border-transparent hover:border-[#22303E] transition-colors"
          >
            Clear conversation
          </button>
        )}
      </div>

      {/* Messages / Conversation Area */}
      <div className="flex-1 overflow-y-auto px-1 scrollbar-quiet min-h-0">
        {messages.length === 0 ? (
          /* Empty state tailored to application voice */
          <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center px-4 py-8">
            {!hasDocuments ? (
              /* State A: Zero documents uploaded */
              <div className="max-w-md mx-auto flex flex-col items-center">
                <div className="w-14 h-14 rounded-2xl bg-[#16202B] border border-[#22303E] flex items-center justify-center text-[#8295A8] mb-4 shadow-xs">
                  <svg className="w-7 h-7 text-[#2DD4BF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                </div>

                <h3 className="font-serif-title text-lg sm:text-xl font-medium text-[#EBF1F7] mb-2">
                  Your reading room is quiet
                </h3>
                <p className="text-xs sm:text-sm text-[#8295A8] leading-relaxed max-w-sm mb-6">
                  Add research papers, agreements, technical specifications, or archives to your folio to unlock grounded reasoning.
                </p>

                <button
                  type="button"
                  onClick={onOpenDrawer}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#16202B] hover:bg-[#1C2A38] border border-[#22303E] hover:border-[#314457] text-xs font-medium text-[#EBF1F7] transition-all duration-150"
                >
                  <svg className="w-4 h-4 text-[#2DD4BF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  <span>Open Document Folio to Upload</span>
                </button>
              </div>
            ) : (
              /* State B: Documents present, awaiting first question */
              <div className="max-w-md mx-auto flex flex-col items-center">
                <div className="w-12 h-12 rounded-xl bg-[#16202B] border border-[#22303E] flex items-center justify-center text-[#2DD4BF] mb-3">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                  </svg>
                </div>

                <h3 className="font-serif-title text-base sm:text-lg font-medium text-[#EBF1F7] mb-1">
                  Ready to examine your folio
                </h3>
                <p className="text-xs text-[#8295A8] mb-5">
                  Pose a question or select a prompt to begin inquiry across your {documents.length}{" "}
                  {documents.length === 1 ? "document" : "documents"}.
                </p>

                {/* Thoughtful prompt recommendations */}
                <div className="flex flex-wrap gap-2 justify-center max-w-sm">
                  {[
                    "Provide a comprehensive executive summary",
                    "What are the principal findings or terms?",
                    "Highlight potential risks or obligations",
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => sendMessage(prompt)}
                      className="text-xs bg-[#16202B] hover:bg-[#1C2A38] border border-[#22303E] hover:border-[#314457] text-[#8295A8] hover:text-[#EBF1F7] px-3 py-1.5 rounded-lg transition-colors text-left"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Render Active Messages */
          <div className="py-2">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
                sources={msg.sources}
                isLoading={msg.isLoading}
              />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Pinned Bottom Composer */}
      <div className="pt-3 border-t border-[#22303E] flex-shrink-0">
        <div
          className={`relative flex items-end gap-2 sm:gap-3 rounded-xl p-2 sm:p-2.5 transition-all duration-200 border ${
            !hasDocuments
              ? "bg-[#16202B]/40 border-[#22303E] opacity-65 cursor-not-allowed"
              : "bg-[#16202B] border-[#22303E] focus-within:border-[#2DD4BF]/60 focus-within:ring-1 focus-within:ring-[#2DD4BF]/30"
          }`}
        >
          <textarea
            ref={inputRef}
            id="chat-input"
            rows={1}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={
              hasDocuments
                ? "Inquire about your documents… (Enter to send, Shift+Enter for new line)"
                : "Upload documents to enable the reading room composer"
            }
            disabled={!hasDocuments || isLoading}
            className="flex-1 bg-transparent text-sm text-[#EBF1F7] placeholder-[#536475] resize-none outline-none leading-relaxed px-2 py-1 disabled:cursor-not-allowed min-h-[28px] max-h-[140px]"
          />

          <button
            id="send-message-btn"
            type="button"
            aria-label="Send question"
            onClick={() => sendMessage()}
            disabled={!hasDocuments || isLoading || !input.trim()}
            className={`flex-shrink-0 w-10 h-10 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center transition-all duration-150 ${
              hasDocuments && input.trim() && !isLoading
                ? "bg-[#2DD4BF] hover:bg-[#14B8A6] text-[#0E141B] shadow-xs active:scale-95"
                : "bg-[#1C2A38] text-[#536475] cursor-not-allowed"
            }`}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-[#0E141B] border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            )}
          </button>
        </div>

        <div className="flex items-center justify-between text-[11px] text-[#536475] px-1 mt-2">
          <span>Grounded retrieval via FAISS vector store</span>
          <span className="hidden sm:inline">Groq llama-3.1-8b-instant</span>
        </div>
      </div>
    </div>
  );
}
