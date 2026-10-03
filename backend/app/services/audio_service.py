import os
import shutil
import json
import subprocess
import numpy as np
from pathlib import Path
from typing import Dict, Any, List, Optional
from app.models.project import AudioTrack
from app.services.project_service import project_service

class AudioService:
    def probe_audio(self, file_path: Path) -> Dict[str, Any]:
        """
        Probe audio metadata using ffprobe
        """
        ffprobe_bin = shutil.which("ffprobe")
        if not ffprobe_bin:
            # Fallback estimation if ffprobe is missing
            return {
                "duration": 0.0,
                "sample_rate": 44100,
                "channels": 2,
                "codec": "unknown"
            }

        cmd = [
            ffprobe_bin,
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            str(file_path)
        ]

        try:
            res = subprocess.run(cmd, capture_output=True, text=True, check=True)
            data = json.loads(res.stdout)

            duration = 0.0
            if "format" in data and "duration" in data["format"]:
                duration = float(data["format"]["duration"])

            sample_rate = 44100
            channels = 2
            codec = "mp3"

            if "streams" in data:
                for stream in data["streams"]:
                    if stream.get("codec_type") == "audio":
                        sample_rate = int(stream.get("sample_rate", 44100))
                        channels = int(stream.get("channels", 2))
                        codec = stream.get("codec_name", "mp3")
                        if duration == 0.0 and "duration" in stream:
                            duration = float(stream["duration"])
                        break

            return {
                "duration": duration,
                "sample_rate": sample_rate,
                "channels": channels,
                "codec": codec
            }
        except Exception as e:
            print(f"Error probing audio: {e}")
            return {
                "duration": 0.0,
                "sample_rate": 44100,
                "channels": 2,
                "codec": "unknown"
            }

    def extract_waveform_peaks(self, file_path: Path, num_peaks: int = 500) -> List[float]:
        """
        Fast waveform peak extraction using FFmpeg PCM pipe into NumPy
        """
        ffmpeg_bin = shutil.which("ffmpeg")
        if not ffmpeg_bin:
            # Return dummy sine peaks
            return [float(abs(np.sin(i / 10.0))) for i in range(num_peaks)]

        cmd = [
            ffmpeg_bin,
            "-v", "error",
            "-i", str(file_path),
            "-f", "f32le",
            "-ac", "1",
            "-ar", "8000",
            "-"
        ]

        try:
            res = subprocess.run(cmd, capture_output=True, check=True)
            raw_audio = np.frombuffer(res.stdout, dtype=np.float32)
            if len(raw_audio) == 0:
                return [0.1] * num_peaks

            # Calculate chunk size to produce exact num_peaks
            chunk_size = max(1, len(raw_audio) // num_peaks)
            peaks = []
            for i in range(0, len(raw_audio), chunk_size):
                chunk = raw_audio[i : i + chunk_size]
                if len(chunk) > 0:
                    peak = float(np.max(np.abs(chunk)))
                    peaks.append(round(min(1.0, peak), 3))

            # Normalize peaks so max peak is ~0.95
            max_val = max(peaks) if peaks else 1.0
            if max_val > 0.05:
                peaks = [round(p / max_val, 3) for p in peaks]

            # Adjust length to exact num_peaks
            if len(peaks) > num_peaks:
                peaks = peaks[:num_peaks]
            elif len(peaks) < num_peaks:
                peaks.extend([0.0] * (num_peaks - len(peaks)))

            return peaks
        except Exception as e:
            print(f"Failed to extract waveform peaks: {e}")
            return [0.2] * num_peaks

    def attach_audio_to_project(self, project_id: str, source_path: Path, original_filename: str) -> AudioTrack:
        project = project_service.get_project(project_id)
        if not project:
            raise ValueError(f"Project not found: {project_id}")

        pdir = Path(project.project_dir)
        audio_dir = pdir / "audio"
        audio_dir.mkdir(parents=True, exist_ok=True)

        target_ext = source_path.suffix or ".mp3"
        dest_filename = f"narration_audio{target_ext}"
        dest_path = audio_dir / dest_filename

        # Copy file into project folder
        if source_path.resolve() != dest_path.resolve():
            shutil.copy2(source_path, dest_path)

        # Probe metadata & extract peaks
        metadata = self.probe_audio(dest_path)
        peaks = self.extract_waveform_peaks(dest_path)

        audio_track = AudioTrack(
            file_path=str(dest_path),
            original_filename=original_filename,
            duration=metadata.get("duration", 0.0),
            sample_rate=metadata.get("sample_rate", 44100),
            channels=metadata.get("channels", 2),
            volume=1.0,
            aligned=False,
            waveform_data=peaks
        )

        project.narration_audio = audio_track
        project_service.save_project(project)
        return audio_track

audio_service = AudioService()
