# QSAFE Nepal

## What this project is trying to build

QSAFE Nepal is a prototype emergency assistance application designed to provide safety guidance and hotline information for disaster events in Nepal. The app aims to operate as a chat-style interface with both online and offline capabilities, allowing users to get guidance even when network connectivity is poor or unavailable.

## Key goals

- Provide a simple conversational UI for emergency queries.
- Detect whether the device is online or offline and adjust behavior accordingly.
- Use a cloud-connected backend and RAG-style pipeline when online.
- Fall back to local emergency content and offline NLP intent recognition when offline.
- Support bilingual or localized disaster-related intents for Nepal.

## Project structure

### frontend/

- `index.html`: Chat interface layout and styles for `QSAFE Nepal`.
- `app.js`: Core browser app logic including:
  - network telemetry monitoring
  - chat message rendering
  - online/offline routing
  - offline fallback logic using local JSON assets
- `public/emergency_contacts.json`: static offline data containing emergency hotlines and earthquake safety checklist.
- `public/manifest.json`: web manifest for the frontend app.
- `sw.js`: service worker placeholder for offline support (currently empty).

### offline-nlp/

- `corpus.json`: bilingual training corpus for emergency intents such as earthquake and landslide.
- `train.js`: script to train an offline NLP model using `@nlpjs/nlp` and export it to `frontend/public/model.nlp.json`.
- `package.json`: defines the offline NLP toolchain.

### backend/

- `server.js`: backend gateway placeholder for future cloud integration.
- `package.json`: backend package metadata placeholder.
- `data/ndrrma_guidlines.txt`: raw guideline document containing Nepal disaster response recommendations.

## Current behavior

- On app load, the UI shows an online status badge.
- When the user submits a query:
  - If online: the app displays a placeholder message describing a future cloud pipeline using a backend gateway, ChromaDB, and Gemini 2.0 Flash.
  - If offline: the app loads `emergency_contacts.json` and responds with earthquake checklist and hotline info for recognized earthquake-related queries.
- If the offline query is not recognized, a generic fail-safe safety message is shown.

## Missing / future work

- Implement the backend gateway in `backend/server.js`.
- Add actual cloud retrieval of disaster manuals or knowledge using a database such as ChromaDB.
- Connect the frontend to the backend for live cloud-driven responses.
- Populate `sw.js` to cache assets and enable true offline web app behavior.
- Use the trained offline NLP model in the frontend for richer local intent classification.
- Expand the emergency dataset to cover additional disaster types and safety checklists.

## Why this matters

This project is designed to help people in Nepal access emergency guidance quickly, with robust support for intermittent or lost connectivity. It prioritizes fast, local fallback safety content while preparing for a more advanced cloud-assisted response system.
