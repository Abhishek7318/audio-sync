import os
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from app.routers import projects, settings, jobs, audio, scenes, images, timeline, subtitles, export
from app.services.project_service import project_service

app = FastAPI(
    title="StoryReel Studio API",
    description="Local AI Backend for StoryReel Studio Desktop Video Creation Engine",
    version="1.0.0"
)

# CORS middleware for Electron/Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(projects.router)
app.include_router(settings.router)
app.include_router(jobs.router)
app.include_router(audio.router)
app.include_router(scenes.router)
app.include_router(images.router)
app.include_router(timeline.router)
app.include_router(subtitles.router)
app.include_router(export.router)

@app.get("/api/health")
async def health_check():
    return {
        "status": "online",
        "service": "StoryReel Studio Backend",
        "version": "1.0.0"
    }

@app.get("/api/projects/{project_id}/assets/{asset_type}/{filename}")
async def serve_project_asset(project_id: str, asset_type: str, filename: str):
    """
    Serve image, audio, subtitle, or export assets directly for the web UI player
    """
    if asset_type not in ("images", "audio", "subtitles", "exports"):
        raise HTTPException(status_code=400, detail="Invalid asset type")
        
    pdir = project_service.get_project_dir(project_id)
    if not pdir:
        raise HTTPException(status_code=404, detail="Project not found")
        
    asset_file = pdir / asset_type / filename
    if not asset_file.exists():
        raise HTTPException(status_code=404, detail=f"Asset {filename} not found")
        
    return FileResponse(asset_file)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8765, reload=True)
