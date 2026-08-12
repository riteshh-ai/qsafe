# QSAFE

QSAFE is a disaster-assistance project for Nepal that combines a lightweight frontend UI, a Node.js backend API, and offline first disaster response system

## Repository Structure

- `backend/`
  - Express-based API server
  - `server.js` entry point
  - `package.json` and `package-lock.json`
  - `src/` controllers, routes, and services
- `frontend/`
  - Browser chat UI and offline-capable client code
  - `index.html`, `app.js`, `sw.js`
  - public assets and a service worker
- `offline-nlp/`
  - Local NLP training scripts
  - Dataset and exported model artifacts

## Features

- Express backend with telemetry and chat endpoints
- Frontend chat interface with fallback handling
- Offline NLP training and model export using `@nlpjs`
- Support for generative and retrieval-augmented generation workflows

## Setup

### Backend

```bash
cd backend
npm install
npm start
```

- Default server port: `5000`
- The backend uses ESM modules and loads environment variables with `dotenv`

### Frontend

Open `frontend/index.html` in your browser or serve the folder using a static server.

### Offline NLP

```bash
cd offline-nlp
npm install
node train.js
```

- Expects a dataset like `datasets/training_dataset.csv`
- Outputs a trained model file such as `model.nlp.json`

## Common Commands

```bash
# Run backend
cd backend
npm start

# Run offline NLP training
cd offline-nlp
node train.js
```

## Notes

- Ensure `backend/.env` is configured if environment variables are required
- Avoid committing generated files from `node_modules/`
- If a merge is in progress, use `git merge --abort` to cancel or `git add` to mark conflicts resolved

## Branching

- `main`: production-ready baseline
- `nlp`: offline NLP feature work

## Useful Endpoints

- Telemetry: `http://localhost:5000/api/telemetry/live`

## Recommended Workflow

1. Push feature branches separately
2. Open PRs against `main`
3. Test backend and frontend locally before merge

## License

Add license details here as needed.
