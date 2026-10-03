import shutil
from fastapi import APIRouter, HTTPException
from app.models.settings import AppSettings
from app.services.settings_service import settings_service

router = APIRouter(prefix="/api/settings", tags=["settings"])

@router.get("", response_model=AppSettings)
async def get_settings():
    return settings_service.get_settings()

@router.post("", response_model=AppSettings)
async def update_settings(settings: AppSettings):
    try:
        return settings_service.save_settings(settings)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save settings: {str(e)}")

@router.get("/system-check")
async def system_check():
    ffmpeg_detected = shutil.which("ffmpeg") is not None
    ffprobe_detected = shutil.which("ffprobe") is not None
    
    return {
        "ffmpeg": ffmpeg_detected,
        "ffmpeg_path": shutil.which("ffmpeg"),
        "ffprobe": ffprobe_detected,
        "ffprobe_path": shutil.which("ffprobe"),
        "python_version": "3.14",
        "gpu_available": False # Will be extended for CUDA/MPS checks
    }
