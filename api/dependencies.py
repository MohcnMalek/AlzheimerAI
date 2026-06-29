from __future__ import annotations

import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Optional

from fastapi import HTTPException

# ---------------------------------------------------------------------------
# Path constants
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parents[1]

UPLOAD_DIR = PROJECT_ROOT / "cnn_module" / "outputs" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

GRADCAM_DIR = PROJECT_ROOT / "cnn_module" / "outputs" / "gradcam"
GRADCAM_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# In-memory task registry
# ---------------------------------------------------------------------------
_tasks: dict[str, dict[str, Any]] = {}


def get_task(task_id: str) -> dict[str, Any]:
    task = _tasks.get(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found.")
    return task


def create_task(task_id: str, meta: Optional[dict] = None) -> dict[str, Any]:
    entry: dict[str, Any] = {
        "task_id": task_id,
        "status": "pending",
        "result": None,
        "error": None,
    }
    if meta:
        entry.update(meta)
    _tasks[task_id] = entry
    return entry


def update_task(
    task_id: str,
    status: str,
    result: Optional[Any] = None,
    error: Optional[str] = None,
) -> None:
    task = _tasks.get(task_id)
    if task is None:
        return
    task["status"] = status
    if result is not None:
        task["result"] = result
    if error is not None:
        task["error"] = error


# ---------------------------------------------------------------------------
# Thread pool executor for CPU-bound tasks
# ---------------------------------------------------------------------------
_executor = ThreadPoolExecutor(max_workers=4)


def get_executor() -> ThreadPoolExecutor:
    return _executor
