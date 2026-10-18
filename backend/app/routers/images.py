import asyncio
import time
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Body
from app.models.project import Scene, Project
from app.services.project_service import project_service
from app.services.image_service import image_service
from app.services.browser_assist_service import browser_assist_service
from app.services.playwright_chatgpt_service import playwright_chatgpt_service
from app.services.playwright_gemini_service import playwright_gemini_service
from app.services.job_queue import job_queue

router = APIRouter(prefix="/api/images", tags=["images"])

@router.post("/playwright/open-browser")
async def open_playwright_browser(payload: Optional[Dict[str, Any]] = Body(None)):
    provider = "gemini"
    if payload and isinstance(payload, dict):
        provider = payload.get("provider", "gemini").lower()
    
    if provider == "chatgpt":
        res = await playwright_chatgpt_service.open_browser()
    else:
        res = await playwright_gemini_service.open_browser()
    return res

@router.post("/{project_id}/playwright/generate-scene")
async def generate_playwright_scene(
    project_id: str,
    payload: Dict[str, Any] = Body(...)
):
    provider = payload.get("provider", "gemini").lower()
    scene_id = payload.get("scene_id")
    prompt = payload.get("prompt", "")
    if not prompt:
        project = project_service.get_project(project_id)
        if project:
            scene = next((s for s in project.scenes if s.id == scene_id), None)
            if scene:
                prompt = scene.image_prompt

    try:
        if provider == "chatgpt":
            scene = await playwright_chatgpt_service.generate_and_download_scene(
                project_id=project_id,
                scene_id=scene_id,
                prompt=prompt
            )
        else:
            scene = await playwright_gemini_service.generate_and_download_scene(
                project_id=project_id,
                scene_id=scene_id,
                prompt=prompt
            )
        return {"status": "success", "scene": scene}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{project_id}/browser-assist/paste-to-chrome")
async def paste_prompt_to_chrome(
    project_id: str,
    payload: Dict[str, Any] = Body(...)
):
    scene_id = payload.get("scene_id")
    prompt = payload.get("prompt", "")
    browser_name = payload.get("browser_name", "Google Chrome")
    press_enter = payload.get("press_enter", True)

    if not prompt:
        project = project_service.get_project(project_id)
        if project:
            scene = next((s for s in project.scenes if s.id == scene_id), None)
            if scene:
                prompt = scene.image_prompt

    success = browser_assist_service.focus_browser_and_paste(
        prompt,
        browser_name=browser_name,
        press_enter=press_enter
    )
    return {
        "status": "pasted" if success else "copied_only",
        "timestamp": time.time(),
        "message": "Prompt pasted to Chrome and submitted! Now waiting for image generation/download..."
    }

@router.post("/{project_id}/browser-assist/poll-download")
async def poll_browser_download(
    project_id: str,
    payload: Dict[str, Any] = Body(...)
):
    scene_id = payload.get("scene_id")
    start_time = float(payload.get("start_time", time.time() - 60))

    result = browser_assist_service.auto_detect_and_attach_download(project_id, scene_id, start_time)
    if not result:
        return {"status": "waiting", "message": "No new downloaded image detected in ~/Downloads yet."}

    return {"status": "attached", "scene": result}

@router.post("/{project_id}/generate-single")
async def generate_single_image(
    project_id: str,
    payload: Dict[str, Any] = Body(...)
):
    scene_id = payload.get("scene_id")
    if not scene_id:
        raise HTTPException(status_code=400, detail="scene_id is required")

    provider = payload.get("provider", "free_flux")

    try:
        scene = await image_service.generate_image_for_scene(project_id, scene_id, provider=provider)
        return scene
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image generation failed: {str(e)}")

@router.post("/{project_id}/generate-batch")
async def generate_batch_images(
    project_id: str,
    payload: Dict[str, Any] = Body(default={})
):
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    provider = payload.get("provider", "free_flux")
    pending_scenes = [s for s in project.scenes if s.image_status != "ready" or payload.get("force_all", False)]

    if not pending_scenes:
        return {"message": "All scenes already have ready images", "scenes_count": 0}

    job = job_queue.create_job(project_id, "image_batch", f"Queued {len(pending_scenes)} scene images for generation...")

    async def run_batch_task():
        total = len(pending_scenes)
        completed = 0
        try:
            for s in pending_scenes:
                job_queue.update_progress(
                    job.id,
                    (completed / total) * 100.0,
                    f"Generating image for Scene {s.scene_number} of {len(project.scenes)}..."
                )

                try:
                    await image_service.generate_image_for_scene(project_id, s.id, provider=provider)
                except Exception as err:
                    print(f"Failed scene {s.scene_number}: {err}")

                completed += 1
                job_queue.update_progress(
                    job.id,
                    (completed / total) * 100.0,
                    f"Completed Scene {s.scene_number} ({completed}/{total})"
                )
                await asyncio.sleep(0.4) # slight throttle

            # Refresh project
            updated_proj = project_service.get_project(project_id)
            job_queue.complete_job(
                job.id,
                result={"scenes": [sc.model_dump() for sc in (updated_proj.scenes if updated_proj else [])]},
                message=f"Successfully finished generating {completed} images!"
            )
        except Exception as e:
            job_queue.fail_job(job.id, str(e))

    task = asyncio.create_task(run_batch_task())
    job_queue.register_task(job.id, task)

    return {"job_id": job.id, "status": "started", "pending_count": len(pending_scenes)}

@router.post("/{project_id}/upload-single")
async def upload_single_scene_image(
    project_id: str,
    scene_id: str = Form(...),
    file: UploadFile = File(...)
):
    try:
        content = await file.read()
        scene = image_service.assign_image_to_scene(project_id, scene_id, content, file.filename or "image.png")
        return scene
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload image: {str(e)}")

@router.post("/{project_id}/upload-bulk")
async def upload_bulk_scene_images(
    project_id: str,
    files: List[UploadFile] = File(...)
):
    try:
        file_tuples = []
        for f in files:
            content = await f.read()
            file_tuples.append((f.filename or "image.png", content))

        updated_scenes = image_service.bulk_assign_images(project_id, file_tuples)
        return {"status": "success", "matched_count": len(updated_scenes), "scenes": [s.model_dump() for s in updated_scenes]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Bulk upload failed: {str(e)}")

@router.post("/{project_id}/browser-assist/detect")
async def detect_browser_download(
    project_id: str,
    payload: Dict[str, Any] = Body(...)
):
    scene_id = payload.get("scene_id")
    if not scene_id:
        raise HTTPException(status_code=400, detail="scene_id is required")

    scene = image_service.check_browser_downloads_for_new_image(project_id, scene_id)
    if not scene:
        return {"status": "none_found", "message": "No newly saved image found in ~/Downloads folder yet."}

    return {"status": "attached", "scene": scene.model_dump()}
