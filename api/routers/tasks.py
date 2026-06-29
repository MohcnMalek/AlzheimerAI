from __future__ import annotations

from fastapi import APIRouter

from api.dependencies import get_task
from api.schemas.tasks import TaskResponse

router = APIRouter()


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task_status(task_id: str):
    """Poll the status of a background task."""
    return get_task(task_id)
