from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from contextlib import asynccontextmanager
from .engine import get_engine, IntentEngine

# Singleton/global engine reference
engine: IntentEngine = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global engine
    try:
        # Initialize engine on startup
        engine = get_engine()
    except Exception as e:
        print(f"Error initializing IntentEngine: {e}")
    yield
    # Cleanup on shutdown if needed
    pass

app = FastAPI(
    title="QSafe Offline NLP Microservice",
    description="Microservice for offline bilingual intent classification in Nepal disaster contexts.",
    version="1.0.0",
    lifespan=lifespan
)

class QueryRequest(BaseModel):
    text: str

class QueryResponse(BaseModel):
    intent: str
    confidence: float
    source: str
    urgency: str
    entities: dict
    recommended_action: str | None
    latency_ms: float

@app.get("/health")
async def health_check():
    """Verify service health and engine loading status."""
    if engine is None:
        raise HTTPException(status_code=503, detail="Intent classification engine not loaded.")
    return {"status": "ok", "message": "QSafe Offline NLP Microservice Active"}

@app.post("/predict", response_model=QueryResponse)
async def predict_intent(request: QueryRequest):
    """Classify user queries across cascading confidence tiers."""
    if engine is None:
        raise HTTPException(status_code=503, detail="Engine not initialized.")
    try:
        result = engine.predict(request.text)
        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
