from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import sys
import os

# Ensure the local directory is in the path so retriver can be imported
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from retriver import get_relevant_context
except ImportError as e:
    print(f"Failed to import retriever: {e}")
    get_relevant_context = None

app = FastAPI(title="QSAFE RAG Pipeline API")

class QueryRequest(BaseModel):
    text: str

@app.post("/retrieve")
async def retrieve_context(req: QueryRequest):
    if not get_relevant_context:
        raise HTTPException(status_code=500, detail="Retriever not initialized.")
    try:
        context = get_relevant_context(req.text)
        return {"context": context}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
