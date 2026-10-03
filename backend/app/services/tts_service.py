import os
import asyncio
from pathlib import Path
from typing import List, Dict, Any, Optional
from app.models.project import AudioTrack
from app.services.project_service import project_service
from app.services.audio_service import audio_service

# 100% Free Natural Voices Catalog (Edge Neural TTS & Google TTS - No API Key Needed)
VOICE_CATALOG = [
    # Hindi Free Neural Voices
    {
        "id": "hi-IN-MadhurNeural",
        "name": "Madhur (Hindi Male - Deep & Cinematic)",
        "language": "Hindi (हिन्दी)",
        "gender": "Male",
        "provider": "edge",
        "is_free": True,
        "recommended": True
    },
    {
        "id": "hi-IN-SwaraNeural",
        "name": "Swara (Hindi Female - Expressive Storyteller)",
        "language": "Hindi (हिन्दी)",
        "gender": "Female",
        "provider": "edge",
        "is_free": True,
        "recommended": True
    },
    # Indian English Free Voices
    {
        "id": "en-IN-PrabhatNeural",
        "name": "Prabhat (Indian English Male)",
        "language": "English (India)",
        "gender": "Male",
        "provider": "edge",
        "is_free": True,
        "recommended": False
    },
    {
        "id": "en-IN-NeerjaNeural",
        "name": "Neerja (Indian English Female)",
        "language": "English (India)",
        "gender": "Female",
        "provider": "edge",
        "is_free": True,
        "recommended": False
    },
    # International English Free Voices
    {
        "id": "en-US-ChristopherNeural",
        "name": "Christopher (US Male - Cinematic Narrative)",
        "language": "English (US)",
        "gender": "Male",
        "provider": "edge",
        "is_free": True,
        "recommended": True
    },
    {
        "id": "en-US-JennyNeural",
        "name": "Jenny (US Female - Warm & Clear)",
        "language": "English (US)",
        "gender": "Female",
        "provider": "edge",
        "is_free": True,
        "recommended": True
    },
    {
        "id": "en-US-GuyNeural",
        "name": "Guy (US Male - Documentary Narration)",
        "language": "English (US)",
        "gender": "Male",
        "provider": "edge",
        "is_free": True,
        "recommended": False
    },
    {
        "id": "en-US-AriaNeural",
        "name": "Aria (US Female - Expressive)",
        "language": "English (US)",
        "gender": "Female",
        "provider": "edge",
        "is_free": True,
        "recommended": False
    },
    # Google Free TTS Fallbacks
    {
        "id": "gtts-hindi",
        "name": "Google Hindi Voice (100% Free)",
        "language": "Hindi (हिन्दी)",
        "gender": "Standard",
        "provider": "gtts",
        "is_free": True,
        "recommended": False
    },
    {
        "id": "gtts-english",
        "name": "Google English Voice (100% Free)",
        "language": "English",
        "gender": "Standard",
        "provider": "gtts",
        "is_free": True,
        "recommended": False
    }
]

class TTSService:
    def get_voices(self) -> List[Dict[str, Any]]:
        return VOICE_CATALOG

    async def generate_edge_tts(self, text: str, voice: str, output_path: Path, rate_offset: int = 0) -> Path:
        """
        Generate natural speech using edge-tts (100% Free, no API key)
        """
        import edge_tts

        rate_str = f"+{rate_offset}%" if rate_offset >= 0 else f"{rate_offset}%"
        communicate = edge_tts.Communicate(text, voice=voice, rate=rate_str)
        await communicate.save(str(output_path))
        return output_path

    def generate_gtts_fallback(self, text: str, language: str, output_path: Path) -> Path:
        """
        Generate speech using gTTS fallback (100% Free)
        """
        from gtts import gTTS
        lang_code = "hi" if "hindi" in language.lower() else "en"
        tts = gTTS(text=text, lang=lang_code, slow=False)
        tts.save(str(output_path))
        return output_path

    async def generate_project_narration(
        self,
        project_id: str,
        text: str,
        voice: str = "hi-IN-MadhurNeural",
        provider: str = "edge",
        speed_rate: int = 0
    ) -> AudioTrack:
        project = project_service.get_project(project_id)
        if not project:
            raise ValueError(f"Project not found: {project_id}")

        if not text.strip():
            raise ValueError("Story text is empty")

        pdir = Path(project.project_dir)
        audio_dir = pdir / "audio"
        audio_dir.mkdir(parents=True, exist_ok=True)

        output_path = audio_dir / "narration_audio.mp3"

        # Match voice provider
        matched_voice = next((v for v in VOICE_CATALOG if v["id"] == voice), None)
        voice_provider = matched_voice["provider"] if matched_voice else provider

        success = False
        last_err = None

        # 1. Try Edge TTS (Natural Free Neural Voice)
        if voice_provider != "gtts":
            try:
                edge_voice = voice if voice.startswith("hi-") or voice.startswith("en-") else ("hi-IN-MadhurNeural" if "hindi" in project.language.lower() else "en-US-ChristopherNeural")
                await self.generate_edge_tts(text, edge_voice, output_path, rate_offset=speed_rate)
                if output_path.exists() and output_path.stat().st_size > 100:
                    success = True
            except Exception as e:
                print(f"Edge TTS error ({e}), falling back to Google TTS...")
                last_err = e

        # 2. Fallback to Google TTS (100% Free)
        if not success:
            try:
                self.generate_gtts_fallback(text, project.language, output_path)
                if output_path.exists() and output_path.stat().st_size > 100:
                    success = True
            except Exception as e:
                print(f"gTTS error ({e})")
                last_err = e

        if not success:
            raise RuntimeError(f"Could not generate TTS audio: {last_err}")

        # Probe metadata & peaks
        metadata = audio_service.probe_audio(output_path)
        peaks = audio_service.extract_waveform_peaks(output_path)

        audio_track = AudioTrack(
            file_path=str(output_path),
            original_filename=f"AI_Narration_{voice}.mp3",
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

tts_service = TTSService()
