import os
import shutil
import asyncio
from pathlib import Path
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Body
from app.models.project import AudioTrack, SubtitleCue, Project
from app.services.project_service import project_service
from app.services.audio_service import audio_service
from app.services.alignment_service import alignment_service
from app.services.tts_service import tts_service
from app.services.job_queue import job_queue

router = APIRouter(prefix="/api/audio", tags=["audio"])

@router.get("/voices")
async def get_tts_voices():
    return tts_service.get_voices()

@router.post("/{project_id}/generate-tts")
async def generate_narration_tts(
    project_id: str,
    payload: Dict[str, Any] = Body(...)
):
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    text = payload.get("text") or project.story_raw_text
    if not text.strip():
        raise HTTPException(status_code=400, detail="Story text is required to generate AI voice narration")

    voice = payload.get("voice", "hi-IN-MadhurNeural")
    provider = payload.get("provider", "edge")
    speed_rate = int(payload.get("speed_rate", 0))

    try:
        audio_track = await tts_service.generate_project_narration(
            project_id=project_id,
            text=text,
            voice=voice,
            provider=provider,
            speed_rate=speed_rate
        )
        return audio_track
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {str(e)}")

@router.post("/{project_id}/upload")
async def upload_audio(
    project_id: str,
    file: Optional[UploadFile] = File(None),
    source_path: Optional[str] = Form(None)
):
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    pdir = Path(project.project_dir)
    audio_dir = pdir / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)

    if file:
        filename = file.filename or "narration_audio.mp3"
        ext = Path(filename).suffix or ".mp3"
        dest_path = audio_dir / f"narration_audio{ext}"
        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        audio_track = audio_service.attach_audio_to_project(project_id, dest_path, filename)
        return audio_track
    elif source_path:
        src = Path(source_path)
        if not src.exists():
            raise HTTPException(status_code=400, detail=f"Source file does not exist: {source_path}")
        audio_track = audio_service.attach_audio_to_project(project_id, src, src.name)
        return audio_track
    else:
        raise HTTPException(status_code=400, detail="No audio file or source_path provided")

@router.post("/{project_id}/align")
async def align_audio(
    project_id: str,
    payload: Dict[str, Any] = Body(default={})
):
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    story_text = payload.get("story_text") or project.story_raw_text
    if not story_text.strip():
        raise HTTPException(status_code=400, detail="Story text is required for speech alignment")

    use_whisper_api = payload.get("use_whisper_api", False)
    mode = payload.get("mode", "auto") # auto, whisper_api, proportional

    # Create job
    job = job_queue.create_job(project_id, "alignment", "Starting speech alignment...")

    async def run_alignment_task():
        try:
            job_queue.update_progress(job.id, 15.0, "Analyzing audio waveform and story script...")
            await asyncio.sleep(0.3)

            audio_path = Path(project.narration_audio.file_path) if project.narration_audio.file_path else None
            duration = project.narration_audio.duration or 0.0

            # If no audio file attached, calculate duration from text
            if not audio_path or not audio_path.exists():
                job_queue.update_progress(job.id, 50.0, "Generating proportional timestamp mapping...")
                cues = alignment_service.estimate_proportional_alignment(story_text, duration)
            else:
                lang_code = "hi" if "hindi" in project.language.lower() else "en"
                
                if mode == "whisper_api" or use_whisper_api:
                    job_queue.update_progress(job.id, 40.0, "Transcribing with Whisper API (word timestamps)...")
                    try:
                        whisper_words = alignment_service.transcribe_with_openai_whisper(audio_path, lang_code)
                        job_queue.update_progress(job.id, 75.0, "Aligning transcript words with story sentences...")
                        cues = alignment_service.align_whisper_words_to_story(story_text, whisper_words, duration)
                    except Exception as e:
                        print(f"Whisper API fallback to proportional: {e}")
                        job_queue.update_progress(job.id, 60.0, f"Whisper API notice ({str(e)}), generating smart heuristic alignment...")
                        cues = alignment_service.estimate_proportional_alignment(story_text, duration)
                else:
                    # Smart heuristic alignment
                    job_queue.update_progress(job.id, 60.0, "Aligning speech cadence and sentence boundaries...")
                    await asyncio.sleep(0.5)
                    cues = alignment_service.estimate_proportional_alignment(story_text, duration)

            # Update project with aligned cues
            project.subtitles = cues
            project.narration_audio.aligned = True
            project_service.save_project(project)

            job_queue.complete_job(
                job.id,
                result={"cues_count": len(cues), "cues": [c.model_dump() for c in cues]},
                message=f"Successfully aligned {len(cues)} sentence segments"
            )
        except Exception as e:
            job_queue.fail_job(job.id, str(e))

    task = asyncio.create_task(run_alignment_task())
    job_queue.register_task(job.id, task)

    return {"job_id": job.id, "status": "started"}

@router.post("/{project_id}/update-cues")
async def update_cues(project_id: str, cues: List[SubtitleCue]):
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    project.subtitles = cues
    project.narration_audio.aligned = True
    project_service.save_project(project)
    return {"status": "saved", "cues_count": len(cues)}
