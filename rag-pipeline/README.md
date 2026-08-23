# QSAFE RAG Pipeline

Retrieval-Augmented Generation system for earthquake preparedness in Nepal.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm installed
- Pinecone account
- Gemini API keys (5 recommended)
- CSV data files

### Installation

```bash
cd rag-pipeline
npm install
```

### Configuration

1. Copy `.env.example` to `.env`
2. Fill in your API keys:
   - 5x Gemini API keys
   - Pinecone API key
   - Pinecone environment
   - Pinecone index name

### Ingest Data

```bash
npm run ingest
```

This will:
- Read all CSV files from `/data`
- Generate embeddings using Gemini
- Store vectors in Pinecone (~30-60 mins)

### Run Server

```bash
npm run dev
```

Server starts on `http://localhost:5000`

### Test API

```bash
npm run test
```

## 📡 API Endpoints

- `POST /health` - Health check
- `POST /api/retrieve` - Retrieve documents
  ```json
  {"query": "...", "topK": 5}
  ```
- `POST /api/generate` - Generate answer with retrieval
  ```json
  {"question": "...", "topK": 5}
  ```
- `POST /api/batch` - Batch queries
  ```json
  {"questions": ["...", "..."], "topK": 5}
  ```

## 📁 Project Structure

```
src/
├── config/          # Configuration (Gemini, Pinecone, env)
├── services/        # Core services (retrieval, generation, ingestion)
├── routes/          # API endpoints
└── index.ts         # Main server

scripts/
├── ingest.ts        # CSV ingestion script
└── test.ts          # Test script

data/               # CSV input files
dist/               # Compiled JavaScript
```

## 🔧 Configuration

All configuration in `.env` file. See `.env.example` for template.

## 📝 Features

✅ Multi-API key rotation for failover  
✅ Batch CSV ingestion with deduplication  
✅ Vector search with Pinecone  
✅ LLM-powered answer generation  
✅ Refusal classification  
✅ Full REST API  

## 🚀 Next Steps

1. Configure `.env` with your keys
2. Run `npm run ingest` to embed CSVs
3. Run `npm run dev` to start server
4. Connect your frontend to API endpoints

## 📖 Documentation

See main QSAFE documentation for complete setup guide.
