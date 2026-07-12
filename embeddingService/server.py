from typing import List

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

MODEL_NAME = "BAAI/bge-small-en-v1.5"

print(f"Loading embedding model ({MODEL_NAME})...")

model = SentenceTransformer(MODEL_NAME)

print("Embedding model loaded successfully!")

app = FastAPI(
    title="DevMind Embedding Service",
    version="1.0.0"
)


# ----------------------------
# Request / Response Models
# ----------------------------

class EmbedRequest(BaseModel):
    texts: List[str]


class EmbedResponse(BaseModel):
    model: str
    dimensions: int
    embeddings: List[List[float]]


# ----------------------------
# Routes
# ----------------------------

@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": MODEL_NAME,
        "dimensions": model.get_sentence_embedding_dimension(),
    }


@app.post("/embed", response_model=EmbedResponse)
def embed(request: EmbedRequest):

    if len(request.texts) == 0:
        raise HTTPException(
            status_code=400,
            detail="texts cannot be empty."
        )

    embeddings = model.encode(
        request.texts,
        normalize_embeddings=True,
        convert_to_numpy=True,
    )

    return {
        "model": MODEL_NAME,
        "dimensions": model.get_sentence_embedding_dimension(),
        "embeddings": embeddings.tolist(),
    }