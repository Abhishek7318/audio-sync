from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import uuid

class Job(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    project_id: str
    job_type: str # alignment, llm_breakdown, image_batch, video_export, browser_assist
    status: str = "pending" # pending, running, completed, failed, cancelled
    progress: float = 0.0 # 0.0 to 100.0
    message: str = "Queued"
    error: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
