# DevMind Embedding Service ⚡

This is the dedicated Python microservice that provides text embeddings for DevMind AI's Knowledge Base (RAG) system using Hugging Face's `SentenceTransformer` models.

---

## 📌 Features

- **Model**: [`BAAI/bge-small-en-v1.5`](https://huggingface.co/BAAI/bge-small-en-v1.5)
- **Embedding Dimension**: 384 dimensions (normalized for cosine / dotProduct similarity)
- **Fast & Lightweight**: Built with FastAPI and Uvicorn
- **Batch Processing**: Supports batch encoding of text chunks for fast ingestion

---

## 📋 Prerequisites

- **Python**: `3.10` or higher
- **pip** and `venv`

---

## 🚀 Setup & Installation

### 1. Create and Activate a Virtual Environment

#### On Windows (PowerShell):
```powershell
cd embeddingService
python -m venv .venv
.venv\Scripts\Activate.ps1
```

#### On Linux / macOS:
```bash
cd embeddingService
python3 -m venv .venv
source .venv/bin/activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

> **Note on PyTorch / GPU**: By default, `pip install torch` installs standard PyTorch. If you have an NVIDIA GPU with CUDA, install the CUDA-enabled PyTorch build from [pytorch.org](https://pytorch.org) for even faster embedding generation.

---

## 🏃 Running the Service

Start the FastAPI server on port `8001` (recommended via `python -m` to avoid path issues with activated venvs):

```bash
python -m uvicorn server:app --host 127.0.0.1 --port 8001
```

Or directly via `uvicorn`:

```bash
uvicorn server:app --host 127.0.0.1 --port 8001
```

The service will automatically download the `BAAI/bge-small-en-v1.5` model weights on first run and cache them locally in `~/.cache/huggingface/hub`.

---

## 🔌 API Endpoints

### 1. Health Check
- **URL**: `GET /health`
- **Response**:
```json
{
  "status": "ok",
  "model": "BAAI/bge-small-en-v1.5",
  "dimensions": 384
}
```

### 2. Generate Embeddings
- **URL**: `POST /embed`
- **Request Body**:
```json
{
  "texts": [
    "First document paragraph",
    "Second document paragraph"
  ]
}
```
- **Response**:
```json
{
  "model": "BAAI/bge-small-en-v1.5",
  "dimensions": 384,
  "embeddings": [
    [-0.0123, 0.0456, ...],
    [0.0789, -0.0234, ...]
  ]
}
```

---

## ⚙️ Configuration in DevMind AI

In your main DevMind AI `.env.local` file, specify:

```ini
EMBEDDING_SERVICE_URL=http://127.0.0.1:8001
```