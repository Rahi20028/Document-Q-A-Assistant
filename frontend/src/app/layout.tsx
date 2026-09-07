import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-serif",
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Document Q&A Assistant — Atelier Reading Room",
  description:
    "Grounded document question-answering workspace powered by LangChain, FAISS, and Groq. Ingest PDFs, DOCX, TXT, and CSV with deep citations.",
  keywords: ["RAG", "Document QA", "AI Library", "LangChain", "FAISS", "Groq"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${newsreader.variable} h-full`}>
      <body className="h-full antialiased font-sans text-slate-100 bg-[#0E141B]">{children}</body>
    </html>
  );
}
