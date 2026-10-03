from fastapi import APIRouter, HTTPException, Body
from typing import Dict, Any, Optional
from pathlib import Path
from app.services.project_service import project_service
from app.services.export_service import export_service
from app.services.job_queue import job_queue

router = APIRouter(prefix="/api/export", tags=["export"])

@router.get("/hardware-info")
async def get_hardware_info():
    """Get detected hardware encoder capabilities (Apple VideoToolbox, NVENC, AMF)"""
    return export_service.detect_hardware_encoder()

@router.get("/{project_id}/settings")
async def get_export_settings(project_id: str):
    """Get current export configuration for project"""
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    encoder_info = export_service.detect_hardware_encoder()

    return {
        "project_id": project_id,
        "export_settings": project.export_settings,
        "aspect_ratio": project.aspect_ratio,
        "scene_count": len(project.scenes),
        "total_duration": project.scenes[-1].end_time if project.scenes else (project.narration_audio.duration or 0.0),
        "hardware_encoder": encoder_info
    }

@router.post("/{project_id}/start")
async def start_video_render(project_id: str, payload: Dict[str, Any] = Body(default={})):
    """Trigger background FFmpeg video rendering job"""
    try:
        job_id = export_service.start_export_job(project_id, payload.get("settings"))
        return {
            "status": "started",
            "job_id": job_id,
            "message": "Video render job started in background"
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{project_id}/status/{job_id}")
async def get_render_status(project_id: str, job_id: str):
    """Poll progress of active video render job"""
    job = job_queue.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return {
        "job_id": job.id,
        "status": job.status,
        "progress": job.progress,
        "message": job.message,
        "result": job.result,
        "error": job.error,
        "created_at": job.created_at,
        "updated_at": job.updated_at
    }

@router.post("/{project_id}/cancel/{job_id}")
async def cancel_render_job(project_id: str, job_id: str):
    """Cancel an active rendering job"""
    job_queue.cancel_job(job_id)
    return {
        "status": "cancelled",
        "job_id": job_id,
        "message": "Render job cancelled"
    }

@router.get("/{project_id}/history")
async def list_exported_videos(project_id: str):
    """List previously exported MP4 videos for this project"""
    pdir = project_service.get_project_dir(project_id)
    if not pdir:
        raise HTTPException(status_code=404, detail="Project not found")

    exports_dir = pdir / "exports"
    if not exports_dir.exists():
        return {"videos": []}

    videos = []
    for f in exports_dir.glob("*.mp4"):
        try:
            stat = f.stat()
            videos.append({
                "filename": f.name,
                "file_size_mb": round(stat.st_size / (1024 * 1024), 2),
                "created_at": stat.st_mtime,
                "video_url": f"/api/projects/{project_id}/assets/exports/{f.name}"
            })
        except Exception:
            continue

    videos.sort(key=lambda x: x["created_at"], reverse=True)
    return {"videos": videos}
