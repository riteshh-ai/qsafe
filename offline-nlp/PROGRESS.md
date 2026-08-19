# 📌 QSAFE NLP Engine - Context & Task Tracker

## 1. Project Scope
- Plattform: Google Antigravity Agent Workspace
- Project: `qsafe / offline-nlp`
- Languages: English, Devanagari Nepali, Romanized Nepali

## 2. Phase Execution Status
- [x] Phase 1: Preprocessing & Unicode Normalization (`src/preprocessor.py`)
- [x] Phase 2: Feature Vectorization & Model Serialization (`src/model.py`)
- [x] Phase 3: Inference Engine & Threshold Guardrails (`src/engine.py`)
- [x] Phase 4: Local Storage Fallback & RAG Routing (`src/router.py` / `ragService.js`)
- [x] Phase 5: Production Readiness (API & UI integration)

## 3. Migration & Audit Log
- **Date:** 2026-08-19
- **Major Issues Fixed:**
  1. **Unicode/Mojibake Fix (Frontend `app.js`)**: Eliminated corrupted CP1252/ANSI characters (`αñ...`, `ΓÇó`) and replaced them with native UTF-8 Devanagari and clean bullet strings.
  2. **File I/O UTF-8 Precedence (Python `offline-nlp`)**: Enforced explicit `encoding='utf-8'` across all CSV loaders (`engine.py`, `model.py`, `augment.py`) to prevent OS-level character corruption on Windows.
  3. **Network Response Header Encoding (Backend `chatController.js` & `nlpClient.js`)**: Enforced `Content-Type: application/json; charset=utf-8` on all outgoing chat and inference endpoints.
  4. **UI Protocol Card Redesign**: Implemented rich markdown card formatting with icon badges, numbered lists, and interactive hotline dialing pills, hiding internal route metadata tags.
  5. **Multiclass Confidence Optimization (`engine.py`)**: Adjusted `CONFIDENCE_THRESHOLD` from `0.40` to `0.25` for the 25-class output space, enabling high-accuracy classification on conversational Devanagari and code-mixed inputs without premature fallback.
- **Active Task:** All English, Devanagari, Romanized Nepali, and Code-Mixed queries verified end-to-end.
