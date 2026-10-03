import os
import sys
import json
import uuid
import shutil
import asyncio
import subprocess
from pathlib import Path
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone

from app.models.project import Project, ExportSettings, Scene
from app.services.project_service import project_service
from app.services.subtitle_service import subtitle_service
from app.services.job_queue import job_queue

class ExportService:
    def __init__(self):
        self._cached_encoder: Optional[str] = None

    def detect_hardware_encoder(self) -> Dict[str, Any]:
        """Detect best available FFmpeg video encoder (Apple VideoToolbox, NVENC, AMF, or libx264)"""
        if self._cached_encoder:
            return {"encoder": self._cached_encoder, "type": "hardware" if "videotoolbox" in self._cached_encoder or "nvenc" in self._cached_encoder else "software"}

        # Test encoders by probing ffmpeg -encoders
        try:
            res = subprocess.run(["ffmpeg", "-encoders"], capture_output=True, text=True, timeout=5)
            encoders_output = res.stdout

            if "h264_videotoolbox" in encoders_output:
                self._cached_encoder = "h264_videotoolbox"
                return {"encoder": "h264_videotoolbox", "name": "Apple VideoToolbox (GPU Accelerated)", "type": "hardware"}
            elif "h264_nvenc" in encoders_output:
                self._cached_encoder = "h264_nvenc"
                return {"encoder": "h264_nvenc", "name": "NVIDIA NVENC (GPU Accelerated)", "type": "hardware"}
            elif "h264_amf" in encoders_output:
                self._cached_encoder = "h264_amf"
                return {"encoder": "h264_amf", "name": "AMD AMF (GPU Accelerated)", "type": "hardware"}
            else:
                self._cached_encoder = "libx264"
                return {"encoder": "libx264", "name": "CPU x264 Software Encoder", "type": "software"}
        except Exception:
            self._cached_encoder = "libx264"
            return {"encoder": "libx264", "name": "CPU x264 Software Encoder", "type": "software"}

    def _get_preset_dimensions(self, preset: str, aspect_ratio: str) -> tuple[int, int]:
        """Determine export width and height based on preset and aspect ratio"""
        if aspect_ratio == "9:16":
            if preset == "youtube_4k":
                return 2160, 3840
            return 1080, 1920
        elif aspect_ratio == "1:1":
            if preset == "youtube_4k":
                return 2160, 2160
            return 1080, 1080
        elif aspect_ratio == "4:5":
            return 1080, 1350
        else:
            # 16:9 Landscape
            if preset == "youtube_4k":
                return 3840, 2160
            elif preset == "720p":
                return 1280, 720
            return 1920, 1080

    def start_export_job(self, project_id: str, settings_override: Optional[Dict[str, Any]] = None) -> str:
        """Start async FFmpeg rendering job and return job_id"""
        project = project_service.get_project(project_id)
        if not project:
            raise ValueError(f"Project {project_id} not found")

        # Update export settings if override provided
        if settings_override:
            current_dict = project.export_settings.model_dump()
            current_dict.update(settings_override)
            project.export_settings = ExportSettings(**current_dict)
            project_service.save_project(project)

        job = job_queue.create_job(project_id, "video_export", "Initializing FFmpeg render pipeline...")
        task = asyncio.create_task(self._execute_render_job(job.id, project_id, project.export_settings))
        job_queue.register_task(job.id, task)

        return job.id

    async def _execute_render_job(self, job_id: str, project_id: str, settings: ExportSettings):
        """Execute full FFmpeg rendering process with real-time progress parsing"""
        try:
            project = project_service.get_project(project_id)
            if not project:
                job_queue.fail_job(job_id, "Project not found")
                return

            pdir = project_service.get_project_dir(project_id)
            if not pdir:
                job_queue.fail_job(job_id, "Project directory not found")
                return

            exports_dir = pdir / "exports"
            exports_dir.mkdir(parents=True, exist_ok=True)
            temp_render_dir = exports_dir / f"tmp_{job_id[:8]}"
            temp_render_dir.mkdir(parents=True, exist_ok=True)

            job_queue.update_progress(job_id, 5.0, "Preparing media assets and subtitle tracks...")

            scenes = project.scenes
            if not scenes:
                job_queue.fail_job(job_id, "Project has no scenes to render")
                return

            # Determine dimensions and FPS
            width, height = self._get_preset_dimensions(settings.preset, project.aspect_ratio)
            fps = settings.fps or 30
            encoder_info = self.detect_hardware_encoder()
            encoder = settings.codec if settings.codec and settings.codec != "auto" else encoder_info["encoder"]

            # Calculate total duration
            total_duration = scenes[-1].end_time if scenes else (project.narration_audio.duration or 10.0)

            # Subtitle preparation
            ass_path: Optional[Path] = None
            if settings.burn_subtitles:
                sub_res = subtitle_service.save_subtitle_files(project)
                if sub_res.get("ass_path"):
                    ass_path = Path(sub_res["ass_path"])

            # ─────────────────────────────────────────────────────────────
            # STEP 1: Render Individual Scene Clips with Ken Burns Motions
            # ─────────────────────────────────────────────────────────────
            scene_clips: List[Path] = []
            total_scenes = len(scenes)

            for i, scene in enumerate(scenes):
                clip_file = temp_render_dir / f"scene_{scene.scene_number:03d}.ts"
                scene_duration = max(0.2, scene.duration)
                duration_frames = int(round(scene_duration * fps))

                # Resolve image path across multiple naming conventions
                img_path: Optional[Path] = None
                candidates = [
                    pdir / "images" / f"scene_{scene.scene_number:02d}.png",
                    pdir / "images" / f"scene_{scene.scene_number}.png",
                    pdir / "images" / f"scene_{scene.scene_number:03d}.png",
                    pdir / "images" / f"scene_{scene.scene_number:02d}.jpg",
                    pdir / "images" / f"scene_{scene.scene_number}.jpg",
                ]
                if scene.generated_image_path:
                    candidates.insert(0, Path(scene.generated_image_path))
                    candidates.insert(1, pdir / "images" / Path(scene.generated_image_path).name)

                for cand in candidates:
                    if cand.exists():
                        img_path = cand
                        break

                # Ken Burns Filter Expression
                motion = scene.camera_motion
                motion_type = motion.type if motion else "zoom_in"
                intensity = motion.intensity if motion and motion.intensity else 1.25

                # Zoompan filter expressions
                # Note: zoompan requires image input and outputs video stream
                if motion_type == "zoom_out":
                    zoom_expr = f"if(lte(zoom,1.0),{intensity},max(1.001,zoom-({intensity}-1.0)/{duration_frames}))"
                    x_expr = "iw/2-(iw/zoom/2)"
                    y_expr = "ih/2-(ih/zoom/2)"
                elif motion_type == "pan_left":
                    zoom_expr = str(intensity)
                    x_expr = f"(iw*{intensity}-iw)*{1.0}/2 - (iw*{intensity}-iw)*on/{duration_frames}"
                    y_expr = "ih/2-(ih/zoom/2)"
                elif motion_type == "pan_right":
                    zoom_expr = str(intensity)
                    x_expr = f"-(iw*{intensity}-iw)*{1.0}/2 + (iw*{intensity}-iw)*on/{duration_frames}"
                    y_expr = "ih/2-(ih/zoom/2)"
                elif motion_type == "pan_up":
                    zoom_expr = str(intensity)
                    x_expr = "iw/2-(iw/zoom/2)"
                    y_expr = f"(ih*{intensity}-ih)*{1.0}/2 - (ih*{intensity}-ih)*on/{duration_frames}"
                elif motion_type == "pan_down":
                    zoom_expr = str(intensity)
                    x_expr = "iw/2-(iw/zoom/2)"
                    y_expr = f"-(ih*{intensity}-ih)*{1.0}/2 + (ih*{intensity}-ih)*on/{duration_frames}"
                elif motion_type in ("slow_drift", "zoom_in_pan_right"):
                    zoom_expr = f"min(zoom+({intensity}-1.0)/{duration_frames},{intensity})"
                    x_expr = f"-(iw*{intensity}-iw)/4 + (iw*{intensity}-iw)/2 * on/{duration_frames}"
                    y_expr = "ih/2-(ih/zoom/2)"
                elif motion_type == "static":
                    zoom_expr = "1.0"
                    x_expr = "iw/2-(iw/zoom/2)"
                    y_expr = "ih/2-(ih/zoom/2)"
                else:
                    # Default: zoom_in
                    zoom_expr = f"min(zoom+({intensity}-1.0)/{duration_frames},{intensity})"
                    x_expr = "iw/2-(iw/zoom/2)"
                    y_expr = "ih/2-(ih/zoom/2)"

                if img_path and img_path.exists():
                    # Ken Burns with zoompan on single image (no -loop 1 to prevent infinite stream)
                    vf = f"scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},zoompan=z='{zoom_expr}':d={duration_frames}:x='{x_expr}':y='{y_expr}':s={width}x{height}:fps={fps},setsar=1,format=yuv420p"
                    cmd = [
                        "ffmpeg", "-y",
                        "-i", str(img_path),
                        "-vf", vf,
                        "-c:v", "libx264",
                        "-preset", "ultrafast",
                        "-crf", "20",
                        "-frames:v", str(duration_frames),
                        str(clip_file)
                    ]
                else:
                    # Clean solid color background (no drawtext to avoid libfreetype dependency)
                    vf = f"color=c=0x0f111a:s={width}x{height}:r={fps},format=yuv420p"
                    cmd = [
                        "ffmpeg", "-y",
                        "-f", "lavfi",
                        "-i", vf,
                        "-c:v", "libx264",
                        "-preset", "ultrafast",
                        "-crf", "20",
                        "-frames:v", str(duration_frames),
                        str(clip_file)
                    ]

                proc = await asyncio.create_subprocess_exec(*cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
                stdout, stderr = await proc.communicate()

                if clip_file.exists():
                    scene_clips.append(clip_file)
                else:
                    err_msg = stderr.decode('utf-8', errors='ignore') if stderr else 'unknown error'
                    print(f"Warning: Failed to render clip {clip_file.name}: {err_msg[:200]}")

                pct = 10.0 + ((i + 1) / total_scenes) * 45.0
                job_queue.update_progress(job_id, pct, f"Rendered scene {i+1}/{total_scenes} with cinematic camera motion...")

            if not scene_clips:
                job_queue.fail_job(job_id, "Failed to render scene video clips")
                return

            # ─────────────────────────────────────────────────────────────
            # STEP 2: Concat Clips List
            # ─────────────────────────────────────────────────────────────
            concat_list_file = temp_render_dir / "concat_list.txt"
            with open(concat_list_file, "w", encoding="utf-8") as f:
                for clip in scene_clips:
                    f.write(f"file '{clip.absolute()}'\n")

            concatenated_video = temp_render_dir / "combined_video.mp4"
            cmd_concat = [
                "ffmpeg", "-y",
                "-f", "concat",
                "-safe", "0",
                "-i", str(concat_list_file),
                "-c", "copy",
                str(concatenated_video)
            ]
            proc_concat = await asyncio.create_subprocess_exec(*cmd_concat, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
            stdout_c, stderr_c = await proc_concat.communicate()
            if proc_concat.returncode != 0 or not concatenated_video.exists():
                err_text = stderr_c.decode('utf-8', errors='ignore') if stderr_c else 'Concat failed'
                job_queue.fail_job(job_id, f"Failed to concatenate scene clips: {err_text[:300]}")
                return

            # Free disk space immediately after concatenation
            for c in scene_clips:
                try:
                    c.unlink(missing_ok=True)
                except Exception:
                    pass

            job_queue.update_progress(job_id, 60.0, "Merging audio tracks, music soundtrack & mastering LUFS...")

            # ─────────────────────────────────────────────────────────────
            # STEP 3: Audio Mastering & Music Mixing
            # ─────────────────────────────────────────────────────────────
            narration_file = None
            if project.narration_audio and project.narration_audio.file_path:
                n_path = pdir / "audio" / Path(project.narration_audio.file_path).name
                if n_path.exists():
                    narration_file = n_path

            bgm_file = None
            if project.background_music and project.background_music.file_path:
                b_path = pdir / "audio" / Path(project.background_music.file_path).name
                if b_path.exists():
                    bgm_file = b_path

            mixed_audio = temp_render_dir / "master_audio.m4a"
            if narration_file and bgm_file:
                # Mix narration and background music with auto-ducking (BGM volume at 0.18 during speech)
                bgm_vol = project.background_music.volume or 0.20
                cmd_audio = [
                    "ffmpeg", "-y",
                    "-i", str(narration_file),
                    "-stream_loop", "-1",
                    "-i", str(bgm_file),
                    "-filter_complex",
                    f"[1:a]volume={bgm_vol}[bgm];[0:a][bgm]amix=inputs=2:duration=first:dropout_transition=2,loudnorm=I=-14:LRA=11:TP=-1.5[aout]",
                    "-map", "[aout]",
                    "-c:a", "aac",
                    "-b:a", settings.audio_bitrate or "320k",
                    "-t", str(total_duration),
                    str(mixed_audio)
                ]
            elif narration_file:
                cmd_audio = [
                    "ffmpeg", "-y",
                    "-i", str(narration_file),
                    "-af", "loudnorm=I=-14:LRA=11:TP=-1.5",
                    "-c:a", "aac",
                    "-b:a", settings.audio_bitrate or "320k",
                    "-t", str(total_duration),
                    str(mixed_audio)
                ]
            else:
                # Silent audio track fallback
                cmd_audio = [
                    "ffmpeg", "-y",
                    "-f", "lavfi",
                    "-i", f"anullsrc=r=44100:cl=stereo",
                    "-t", str(total_duration),
                    "-c:a", "aac",
                    str(mixed_audio)
                ]

            proc_audio = await asyncio.create_subprocess_exec(*cmd_audio, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
            await proc_audio.communicate()

            job_queue.update_progress(job_id, 75.0, "Applying subtitles and final hardware-accelerated video packaging...")

            # ─────────────────────────────────────────────────────────────
            # STEP 4: Final Multiplexing & Hardware GPU Encoding
            # ─────────────────────────────────────────────────────────────
            clean_name = "".join([c if c.isalnum() or c in (" ", "-", "_") else "_" for c in project.name]).strip()
            timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_filename = f"{clean_name}_{settings.preset}_{timestamp_str}.mp4"
            final_output_file = exports_dir / output_filename

            # Build final FFmpeg command
            cmd_final = [
                "ffmpeg", "-y",
                "-i", str(concatenated_video),
                "-i", str(mixed_audio)
            ]

            # Subtitle burn-in filter if requested
            video_filters = []
            if settings.burn_subtitles and ass_path and ass_path.exists():
                # Escape Windows/macOS path for FFmpeg filter
                escaped_ass = str(ass_path.absolute()).replace("\\", "/").replace(":", "\\:")
                video_filters.append(f"ass='{escaped_ass}'")

            if video_filters:
                cmd_final.extend(["-vf", ",".join(video_filters)])
                # Codec settings when re-encoding is needed for filter
                if encoder == "h264_videotoolbox":
                    cmd_final.extend([
                        "-c:v", "h264_videotoolbox",
                        "-b:v", settings.video_bitrate or "14M",
                        "-allow_sw", "1"
                    ])
                elif encoder == "h264_nvenc":
                    cmd_final.extend([
                        "-c:v", "h264_nvenc",
                        "-preset", "p6",
                        "-b:v", settings.video_bitrate or "14M"
                    ])
                else:
                    # libx264 CPU fallback
                    cmd_final.extend([
                        "-c:v", "libx264",
                        "-preset", "ultrafast",
                        "-crf", "18",
                        "-pix_fmt", "yuv420p"
                    ])
            else:
                # Direct lossless stream copy for instantaneous packaging
                cmd_final.extend([
                    "-c:v", "copy"
                ])

            cmd_final.extend([
                "-c:a", "copy",
                "-shortest",
                "-movflags", "+faststart",
                str(final_output_file)
            ])

            job_queue.update_progress(job_id, 85.0, "Packaging final MP4 file with faststart stream flags...")
            proc_final = await asyncio.create_subprocess_exec(*cmd_final, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
            stdout_f, stderr_f = await proc_final.communicate()
            if proc_final.returncode != 0 or not final_output_file.exists():
                err_text = stderr_f.decode('utf-8', errors='ignore') if stderr_f else 'Final packaging failed'
                job_queue.fail_job(job_id, f"FFmpeg final packaging error: {err_text[:300]}")
                return

            # Cleanup temp folder
            try:
                shutil.rmtree(temp_render_dir, ignore_errors=True)
            except Exception:
                pass

            if not final_output_file.exists():
                job_queue.fail_job(job_id, "FFmpeg failed to generate final MP4 video")
                return

            file_size_bytes = final_output_file.stat().st_size
            file_size_mb = round(file_size_bytes / (1024 * 1024), 2)

            result_data = {
                "filename": output_filename,
                "file_path": str(final_output_file),
                "file_size_mb": file_size_mb,
                "duration": total_duration,
                "resolution": f"{width}x{height}",
                "fps": fps,
                "encoder_used": encoder,
                "burn_subtitles": settings.burn_subtitles,
                "video_url": f"/api/projects/{project_id}/assets/exports/{output_filename}",
                "srt_url": f"/api/subtitles/{project_id}/export/srt",
                "ass_url": f"/api/subtitles/{project_id}/export/ass",
                "completed_at": datetime.now(timezone.utc).isoformat()
            }

            job_queue.complete_job(
                job_id,
                result=result_data,
                message=f"🎉 Video rendered successfully! ({file_size_mb} MB, {width}x{height} @ {fps}fps)"
            )

        except Exception as e:
            job_queue.fail_job(job_id, f"Render exception: {str(e)}")

export_service = ExportService()
