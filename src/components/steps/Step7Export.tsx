import React, { useState, useEffect, useRef } from 'react';
import {
  Download,
  ArrowLeft,
  Play,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Cpu,
  Layers,
  Film,
  Clock,
  Volume2,
  Type,
  Settings,
  FileText,
  RefreshCw,
  X,
  Zap,
  Monitor,
  Smartphone,
  Square,
  Sliders,
  HardDrive,
  Eye,
  Check,
  Flame,
  VolumeX,
  Radio,
  FileDown,
  RotateCcw
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { api } from '../../services/api';
import { ExportSettings } from '../../types';

interface HardwareInfo {
  encoder: string;
  name?: string;
  type?: 'hardware' | 'software';
}

interface ExportedVideo {
  filename: string;
  file_size_mb: number;
  created_at: number;
  video_url: string;
}

interface PresetOption {
  id: 'youtube_1080p' | 'youtube_4k' | 'shorts_vertical' | 'square_social' | 'custom';
  title: string;
  subtitle: string;
  aspectRatio: '16:9' | '9:16' | '1:1' | 'custom';
  resolution: string;
  width: number;
  height: number;
  bitrate: string;
  recommendedFor: string;
  icon: React.ReactNode;
  badge?: string;
}

const PRESET_OPTIONS: PresetOption[] = [
  {
    id: 'youtube_1080p',
    title: 'YouTube 1080p Full HD',
    subtitle: '1920 × 1080 • 16:9 Widescreen',
    aspectRatio: '16:9',
    resolution: '1920 × 1080',
    width: 1920,
    height: 1080,
    bitrate: '14M',
    recommendedFor: 'YouTube, Web, TV & Desktop Displays',
    icon: <Monitor className="w-5 h-5 text-indigo-400" />,
    badge: 'RECOMMENDED'
  },
  {
    id: 'youtube_4k',
    title: 'YouTube 4K Ultra HD',
    subtitle: '3840 × 2160 • 16:9 Crisp Master',
    aspectRatio: '16:9',
    resolution: '3840 × 2160',
    width: 3840,
    height: 2160,
    bitrate: '35M',
    recommendedFor: 'Highest visual fidelity & sharp typography',
    icon: <Sparkles className="w-5 h-5 text-amber-400" />,
    badge: 'ULTRA HD'
  },
  {
    id: 'shorts_vertical',
    title: 'Shorts & Reels (9:16)',
    subtitle: '1080 × 1920 • 9:16 Vertical Portrait',
    aspectRatio: '9:16',
    resolution: '1080 × 1920',
    width: 1080,
    height: 1920,
    bitrate: '16M',
    recommendedFor: 'YouTube Shorts, Instagram Reels, TikTok',
    icon: <Smartphone className="w-5 h-5 text-purple-400" />,
    badge: 'VIRAL'
  },
  {
    id: 'square_social',
    title: 'Square Social (1:1)',
    subtitle: '1080 × 1080 • 1:1 Instagram Square',
    aspectRatio: '1:1',
    resolution: '1080 × 1080',
    width: 1080,
    height: 1080,
    bitrate: '12M',
    recommendedFor: 'Instagram Feed, Twitter/X, LinkedIn Posts',
    icon: <Square className="w-5 h-5 text-emerald-400" />,
  },
  {
    id: 'custom',
    title: 'Custom Studio Master',
    subtitle: 'User Configurable Bitrate, FPS & Codec',
    aspectRatio: 'custom',
    resolution: 'Custom Size',
    width: 1920,
    height: 1080,
    bitrate: 'Custom',
    recommendedFor: 'Advanced post-production & custom resolutions',
    icon: <Sliders className="w-5 h-5 text-cyan-400" />,
  }
];

export const Step7Export: React.FC = () => {
  const { currentProject, setStep, updateCurrentProject, saveCurrentProject } = useProject();

  // Hardware acceleration info
  const [hardwareInfo, setHardwareInfo] = useState<HardwareInfo | null>(null);
  const [isLoadingHardware, setIsLoadingHardware] = useState(true);

  // Export settings state
  const [preset, setPreset] = useState<PresetOption['id']>('youtube_1080p');
  const [fps, setFps] = useState<number>(30);
  const [videoBitrate, setVideoBitrate] = useState<string>('14M');
  const [audioBitrate, setAudioBitrate] = useState<string>('320k');
  const [codec, setCodec] = useState<string>('auto');
  const [burnSubtitles, setBurnSubtitles] = useState<boolean>(true);
  const [exportSrtSeparately, setExportSrtSeparately] = useState<boolean>(true);
  const [normalizeAudio, setNormalizeAudio] = useState<boolean>(true);
  const [targetLufs, setTargetLufs] = useState<number>(-14.0);
  const [customWidth, setCustomWidth] = useState<number>(1920);
  const [customHeight, setCustomHeight] = useState<number>(1080);

  // Active render job state
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<'idle' | 'running' | 'completed' | 'failed' | 'cancelled'>('idle');
  const [jobProgress, setJobProgress] = useState<number>(0);
  const [jobMessage, setJobMessage] = useState<string>('');
  const [jobResult, setJobResult] = useState<any>(null);
  const [renderStartTime, setRenderStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Export History state
  const [exportHistory, setExportHistory] = useState<ExportedVideo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<ExportedVideo | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // UI state
  const [activeTab, setActiveTab] = useState<'render' | 'history' | 'settings'>('render');
  const [isSaving, setIsSaving] = useState(false);

  // Video element ref
  const videoPlayerRef = useRef<HTMLVideoElement | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Initial Load: Fetch hardware info, export settings, and export history
  useEffect(() => {
    if (!currentProject) return;

    // Fetch hardware encoder info
    api.getHardwareInfo()
      .then((info) => {
        setHardwareInfo(info);
      })
      .catch((err) => {
        console.warn('Failed to detect hardware encoder:', err);
        setHardwareInfo({ encoder: 'libx264', name: 'CPU Software Encoder (libx264)', type: 'software' });
      })
      .finally(() => setIsLoadingHardware(false));

    // Initialize state from current project export_settings
    if (currentProject.export_settings) {
      const s = currentProject.export_settings;
      if (s.preset) setPreset(s.preset as any);
      if (s.fps) setFps(s.fps);
      if (s.video_bitrate) setVideoBitrate(s.video_bitrate);
      if (s.audio_bitrate) setAudioBitrate(s.audio_bitrate);
      if (s.codec) setCodec(s.codec);
      if (typeof s.burn_subtitles === 'boolean') setBurnSubtitles(s.burn_subtitles);
      if (typeof s.export_srt_separately === 'boolean') setExportSrtSeparately(s.export_srt_separately);
      if (typeof s.normalize_audio === 'boolean') setNormalizeAudio(s.normalize_audio);
      if (s.target_lufs) setTargetLufs(s.target_lufs);
      if (s.width) setCustomWidth(s.width);
      if (s.height) setCustomHeight(s.height);
    }

    // If project is 9:16 aspect ratio, default preset to shorts_vertical
    if (currentProject.aspect_ratio === '9:16') {
      setPreset('shorts_vertical');
    } else if (currentProject.aspect_ratio === '1:1') {
      setPreset('square_social');
    }

    // Load export history
    loadExportHistory();

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentProject?.id]);

  // Timer for active render job
  useEffect(() => {
    if (jobStatus === 'running') {
      setRenderStartTime(Date.now());
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [jobStatus]);

  // Load export history
  const loadExportHistory = async () => {
    if (!currentProject) return;
    setIsLoadingHistory(true);
    try {
      const res = await api.getExportHistory(currentProject.id);
      if (res && res.videos) {
        setExportHistory(res.videos);
        if (res.videos.length > 0 && !selectedVideo) {
          setSelectedVideo(res.videos[0]);
        }
      }
    } catch (e) {
      console.error('Failed to load export history:', e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  if (!currentProject) return null;

  // Preset Selection Handler
  const handleSelectPreset = (p: PresetOption) => {
    setPreset(p.id);
    if (p.id === 'youtube_1080p') {
      setVideoBitrate('14M');
      setCustomWidth(1920);
      setCustomHeight(1080);
    } else if (p.id === 'youtube_4k') {
      setVideoBitrate('35M');
      setCustomWidth(3840);
      setCustomHeight(2160);
    } else if (p.id === 'shorts_vertical') {
      setVideoBitrate('16M');
      setCustomWidth(1080);
      setCustomHeight(1920);
    } else if (p.id === 'square_social') {
      setVideoBitrate('12M');
      setCustomWidth(1080);
      setCustomHeight(1080);
    }
  };

  // Save Settings to Backend
  const handleSaveSettings = async () => {
    if (!currentProject) return;
    setIsSaving(true);
    try {
      const updatedSettings: ExportSettings = {
        preset,
        width: customWidth,
        height: customHeight,
        fps,
        video_bitrate: videoBitrate,
        audio_bitrate: audioBitrate,
        codec,
        burn_subtitles: burnSubtitles,
        export_srt_separately: exportSrtSeparately,
        normalize_audio: normalizeAudio,
        target_lufs: targetLufs
      };

      updateCurrentProject((prev) => ({
        ...prev,
        export_settings: updatedSettings
      }));
      await saveCurrentProject({
        ...currentProject,
        export_settings: updatedSettings
      });
    } catch (err) {
      console.error('Failed to save export settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Start Video Rendering Job
  const handleStartRender = async () => {
    if (!currentProject) return;

    try {
      setJobStatus('running');
      setJobProgress(2);
      setJobMessage('Initializing high-performance FFmpeg rendering engine...');
      setElapsedSeconds(0);
      setJobResult(null);

      const renderSettings = {
        preset,
        width: customWidth,
        height: customHeight,
        fps,
        video_bitrate: videoBitrate,
        audio_bitrate: audioBitrate,
        codec: codec === 'auto' ? (hardwareInfo?.encoder || 'libx264') : codec,
        burn_subtitles: burnSubtitles,
        export_srt_separately: exportSrtSeparately,
        normalize_audio: normalizeAudio,
        target_lufs: targetLufs
      };

      const startRes = await api.startVideoRender(currentProject.id, renderSettings);
      const jobId = startRes.job_id;
      setActiveJobId(jobId);

      // Start Polling
      if (pollingRef.current) clearInterval(pollingRef.current);

      pollingRef.current = setInterval(async () => {
        try {
          const statusRes = await api.getRenderStatus(currentProject.id, jobId);
          setJobProgress(statusRes.progress || 0);
          setJobMessage(statusRes.message || 'Processing...');

          if (statusRes.status === 'completed') {
            if (pollingRef.current) clearInterval(pollingRef.current);
            setJobStatus('completed');
            setJobProgress(100);
            setJobResult(statusRes.result);
            // Refresh history and set current video
            loadExportHistory();
            if (statusRes.result) {
              setSelectedVideo({
                filename: statusRes.result.filename,
                file_size_mb: statusRes.result.file_size_mb,
                created_at: Date.now() / 1000,
                video_url: statusRes.result.video_url
              });
            }
          } else if (statusRes.status === 'failed') {
            if (pollingRef.current) clearInterval(pollingRef.current);
            setJobStatus('failed');
            setJobMessage(statusRes.error || 'Video rendering encountered an error');
          } else if (statusRes.status === 'cancelled') {
            if (pollingRef.current) clearInterval(pollingRef.current);
            setJobStatus('cancelled');
            setJobMessage('Render was cancelled by user');
          }
        } catch (pollErr: any) {
          console.error('Error polling render status:', pollErr);
          // If job was not found or backend was restarted, clear polling and reset to idle
          if (pollErr?.message?.includes('404') || pollErr?.message?.includes('not found') || pollErr?.message?.includes('Failed to get render job')) {
            if (pollingRef.current) clearInterval(pollingRef.current);
            setJobStatus('idle');
            setActiveJobId(null);
            setJobProgress(0);
          }
        }
      }, 1000);

    } catch (err: any) {
      console.error('Failed to start render:', err);
      setJobStatus('failed');
      setJobMessage(err.message || 'Failed to initialize render process');
    }
  };

  // Cancel Active Render Job
  const handleCancelRender = async () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (currentProject && activeJobId) {
      try {
        await api.cancelRenderJob(currentProject.id, activeJobId);
      } catch (err) {
        console.error('Failed to cancel render:', err);
      }
    }
    setActiveJobId(null);
    setJobStatus('idle');
    setJobProgress(0);
    setJobMessage('');
  };

  // Helper: Format seconds to MM:SS
  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Production checklist calculations
  const sceneCount = currentProject.scenes?.length || 0;
  const readyScenesCount = currentProject.scenes?.filter((s) => s.image_status === 'ready' || s.generated_image_path)?.length || 0;
  const audioDuration = currentProject.scenes?.length > 0 
    ? currentProject.scenes[currentProject.scenes.length - 1].end_time 
    : (currentProject.narration_audio?.duration || 0);
  const subtitleCount = currentProject.subtitles?.length || 0;
  const isHardwareAcc = hardwareInfo?.type === 'hardware';

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6 overflow-y-auto h-full pb-24 text-white select-none">
      
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER BAR: Title, Hardware GPU Badge, and Navigation
          ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-studio-900 via-studio-900 to-indigo-950/60 border border-studio-800 p-5 rounded-2xl shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-studio-100 to-indigo-300">
              Step 7: Master Video Render &amp; Export Center
            </h1>
            <Badge variant="brand" size="md">
              STAGE 7 FINAL
            </Badge>
          </div>
          <p className="text-xs text-studio-400">
            FFmpeg 4K/1080p hardware-accelerated video rendering, dual audio mixing &amp; LUFS loudness mastering
          </p>
        </div>

        {/* Hardware Encoder Info Chip */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-studio-950/80 border border-studio-700/80 text-xs shadow-inner">
            <Zap className={`w-4 h-4 ${isHardwareAcc ? 'text-amber-400 fill-amber-400 animate-pulse' : 'text-cyan-400'}`} />
            <div>
              <div className="font-bold text-[11px] text-white flex items-center gap-1.5">
                <span>{hardwareInfo?.name || 'Detecting GPU Encoder...'}</span>
                {isHardwareAcc && (
                  <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-mono font-bold">
                    GPU 5x-15x
                  </span>
                )}
              </div>
              <div className="text-[10px] text-studio-400 font-mono">
                Encoder: {hardwareInfo?.encoder || 'auto'}
              </div>
            </div>
          </div>

          <Button
            variant="secondary"
            size="md"
            leftIcon={<ArrowLeft className="w-4 h-4" />}
            onClick={() => setStep(6)}
          >
            Subtitles
          </Button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. NAVIGATION TABS (Render Studio / Export History / Settings)
          ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-studio-800 pb-3">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('render')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'render'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/25'
                : 'bg-studio-900 border border-studio-800 text-studio-400 hover:text-white'
            }`}
          >
            <Film className="w-4 h-4" />
            <span>Master Video Studio</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 relative ${
              activeTab === 'history'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/25'
                : 'bg-studio-900 border border-studio-800 text-studio-400 hover:text-white'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Export Archive ({exportHistory.length})</span>
            {exportHistory.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping absolute top-1.5 right-1.5" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'settings'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/25'
                : 'bg-studio-900 border border-studio-800 text-studio-400 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Codec &amp; Mastering</span>
          </button>
        </div>

        {/* Quick Subtitle Burn Indicator */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setBurnSubtitles(!burnSubtitles)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
              burnSubtitles
                ? 'bg-emerald-950/60 border-emerald-500/80 text-emerald-300 shadow'
                : 'bg-studio-900/80 border-studio-700/80 text-studio-400'
            }`}
            title="Toggle whether subtitles are burned into the final MP4 video"
          >
            <Type className="w-3.5 h-3.5" />
            <span>Burn Subtitles:</span>
            <span className={burnSubtitles ? 'text-emerald-400 uppercase font-mono' : 'text-rose-400 uppercase font-mono'}>
              {burnSubtitles ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. MAIN TAB CONTENT
          ───────────────────────────────────────────────────────────── */}
      {activeTab === 'render' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* LEFT COLUMN (7 Cols): Resolution Presets & Options */}
          <div className="lg:col-span-7 space-y-6">

            {/* Resolution Preset Cards Grid */}
            <Card variant="glass" className="p-5 space-y-4 border-studio-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Film className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-sm font-bold text-white">Target Video Resolution &amp; Aspect Ratio</h3>
                </div>
                <span className="text-[11px] text-studio-400">Select render profile</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PRESET_OPTIONS.map((p) => {
                  const isSelected = preset === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleSelectPreset(p)}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all relative flex flex-col justify-between gap-3 ${
                        isSelected
                          ? 'bg-gradient-to-br from-indigo-950/90 via-studio-900 to-purple-950/80 border-indigo-500 ring-2 ring-indigo-500/50 shadow-xl'
                          : 'bg-studio-900/60 border-studio-800 hover:border-studio-700 hover:bg-studio-900'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-2 rounded-xl ${isSelected ? 'bg-indigo-600 text-white shadow' : 'bg-studio-800 text-studio-300'}`}>
                            {p.icon}
                          </div>
                          <div>
                            <div className="font-bold text-xs text-white">{p.title}</div>
                            <div className="text-[10px] text-studio-400 font-mono">{p.resolution}</div>
                          </div>
                        </div>

                        {p.badge && (
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            isSelected ? 'bg-indigo-500 text-white' : 'bg-studio-800 text-studio-400'
                          }`}>
                            {p.badge}
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-studio-400 border-t border-studio-800/80 pt-2 flex items-center justify-between">
                        <span>{p.recommendedFor}</span>
                        {isSelected && <Check className="w-4 h-4 text-indigo-400 shrink-0" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Video Quality, Bitrate & Audio Settings */}
            <Card variant="glass" className="p-5 space-y-4 border-studio-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-bold text-white">Encoding Quality &amp; Mastering Controls</h3>
                </div>
                <button
                  onClick={handleSaveSettings}
                  disabled={isSaving}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                >
                  {isSaving ? 'Saving...' : '💾 Save as Default'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                {/* Frame Rate */}
                <div className="space-y-1.5">
                  <label className="font-bold text-studio-300">Frame Rate (FPS):</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { val: 30, label: '30 FPS', desc: 'Standard' },
                      { val: 60, label: '60 FPS', desc: 'Smooth' }
                    ].map((f) => (
                      <button
                        key={f.val}
                        onClick={() => setFps(f.val)}
                        className={`py-2 px-2 rounded-xl border font-bold text-center transition-all ${
                          fps === f.val
                            ? 'bg-indigo-950 border-indigo-500 text-indigo-200 shadow'
                            : 'bg-studio-900 border-studio-800 text-studio-400'
                        }`}
                      >
                        <div>{f.label}</div>
                        <div className="text-[9px] text-studio-500">{f.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Video Bitrate */}
                <div className="space-y-1.5">
                  <label className="font-bold text-studio-300">Video Bitrate:</label>
                  <select
                    value={videoBitrate}
                    onChange={(e) => setVideoBitrate(e.target.value)}
                    className="w-full bg-studio-900 border border-studio-800 rounded-xl px-3 py-2 text-white font-medium focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="10M">10 Mbps (Good / Smaller file)</option>
                    <option value="14M">14 Mbps (Studio Standard)</option>
                    <option value="20M">20 Mbps (High Bitrate)</option>
                    <option value="35M">35 Mbps (Cinema 4K Ultra)</option>
                    <option value="50M">50 Mbps (Lossless Master)</option>
                  </select>
                </div>

                {/* Audio Bitrate */}
                <div className="space-y-1.5">
                  <label className="font-bold text-studio-300">Audio Quality:</label>
                  <select
                    value={audioBitrate}
                    onChange={(e) => setAudioBitrate(e.target.value)}
                    className="w-full bg-studio-900 border border-studio-800 rounded-xl px-3 py-2 text-white font-medium focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="192k">192 kbps AAC</option>
                    <option value="256k">256 kbps AAC</option>
                    <option value="320k">320 kbps Studio Master</option>
                  </select>
                </div>
              </div>

              {/* Toggles Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-studio-800/80 text-xs">
                {/* Subtitle Burn-In Switch */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-studio-900/70 border border-studio-800">
                  <div>
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-amber-400" />
                      <span>Burn Subtitles in Video</span>
                    </div>
                    <div className="text-[10px] text-studio-400">Hardcode styled typography directly onto frames</div>
                  </div>
                  <button
                    onClick={() => setBurnSubtitles(!burnSubtitles)}
                    className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                      burnSubtitles ? 'bg-emerald-600 text-white shadow' : 'bg-studio-800 text-studio-400'
                    }`}
                  >
                    {burnSubtitles ? 'YES' : 'NO'}
                  </button>
                </div>

                {/* Audio LUFS Normalization */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-studio-900/70 border border-studio-800">
                  <div>
                    <div className="font-bold text-white flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Broadcast Normalization</span>
                    </div>
                    <div className="text-[10px] text-studio-400">-14.0 LUFS YouTube / Spotify standard</div>
                  </div>
                  <button
                    onClick={() => setNormalizeAudio(!normalizeAudio)}
                    className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                      normalizeAudio ? 'bg-indigo-600 text-white shadow' : 'bg-studio-800 text-studio-400'
                    }`}
                  >
                    {normalizeAudio ? 'ACTIVE' : 'OFF'}
                  </button>
                </div>
              </div>
            </Card>

          </div>

          {/* RIGHT COLUMN (5 Cols): Pre-Render Production Checklist & Big Render Action */}
          <div className="lg:col-span-5 space-y-6">

            {/* Production Readiness Card */}
            <Card variant="glass" className="p-5 space-y-4 border-studio-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">Pre-Render Production Checklist</h3>
                </div>
                <Badge variant="success">READY</Badge>
              </div>

              {/* Checklist Items */}
              <div className="space-y-2.5 text-xs">
                {/* 1. Voice Narration */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-studio-900/60 border border-studio-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                      🎙️
                    </div>
                    <div>
                      <div className="font-bold text-white">Narration Audio Track</div>
                      <div className="text-[10px] text-studio-400 font-mono">
                        {formatSeconds(audioDuration)} • Neural Speech Synced
                      </div>
                    </div>
                  </div>
                  <Check className="w-4 h-4 text-emerald-400" />
                </div>

                {/* 2. Visual Scenes */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-studio-900/60 border border-studio-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                      🖼️
                    </div>
                    <div>
                      <div className="font-bold text-white">Visual Scenes &amp; Motion</div>
                      <div className="text-[10px] text-studio-400 font-mono">
                        {sceneCount} Scenes ({readyScenesCount} Images Ready) • Ken Burns Active
                      </div>
                    </div>
                  </div>
                  <Check className="w-4 h-4 text-emerald-400" />
                </div>

                {/* 3. Subtitles */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-studio-900/60 border border-studio-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
                      💬
                    </div>
                    <div>
                      <div className="font-bold text-white">Typography &amp; Subtitles</div>
                      <div className="text-[10px] text-studio-400 font-mono">
                        {subtitleCount} Cues • {burnSubtitles ? 'Burned into video' : 'Clean video (No burn)'}
                      </div>
                    </div>
                  </div>
                  <Check className="w-4 h-4 text-emerald-400" />
                </div>

                {/* 4. Soundtrack & BGM */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-studio-900/60 border border-studio-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                      🎵
                    </div>
                    <div>
                      <div className="font-bold text-white">Background Music &amp; Ducking</div>
                      <div className="text-[10px] text-studio-400 font-mono">
                        Auto-Ducking -70% • -14.0 LUFS Normalized
                      </div>
                    </div>
                  </div>
                  <Check className="w-4 h-4 text-emerald-400" />
                </div>

                {/* 5. Hardware Encoder */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-studio-900/60 border border-studio-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                      ⚡
                    </div>
                    <div>
                      <div className="font-bold text-white">GPU Acceleration</div>
                      <div className="text-[10px] text-studio-400 font-mono">
                        {hardwareInfo?.encoder || 'libx264'} ({isHardwareAcc ? 'Hardware GPU' : 'CPU'})
                      </div>
                    </div>
                  </div>
                  <Check className="w-4 h-4 text-emerald-400" />
                </div>
              </div>

              {/* Big Start Render Action Button */}
              <div className="pt-2">
                {jobStatus === 'running' ? (
                  <div className="space-y-3">
                    <div className="p-4 rounded-2xl bg-indigo-950/80 border border-indigo-500/80 space-y-3 shadow-2xl animate-pulse">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-indigo-200 flex items-center gap-2">
                          <RotateCcw className="w-4 h-4 animate-spin text-amber-400" />
                          Rendering Master Video...
                        </span>
                        <span className="font-mono text-amber-400 font-bold">{Math.round(jobProgress)}%</span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-3 bg-studio-950 rounded-full overflow-hidden border border-studio-800">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-500 transition-all duration-300"
                          style={{ width: `${Math.max(3, jobProgress)}%` }}
                        />
                      </div>

                      <div className="text-[11px] text-studio-300 flex items-center justify-between">
                        <span className="truncate pr-2">{jobMessage}</span>
                        <span className="font-mono text-studio-400 shrink-0">⏱️ {formatSeconds(elapsedSeconds)}</span>
                      </div>
                    </div>

                    <Button
                      variant="danger"
                      size="md"
                      onClick={handleCancelRender}
                      className="w-full"
                      leftIcon={<X className="w-4 h-4" />}
                    >
                      Cancel Render
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="glow"
                    size="lg"
                    onClick={handleStartRender}
                    className="w-full bg-gradient-to-r from-emerald-600 via-indigo-600 to-purple-600 hover:from-emerald-500 hover:to-purple-500 text-white font-black text-sm py-4 shadow-xl shadow-indigo-600/30"
                    leftIcon={<Flame className="w-5 h-5 text-amber-300 animate-bounce" />}
                  >
                    🚀 START MASTER VIDEO RENDERING
                  </Button>
                )}
              </div>
            </Card>

            {/* Quick Companion Subtitles Download Box */}
            <Card variant="glass" className="p-4 space-y-3 border-studio-800">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  Companion Subtitle Files
                </span>
                <span className="text-[10px] text-studio-400">Direct Download</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <a
                  href={api.getSrtExportUrl(currentProject.id)}
                  download
                  className="py-2.5 px-3 rounded-xl bg-studio-900 hover:bg-studio-800 border border-studio-700 text-center text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-colors shadow"
                >
                  <FileDown className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Download .SRT</span>
                </a>

                <a
                  href={api.getAssExportUrl(currentProject.id)}
                  download
                  className="py-2.5 px-3 rounded-xl bg-studio-900 hover:bg-studio-800 border border-studio-700 text-center text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-colors shadow"
                >
                  <FileDown className="w-3.5 h-3.5 text-amber-400" />
                  <span>Download .ASS</span>
                </a>
              </div>
            </Card>

          </div>

        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          4. MASTER VIDEO THEATER (When Render is Completed or Video Selected)
          ───────────────────────────────────────────────────────────── */}
      {selectedVideo && (
        <Card variant="glass" className="p-6 space-y-5 border-studio-700/80 bg-gradient-to-b from-studio-900/90 to-studio-950/90 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-studio-800">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                <Film className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white">🎬 Master Video Theater: {selectedVideo.filename}</h2>
                  <Badge variant="success">RENDER READY</Badge>
                </div>
                <p className="text-xs text-studio-400">
                  High-definition preview stream from local storage ({selectedVideo.file_size_mb} MB)
                </p>
              </div>
            </div>

            {/* Direct Download Master MP4 Button */}
            <div className="flex gap-2">
              <a
                href={selectedVideo.video_url}
                download={selectedVideo.filename}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Download Master MP4</span>
              </a>
            </div>
          </div>

          {/* HTML5 Video Player */}
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-video max-h-[500px] border border-studio-800 shadow-2xl flex items-center justify-center mx-auto">
            <video
              ref={videoPlayerRef}
              src={selectedVideo.video_url}
              controls
              autoPlay
              className="w-full h-full object-contain"
            />
          </div>

          {/* Video Metadata Chip Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-studio-950/80 p-3 rounded-xl border border-studio-800">
            <div className="flex flex-wrap items-center gap-3 font-mono">
              <span className="text-studio-400">File: <strong className="text-white">{selectedVideo.filename}</strong></span>
              <span className="text-studio-600">•</span>
              <span className="text-studio-400">Size: <strong className="text-emerald-400">{selectedVideo.file_size_mb} MB</strong></span>
              <span className="text-studio-600">•</span>
              <span className="text-studio-400">Duration: <strong className="text-amber-400">{formatSeconds(audioDuration)}</strong></span>
              <span className="text-studio-600">•</span>
              <span className="text-studio-400">Created: <strong className="text-indigo-300">{new Date(selectedVideo.created_at * 1000).toLocaleTimeString()}</strong></span>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={api.getSrtExportUrl(currentProject.id)}
                download
                className="px-2.5 py-1 rounded-lg bg-studio-800 hover:bg-studio-700 text-cyan-300 text-[11px] font-bold flex items-center gap-1"
              >
                <FileDown className="w-3 h-3" />
                <span>.SRT</span>
              </a>
              <a
                href={api.getAssExportUrl(currentProject.id)}
                download
                className="px-2.5 py-1 rounded-lg bg-studio-800 hover:bg-studio-700 text-amber-300 text-[11px] font-bold flex items-center gap-1"
              >
                <FileDown className="w-3 h-3" />
                <span>.ASS</span>
              </a>
            </div>
          </div>
        </Card>
      )}

      {/* ─────────────────────────────────────────────────────────────
          5. EXPORT ARCHIVE TAB (Previous Renders Table)
          ───────────────────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <Card variant="glass" className="p-6 space-y-4 border-studio-800">
          <div className="flex items-center justify-between pb-2 border-b border-studio-800">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">Exported Video Versions Archive</h3>
              <Badge variant="brand">{exportHistory.length} Renders</Badge>
            </div>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={loadExportHistory}
              isLoading={isLoadingHistory}
            >
              Refresh
            </Button>
          </div>

          {exportHistory.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Film className="w-12 h-12 text-studio-600 mx-auto" />
              <h4 className="text-sm font-bold text-studio-300">No Rendered Videos Yet</h4>
              <p className="text-xs text-studio-500">
                Click "Start Master Video Rendering" in the Master Video Studio tab to produce your first MP4.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {exportHistory.map((vid, idx) => (
                <div
                  key={vid.filename || idx}
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                    selectedVideo?.filename === vid.filename
                      ? 'bg-indigo-950/70 border-indigo-500 ring-1 ring-indigo-500/50'
                      : 'bg-studio-900/60 border-studio-800 hover:border-studio-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-studio-800 flex items-center justify-center text-indigo-400 font-bold">
                      🎬
                    </div>
                    <div>
                      <div className="font-bold text-xs text-white">{vid.filename}</div>
                      <div className="text-[11px] text-studio-400 font-mono flex items-center gap-2">
                        <span className="text-emerald-400">{vid.file_size_mb} MB</span>
                        <span>•</span>
                        <span>{new Date(vid.created_at * 1000).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedVideo(vid);
                        setActiveTab('render');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-studio-800 hover:bg-studio-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Play in Theater</span>
                    </button>

                    <a
                      href={vid.video_url}
                      download={vid.filename}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ─────────────────────────────────────────────────────────────
          6. ADVANCED CODEC & MASTERING TAB
          ───────────────────────────────────────────────────────────── */}
      {activeTab === 'settings' && (
        <Card variant="glass" className="p-6 space-y-5 border-studio-800">
          <div className="flex items-center justify-between pb-2 border-b border-studio-800">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">Advanced FFmpeg Codec &amp; Mastering Pipeline</h3>
            </div>
            <Button
              variant="glow"
              size="sm"
              onClick={handleSaveSettings}
              isLoading={isSaving}
            >
              💾 Save Settings
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* Encoder Selection */}
            <div className="space-y-2">
              <label className="font-bold text-studio-200">Hardware / Software Video Encoder:</label>
              <select
                value={codec}
                onChange={(e) => setCodec(e.target.value)}
                className="w-full bg-studio-900 border border-studio-800 rounded-xl px-3 py-2.5 text-white font-medium focus:border-indigo-500 focus:outline-none"
              >
                <option value="auto">⚡ Auto (Best Hardware GPU Encoder)</option>
                <option value="h264_videotoolbox">Apple VideoToolbox (Apple Silicon / Mac GPU)</option>
                <option value="h264_nvenc">NVIDIA NVENC (GeForce RTX/GTX GPU)</option>
                <option value="h264_amf">AMD AMF (Radeon GPU)</option>
                <option value="libx264">libx264 (CPU Multi-threaded Software)</option>
              </select>
              <p className="text-[10.5px] text-studio-400">
                Hardware encoders process 4K and 1080p clips at up to 15x real-time speed.
              </p>
            </div>

            {/* Audio LUFS Target */}
            <div className="space-y-2">
              <label className="font-bold text-studio-200">Target Audio Loudness (LUFS):</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="-24"
                  max="-8"
                  step="0.5"
                  value={targetLufs}
                  onChange={(e) => setTargetLufs(parseFloat(e.target.value))}
                  className="flex-1 accent-indigo-500"
                />
                <span className="font-mono font-bold text-amber-400 bg-studio-900 px-3 py-1.5 rounded-xl border border-studio-800">
                  {targetLufs} LUFS
                </span>
              </div>
              <p className="text-[10.5px] text-studio-400">
                Standard: -14.0 LUFS for YouTube, -16.0 LUFS for Apple Podcasts, -23.0 LUFS for Broadcast TV.
              </p>
            </div>
          </div>
        </Card>
      )}

    </div>
  );
};
