from pydantic import BaseModel, Field
from typing import Optional, Dict

class ApiKeys(BaseModel):
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    stability_api_key: Optional[str] = None
    replicate_api_key: Optional[str] = None

class AppSettings(BaseModel):
    default_projects_dir: str = ""
    theme: str = "dark" # dark, light, midnight
    ui_language: str = "en" # en, hi
    llm_provider: str = "gemini" # gemini, openai, anthropic, mock
    llm_model: str = "gemini-1.5-flash"
    image_provider: str = "openai" # openai, replicate_flux, stability, imagen, manual, browser_assist
    image_model: str = "dall-e-3"
    api_keys: ApiKeys = Field(default_factory=ApiKeys)
    whisper_model_size: str = "base" # tiny, base, small, medium, large-v3
    whisper_device: str = "auto" # auto, cpu, cuda, mps
    ffmpeg_path: Optional[str] = None
    auto_save_interval_seconds: int = 10
