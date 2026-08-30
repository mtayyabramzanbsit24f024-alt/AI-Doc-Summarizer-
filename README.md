# TRB Document Summarizer

Upload a PDF, Word (.docx), or text file → get a structured AI summary
(overview, key topics, why it matters, why it's used, benefits, use cases) →
then chat with an AI assistant that explains anything about the document in
plain language.

Runs on **OpenRouter's free Gemini Flash model** — no paid API key needed.

```
ai-doc-summarizer/
├── backend/              FastAPI server (file parsing + AI calls)
│   ├── main.py
│   ├── requirements.txt
│   ├── run.sh
│   ├── .env.example      <- copy to .env and add your OpenRouter API key
│   └── utils/
│       ├── extract_text.py   PDF/DOCX/TXT text extraction
│       └── ai_service.py     Summary + chat logic via OpenRouter
├── frontend/             Plain HTML/CSS/JS UI (no build step needed)
│   ├── index.html
│   ├── style.css
│   └── script.js
└── README.md
```

## 1. Requirements

- Python 3.10+
- A free OpenRouter API key (see below — no credit card needed)

## 2. How to get your free OpenRouter API key

1. Go to **https://openrouter.ai/**
2. Click **Sign In** (top right) and sign up with Google/GitHub/email — it's free
3. Once logged in, click your profile icon → **Keys** (or go directly to
   **https://openrouter.ai/keys**)
4. Click **Create Key**, give it any name (e.g. "TRB Summarizer"), and copy
   the key it generates — it starts with `sk-or-v1-...`
5. That's it — no payment method required to use free models

The project is already configured to use the free model
`google/gemini-2.0-flash-exp:free`, so your key can be used immediately at
no cost.

## 3. Backend setup

```bash
cd backend
python -m pip install -r requirements.txt

cp .env.example .env            # then open .env and paste your real API key
```

Your `.env` should look like:

```
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxx
AI_MODEL=google/gemini-2.0-flash-exp:free
PORT=8000
```

Start the server:

```bash
python -m uvicorn main:app --reload --port 8000
```

The API is now running at **http://localhost:8000** (interactive docs at
`http://localhost:8000/docs`).

## 4. Frontend setup

No build tools needed — it's plain HTML/CSS/JS. Just open the file, or serve
it with any static server:

```bash
cd frontend
python -m http.server 5500
```

Then open **http://localhost:5500** in your browser.

> If your backend runs on a different host/port, update `API_BASE` at the
> top of `frontend/script.js`.

## 5. How it works

1. **Upload** — drag a PDF/DOCX/TXT/MD file onto the left panel. The backend
   extracts raw text (`utils/extract_text.py`).
2. **Summarize** — click "Generate Summary". The backend sends the document
   text to the AI model with a structured prompt and gets back JSON: title,
   document type, overview, key topics, importance, why it's used, benefits,
   use cases, and key takeaways — rendered as a clean "document briefing" in
   the main pane.
3. **Chat** — open the chat widget (bottom right) and ask questions. Every
   message is answered using the document's full text as grounding context,
   so answers stay accurate to what's actually in the file, not generic
   guesses. The chat box unlocks automatically once a summary has been
   generated successfully.

## 6. Notes & limitations (demo-grade project)

- Documents are stored **in memory** on the backend while the server runs —
  restarting the server clears uploaded documents. Swap `DOCUMENTS = {}` in
  `main.py` for a real database (SQLite/Postgres) for persistence.
- Very long documents are truncated to ~60,000 characters before being sent
  to the model (`MAX_CHARS` in `ai_service.py`) to control context size.
- Free OpenRouter models have rate limits (roughly 20 requests/minute) —
  fine for personal/demo use, but not for production traffic.
- Scanned/image-only PDFs have no extractable text — you'll need an OCR step
  (e.g. `pytesseract`) first if you plan to support those.
- CORS is wide open (`allow_origins=["*"]`) for easy local development —
  restrict this before deploying publicly.

## 7. Customizing

- **Change the AI model** — edit `AI_MODEL` in `backend/.env`. Browse other
  free models at https://openrouter.ai/models?max_price=0
- **Change summary fields** — edit `SUMMARY_SYSTEM_PROMPT` in
  `backend/utils/ai_service.py` and the matching render logic in
  `frontend/script.js` (`renderSummary`).
- **Change the look** — all design tokens (colors, fonts, spacing) live at
  the top of `frontend/style.css` under `:root`.

---

Built with FastAPI + OpenRouter on the backend, and plain HTML/CSS/JS on the frontend.
