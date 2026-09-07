"use client";

import React, { useState } from "react";
import type { SourceChunk } from "@/types";

interface Props {
  role: "user" | "assistant";
  content: string;
  sources?: SourceChunk[];
  isLoading?: boolean;
}

export default function MessageBubble({
  role,
  content,
  sources,
  isLoading,
}: Props) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const isUser = role === "user";

  return (
    <div
      className={`flex gap-3 sm:gap-4 ${
        isUser ? "flex-row-reverse justify-start" : "flex-row justify-start"
      } mb-6 sm:mb-8 items-start animate-message`}
    >
      {/* Monogram / Entity Badge */}
      <div
        aria-hidden="true"
        className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium select-none border ${
          isUser
            ? "bg-[#1C2A38] border-[#24374A] text-[#8295A8]"
            : "bg-[#2DD4BF]/10 border-[#2DD4BF]/30 text-[#2DD4BF]"
        }`}
      >
        {isUser ? (
          "You"
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
        )}
      </div>

      {/* Message Content Container */}
      <div
        className={`max-w-[88%] sm:max-w-[80%] flex flex-col gap-2 ${
          isUser ? "items-end" : "items-start w-full"
        }`}
      >
        {isUser ? (
          /* User Message Box */
          <div className="px-4 py-3 rounded-2xl rounded-tr-xs bg-[#1C2A38] border border-[#24374A] text-sm text-[#EBF1F7] leading-relaxed shadow-xs">
            <span className="whitespace-pre-wrap">{content}</span>
          </div>
        ) : (
          /* Assistant Reading Box */
          <div className="w-full">
            {isLoading ? (
              /* Calm skeleton loader + contextual message */
              <div
                role="status"
                aria-live="polite"
                aria-label="Assistant is analyzing documents"
                className="p-4 rounded-xl border border-[#22303E] bg-[#16202B] space-y-3"
              >
                <div className="flex items-center gap-2 text-xs text-[#8295A8]">
                  <span className="w-2 h-2 rounded-full bg-[#2DD4BF] animate-pulse" />
                  <span>Synthesizing answer from retrieved passages…</span>
                </div>
                <div className="space-y-2 pt-1">
                  <div className="h-3.5 bg-[#1C2A38] rounded w-5/6 skeleton-shimmer" />
                  <div className="h-3.5 bg-[#1C2A38] rounded w-full skeleton-shimmer" />
                  <div className="h-3.5 bg-[#1C2A38] rounded w-3/4 skeleton-shimmer" />
                </div>
              </div>
            ) : (
              /* Assistant prose response */
              <div className="text-[14.5px] sm:text-[15px] leading-[1.7] text-[#EBF1F7] font-sans tracking-normal selection:bg-[#2DD4BF]/20 selection:text-[#EBF1F7]">
                <div className="whitespace-pre-wrap">{content}</div>
              </div>
            )}

            {/* Collapsible Source Citations */}
            {!isLoading && sources && sources.length > 0 && (
              <div className="mt-4 pt-3 border-t border-[#22303E]/60 w-full">
                <button
                  type="button"
                  aria-expanded={sourcesOpen}
                  aria-label="Toggle source citations"
                  onClick={() => setSourcesOpen((prev) => !prev)}
                  className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-[#8295A8] hover:text-[#2DD4BF] hover:bg-[#16202B] border border-transparent hover:border-[#22303E] transition-colors duration-150"
                >
                  <svg
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      sourcesOpen ? "rotate-90" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="font-mono text-[11px]">
                    {sources.length} {sources.length === 1 ? "source excerpt" : "source excerpts"} referenced
                  </span>
                </button>

                {sourcesOpen && (
                  <div className="mt-2.5 space-y-2.5">
                    {sources.map((src, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-[#22303E] bg-[#16202B] p-3 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-[11px] text-[#E5A93C] font-medium truncate max-w-[200px] sm:max-w-xs">
                              {src.source}
                            </span>
                            <span className="text-[10px] text-[#536475]">·</span>
                            <span className="text-[10px] font-mono text-[#8295A8]">
                              chunk #{src.chunk_index}
                            </span>
                          </div>
                        </div>
                        <p className="text-[#8295A8] text-[12px] leading-relaxed italic border-l-2 border-[#24374A] pl-2.5 my-1 font-serif-title">
                          "{src.content.trim()}"
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
