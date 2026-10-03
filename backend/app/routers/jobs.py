from fastapi import APIRouter, HTTPException
from typing import List, Optional
from app.models.jobs import Job
from app.services.job_queue import job_queue

router = APIRouter(prefix="/api/jobs", tags=["jobs"])

@router.get("/{job_id}", response_model=Job)
async def get_job(job_id: str):
    job = job_queue.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@router.post("/{job_id}/cancel")
async def cancel_job(job_id: str):
    job = job_queue.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    job_queue.cancel_job(job_id)
    return {"status": "cancelled", "job_id": job_id}

@router.get("/project/{project_id}", response_model=List[Job])
async def get_project_jobs(project_id: str):
    return job_queue.get_jobs_for_project(project_id)
