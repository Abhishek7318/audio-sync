export interface CharacterProfile {
  id: string;
  name: string;
  aliases: string[];
  age_appearance: string;
  physical_description: string;
  clothing_style: string;
  key_colors: string[];
  personality_vibe: string;
  reference_image_path?: string | null;
}

export interface StyleBible {
  preset_name: string;
  custom_description: string;
  lighting: string;
  color_palette: string;
  camera_lens: string;
  art_medium: string;
  negative_prompt: string;
}

export interface CameraMotion {
  type: 'zoom_in' | 'zoom_out' | 'pan_left' | 'pan_right' | 'pan_up' | 'pan_down' | 'slow_drift' | 'subtle_tilt' | 'zoom_in_pan_right' | 'static';
  speed: 'slow' | 'medium' | 'fast';
  intensity: number;
  start_crop?: { x: number; y: number; w: number; h: number } | null;
  end_crop?: { x: number; y: number; w: number; h: number } | null;
}

export interface Scene {
  id: string;
  scene_number: number;
  story_text: string;
  start_time: number;
  end_time: number;
  duration: number;
  location: string;
  time_of_day: string;
  characters_present: string[];
  mood: string;
  camera_shot: 'wide' | 'medium' | 'close_up' | 'extreme_close_up' | 'over_shoulder' | 'aerial';
  camera_motion: CameraMotion;
  image_prompt: string;
  generated_image_path?: string | null;
  image_status: 'pending' | 'generating' | 'ready' | 'failed';
  transition_in: 'cut' | 'crossfade' | 'dip_black' | 'wipe_left' | 'wipe_right';
  transition_duration: number;
  visual_effects: string[];
  notes?: string | null;
}

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
  probability: number;
}

export interface SubtitleCue {
  id: string;
  start_time: number;
  end_time: number;
  text: string;
  words: WordTimestamp[];
  speaker?: string | null;
}

export interface SubtitleStyle {
  mode: 'sentence' | 'word_karaoke' | 'phrase';
  font_family: string;
  font_size: number;
  primary_color: string;
  secondary_color: string;
  outline_color: string;
  outline_width: number;
  shadow_color: string;
  shadow_offset: number;
  background_color: string;
  background_enabled: boolean;
  position: 'bottom' | 'center' | 'top';
  margin_v: number;
  margin_h: number;
  max_lines: number;
  max_chars_per_line: number;
  animation: 'none' | 'fade' | 'pop' | 'typewriter';
  uppercase: boolean;
}

export interface AudioTrack {
  file_path?: string | null;
  original_filename?: string | null;
  duration: number;
  sample_rate: number;
  channels: number;
  volume: number;
  aligned: boolean;
  waveform_data: number[];
}

export interface BackgroundMusicTrack {
  file_path?: string | null;
  volume: number;
  auto_ducking: boolean;
  ducking_amount: number;
  fade_in: number;
  fade_out: number;
}

export interface ExportSettings {
  preset: 'youtube_1080p' | 'youtube_4k' | 'shorts_vertical' | 'square_social' | 'custom';
  width: number;
  height: number;
  fps: number;
  video_bitrate: string;
  audio_bitrate: string;
  codec: string;
  burn_subtitles: boolean;
  export_srt_separately: boolean;
  normalize_audio: boolean;
  target_lufs: number;
}

export interface Project {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  language: string;
  aspect_ratio: '16:9' | '9:16' | '1:1' | '4:5';
  resolution_preset: '1080p' | '4K' | '720p';
  fps: number;
  story_raw_text: string;
  narration_audio: AudioTrack;
  background_music: BackgroundMusicTrack;
  style_bible: StyleBible;
  characters: CharacterProfile[];
  scenes: Scene[];
  subtitles: SubtitleCue[];
  subtitle_style: SubtitleStyle;
  export_settings: ExportSettings;
  project_dir?: string | null;
  version: number;
  current_step: number;
}

export interface ProjectSummary {
  id: string;
  name: string;
  updated_at: string;
  created_at: string;
  language: string;
  aspect_ratio: string;
  resolution_preset: string;
  scene_count: number;
  audio_duration: number;
  project_dir: string;
  current_step: number;
}

export interface ApiKeys {
  openai_api_key?: string | null;
  anthropic_api_key?: string | null;
  gemini_api_key?: string | null;
  stability_api_key?: string | null;
  replicate_api_key?: string | null;
}

export interface AppSettings {
  default_projects_dir: string;
  theme: 'dark' | 'light' | 'midnight';
  ui_language: 'en' | 'hi';
  llm_provider: 'gemini' | 'openai' | 'anthropic' | 'mock';
  llm_model: string;
  image_provider: 'openai' | 'replicate_flux' | 'stability' | 'imagen' | 'manual' | 'browser_assist';
  image_model: string;
  api_keys: ApiKeys;
  whisper_model_size: string;
  whisper_device: string;
  ffmpeg_path?: string | null;
  auto_save_interval_seconds: number;
}

export interface Job {
  id: string;
  project_id: string;
  job_type: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  message: string;
  error?: string | null;
  result?: any;
  created_at: string;
  updated_at: string;
}
