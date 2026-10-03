from fastapi import APIRouter, HTTPException, Body
from fastapi.responses import Response, PlainTextResponse
from typing import List, Dict, Any
from app.services.project_service import project_service
from app.services.subtitle_service import subtitle_service
from app.models.project import SubtitleStyle, SubtitleCue

router = APIRouter(prefix="/api/subtitles", tags=["subtitles"])

@router.get("/{project_id}")
async def get_project_subtitles(project_id: str):
    """Get project subtitles and current subtitle style"""
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    return {
        "project_id": project_id,
        "subtitles": project.subtitles,
        "subtitle_style": project.subtitle_style,
        "burn_subtitles": project.export_settings.burn_subtitles,
        "export_srt_separately": project.export_settings.export_srt_separately
    }

@router.post("/{project_id}/style")
async def update_subtitle_style(project_id: str, payload: Dict[str, Any] = Body(...)):
    """Update subtitle typography, colors, position, animation and burn settings"""
    try:
        # Extract style and export settings
        style_data = payload.get("style", payload)
        burn_subtitles = payload.get("burn_subtitles")
        export_srt = payload.get("export_srt_separately")

        project = subtitle_service.update_style(project_id, style_data)
        
        if burn_subtitles is not None:
            project.export_settings.burn_subtitles = bool(burn_subtitles)
        if export_srt is not None:
            project.export_settings.export_srt_separately = bool(export_srt)
            
        project_service.save_project(project)

        return {
            "status": "success",
            "subtitle_style": project.subtitle_style,
            "burn_subtitles": project.export_settings.burn_subtitles,
            "export_srt_separately": project.export_settings.export_srt_separately
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{project_id}/cues")
async def update_subtitle_cues(project_id: str, cues: List[Dict[str, Any]] = Body(...)):
    """Batch update subtitle cues array"""
    try:
        project = subtitle_service.update_cues(project_id, cues)
        return {
            "status": "success",
            "subtitles": project.subtitles
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{project_id}/cue/{cue_id}")
async def update_single_cue(project_id: str, cue_id: str, cue_data: Dict[str, Any] = Body(...)):
    """Update a single subtitle cue text or timestamps"""
    try:
        project = subtitle_service.update_single_cue(project_id, cue_id, cue_data)
        return {
            "status": "success",
            "subtitles": project.subtitles
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{project_id}/split")
async def split_subtitle_cue(project_id: str, payload: Dict[str, Any] = Body(...)):
    """Split a cue into two at split_time"""
    try:
        cue_id = payload.get("cue_id")
        split_time = float(payload.get("split_time", 0))
        text_part1 = payload.get("text_part1", "")
        text_part2 = payload.get("text_part2", "")

        if not cue_id:
            raise HTTPException(status_code=400, detail="cue_id required")

        project = subtitle_service.split_cue(project_id, cue_id, split_time, text_part1, text_part2)
        return {
            "status": "success",
            "subtitles": project.subtitles
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{project_id}/merge")
async def merge_subtitle_cues(project_id: str, payload: Dict[str, Any] = Body(...)):
    """Merge two adjacent cues"""
    try:
        cue_id1 = payload.get("cue_id1")
        cue_id2 = payload.get("cue_id2")
        if not cue_id1 or not cue_id2:
            raise HTTPException(status_code=400, detail="cue_id1 and cue_id2 required")

        project = subtitle_service.merge_cues(project_id, cue_id1, cue_id2)
        return {
            "status": "success",
            "subtitles": project.subtitles
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{project_id}/export/srt")
async def download_srt(project_id: str):
    """Download project subtitles in standard .srt format"""
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    srt_content = subtitle_service.generate_srt(project.subtitles)
    filename = f"{project.name.replace(' ', '_')}_subtitles.srt"
    
    return PlainTextResponse(
        content=srt_content,
        headers={
            "Content-Disposition": f"attachment; filename=\"{filename}\""
        }
    )

@router.get("/{project_id}/export/ass")
async def download_ass(project_id: str):
    """Download project subtitles in Advanced SubStation Alpha .ass format"""
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    ass_content = subtitle_service.generate_ass(
        subtitles=project.subtitles,
        style=project.subtitle_style,
        aspect_ratio=project.aspect_ratio
    )
    filename = f"{project.name.replace(' ', '_')}_subtitles.ass"

    return PlainTextResponse(
        content=ass_content,
        headers={
            "Content-Disposition": f"attachment; filename=\"{filename}\""
        }
    )
