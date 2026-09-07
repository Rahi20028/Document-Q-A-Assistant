# Document Q&A Assistant

A full-stack, locally-runnable **Retrieval-Augmented Generation (RAG)** application. Upload PDF, DOCX, TXT, or CSV documents, then ask natural-language questions — the app answers using only what's in your documents, citing the exact source chunks used.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (localhost:3000)                                       │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐ │
│  │  Upload Panel        │  │  Chat Panel                      │ │
│  │  • Drag-and-drop     │  │  • Question input                │ │
│  │  • Document list     │  │  • AI answer display             │ │
│  │  • Delete document   │  │  • Source citations              │ │
│  └──────────┬───────────┘  └──────────────┬───────────────────┘ │
└─────────────┼──────────────────────────────┼───────────────────┘
              │ POST /upload                 │ POST /ask
              ▼                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  FastAPI Backend (localhost:8000)                               │
│                                                                 │
│  /upload ──► document_loader ──► LangChain splitter            │
│              (PDF/DOCX/TXT/CSV)   (1000-char chunks)           │
│                                        │                        │
│                                        ▼                        │
│                              HuggingFace Embeddings             │
│                              (all-MiniLM-L6-v2, local)         │
│                                        │                        │
│                                        ▼                        │
│                              FAISS Vector Index                 │
│                              (persisted to vectorstore/)        │
│                                                                 │
│  /ask ─────► FAISS similarity search (top-k chunks)            │
│                    │                                            │
│                    ▼                                            │
│              ChatGroq (llama-3.1-8b-instant)                   │
│              → answer + source citations                        │
└─────────────────────────────────────────────────────────────────┘
```

**Key design decisions:**
- All documents share a **single FAISS index** — ask cross-document questions
- Embeddings run **100% locally** — no OpenAI or paid embedding API needed
- Only one external API key required: **Groq** (free tier)
- FAISS index is **persisted to disk** — survives server restarts

---

## Prerequisites

- **Python 3.10+** — [python.org](https://python.org)
- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **npm** (bundled with Node.js)

---

## Step 1 — Get a Free Groq API Key

1. Go to [console.groq.com](https://console.groq.com)
2. Sign up for a free account (no credit card required)
3. Navigate to **API Keys** → **Create API Key**
4. Copy the key — you'll need it in Step 3

The free Groq tier includes generous rate limits for `llama-3.1-8b-instant`.

---

## Step 2 — Set Up the Backend

```bash
# 1. Navigate to the backend directory
cd backend

# 2. Create a Python virtual environment
python -m venv venv

# 3. Activate the virtual environment
#    On Windows (PowerShell):
.\venv\Scripts\Activate.ps1
#    On macOS / Linux:
source venv/bin/activate

# 4. Install dependencies
pip install -r requirements.txt

# 5. Create your .env file from the template
copy .env.example .env      # Windows
# cp .env.example .env      # macOS/Linux
```

**Edit `backend/.env`** and replace the placeholder:
```
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> **Note:** The first time you start the backend, it will download the
> HuggingFace embedding model (~90 MB). This happens once and is cached.

---

## Step 3 — Start the Backend

```bash
# From the backend/ directory, with venv activated:
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Verify it's running: open [http://localhost:8000/health](http://localhost:8000/health)  
You should see: `{"status":"ok","message":"Document Q&A RAG API is running"}`

Interactive API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## Step 4 — Set Up and Start the Frontend

Open a **new terminal window** (keep the backend running):

```bash
# 1. Navigate to the frontend directory
cd frontend

# 2. Install dependencies (already done if you ran create-next-app)
npm install

# 3. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Project Structure

```
Document Q&A Assistant/
├── backend/
│   ├── app/
│   │   ├── main.py            ← FastAPI app + all API routes
│   │   ├── rag_pipeline.py    ← Chunking, embedding, FAISS, Groq LLM
│   │   ├── document_loader.py ← PDF/DOCX/TXT/CSV parsing
│   │   └── models.py          ← Pydantic request/response models
│   ├── vectorstore/           ← FAISS index files (auto-created at runtime)
│   ├── requirements.txt
│   ├── .env.example
│   └── .gitignore
│
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx       ← Main split-panel layout
    │   │   ├── layout.tsx     ← Root layout + metadata
    │   │   └── globals.css    ← Dark theme + glassmorphism styles
    │   ├── components/
    │   │   ├── UploadPanel.tsx   ← Drag-and-drop upload + document list
    │   │   ├── ChatPanel.tsx     ← Chat interface + message history
    │   │   └── MessageBubble.tsx ← Message bubble + source citations
    │   ├── lib/
    │   │   └── api.ts         ← Typed API client functions
    │   └── types/
    │       └── index.ts       ← TypeScript interfaces
    └── .env.local             ← NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## How the RAG Pipeline Works

1. **Upload**: You upload a file → FastAPI saves it to a temp path
2. **Parse**: `document_loader.py` extracts text using format-specific loaders (PyPDF, Docx2txt, etc.)
3. **Chunk**: LangChain's `RecursiveCharacterTextSplitter` splits text into ~1000-character chunks with 200-char overlap, preserving semantic boundaries
4. **Embed**: HuggingFace `all-MiniLM-L6-v2` converts each chunk into a 384-dimensional vector (runs on CPU, no GPU needed)
5. **Store**: Vectors are added to a FAISS flat index and saved to `vectorstore/` — all documents share one index
6. **Retrieve**: When you ask a question, it's embedded the same way, and FAISS finds the top-5 most similar chunks by cosine similarity
7. **Generate**: Retrieved chunks are injected into a prompt along with your question, sent to Groq's `llama-3.1-8b-instant` via LangChain's `ChatGroq`, and the model generates a grounded answer
8. **Cite**: The source chunks (filename + chunk index + text excerpt) are returned alongside the answer

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/upload` | Upload and index a document |
| `POST` | `/ask` | Ask a question |
| `GET` | `/documents` | List indexed documents |
| `DELETE` | `/documents/{id}` | Remove a document |

---

## Known Limitations

- **FAISS deletion is expensive**: Removing a document rebuilds the entire index (works fine for dozens of documents, may be slow for hundreds)
- **No streaming**: Answers are returned as a complete response (not streamed token-by-token)
- **Session-scoped chat history**: The conversation history lives only in the browser — refreshing clears it
- **CPU-only embeddings**: First embedding of a large document set may be slow without a GPU; the model runs fine on CPU for typical document sizes
- **Groq rate limits**: Free tier has limits (~30 req/min). If you hit a rate limit error, wait a moment and try again
- **Max file size**: 50 MB per upload
- **No authentication**: The API has no auth — intended for local development only

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Required |
|----------|-------------|----------|
| `GROQ_API_KEY` | Your Groq API key from console.groq.com | ✅ Yes |

### Frontend (`frontend/.env.local`)

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | FastAPI backend URL | `http://localhost:8000` |
