"""Entry point for the FastAPI backend. Run: python start_api.py"""
import sys
import os
from pathlib import Path

# Bootstrap sys.path so all existing modules are importable
ROOT = Path(__file__).resolve().parent
for p in [
    str(ROOT),
    str(ROOT / "cnn_module" / "src"),
    str(ROOT / "nlp_rag_module" / "src"),
    str(ROOT / "src"),
]:
    if p not in sys.path:
        sys.path.insert(0, p)

os.environ.setdefault("STREAMLIT_SERVER_FILE_WATCHER_TYPE", "none")
os.environ.setdefault("STREAMLIT_SERVER_RUN_ON_SAVE", "false")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "api.main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info",
    )
