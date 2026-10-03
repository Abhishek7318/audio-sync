import { Project, ProjectSummary, AppSettings, Job } from '../types';

const API_BASE = 'http://127.0.0.1:8765/api';

export const api = {
  // Health
  checkHealth: async (): Promise<{ status: string; service: string; version: string }> => {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error('Backend offline');
    return res.json();
  },

  // Projects
  listProjects: async (): Promise<ProjectSummary[]> => {
    const res = await fetch(`${API_BASE}/projects`);
    if (!res.ok) throw new Error('Failed to load projects');
    return res.json();
  },

  getProject: async (projectId: string): Promise<Project> => {
    const res = await fetch(`${API_BASE}/projects/${projectId}`);
    if (!res.ok) throw new Error(`Failed to load project: ${projectId}`);
    return res.json();
  },

  createProject: async (project: Partial<Project>): Promise<Project> => {
    const res = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project),
    });
    if (!res.ok) throw new Error('Failed to create project');
    return res.json();
  },

  updateProject: async (projectId: string, project: Project): Promise<Project> => {
    const res = await fetch(`${API_BASE}/projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project),
    });
    if (!res.ok) throw new Error('Failed to save project');
    return res.json();
  },

  deleteProject: async (projectId: string): Promise<{ status: string }> => {
    const res = await fetch(`${API_BASE}/projects/${projectId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete project');
    return res.json();
  },

  duplicateProject: async (projectId: string): Promise<Project> => {
    const res = await fetch(`${API_BASE}/projects/${projectId}/duplicate`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to duplicate project');
    return res.json();
  },

  // Settings
  getSettings: async (): Promise<AppSettings> => {
    const res = await fetch(`${API_BASE}/settings`);
    if (!res.ok) throw new Error('Failed to load settings');
    return res.json();
  },

  saveSettings: async (settings: AppSettings): Promise<AppSettings> => {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error('Failed to save settings');
    return res.json();
  },

  getSystemCheck: async (): Promise<any> => {
    const res = await fetch(`${API_BASE}/settings/system-check`);
    if (!res.ok) throw new Error('Failed to get system check');
    return res.json();
  },

  // Jobs
  getJob: async (jobId: string): Promise<Job> => {
    const res = await fetch(`${API_BASE}/jobs/${jobId}`);
    if (!res.ok) throw new Error('Failed to fetch job status');
    return res.json();
  },

  cancelJob: async (jobId: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/jobs/${jobId}/cancel`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to cancel job');
    return res.json();
  },

  // Audio & Alignment
  getTTSVoices: async () => {
    const res = await fetch(`${API_BASE}/audio/voices`);
    if (!res.ok) throw new Error('Failed to fetch TTS voice catalog');
    return res.json();
  },

  generateTTS: async (projectId: string, payload: { text?: string; voice?: string; provider?: string; speed_rate?: number }) => {
    const res = await fetch(`${API_BASE}/audio/${projectId}/generate-tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to generate TTS narration audio');
    }
    return res.json();
  },

  uploadAudio: async (projectId: string, file?: File, sourcePath?: string) => {
    const formData = new FormData();
    if (file) formData.append('file', file);
    if (sourcePath) formData.append('source_path', sourcePath);

    const res = await fetch(`${API_BASE}/audio/${projectId}/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to upload/attach audio file');
    return res.json();
  },

  alignAudio: async (projectId: string, payload: { story_text?: string; mode?: string; use_whisper_api?: boolean }) => {
    const res = await fetch(`${API_BASE}/audio/${projectId}/align`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to start audio alignment');
    return res.json();
  },

  updateCues: async (projectId: string, cues: any[]) => {
    const res = await fetch(`${API_BASE}/audio/${projectId}/update-cues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cues),
    });
    if (!res.ok) throw new Error('Failed to update subtitle/alignment cues');
    return res.json();
  },

  // Scenes & Prompts
  breakdownScenes: async (projectId: string, payload: { provider?: string } = {}) => {
    const res = await fetch(`${API_BASE}/scenes/${projectId}/breakdown`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to start LLM scene breakdown');
    return res.json();
  },

  updateScenes: async (projectId: string, scenes: any[]) => {
    const res = await fetch(`${API_BASE}/scenes/${projectId}/scenes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scenes),
    });
    if (!res.ok) throw new Error('Failed to save scenes');
    return res.json();
  },

  regeneratePrompt: async (projectId: string, sceneId: string, instruction: string = '') => {
    const res = await fetch(`${API_BASE}/scenes/${projectId}/regenerate-prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scene_id: sceneId, instruction }),
    });
    if (!res.ok) throw new Error('Failed to regenerate prompt');
    return res.json();
  },

  getYoutubeSEO: async (projectId: string) => {
    const res = await fetch(`${API_BASE}/scenes/${projectId}/youtube-seo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Failed to generate YouTube SEO metadata');
    return res.json();
  },

  // Images Studio
  generateSingleImage: async (projectId: string, sceneId: string, provider?: string) => {
    const res = await fetch(`${API_BASE}/images/${projectId}/generate-single`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scene_id: sceneId, provider }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to generate image');
    }
    return res.json();
  },

  generateBatchImages: async (projectId: string, payload: { provider?: string; force_all?: boolean } = {}) => {
    const res = await fetch(`${API_BASE}/images/${projectId}/generate-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to start batch image generation');
    return res.json();
  },

  uploadSingleSceneImage: async (projectId: string, sceneId: string, file: File) => {
    const formData = new FormData();
    formData.append('scene_id', sceneId);
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/images/${projectId}/upload-single`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to upload scene image');
    return res.json();
  },

  uploadBulkSceneImages: async (projectId: string, files: FileList | File[]) => {
    const formData = new FormData();
    Array.from(files).forEach((f) => formData.append('files', f));

    const res = await fetch(`${API_BASE}/images/${projectId}/upload-bulk`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to bulk upload scene images');
    return res.json();
  },

  detectBrowserDownload: async (projectId: string, sceneId: string) => {
    const res = await fetch(`${API_BASE}/images/${projectId}/browser-assist/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scene_id: sceneId }),
    });
    if (!res.ok) throw new Error('Failed to detect browser download');
    return res.json();
  },

  pasteToChrome: async (projectId: string, payload: { scene_id: string; prompt?: string; browser_name?: string; press_enter?: boolean }) => {
    const res = await fetch(`${API_BASE}/images/${projectId}/browser-assist/paste-to-chrome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to send prompt to Chrome');
    return res.json();
  },

  openPlaywrightBrowser: async () => {
    const res = await fetch(`${API_BASE}/images/playwright/open-browser`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to launch Playwright browser');
    return res.json();
  },

  generatePlaywrightScene: async (projectId: string, payload: { scene_id: string; prompt?: string }) => {
    const res = await fetch(`${API_BASE}/images/${projectId}/playwright/generate-scene`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Playwright scene generation failed');
    }
    return res.json();
  },

  pollBrowserDownload: async (projectId: string, sceneId: string, startTime: number) => {
    const res = await fetch(`${API_BASE}/images/${projectId}/browser-assist/poll-download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scene_id: sceneId, start_time: startTime }),
    });
    if (!res.ok) throw new Error('Failed to poll downloads');
    return res.json();
  },

  // Timeline & Motion
  reorderScenes: async (projectId: string, sceneIds: string[]) => {
    const res = await fetch(`${API_BASE}/timeline/${projectId}/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scene_ids: sceneIds }),
    });
    if (!res.ok) throw new Error('Failed to reorder scenes');
    return res.json();
  },

  splitScene: async (projectId: string, sceneId: string, splitTime: number) => {
    const res = await fetch(`${API_BASE}/timeline/${projectId}/split`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scene_id: sceneId, split_time: splitTime }),
    });
    if (!res.ok) throw new Error('Failed to split scene');
    return res.json();
  },

  updateSceneDuration: async (projectId: string, sceneId: string, duration: number) => {
    const res = await fetch(`${API_BASE}/timeline/${projectId}/update-duration`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scene_id: sceneId, duration }),
    });
    if (!res.ok) throw new Error('Failed to update scene duration');
    return res.json();
  },

  updateSceneMotion: async (projectId: string, sceneId: string, motion: any) => {
    const res = await fetch(`${API_BASE}/timeline/${projectId}/update-motion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scene_id: sceneId, motion }),
    });
    if (!res.ok) throw new Error('Failed to update camera motion');
    return res.json();
  },

  updateSceneTransition: async (projectId: string, sceneId: string, transitionIn: string, duration: number = 0.5) => {
    const res = await fetch(`${API_BASE}/timeline/${projectId}/update-transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scene_id: sceneId, transition_in: transitionIn, transition_duration: duration }),
    });
    if (!res.ok) throw new Error('Failed to update transition');
    return res.json();
  },

  snapToSpeech: async (projectId: string) => {
    const res = await fetch(`${API_BASE}/timeline/${projectId}/snap-to-speech`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to snap timeline to speech');
    return res.json();
  },

  autoFitAudioAndMotion: async (projectId: string) => {
    const res = await fetch(`${API_BASE}/timeline/${projectId}/auto-fit-audio-and-motion`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to auto-fit audio and cinematic motion');
    return res.json();
  },

  animateSingleScene: async (
    projectId: string,
    sceneId: string,
    motionMode: string = 'cinematic_vfx',
    particleEffect?: string
  ) => {
    const res = await fetch(`${API_BASE}/timeline/${projectId}/animate-single`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scene_id: sceneId,
        motion_mode: motionMode,
        particle_effect: particleEffect,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to animate scene');
    }
    return res.json();
  },

  animateBatchScenes: async (
    projectId: string,
    payload: { motion_mode?: string; particle_effect?: string } = {}
  ) => {
    const res = await fetch(`${API_BASE}/timeline/${projectId}/animate-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to start batch scene animation');
    return res.json();
  },

  updateParticleEffect: async (projectId: string, sceneId: string, particleEffect: string) => {
    const res = await fetch(`${API_BASE}/timeline/${projectId}/update-particle-effect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scene_id: sceneId, particle_effect: particleEffect }),
    });
    if (!res.ok) throw new Error('Failed to update particle effect');
    return res.json();
  },

  uploadBGM: async (projectId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/timeline/${projectId}/bgm-upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to upload background music');
    return res.json();
  },

  // Subtitles Studio
  getSubtitles: async (projectId: string) => {
    const res = await fetch(`${API_BASE}/subtitles/${projectId}`);
    if (!res.ok) throw new Error('Failed to fetch project subtitles');
    return res.json();
  },

  updateSubtitleStyle: async (projectId: string, payload: { style?: any; burn_subtitles?: boolean; export_srt_separately?: boolean }) => {
    const res = await fetch(`${API_BASE}/subtitles/${projectId}/style`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to update subtitle style');
    return res.json();
  },

  updateSubtitleCues: async (projectId: string, cues: any[]) => {
    const res = await fetch(`${API_BASE}/subtitles/${projectId}/cues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cues),
    });
    if (!res.ok) throw new Error('Failed to update subtitle cues');
    return res.json();
  },

  updateSubtitleCue: async (projectId: string, cueId: string, cueData: { text?: string; start_time?: number; end_time?: number }) => {
    const res = await fetch(`${API_BASE}/subtitles/${projectId}/cue/${cueId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cueData),
    });
    if (!res.ok) throw new Error('Failed to update subtitle cue');
    return res.json();
  },

  splitSubtitleCue: async (projectId: string, cueId: string, splitTime: number, textPart1: string, textPart2: string) => {
    const res = await fetch(`${API_BASE}/subtitles/${projectId}/split`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cue_id: cueId, split_time: splitTime, text_part1: textPart1, text_part2: textPart2 }),
    });
    if (!res.ok) throw new Error('Failed to split subtitle cue');
    return res.json();
  },

  mergeSubtitleCues: async (projectId: string, cueId1: string, cueId2: string) => {
    const res = await fetch(`${API_BASE}/subtitles/${projectId}/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cue_id1: cueId1, cue_id2: cueId2 }),
    });
    if (!res.ok) throw new Error('Failed to merge subtitle cues');
    return res.json();
  },

  getSrtExportUrl: (projectId: string) => `${API_BASE}/subtitles/${projectId}/export/srt`,
  getAssExportUrl: (projectId: string) => `${API_BASE}/subtitles/${projectId}/export/ass`,

  // Export Studio
  getHardwareInfo: async () => {
    const res = await fetch(`${API_BASE}/export/hardware-info`);
    if (!res.ok) throw new Error('Failed to get hardware encoder info');
    return res.json();
  },

  getExportSettings: async (projectId: string) => {
    const res = await fetch(`${API_BASE}/export/${projectId}/settings`);
    if (!res.ok) throw new Error('Failed to get export settings');
    return res.json();
  },

  startVideoRender: async (projectId: string, settings?: any) => {
    const res = await fetch(`${API_BASE}/export/${projectId}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings }),
    });
    if (!res.ok) throw new Error('Failed to start video rendering');
    return res.json();
  },

  getRenderStatus: async (projectId: string, jobId: string) => {
    const res = await fetch(`${API_BASE}/export/${projectId}/status/${jobId}`);
    if (!res.ok) throw new Error('Failed to get render job status');
    return res.json();
  },

  cancelRenderJob: async (projectId: string, jobId: string) => {
    const res = await fetch(`${API_BASE}/export/${projectId}/cancel/${jobId}`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to cancel render job');
    return res.json();
  },

  getExportHistory: async (projectId: string) => {
    const res = await fetch(`${API_BASE}/export/${projectId}/history`);
    if (!res.ok) throw new Error('Failed to fetch export history');
    return res.json();
  },

  // Assets
  getAssetUrl: (projectId: string, assetType: 'images' | 'audio' | 'subtitles' | 'exports', filename: string): string => {
    return `${API_BASE}/projects/${projectId}/assets/${assetType}/${encodeURIComponent(filename)}`;
  }
};
