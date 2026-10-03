import asyncio
from typing import Dict, Optional, Callable, Any
from datetime import datetime, timezone
from app.models.jobs import Job

class JobQueue:
    def __init__(self):
        self._jobs: Dict[str, Job] = {}
        self._tasks: Dict[str, asyncio.Task] = {}

    def create_job(self, project_id: str, job_type: str, initial_message: str = "Starting...") -> Job:
        job = Job(
            project_id=project_id,
            job_type=job_type,
            status="running",
            progress=0.0,
            message=initial_message,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        self._jobs[job.id] = job
        return job

    def get_job(self, job_id: str) -> Optional[Job]:
        return self._jobs.get(job_id)

    def get_jobs_for_project(self, project_id: str):
        return [j for j in self._jobs.values() if j.project_id == project_id]

    def update_progress(self, job_id: str, progress: float, message: Optional[str] = None):
        job = self._jobs.get(job_id)
        if job:
            job.progress = max(0.0, min(100.0, progress))
            if message:
                job.message = message
            job.updated_at = datetime.now(timezone.utc)

    def complete_job(self, job_id: str, result: Optional[Dict[str, Any]] = None, message: str = "Completed successfully"):
        job = self._jobs.get(job_id)
        if job:
            job.status = "completed"
            job.progress = 100.0
            job.message = message
            job.result = result
            job.updated_at = datetime.now(timezone.utc)

    def fail_job(self, job_id: str, error: str):
        job = self._jobs.get(job_id)
        if job:
            job.status = "failed"
            job.error = error
            job.message = f"Failed: {error}"
            job.updated_at = datetime.now(timezone.utc)

    def register_task(self, job_id: str, task: asyncio.Task):
        self._tasks[job_id] = task

    def cancel_job(self, job_id: str):
        job = self._jobs.get(job_id)
        if job and job.status == "running":
            job.status = "cancelled"
            job.message = "Cancelled by user"
            job.updated_at = datetime.now(timezone.utc)
            task = self._tasks.get(job_id)
            if task and not task.done():
                task.cancel()

job_queue = JobQueue()
