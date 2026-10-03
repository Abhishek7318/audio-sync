import os
import re
import sys
import math
import time
import shutil
import asyncio
import subprocess
from pathlib import Path
from typing import List, Dict, Any, Optional
from PIL import Image

from app.models.project import Project, Scene
from app.services.project_service import project_service
from app.services.settings_service import settings_service

class VideoGenService:
    def __init__(self):
        self._ffmpeg_path = self._find_ffmpeg()

    def _find_ffmpeg(self) -> str:
        candidates = [
            shutil.which("ffmpeg"),
            "/opt/homebrew/bin/ffmpeg",
            "/usr/local/bin/ffmpeg",
            "/usr/bin/ffmpeg"
        ]
        for c in candidates:
            if c and os.path.exists(c):
                return c
        return "ffmpeg"

    def _get_target_resolution(self, aspect_ratio: str) -> tuple[int, int]:
        if aspect_ratio == "9:16":
            return (1080, 1920)
        elif aspect_ratio == "1:1":
            return (1080, 1080)
        elif aspect_ratio == "4:5":
            return (1080, 1350)
        return (1920, 1080) # 16:9

    def _build_cinematic_motion_filter(
        self,
        motion_type: str,
        duration: float,
        fps: int,
        width: int,
        height: int,
        particle_effect: str = "none"
    ) -> str:
        """
        Builds a rich multi-layer FFmpeg filtergraph with Ken Burns motion, organic breathing,
        and procedural atmospheric particle effects (fire embers, mystic dust, rain, fog, light leaks).
        """
        total_frames = max(30, int(duration * fps))

        # Base Ken Burns Pan/Zoom
        if motion_type == "zoom_in":
            zoom_expr = "min(zoom+0.0008,1.20)"
            x_expr = "iw/2-(iw/zoom/2)"
            y_expr = "ih/2-(ih/zoom/2)"
        elif motion_type == "zoom_out":
            zoom_expr = "if(eq(on,1),1.20,max(1.0,zoom-0.0008))"
            x_expr = "iw/2-(iw/zoom/2)"
            y_expr = "ih/2-(ih/zoom/2)"
        elif motion_type == "pan_left":
            zoom_expr = "1.12"
            x_expr = f"(1-on/{total_frames})*(iw-iw/zoom)"
            y_expr = "ih/2-(ih/zoom/2)"
        elif motion_type == "pan_right":
            zoom_expr = "1.12"
            x_expr = f"(on/{total_frames})*(iw-iw/zoom)"
            y_expr = "ih/2-(ih/zoom/2)"
        elif motion_type == "pan_up":
            zoom_expr = "1.12"
            x_expr = "iw/2-(iw/zoom/2)"
            y_expr = f"(1-on/{total_frames})*(ih-ih/zoom)"
        elif motion_type == "pan_down":
            zoom_expr = "1.12"
            x_expr = "iw/2-(iw/zoom/2)"
            y_expr = f"(on/{total_frames})*(ih-ih/zoom)"
        else: # slow_drift / default
            zoom_expr = f"1.05+0.05*sin(2*PI*on/{total_frames})"
            x_expr = f"iw/2-(iw/zoom/2)+15*sin(2*PI*on/{total_frames})"
            y_expr = f"ih/2-(ih/zoom/2)+10*cos(2*PI*on/{total_frames})"

        # 1. Base zoompan filter
        base_filter = (
            f"zoompan=z='{zoom_expr}':x='{x_expr}':y='{y_expr}':"
            f"d={total_frames}:s={width}x{height}:fps={fps}"
        )

        # 2. Organic breathing & color dynamic vibrance filter
        # Subtle light pulse (period of ~3s)
        pulse_filter = "eq=contrast=1.03:brightness='0.015*sin(2*PI*t/3.2)':saturation='1.05+0.04*cos(2*PI*t/3.2)'"

        # 3. Particle Effect Overlays
        vfx_filter = ""
        if particle_effect == "fire_embers":
            # Rising warm sparks and embers overlay using noise + color balance + blend
            # Creates glowing amber rising speckles
            vfx_filter = (
                f",split=2[base][vfx];"
                f"[vfx]geq=r='if(gt(random(1)*100,99.2),255,0)':g='if(gt(random(1)*100,99.2),140,0)':b='0':a='if(gt(random(1)*100,99.2),200,0)',"
                f"gblur=sigma=1.5,"
                f"format=yuva420p[sparks];"
                f"[base][sparks]overlay=x='10*sin(t*3)+5':y='-t*70':repeatlast=1"
            )
        elif particle_effect == "mystic_dust":
            # Floating luminous fairy/god ray dust particles
            vfx_filter = (
                f",split=2[base][vfx];"
                f"[vfx]geq=r='if(gt(random(2)*100,99.5),240,0)':g='if(gt(random(2)*100,99.5),230,0)':b='if(gt(random(2)*100,99.5),255,0)':a='if(gt(random(2)*100,99.5),180,0)',"
                f"gblur=sigma=2.0,"
                f"format=yuva420p[dust];"
                f"[base][dust]overlay=x='20*sin(t*1.5)+10':y='-t*25':repeatlast=1"
            )
        elif particle_effect == "cinematic_rain":
            # Falling rain streaks
            vfx_filter = (
                f",split=2[base][vfx];"
                f"[vfx]geq=r='if(gt(random(3)*100,98.5),200,0)':g='if(gt(random(3)*100,98.5),220,0)':b='if(gt(random(3)*100,98.5),255,0)':a='if(gt(random(3)*100,98.5),160,0)',"
                f"boxblur=0:3,"
                f"format=yuva420p[rain];"
                f"[base][rain]overlay=x='-t*50':y='t*400':repeatlast=1"
            )
        elif particle_effect == "fog_mist":
            # Volumetric drifting atmospheric mist
            vfx_filter = (
                f",split=2[base][vfx];"
                f"[vfx]geq=r='180':g='190':b='210':a='35+20*sin(t*1.2+X/200)+15*cos(t*0.8+Y/150)',"
                f"boxblur=20:20,"
                f"format=yuva420p[fog];"
                f"[base][fog]overlay=x='t*20':y='0':repeatlast=1"
            )
        elif particle_effect == "light_leaks":
            # Warm glowing anamorphic flare pulse
            vfx_filter = (
                f",split=2[base][vfx];"
                f"[vfx]geq=r='255':g='160':b='60':a='(sin(t*1.5)+1)*25',"
                f"boxblur=35:35,"
                f"format=yuva420p[leak];"
                f"[base][leak]overlay=x='0':y='0':repeatlast=1"
            )
        elif particle_effect == "film_grain":
            # Organic 35mm grain & vignette
            vfx_filter = ",noise=alls=12:allf=t+u,vignette=PI/4"

        full_filter = f"{base_filter},{pulse_filter}{vfx_filter},format=yuv420p"
        return full_filter

    async def render_procedural_motion_clip(
        self,
        image_path: Path,
        output_clip_path: Path,
        duration: float,
        aspect_ratio: str = "16:9",
        motion_type: str = "zoom_in",
        particle_effect: str = "none",
        fps: int = 30
    ) -> Path:
        """
        Renders a high-quality animated MP4 video clip from a static image using 3D camera pan/zoom
        and atmospheric particle VFX.
        """
        output_clip_path.parent.mkdir(parents=True, exist_ok=True)
        width, height = self._get_target_resolution(aspect_ratio)
        total_frames = max(30, int(duration * fps))

        filter_graph = self._build_cinematic_motion_filter(
            motion_type=motion_type,
            duration=duration,
            fps=fps,
            width=width,
            height=height,
            particle_effect=particle_effect
        )

        # Hardware encoder detection
        is_macos = (sys.platform == "darwin")
        encoder = "h264_videotoolbox" if is_macos else "libx264"

        cmd = [
            self._ffmpeg_path,
            "-y",
            "-loop", "1",
            "-i", str(image_path),
            "-vf", filter_graph,
            "-frames:v", str(total_frames),
            "-c:v", encoder
        ]

        if encoder == "h264_videotoolbox":
            cmd.extend(["-b:v", "10M", "-profile:v", "high", "-allow_sw", "1"])
        else:
            cmd.extend(["-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p"])

        cmd.extend([
            "-movflags", "+faststart",
            str(output_clip_path)
        ])

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await proc.communicate()

        if proc.returncode != 0:
            # Fallback to libx264 if videotoolbox failed
            fallback_cmd = [
                self._ffmpeg_path,
                "-y",
                "-loop", "1",
                "-i", str(image_path),
                "-vf", filter_graph,
                "-frames:v", str(total_frames),
                "-c:v", "libx264",
                "-preset", "fast",
                "-crf", "19",
                "-pix_fmt", "yuv420p",
                "-movflags", "+faststart",
                str(output_clip_path)
            ]
            fallback_proc = await asyncio.create_subprocess_exec(
                *fallback_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            f_stdout, f_stderr = await fallback_proc.communicate()
            if fallback_proc.returncode != 0:
                raise RuntimeError(f"FFmpeg motion render failed: {f_stderr.decode('utf-8', errors='ignore')[:300]}")

        return output_clip_path

    async def animate_single_scene(
        self,
        project: Project,
        scene_id: str,
        motion_mode: str = "cinematic_vfx",
        particle_effect: Optional[str] = None
    ) -> Scene:
        """
        Animates a single scene image into a full motion video clip.
        """
        scene = next((s for s in project.scenes if s.id == scene_id), None)
        if not scene:
            raise ValueError(f"Scene with ID {scene_id} not found")

        if not scene.generated_image_path or not os.path.exists(scene.generated_image_path):
            raise ValueError(f"Scene {scene.scene_number} has no generated image to animate")

        scene.video_status = "generating"
        project_service.save_project(project)

        project_dir = Path(project.project_dir or f"./projects/{project.id}")
        clips_dir = project_dir / "clips"
        clips_dir.mkdir(parents=True, exist_ok=True)
        clip_path = clips_dir / f"scene_{scene.scene_number:03d}_motion.mp4"

        effect = particle_effect or scene.particle_effect or "none"
        motion_type = scene.camera_motion.type or "zoom_in"
        duration = max(2.0, scene.duration or 5.0)

        try:
            await self.render_procedural_motion_clip(
                image_path=Path(scene.generated_image_path),
                output_clip_path=clip_path,
                duration=duration,
                aspect_ratio=project.aspect_ratio,
                motion_type=motion_type,
                particle_effect=effect,
                fps=project.fps or 30
            )

            scene.video_clip_path = str(clip_path.resolve())
            scene.video_status = "ready"
            scene.particle_effect = effect
            project_service.save_project(project)
            return scene
        except Exception as e:
            scene.video_status = "failed"
            project_service.save_project(project)
            raise e

    async def animate_batch_scenes(
        self,
        project: Project,
        motion_mode: str = "cinematic_vfx",
        particle_effect: str = "auto",
        on_progress: Optional[Any] = None
    ) -> List[Scene]:
        """
        Animates all scenes in the project in parallel / queue.
        """
        total = len(project.scenes)
        animated_scenes = []

        # Auto particle effect mapping based on mood & scene
        mood_particle_map = {
            "dramatic": "fire_embers",
            "mysterious": "fog_mist",
            "epic": "light_leaks",
            "emotional": "cinematic_rain",
            "joyful": "mystic_dust",
            "tense": "film_grain"
        }

        for i, scene in enumerate(project.scenes):
            if not scene.generated_image_path or not os.path.exists(scene.generated_image_path):
                continue

            chosen_effect = particle_effect
            if chosen_effect == "auto":
                chosen_effect = mood_particle_map.get(scene.mood.lower(), "none")

            if on_progress:
                progress_pct = (i / total) * 100
                on_progress(progress_pct, f"Animating Scene {scene.scene_number}/{total} ({scene.camera_motion.type})...")

            try:
                updated = await self.animate_single_scene(
                    project=project,
                    scene_id=scene.id,
                    motion_mode=motion_mode,
                    particle_effect=chosen_effect
                )
                animated_scenes.append(updated)
            except Exception as e:
                print(f"Failed to animate scene {scene.scene_number}: {e}")

        if on_progress:
            on_progress(100.0, f"Completed animation for {len(animated_scenes)} scenes!")

        return project.scenes

video_gen_service = VideoGenService()
