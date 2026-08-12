# QSAFE

QSAFE is a Node.js-based backend for the QSAFE Nepal project with an included frontend and an offline NLP directory for local natural-language processing utilities and models. The backend provides health, telemetry, chat, report and SOS HTTP endpoints and runs a background task that periodically fetches Nepal seismic/telemetry data (USGS). This README describes the repository structure, how to run the backend locally, and developer notes.

- Primary focus: QSAFE Nepal backend API and telemetry aggregation
- Ready-to-run backend (Express + ES modules)
- Includes offline-NLP support and a frontend directory (project contains source and supporting files)

## Stack
- Language(s): JavaScript (ES Modules / Node.js)
- Framework / runtime: Node.js + Express
- Notable libraries:
  - express (HTTP server)
  - cors (CORS middleware)
  - dotenv (env management)
  - @google/generative-ai (generative AI integration referenced in backend dependencies)
  - Offline NLP tooling under offline-nlp (uses nlp.js packages)

## How it's organized
Top-level entries (relevant):
```
.gitignore
backend/       Express backend (server, API routes, services)
frontend/      Frontend application (UI) — start scripts not inspected here
offline-nlp/   Offline NLP utilities / models / node_modules (local NLP tooling)
```

backend/ (annotated)
```
backend/
  server.js                start script — loads app and dotenv
  package.json             backend dependencies & scripts ("start", "dev")
  list-models.js           utility script (lists models — inspected as present)
  package-lock.json
  data/                    data storage or static data (directory present)
  src/
    app.js                 Express app mounting routes and background sync
    config/                configuration (directory present)
    controllers/           controllers (e.g. telemetryController.js referenced)
    routes/
      telemetryRoutes.js   GET /api/telemetry/live
      chatRoutes.js        /api/chat routes
      reportRoutes.js      /api/reports routes
      sosRoutes.js         /api/sos routes
    services/
      usgsService.js       fetchNepalSeismicData() — initial cache sync + setInterval
```

How it fits together:
- server.js boots the app (dotenv + app import) and starts listening on PORT.
- app.js constructs the Express app, configures middleware (cors, express.json), mounts route modules under /api/*, exposes a /health endpoint, and starts a background telemetry sync using fetchNepalSeismicData from services/usgsService.js which runs immediately and every 120 seconds.
- Routes delegate to controllers; services handle external integrations (USGS telemetry, generative AI model access, offline NLP).

## API (observed)
- GET /health
  - Health check returning { status: 'OK', message: 'QSAFE Nepal Backend Active' }
- GET /api/telemetry/live
  - Live telemetry endpoint (mounted; controller getLiveTelemetry is used)
- Other route mounts present:
  - /api/chat
  - /api/reports
  - /api/sos

(Controller-level behavior for chat/reports/sos not enumerated because controller source was not inspected here.)

## How to run (backend)
Run these commands from the repository root or from the backend directory:

1. Install dependencies
```bash
cd backend
npm install
```

2. Start (production)
```bash
npm start
```

3. Start in development mode (auto-reload requires nodemon)
```bash
npm run dev
```

Server will default to PORT 5000 unless you provide a PORT environment variable. Example:
```bash
PORT=8080 npm start
```

Environment:
- The backend uses dotenv (it reads a .env file if provided). Create a `.env` file in backend/ for any API keys or configuration values required by services (e.g., Google Generative AI credentials or other API keys). Exact variable names are not present in the inspected files — look for usage in services/ and config/ to identify required env vars.

## Background sync
- On startup app calls fetchNepalSeismicData() to prime a telemetry cache.
- A background timer refreshes telemetry every 120000ms (2 minutes).

## Notes & developer pointers
- package.json (backend) is ES module type ("type": "module"), so server and src files use import/export syntax.
- The code imports @google/generative-ai in backend dependencies — check services that integrate with generative AI for required credentials and scopes.
- There is an offline-nlp/ folder containing NLP tools and node_modules (nlp.js components). If you intend to use offline NLP capabilities, inspect offline-nlp for scripts, trained models, and usage examples.
- No LICENSE file was found in the top-level listing inspected here — add a LICENSE if you plan to publish/redistribute.

## Contributing
- To contribute, start by running the backend locally (see steps above), run tests (if any), and open a PR.
- If you add CI or deployment configuration, include checks that the telemetry background task and API endpoints respond correctly.

## Missing/unclear items you might want to add to the repository
- Root-level README (this file can be committed as README.md)
- LICENSE to clarify usage terms
- Frontend run instructions and README in frontend/ describing build/start steps and dependencies
- A small example .env.example in backend/ listing expected environment variables (Google API keys, external service URLs, DATABASE_URL if used, etc.)
- Documentation for the chat, reports, and sos endpoints (payload schema, examples)

## Try asking
- How do I start the frontend and which framework/build tools does it use (inside frontend/)?
- Which environment variables are required by backend/src/services/usgsService.js and the generative AI integration?
- Can you add a minimal example request and response for GET /api/telemetry/live and for one /api/chat endpoint?

---

If you'd like, I can:
- produce a ready-to-commit README.md file (this content formatted for commit),
- add a backend/.env.example by scanning service files for required env vars,
- or open a PR that adds the README and an .env.example to the repository.
