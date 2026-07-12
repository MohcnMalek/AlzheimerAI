# AlzheimerAI — Multimodal Assistant

> **Research & educational tool only. Not a diagnostic device.**  
> Results must be interpreted by qualified healthcare professionals.

A clinical decision-support system for Alzheimer's disease screening that combines:

- **3D CNN on MRI** — ResNet3D-18 (multimodal) trained on ADNI skull-stripped volumes, outputting CN / AD classification with probability scores
- **NLP classifier on speech** — RoBERTa hybrid model trained on DementiaBank CHAT transcripts, extracting linguistic biomarkers
- **GradCAM visualisation** — Gradient-weighted Class Activation Mapping highlighting brain regions influencing the CNN prediction
- **RAG explanations** — FAISS retrieval over peer-reviewed PDFs + local Ollama LLM
- **Combined multimodal report** — merged PDF / HTML / Markdown report for both modalities


## Screenshots

### Home
![Home](docs/screenshots/home.png)

### Brain Scan Analysis
![Brain Scan](docs/screenshots/brain_scan.png)

### Speech & Language Analysis
![Speech](docs/screenshots/speech.png)

### Reports & History
![Reports](docs/screenshots/reports.png)

### About
![About](docs/screenshots/about.png)

---

## Architecture

```
TessssssT/
├── api/                        # FastAPI backend
│   ├── main.py                 # App entry-point, StaticFiles, CORS
│   ├── dependencies.py         # Shared dirs, task registry, thread pool
│   ├── routers/                # brain · speech · reports · patients · tasks
│   ├── schemas/                # Pydantic request/response models
│   └── services/               # BrainService · SpeechService · ReportService
│
├── frontend/                   # React 18 + Vite + TypeScript
│   └── src/
│       ├── pages/              # Home · BrainScan · Speech · Reports · About
│       ├── components/         # Layout · UI · Domain components
│       ├── store/              # Zustand (persisted patient case state)
│       ├── hooks/              # usePollTask · useHealth
│       └── api/                # Axios client + per-resource modules
│
├── cnn_module/
│   ├── src/
│   │   ├── cnn_model.py        # MultimodalCNNModel (ResNet3D-18 + clinical MLP)
│   │   ├── cnn_predictor.py    # Inference: load model, encode clinical features
│   │   └── gradcam_3d.py       # GradCAM hooks + slice export
│   └── models/
│       └── best_multimodal_model.pth   # Trained weights (not committed — Git LFS)
│
├── nlp_rag_module/
│   ├── src/
│   │   ├── predict_nlp_model.py
│   │   ├── rag_explainer.py
│   │   └── model_architecture.py
│   └── model/
│       ├── best_roberta_hybrid_seed40.pt
│       ├── scaler_hybrid_seed40.pkl
│       └── tokenizer/
│
├── src/
│   ├── combined_report_generator.py    # Merges MRI + speech results into one report
│   └── cha_parser.py                   # CHAT transcript parser
│
├── database/
│   ├── db.py                   # SQLAlchemy helpers (PostgreSQL)
│   └── schema.sql
│
├── app_multimodal.py           # Report generation utilities
├── st_2_multimodal.py          # Training script (MultiModalResNet3D)
├── start_api.py                # Uvicorn launcher
└── requirements_api.txt
```

---

## Quick Start

### 1 — Backend (FastAPI)

```bash
# Install dependencies
pip install -r requirements_api.txt

# Set environment variables
cp .env.example .env          # then fill DATABASE_URL, OLLAMA_BASE_URL ...

# Start Ollama (for RAG explanations)
ollama run gemma3:1b

# Launch API (port 8000)
python start_api.py
```

### 2 — Frontend (React)

```bash
cd frontend
npm install
npm run dev          # dev server on port 5173 (proxies /api → :8000)
```

Open **http://localhost:5173**

---

## API Overview

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/brain/upload` | Upload NIfTI MRI file |
| POST | `/api/brain/analyze` | Start CNN analysis (background task) |
| POST | `/api/brain/gradcam` | Generate GradCAM slices |
| POST | `/api/brain/explain` | RAG explanation for MRI result |
| POST | `/api/speech/upload` | Upload CHAT transcript |
| POST | `/api/speech/analyze` | Start NLP analysis |
| POST | `/api/reports/combined` | Generate combined multimodal report |
| GET | `/api/reports/{patient_case_id}` | List patient reports |
| GET | `/api/tasks/{task_id}` | Poll background task status |
| GET | `/files/...` | Serve generated reports and GradCAM images |

---

## CNN Model

**Architecture** — `MultimodalCNNModel` in `cnn_module/src/cnn_model.py`:

```
backbone     : ResNet3D-18 (inflate-1 from torchvision) → 512-dim MRI features
clinical_mlp : Linear(2→32) → ReLU → BN1d → Dropout(0.3) → Linear(32→16) → ReLU
classifier   : Dropout(0.5) → Linear(528→64) → ReLU → Dropout(0.3) → Linear(64→2)
```

**Clinical input vector** — `[age_normalised, sex_encoded]` where F = 1.0, M = 0.0

**Training** — see `st_2_multimodal.py`:
- Dataset: ADNI skull-stripped NIfTI volumes + `dataset_preprocessed.csv`
- FocalLoss · AdamW · ReduceLROnPlateau · TTA · AMP
- Saves `best_multimodal_model.pth` → place in `cnn_module/models/`

---

## NLP Model

**Architecture** — RoBERTa + handcrafted linguistic features (filled pauses, retracing rate, MLU, …)  
**Dataset** — DementiaBank Pitt Corpus (CHAT format `.cha` files)  
**Scaler** — `scaler_hybrid_seed40.pkl` (must be loaded alongside the model)

---

## Environment Variables (`.env`)

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/alzheimer_db
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma3:1b
```

---

## Database

PostgreSQL schema in `database/schema.sql`.  
Tables: `patients` · `brain_analyses` · `speech_analyses` · `reports`

---

## Medical Disclaimer

This software is a **research prototype** developed as part of a final-year engineering project (PFA). It is not validated for clinical use and must not replace professional medical judgement.
