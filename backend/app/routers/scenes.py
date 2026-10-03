import asyncio
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Body
from app.models.project import Scene, Project
from app.services.project_service import project_service
from app.services.llm_service import llm_service
from app.services.job_queue import job_queue

router = APIRouter(prefix="/api/scenes", tags=["scenes"])

@router.post("/{project_id}/breakdown")
async def trigger_scene_breakdown(
    project_id: str,
    payload: Dict[str, Any] = Body(default={})
):
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not project.story_raw_text.strip():
        raise HTTPException(status_code=400, detail="Project has no story text to break down")

    provider = payload.get("provider") # gemini, openai, anthropic, mock

    job = job_queue.create_job(project_id, "llm_breakdown", "Initializing LLM Scene Breakdown...")

    async def run_breakdown_task():
        try:
            job_queue.update_progress(job.id, 20.0, "Analyzing story pacing and narrative arcs...")
            await asyncio.sleep(0.3)

            job_queue.update_progress(job.id, 50.0, "Injecting Character & Style Bible into cinematic prompts...")
            scenes = await llm_service.breakdown_story(project, provider=provider)

            job_queue.update_progress(job.id, 85.0, "Refining camera shots and motion matrix...")
            project.scenes = scenes
            project_service.save_project(project)

            job_queue.complete_job(
                job.id,
                result={"scenes_count": len(scenes), "scenes": [s.model_dump() for s in scenes]},
                message=f"Generated {len(scenes)} cinematic scenes with consistent prompts"
            )
        except Exception as e:
            job_queue.fail_job(job.id, str(e))

    task = asyncio.create_task(run_breakdown_task())
    job_queue.register_task(job.id, task)

    return {"job_id": job.id, "status": "started"}

@router.post("/{project_id}/scenes")
async def update_scenes(
    project_id: str,
    scenes: List[Scene] = Body(...)
):
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    project.scenes = scenes
    project_service.save_project(project)
    return {"status": "saved", "scenes_count": len(scenes)}

@router.post("/{project_id}/regenerate-prompt")
async def regenerate_prompt(
    project_id: str,
    payload: Dict[str, Any] = Body(...)
):
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    scene_id = payload.get("scene_id")
    instruction = payload.get("instruction", "")

    scene = next((s for s in project.scenes if s.id == scene_id), None)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    new_prompt = await llm_service.regenerate_single_prompt(scene, project, instruction)
    scene.image_prompt = new_prompt
    project_service.save_project(project)
    return {"scene_id": scene_id, "image_prompt": new_prompt}

@router.post("/{project_id}/youtube-seo")
async def generate_youtube_seo(project_id: str):
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    seo_data = await llm_service.generate_youtube_seo(project)
    return seo_data
