from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid

class CharacterProfile(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    aliases: List[str] = []
    age_appearance: str = ""
    physical_description: str = ""
    clothing_style: str = ""
    key_colors: List[str] = []
    personality_vibe: str = ""
    reference_image_path: Optional[str] = None

class StyleBible(BaseModel):
    preset_name: str = "cinematic_realistic" # cinematic_realistic, anime_ghibli, 3d_pixar, dark_horror, watercolor, cyberpunk_retro, custom
    custom_description: str = ""
    lighting: str = "dramatic volumetric cinematic lighting"
    color_palette: str = "rich color grading, natural tones"
    camera_lens: str = "35mm anamorphic lens, shallow depth of field"
    art_medium: str = "photorealistic digital photography, 8k resolution, ultra detailed"
    negative_prompt: str = "blurry, low quality, deformed anatomy, extra limbs, bad hands, watermark, signature, text, out of frame"

class CameraMotion(BaseModel):
    type: str = "zoom_in"  # zoom_in, zoom_out, pan_left, pan_right, pan_up, pan_down, slow_drift, subtle_tilt
    speed: str = "medium"  # slow, medium, fast
    intensity: float = 1.0 # 0.5 to 2.0
    start_crop: Optional[Dict[str, float]] = None # x, y, w, h in 0..1 coordinates
    end_crop: Optional[Dict[str, float]] = None

class Scene(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    scene_number: int
    story_text: str
    start_time: float = 0.0
    end_time: float = 0.0
    duration: float = 0.0
    location: str = ""
    time_of_day: str = "day"
    characters_present: List[str] = []
    mood: str = "neutral"
    camera_shot: str = "medium" # wide, medium, close_up, extreme_close_up, over_shoulder, aerial
    camera_motion: CameraMotion = Field(default_factory=CameraMotion)
    image_prompt: str = ""
    generated_image_path: Optional[str] = None
    image_status: str = "pending" # pending, generating, ready, failed
    transition_in: str = "crossfade" # cut, crossfade, dip_black, wipe_left, wipe_right
    transition_duration: float = 0.5
    visual_effects: List[str] = [] # film_grain, vignette, light_flicker, dust_particles, camera_shake
    notes: Optional[str] = None

class WordTimestamp(BaseModel):
    word: str
    start: float
    end: float
    probability: float = 1.0

class SubtitleCue(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    start_time: float
    end_time: float
    text: str
    words: List[WordTimestamp] = []
    speaker: Optional[str] = None

class SubtitleStyle(BaseModel):
    mode: str = "sentence" # sentence, word_karaoke, phrase
    font_family: str = "Noto Sans Devanagari"
    font_size: int = 42
    primary_color: str = "#FFFFFF"
    secondary_color: str = "#FFD700" # highlight for karaoke
    outline_color: str = "#000000"
    outline_width: int = 3
    shadow_color: str = "rgba(0,0,0,0.8)"
    shadow_offset: int = 2
    background_color: str = "rgba(0,0,0,0.5)"
    background_enabled: bool = False
    position: str = "bottom" # bottom, center, top
    margin_v: int = 60
    margin_h: int = 40
    max_lines: int = 2
    max_chars_per_line: int = 38
    animation: str = "fade" # none, fade, pop, typewriter
    uppercase: bool = False

class AudioTrack(BaseModel):
    file_path: Optional[str] = None
    original_filename: Optional[str] = None
    duration: float = 0.0
    sample_rate: int = 44100
    channels: int = 2
    volume: float = 1.0
    aligned: bool = False
    waveform_data: List[float] = [] # normalized peaks for waveform rendering

class BackgroundMusicTrack(BaseModel):
    file_path: Optional[str] = None
    volume: float = 0.2
    auto_ducking: bool = True
    ducking_amount: float = 0.7 # duck by 70% during narration
    fade_in: float = 1.0
    fade_out: float = 2.0

class ExportSettings(BaseModel):
    preset: str = "youtube_1080p" # youtube_1080p, youtube_4k, shorts_vertical, square_social, custom
    width: int = 1920
    height: int = 1080
    fps: int = 30
    video_bitrate: str = "12M"
    audio_bitrate: str = "320k"
    codec: str = "libx264" # libx264, h264_nvenc, h264_videotoolbox, h264_amf
    burn_subtitles: bool = True
    export_srt_separately: bool = True
    normalize_audio: bool = True
    target_lufs: float = -14.0

class Project(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str = "Untitled Story"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    language: str = "Hindi" # Hindi, English, Hinglish, Spanish, etc.
    aspect_ratio: str = "16:9" # 16:9, 9:16, 1:1, 4:5
    resolution_preset: str = "1080p" # 1080p, 4K, 720p
    fps: int = 30
    story_raw_text: str = ""
    narration_audio: AudioTrack = Field(default_factory=AudioTrack)
    background_music: BackgroundMusicTrack = Field(default_factory=BackgroundMusicTrack)
    style_bible: StyleBible = Field(default_factory=StyleBible)
    characters: List[CharacterProfile] = []
    scenes: List[Scene] = []
    subtitles: List[SubtitleCue] = []
    subtitle_style: SubtitleStyle = Field(default_factory=SubtitleStyle)
    export_settings: ExportSettings = Field(default_factory=ExportSettings)
    project_dir: Optional[str] = None
    version: int = 1
    current_step: int = 1
