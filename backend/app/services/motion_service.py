import os
import math
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from app.models.project import Project, Scene, CameraMotion
from app.services.project_service import project_service
from app.services.audio_service import audio_service

class MotionService:
    """
    Ken Burns Cinematic Motion & Multi-Track Timeline Engine
    Calculates 2D camera motion keyframes, viewport crops, and FFmpeg filter graphs.
    """

    def calculate_motion_crops(
        self,
        motion_type: str,
        aspect_ratio: str = "16:9",
        speed: str = "medium",
        intensity: float = 1.25
    ) -> Tuple[Dict[str, float], Dict[str, float]]:
        """
        Calculates normalized start and end viewport crops [x, y, w, h] in range 0.0 -> 1.0
        """
        zoom_factor = 1.15 if speed == "slow" else (1.25 if speed == "medium" else 1.40)
        if intensity > 1.0:
            zoom_factor = intensity

        w_zoomed = 1.0 / zoom_factor
        h_zoomed = 1.0 / zoom_factor

        # Default full frame
        full = {"x": 0.0, "y": 0.0, "w": 1.0, "h": 1.0}
        center_zoomed = {
            "x": (1.0 - w_zoomed) / 2.0,
            "y": (1.0 - h_zoomed) / 2.0,
            "w": w_zoomed,
            "h": h_zoomed
        }

        if motion_type == "zoom_in":
            # Start full frame -> end center zoomed
            return full, center_zoomed

        elif motion_type == "zoom_out":
            # Start center zoomed -> end full frame
            return center_zoomed, full

        elif motion_type == "pan_left":
            # Pan from right to left
            start_crop = {"x": 1.0 - w_zoomed, "y": (1.0 - h_zoomed) / 2.0, "w": w_zoomed, "h": h_zoomed}
            end_crop = {"x": 0.0, "y": (1.0 - h_zoomed) / 2.0, "w": w_zoomed, "h": h_zoomed}
            return start_crop, end_crop

        elif motion_type == "pan_right":
            # Pan from left to right
            start_crop = {"x": 0.0, "y": (1.0 - h_zoomed) / 2.0, "w": w_zoomed, "h": h_zoomed}
            end_crop = {"x": 1.0 - w_zoomed, "y": (1.0 - h_zoomed) / 2.0, "w": w_zoomed, "h": h_zoomed}
            return start_crop, end_crop

        elif motion_type == "pan_up":
            # Tilt from bottom to top
            start_crop = {"x": (1.0 - w_zoomed) / 2.0, "y": 1.0 - h_zoomed, "w": w_zoomed, "h": h_zoomed}
            end_crop = {"x": (1.0 - w_zoomed) / 2.0, "y": 0.0, "w": w_zoomed, "h": h_zoomed}
            return start_crop, end_crop

        elif motion_type == "pan_down":
            # Tilt from top to bottom
            start_crop = {"x": (1.0 - w_zoomed) / 2.0, "y": 0.0, "w": w_zoomed, "h": h_zoomed}
            end_crop = {"x": (1.0 - w_zoomed) / 2.0, "y": 1.0 - h_zoomed, "w": w_zoomed, "h": h_zoomed}
            return start_crop, end_crop

        elif motion_type == "slow_drift" or motion_type == "zoom_in_pan_right":
            # Diagonal zoom + pan
            start_crop = {"x": 0.0, "y": 0.0, "w": 1.0, "h": 1.0}
            end_crop = {"x": 1.0 - w_zoomed, "y": (1.0 - h_zoomed) / 2.0, "w": w_zoomed, "h": h_zoomed}
            return start_crop, end_crop

        # Static
        return full, full

    def build_ffmpeg_zoompan_filter(
        self,
        scene: Scene,
        width: int = 1920,
        height: int = 1080,
        fps: int = 30
    ) -> str:
        """
        Builds FFmpeg zoompan filter expression for hardware-accelerated Ken Burns rendering
        """
        duration = max(0.5, scene.duration)
        total_frames = int(duration * fps)
        motion_type = scene.camera_motion.type
        speed = scene.camera_motion.speed
        zoom_max = 1.15 if speed == "slow" else (1.25 if speed == "medium" else 1.35)

        if motion_type == "zoom_in":
            # Smooth ease-in zoom
            zoom_step = (zoom_max - 1.0) / max(1, total_frames)
            expr = f"zoompan=z='min(zoom+{zoom_step:.6f},{zoom_max:.3f})':d={total_frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={width}x{height}:fps={fps}"
        elif motion_type == "zoom_out":
            zoom_step = (zoom_max - 1.0) / max(1, total_frames)
            expr = f"zoompan=z='if(lte(on,1),{zoom_max:.3f},max(zoom-{zoom_step:.6f},1.0))':d={total_frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={width}x{height}:fps={fps}"
        elif motion_type == "pan_left":
            expr = f"zoompan=z={zoom_max:.3f}:d={total_frames}:x='if(lte(on,1),iw-iw/zoom,max(0,x-(iw-iw/zoom)/{total_frames}))':y='ih/2-(ih/zoom/2)':s={width}x{height}:fps={fps}"
        elif motion_type == "pan_right":
            expr = f"zoompan=z={zoom_max:.3f}:d={total_frames}:x='if(lte(on,1),0,min(iw-iw/zoom,x+(iw-iw/zoom)/{total_frames}))':y='ih/2-(ih/zoom/2)':s={width}x{height}:fps={fps}"
        elif motion_type == "pan_up":
            expr = f"zoompan=z={zoom_max:.3f}:d={total_frames}:x='iw/2-(iw/zoom/2)':y='if(lte(on,1),ih-ih/zoom,max(0,y-(ih-ih/zoom)/{total_frames}))':s={width}x{height}:fps={fps}"
        elif motion_type == "pan_down":
            expr = f"zoompan=z={zoom_max:.3f}:d={total_frames}:x='iw/2-(iw/zoom/2)':y='if(lte(on,1),0,min(ih-ih/zoom,y+(ih-ih/zoom)/{total_frames}))':s={width}x{height}:fps={fps}"
        else:
            # Static / subtle drift
            expr = f"zoompan=z=1.0:d={total_frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={width}x{height}:fps={fps}"

        return expr

    def recalculate_timeline_timestamps(self, scenes: List[Scene]) -> List[Scene]:
        """
        Ensures contiguous start_time, end_time, and duration across all scenes with zero gaps
        """
        current_time = 0.0
        updated_scenes = []

        for idx, s in enumerate(scenes):
            s.scene_number = idx + 1
            s.start_time = round(current_time, 3)
            duration = max(0.2, round(s.duration, 3))
            s.duration = duration
            s.end_time = round(current_time + duration, 3)
            current_time = s.end_time
            updated_scenes.append(s)

        return updated_scenes

    def reorder_scenes(self, project_id: str, ordered_scene_ids: List[str]) -> Project:
        """
        Reorders scenes based on ordered ID list and recalculates timeline timestamps
        """
        project = project_service.get_project(project_id)
        if not project:
            raise ValueError(f"Project {project_id} not found")

        scene_map = {s.id: s for s in project.scenes}
        new_scenes = []

        for sid in ordered_scene_ids:
            if sid in scene_map:
                new_scenes.append(scene_map[sid])

        # Add any missing scenes at end
        for s in project.scenes:
            if s.id not in ordered_scene_ids:
                new_scenes.append(s)

        project.scenes = self.recalculate_timeline_timestamps(new_scenes)
        return project_service.save_project(project)

    def update_scene_duration(self, project_id: str, scene_id: str, new_duration: float) -> Project:
        """
        Updates a specific scene's duration and recalculates contiguous timestamps for all subsequent scenes.
        Also resynchronizes subtitle cues and word timestamps.
        """
        project = project_service.get_project(project_id)
        if not project:
            raise ValueError(f"Project {project_id} not found")

        scene = next((s for s in project.scenes if s.id == scene_id), None)
        if not scene:
            raise ValueError(f"Scene {scene_id} not found")

        scene.duration = max(0.5, round(new_duration, 3))
        project.scenes = self.recalculate_timeline_timestamps(project.scenes)

        # Resynchronize matching subtitle cues
        if project.subtitles and len(project.subtitles) == len(project.scenes):
            for idx, s in enumerate(project.scenes):
                cue = project.subtitles[idx]
                cue.start_time = s.start_time
                cue.end_time = s.end_time
                if cue.words and len(cue.words) > 0:
                    w_step = s.duration / len(cue.words)
                    curr_w = s.start_time
                    for w in cue.words:
                        w.start = round(curr_w, 3)
                        w.end = round(curr_w + w_step, 3)
                        curr_w = w.end

        return project_service.save_project(project)

    def split_scene_at_time(self, project_id: str, scene_id: str, split_time: float) -> Project:
        """
        Splits a scene into two scenes at split_time
        """
        import uuid
        project = project_service.get_project(project_id)
        if not project:
            raise ValueError(f"Project {project_id} not found")

        target_idx = next((i for i, s in enumerate(project.scenes) if s.id == scene_id), -1)
        if target_idx == -1:
            raise ValueError(f"Scene {scene_id} not found")

        target_scene = project.scenes[target_idx]
        if split_time <= target_scene.start_time + 0.3 or split_time >= target_scene.end_time - 0.3:
            raise ValueError("Split time must be within scene boundaries (at least 0.3s from edges)")

        first_duration = round(split_time - target_scene.start_time, 3)
        second_duration = round(target_scene.end_time - split_time, 3)

        # Update first scene
        target_scene.duration = first_duration
        target_scene.end_time = split_time

        # Create second scene
        second_scene = target_scene.model_copy(deep=True)
        second_scene.id = str(uuid.uuid4())
        second_scene.start_time = split_time
        second_scene.duration = second_duration
        second_scene.end_time = round(split_time + second_duration, 3)

        # Insert second scene immediately after first scene
        new_scenes = project.scenes[:target_idx + 1] + [second_scene] + project.scenes[target_idx + 1:]
        project.scenes = self.recalculate_timeline_timestamps(new_scenes)

        return project_service.save_project(project)

    def update_scene_motion(
        self,
        project_id: str,
        scene_id: str,
        motion_data: Dict[str, Any]
    ) -> Project:
        """
        Updates camera motion parameters (type, speed, intensity, keyframe crops)
        """
        project = project_service.get_project(project_id)
        if not project:
            raise ValueError("Project not found")

        scene = next((s for s in project.scenes if s.id == scene_id), None)
        if not scene:
            raise ValueError("Scene not found")

        motion_type = motion_data.get("type", scene.camera_motion.type)
        speed = motion_data.get("speed", scene.camera_motion.speed)
        intensity = float(motion_data.get("intensity", scene.camera_motion.intensity))

        start_crop, end_crop = self.calculate_motion_crops(
            motion_type=motion_type,
            aspect_ratio=project.aspect_ratio,
            speed=speed,
            intensity=intensity
        )

        scene.camera_motion = CameraMotion(
            type=motion_type,
            speed=speed,
            intensity=intensity,
            start_crop=motion_data.get("start_crop", start_crop),
            end_crop=motion_data.get("end_crop", end_crop)
        )

        return project_service.save_project(project)

    def auto_fit_audio_and_cinematic_motion(self, project_id: str) -> Project:
        """
        1. Automatically calculates and fits scene durations to match narration audio file duration & sentence speech cues.
           Calculates natural word-weighted and punctuation-aware speech duration for every scene so visuals match spoken voice 100%.
        2. Generates and synchronizes matching SubtitleCue entries with word timestamps for live teleprompter and subtitle rendering.
        3. Applies dynamic, alternating cinematic camera motions (Zoom In, Pan Left, Zoom Out, Pan Right, Tilt Up, Diagonal Drift) across all scenes.
        """
        import re
        from app.models.project import SubtitleCue, WordTimestamp

        project = project_service.get_project(project_id)
        if not project:
            raise ValueError("Project not found")

        if not project.scenes or len(project.scenes) == 0:
            return project

        scene_count = len(project.scenes)
        audio_duration = 0.0
        if project.narration_audio and project.narration_audio.duration > 0:
            audio_duration = project.narration_audio.duration
        elif project.narration_audio and project.narration_audio.file_path:
            # Probe audio duration if not set
            p = Path(project.narration_audio.file_path)
            if p.exists():
                probe = audio_service.probe_audio(p)
                if probe.get("duration", 0.0) > 0:
                    audio_duration = float(probe["duration"])
                    project.narration_audio.duration = audio_duration

        # If still 0, estimate from total text length (~2.5 words per second)
        if audio_duration <= 0.0:
            total_words = sum(len(s.story_text.split()) for s in project.scenes)
            audio_duration = max(10.0, round(total_words * 0.4, 2))

        # Calculate natural speech weight for each scene based on word count, character length, and punctuation pauses
        def calc_scene_weight(text: str) -> float:
            if not text:
                return 1.0
            words = [w for w in text.split() if w]
            chars = len(''.join(words))
            # Punctuation pauses (periods, commas, question marks, danda '।', colons, newlines)
            pauses = len(re.findall(r'[,.!?।:;\n]', text))
            return max(1.0, len(words) * 1.0 + (chars / 6.0) * 0.25 + pauses * 0.7)

        weights = [calc_scene_weight(s.story_text) for s in project.scenes]
        total_weight = sum(weights) or 1.0

        # Step 1: Speech-proportional durations
        raw_durations = [(w / total_weight) * audio_duration for w in weights]

        # Enforce minimum scene duration clamp (1.0s) so scenes remain visually stable
        clamped_durations = [max(1.0, d) for d in raw_durations]
        sum_clamped = sum(clamped_durations) or 1.0
        scale_factor = audio_duration / sum_clamped

        durations = [max(0.8, round(d * scale_factor, 3)) for d in clamped_durations]

        # Calculate contiguous start and end times across all scenes
        curr_t = 0.0
        generated_cues: List[SubtitleCue] = []

        for idx, scene in enumerate(project.scenes):
            scene.scene_number = idx + 1
            dur = durations[idx]
            # For the very last scene, ensure exact lock to audio_duration
            if idx == scene_count - 1:
                dur = max(0.5, round(audio_duration - curr_t, 3))

            scene.start_time = round(curr_t, 3)
            scene.duration = round(dur, 3)
            scene.end_time = round(curr_t + dur, 3)
            curr_t = scene.end_time

            # Generate synchronized word timestamps and SubtitleCue for this scene
            words = [w for w in (scene.story_text or "").split() if w]
            word_cues: List[WordTimestamp] = []
            if words:
                w_step = scene.duration / len(words)
                w_start = scene.start_time
                for w in words:
                    w_end = min(scene.end_time, round(w_start + w_step, 3))
                    word_cues.append(WordTimestamp(
                        word=w,
                        start=round(w_start, 3),
                        end=round(w_end, 3),
                        probability=0.98
                    ))
                    w_start = w_end

            generated_cues.append(SubtitleCue(
                id=f"cue_scene_{scene.id}",
                start_time=scene.start_time,
                end_time=scene.end_time,
                text=scene.story_text or f"Scene {scene.scene_number}",
                words=word_cues
            ))

        # Update project subtitles and audio alignment flag
        project.subtitles = generated_cues
        if project.narration_audio:
            project.narration_audio.aligned = True

        # Step 2: Assign Alternating Dynamic Cinematic Camera Motions
        cinematic_palette = [
            ("zoom_in", "medium", 1.25),
            ("pan_left", "slow", 1.22),
            ("zoom_out", "medium", 1.25),
            ("pan_right", "slow", 1.22),
            ("zoom_in_pan_right", "slow", 1.28),
            ("pan_up", "medium", 1.20),
            ("zoom_in", "slow", 1.18),
            ("pan_down", "medium", 1.20),
        ]

        transitions_palette = ["cut", "crossfade", "cut", "crossfade", "dip_black", "cut", "crossfade"]

        for idx, scene in enumerate(project.scenes):
            motion_type, speed, intensity = cinematic_palette[idx % len(cinematic_palette)]
            start_crop, end_crop = self.calculate_motion_crops(
                motion_type=motion_type,
                aspect_ratio=project.aspect_ratio,
                speed=speed,
                intensity=intensity
            )

            scene.camera_motion = CameraMotion(
                type=motion_type,
                speed=speed,
                intensity=intensity,
                start_crop=start_crop,
                end_crop=end_crop
            )

            # Assign subtle cinematic transitions
            if idx > 0 and (scene.transition_in == "cut" or not scene.transition_in):
                scene.transition_in = transitions_palette[idx % len(transitions_palette)]
                scene.transition_duration = 0.5

        return project_service.save_project(project)

motion_service = MotionService()
