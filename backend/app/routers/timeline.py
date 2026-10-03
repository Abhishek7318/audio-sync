from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Body, UploadFile, File
from app.models.project import Project, Scene, CameraMotion
from app.services.project_service import project_service
from app.services.motion_service import motion_service

router = APIRouter(prefix="/api/timeline", tags=["timeline"])

@router.post("/{project_id}/reorder")
async def reorder_scenes(
    project_id: str,
    payload: Dict[str, Any] = Body(...)
):
    scene_ids = payload.get("scene_ids", [])
    if not scene_ids:
        raise HTTPException(status_code=400, detail="scene_ids list is required")

    try:
        project = motion_service.reorder_scenes(project_id, scene_ids)
        return {"status": "success", "scenes": [s.model_dump() for s in project.scenes]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{project_id}/update-duration")
async def update_scene_duration(
    project_id: str,
    payload: Dict[str, Any] = Body(...)
):
    scene_id = payload.get("scene_id")
    duration = float(payload.get("duration", 0.0))

    if not scene_id or duration <= 0:
        raise HTTPException(status_code=400, detail="scene_id and duration (>0) are required")

    try:
        project = motion_service.update_scene_duration(project_id, scene_id, duration)
        return {
            "status": "success",
            "scenes": [s.model_dump() for s in project.scenes],
            "subtitles": [c.model_dump() for c in (project.subtitles or [])]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{project_id}/split")
async def split_scene(
    project_id: str,
    payload: Dict[str, Any] = Body(...)
):
    scene_id = payload.get("scene_id")
    split_time = float(payload.get("split_time", 0.0))

    if not scene_id or split_time <= 0:
        raise HTTPException(status_code=400, detail="scene_id and split_time (>0) are required")

    try:
        project = motion_service.split_scene_at_time(project_id, scene_id, split_time)
        return {"status": "success", "scenes": [s.model_dump() for s in project.scenes]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{project_id}/update-motion")
async def update_scene_motion(
    project_id: str,
    payload: Dict[str, Any] = Body(...)
):
    scene_id = payload.get("scene_id")
    motion = payload.get("motion", {})

    if not scene_id:
        raise HTTPException(status_code=400, detail="scene_id is required")

    try:
        project = motion_service.update_scene_motion(project_id, scene_id, motion)
        scene = next((s for s in project.scenes if s.id == scene_id), None)
        return {"status": "success", "scene": scene.model_dump() if scene else None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{project_id}/update-transition")
async def update_scene_transition(
    project_id: str,
    payload: Dict[str, Any] = Body(...)
):
    scene_id = payload.get("scene_id")
    transition_in = payload.get("transition_in", "cut")
    transition_duration = float(payload.get("transition_duration", 0.5))

    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    scene = next((s for s in project.scenes if s.id == scene_id), None)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    scene.transition_in = transition_in
    scene.transition_duration = transition_duration
    project_service.save_project(project)

    return {"status": "success", "scene": scene.model_dump()}

@router.post("/{project_id}/auto-fit-audio-and-motion")
async def auto_fit_audio_and_motion(project_id: str):
    try:
        project = motion_service.auto_fit_audio_and_cinematic_motion(project_id)
        return {
            "status": "success",
            "scenes": [s.model_dump() for s in project.scenes],
            "subtitles": [c.model_dump() for c in (project.subtitles or [])]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{project_id}/snap-to-speech")
async def snap_scenes_to_speech(project_id: str):
    try:
        project = motion_service.auto_fit_audio_and_cinematic_motion(project_id)
        return {
            "status": "success",
            "scenes": [s.model_dump() for s in project.scenes],
            "subtitles": [c.model_dump() for c in (project.subtitles or [])]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{project_id}/bgm-upload")
async def upload_background_music(
    project_id: str,
    file: UploadFile = File(...)
):
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    project_dir = Path(project.project_dir) if project.project_dir else Path.home() / "StoryReelProjects" / project_id
    audio_dir = project_dir / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)

    filename = f"bgm_{file.filename or 'music.mp3'}"
    target_path = audio_dir / filename

    content = await file.read()
    with open(target_path, "wb") as f:
        f.write(content)

    project.background_music.file_path = str(target_path)
    project.background_music.volume = 0.25
    project.background_music.auto_ducking = True
    project_service.save_project(project)

    return {
        "status": "success",
        "background_music": project.background_music.model_dump(),
        "filename": filename
    }
