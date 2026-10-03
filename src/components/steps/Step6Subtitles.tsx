import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Type,
  ArrowRight,
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Download,
  Palette,
  Sliders,
  Layers,
  Scissors,
  Combine,
  Check,
  Search,
  RefreshCw,
  Flame,
  Film,
  Eye,
  EyeOff,
  Volume2,
  FileText,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Maximize2
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { SubtitleCue, SubtitleStyle, Scene, WordTimestamp } from '../../types';
import { api } from '../../services/api';

// Typography Presets
const STYLE_PRESETS: { id: string; name: string; icon: string; style: Partial<SubtitleStyle> }[] = [
  {
    id: 'hormozi_viral',
    name: '🔥 Hormozi Viral Reels',
    icon: '🔥',
    style: {
      mode: 'word_karaoke',
      font_family: 'Montserrat',
      font_size: 46,
      primary_color: '#FFFFFF',
      secondary_color: '#22c55e', // Vibrant Green
      outline_color: '#000000',
      outline_width: 5,
      shadow_color: 'rgba(0,0,0,0.9)',
      shadow_offset: 3,
      background_color: 'rgba(0,0,0,0.7)',
      background_enabled: true,
      position: 'center',
      margin_v: 80,
      animation: 'pop',
      uppercase: true
    }
  },
  {
    id: 'devanagari_gold',
    name: '🇮🇳 Devanagari Gold',
    icon: '🇮🇳',
    style: {
      mode: 'word_karaoke',
      font_family: 'Noto Sans Devanagari',
      font_size: 42,
      primary_color: '#FFFFFF',
      secondary_color: '#FACC15', // Gold / Yellow
      outline_color: '#000000',
      outline_width: 4,
      shadow_color: 'rgba(0,0,0,0.8)',
      shadow_offset: 2,
      background_color: 'rgba(0,0,0,0.6)',
      background_enabled: true,
      position: 'bottom',
      margin_v: 50,
      animation: 'pop',
      uppercase: false
    }
  },
  {
    id: 'cinematic_movie',
    name: '🎬 Cinematic Movie',
    icon: '🎬',
    style: {
      mode: 'sentence',
      font_family: 'Inter',
      font_size: 38,
      primary_color: '#F8FAFC',
      secondary_color: '#38BDF8', // Cyan
      outline_color: '#090A0F',
      outline_width: 3,
      shadow_color: 'rgba(0,0,0,0.9)',
      shadow_offset: 2,
      background_color: 'rgba(0,0,0,0.4)',
      background_enabled: false,
      position: 'bottom',
      margin_v: 60,
      animation: 'fade',
      uppercase: false
    }
  },
  {
    id: 'anime_neon',
    name: '⚡ Anime Neon Pop',
    icon: '⚡',
    style: {
      mode: 'word_karaoke',
      font_family: 'Poppins',
      font_size: 44,
      primary_color: '#F472B6', // Pink
      secondary_color: '#38BDF8', // Neon Cyan
      outline_color: '#1E1B4B',
      outline_width: 4,
      shadow_color: 'rgba(236,72,153,0.5)',
      shadow_offset: 3,
      background_color: 'rgba(15,23,42,0.8)',
      background_enabled: true,
      position: 'center',
      margin_v: 70,
      animation: 'pop',
      uppercase: true
    }
  },
  {
    id: 'youtube_classic',
    name: '📺 YouTube Classic',
    icon: '📺',
    style: {
      mode: 'word_karaoke',
      font_family: 'Noto Sans Devanagari',
      font_size: 40,
      primary_color: '#FFFFFF',
      secondary_color: '#EAB308',
      outline_color: '#000000',
      outline_width: 4,
      shadow_color: 'rgba(0,0,0,0.7)',
      shadow_offset: 2,
      background_color: 'rgba(0,0,0,0.5)',
      background_enabled: true,
      position: 'bottom',
      margin_v: 50,
      animation: 'fade',
      uppercase: false
    }
  },
  {
    id: 'minimal_clean',
    name: '✨ Minimalist Clean',
    icon: '✨',
    style: {
      mode: 'sentence',
      font_family: 'Inter',
      font_size: 34,
      primary_color: '#FFFFFF',
      secondary_color: '#94A3B8',
      outline_color: '#0F172A',
      outline_width: 2,
      shadow_color: 'rgba(0,0,0,0.5)',
      shadow_offset: 1,
      background_color: 'rgba(0,0,0,0.0)',
      background_enabled: false,
      position: 'bottom',
      margin_v: 40,
      animation: 'none',
      uppercase: false
    }
  }
];

const FONT_OPTIONS = [
  'Noto Sans Devanagari',
  'Poppins',
  'Montserrat',
  'Inter',
  'Roboto',
  'Cinzel',
  'Bangers',
  'Tiro Devanagari Hindi'
];

export const Step6Subtitles: React.FC = () => {
  const { currentProject, updateCurrentProject, setStep, saveCurrentProject } = useProject();
  const { showToast } = useToast();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'presets' | 'typography' | 'position' | 'animation' | 'export'>('presets');

  // Subtitle Style State
  const [subStyle, setSubStyle] = useState<SubtitleStyle>(() => {
    return currentProject?.subtitle_style || {
      mode: 'word_karaoke',
      font_family: 'Noto Sans Devanagari',
      font_size: 42,
      primary_color: '#FFFFFF',
      secondary_color: '#FACC15',
      outline_color: '#000000',
      outline_width: 4,
      shadow_color: 'rgba(0,0,0,0.8)',
      shadow_offset: 2,
      background_color: 'rgba(0,0,0,0.6)',
      background_enabled: true,
      position: 'bottom',
      margin_v: 60,
      margin_h: 40,
      max_lines: 2,
      max_chars_per_line: 38,
      animation: 'pop',
      uppercase: false
    };
  });

  // Export / Burn settings
  const [burnSubtitles, setBurnSubtitles] = useState<boolean>(
    currentProject?.export_settings?.burn_subtitles ?? true
  );
  const [exportSrtSeparately, setExportSrtSeparately] = useState<boolean>(
    currentProject?.export_settings?.export_srt_separately ?? true
  );

  // Playback & Timing State for Live Preview
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0.0);
  const [isSaving, setIsSaving] = useState(false);

  // Search & Filter Cues
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCueId, setEditingCueId] = useState<string | null>(null);

  // Media Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const loadedImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());

  if (!currentProject) return null;

  const scenes: Scene[] = currentProject.scenes || [];
  const subtitles: SubtitleCue[] = currentProject.subtitles || [];
  const totalDuration = scenes.length > 0
    ? scenes[scenes.length - 1].end_time
    : (currentProject.narration_audio?.duration || 10.0);

  // Helper: Image URL
  const getSceneImageUrl = (scene: Scene) => {
    if (!scene.generated_image_path) return null;
    const filename = scene.generated_image_path.split(/[\\/]/).pop();
    if (!filename) return null;
    return api.getAssetUrl(currentProject.id, 'images', filename);
  };

  // Preload Scene Images
  useEffect(() => {
    scenes.forEach((scene) => {
      const url = getSceneImageUrl(scene);
      if (url && !loadedImagesRef.current.has(url)) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = url;
        img.onload = () => {
          loadedImagesRef.current.set(url, img);
        };
      }
    });
  }, [scenes, currentProject.id]);

  // Current Scene and Active Subtitle
  const currentScene = scenes.find((s) => currentTime >= s.start_time && currentTime < s.end_time) || scenes[0];
  const activeCue = subtitles.find((c) => currentTime >= c.start_time && currentTime <= c.end_time);

  // Easing function for smooth Ken Burns motion (ease-in-out cosine)
  const easeInOut = (t: number) => 0.5 * (1 - Math.cos(Math.PI * t));

  // Canvas Render Loop (Real-time Live Subtitle Typography on 60 FPS Video Canvas)
  const renderCanvasFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Background
    ctx.fillStyle = '#07080d';
    ctx.fillRect(0, 0, width, height);

    // ─────────────────────────────────────────────────────────────
    // 1. DRAW BACKGROUND SCENE IMAGE WITH 60 FPS KEN BURNS MOTION
    // ─────────────────────────────────────────────────────────────
    if (currentScene) {
      const imgUrl = getSceneImageUrl(currentScene);
      const img = imgUrl ? loadedImagesRef.current.get(imgUrl) : null;
      if (img && img.complete && img.naturalWidth > 0) {
        // Calculate normalized progress within active scene [0.0 -> 1.0]
        const sceneDuration = Math.max(0.2, currentScene.duration);
        const rawProgress = Math.max(0.0, Math.min(1.0, (currentTime - currentScene.start_time) / sceneDuration));
        const progress = easeInOut(rawProgress);

        const motion = currentScene.camera_motion || { type: 'zoom_in', speed: 'medium', intensity: 1.25 };
        const maxZoom = motion.intensity || (motion.speed === 'slow' ? 1.15 : motion.speed === 'fast' ? 1.40 : 1.25);

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, width, height);
        ctx.clip();

        let currentScale = 1.0;
        let offsetX = 0.0;
        let offsetY = 0.0;

        // Calculate Ken Burns transform parameters
        if (motion.type === 'zoom_in') {
          currentScale = 1.0 + (maxZoom - 1.0) * progress;
        } else if (motion.type === 'zoom_out') {
          currentScale = maxZoom - (maxZoom - 1.0) * progress;
        } else if (motion.type === 'pan_left') {
          currentScale = maxZoom;
          const maxOffset = width * (maxZoom - 1.0);
          offsetX = (maxOffset / 2.0) - maxOffset * progress;
        } else if (motion.type === 'pan_right') {
          currentScale = maxZoom;
          const maxOffset = width * (maxZoom - 1.0);
          offsetX = -(maxOffset / 2.0) + maxOffset * progress;
        } else if (motion.type === 'pan_up') {
          currentScale = maxZoom;
          const maxOffset = height * (maxZoom - 1.0);
          offsetY = (maxOffset / 2.0) - maxOffset * progress;
        } else if (motion.type === 'pan_down') {
          currentScale = maxZoom;
          const maxOffset = height * (maxZoom - 1.0);
          offsetY = -(maxOffset / 2.0) + maxOffset * progress;
        } else if (motion.type === 'slow_drift' || motion.type === 'zoom_in_pan_right') {
          currentScale = 1.0 + (maxZoom - 1.0) * progress;
          const maxOffset = width * (maxZoom - 1.0);
          offsetX = -(maxOffset / 4.0) + (maxOffset / 2.0) * progress;
        } else {
          currentScale = 1.0;
        }

        // Apply transform centered
        ctx.translate(width / 2 + offsetX, height / 2 + offsetY);
        ctx.scale(currentScale, currentScale);

        const imgAspect = img.naturalWidth / img.naturalHeight;
        const canvasAspect = width / height;
        let drawW = width;
        let drawH = height;

        if (imgAspect > canvasAspect) {
          drawH = height;
          drawW = height * imgAspect;
        } else {
          drawW = width;
          drawH = width / imgAspect;
        }
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();

        // Handle Transitions (e.g. Dip to black / Crossfade at scene start)
        if (currentScene.transition_in && currentScene.transition_in !== 'cut') {
          const transDur = currentScene.transition_duration || 0.5;
          const transProgress = (currentTime - currentScene.start_time) / transDur;

          if (transProgress < 1.0) {
            if (currentScene.transition_in === 'dip_black') {
              const alpha = 1.0 - transProgress;
              ctx.fillStyle = `rgba(0, 0, 0, ${alpha.toFixed(2)})`;
              ctx.fillRect(0, 0, width, height);
            } else if (currentScene.transition_in === 'crossfade') {
              const alpha = 1.0 - transProgress;
              ctx.fillStyle = `rgba(15, 15, 25, ${alpha.toFixed(2)})`;
              ctx.fillRect(0, 0, width, height);
            }
          }
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 2. LIVE SUBTITLE TYPOGRAPHY RENDERING (WITH MULTI-LINE AUTO-WRAP)
    // ─────────────────────────────────────────────────────────────
    if (burnSubtitles && activeCue && activeCue.text) {
      ctx.save();
      // Maximum allowed text width per line to prevent overflowing screen
      const maxLineWidth = width - (subStyle.margin_h || 40) * 2 - 80;
      const lineHeight = subStyle.font_size * 1.38;

      ctx.font = `bold ${subStyle.font_size}px "${subStyle.font_family}", "Noto Sans Devanagari", "Inter", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // ── A. Word-by-Word Karaoke Mode with Intelligent Multi-Line Wrapping ──
      if (subStyle.mode === 'word_karaoke' && activeCue.words && activeCue.words.length > 0) {
        const words = activeCue.words;
        const wordMetrics = words.map((w) => {
          const wText = subStyle.uppercase ? w.word.toUpperCase() : w.word;
          const m = ctx.measureText(wText + ' ');
          return { ...w, wText, width: m.width };
        });

        // Group words into lines that stay strictly within maxLineWidth
        const lines: { words: typeof wordMetrics; totalWidth: number }[] = [];
        let curLineWords: typeof wordMetrics = [];
        let curLineWidth = 0;

        wordMetrics.forEach((w) => {
          if (curLineWords.length > 0 && curLineWidth + w.width > maxLineWidth) {
            lines.push({ words: curLineWords, totalWidth: curLineWidth });
            curLineWords = [w];
            curLineWidth = w.width;
          } else {
            curLineWords.push(w);
            curLineWidth += w.width;
          }
        });
        if (curLineWords.length > 0) {
          lines.push({ words: curLineWords, totalWidth: curLineWidth });
        }

        // Calculate vertical start position for all lines
        const totalBlockHeight = lines.length * lineHeight;
        let startY = height - subStyle.margin_v - totalBlockHeight + lineHeight / 2;
        if (subStyle.position === 'top') {
          startY = subStyle.margin_v + lineHeight / 2;
        } else if (subStyle.position === 'center') {
          startY = (height - totalBlockHeight) / 2 + lineHeight / 2;
        }

        // Render each line
        lines.forEach((line, lineIdx) => {
          const lineY = startY + lineIdx * lineHeight;
          let currentX = (width - line.totalWidth) / 2;

          // Draw Background Box per line
          if (subStyle.background_enabled) {
            const boxPadding = 16;
            const boxH = subStyle.font_size * 1.35;
            ctx.fillStyle = subStyle.background_color || 'rgba(0,0,0,0.65)';
            ctx.beginPath();
            ctx.roundRect(currentX - boxPadding, lineY - boxH / 2, line.totalWidth + boxPadding * 2, boxH, 10);
            ctx.fill();
          }

          // Draw each word in the line
          line.words.forEach((w) => {
            const isSpoken = currentTime >= w.start && currentTime < w.end;
            const isPast = currentTime >= w.end;

            ctx.save();
            // Active word glow animation
            if (isSpoken && subStyle.animation === 'pop') {
              ctx.shadowColor = subStyle.secondary_color;
              ctx.shadowBlur = 12;
            }

            // Outline / Stroke
            if (subStyle.outline_width > 0) {
              ctx.strokeStyle = subStyle.outline_color || '#000000';
              ctx.lineWidth = subStyle.outline_width;
              ctx.strokeText(w.wText, currentX + w.width / 2, lineY);
            }

            // Fill Color (Active karaoke color vs Past vs Upcoming)
            ctx.fillStyle = isSpoken
              ? subStyle.secondary_color
              : isPast
              ? subStyle.primary_color
              : 'rgba(255,255,255,0.75)';

            ctx.fillText(w.wText, currentX + w.width / 2, lineY);
            ctx.restore();

            currentX += w.width;
          });
        });
      } else {
        // ── B. Sentence Mode with Intelligent Multi-Line Wrapping ──
        const rawWords = (subStyle.uppercase ? activeCue.text.toUpperCase() : activeCue.text).split(' ');
        const sentenceLines: string[] = [];
        let curSentence = '';

        rawWords.forEach((word) => {
          const testSentence = curSentence ? `${curSentence} ${word}` : word;
          if (ctx.measureText(testSentence).width > maxLineWidth && curSentence) {
            sentenceLines.push(curSentence);
            curSentence = word;
          } else {
            curSentence = testSentence;
          }
        });
        if (curSentence) sentenceLines.push(curSentence);

        const totalBlockHeight = sentenceLines.length * lineHeight;
        let startY = height - subStyle.margin_v - totalBlockHeight + lineHeight / 2;
        if (subStyle.position === 'top') {
          startY = subStyle.margin_v + lineHeight / 2;
        } else if (subStyle.position === 'center') {
          startY = (height - totalBlockHeight) / 2 + lineHeight / 2;
        }

        sentenceLines.forEach((sLine, lineIdx) => {
          const lineY = startY + lineIdx * lineHeight;
          const metrics = ctx.measureText(sLine);
          const boxPadding = 18;
          const boxW = metrics.width + boxPadding * 2;
          const boxH = subStyle.font_size * 1.35;

          // Background Box
          if (subStyle.background_enabled) {
            ctx.fillStyle = subStyle.background_color || 'rgba(0,0,0,0.65)';
            ctx.beginPath();
            ctx.roundRect((width - boxW) / 2, lineY - boxH / 2, boxW, boxH, 10);
            ctx.fill();
          }

          // Outline / Stroke
          if (subStyle.outline_width > 0) {
            ctx.strokeStyle = subStyle.outline_color || '#000000';
            ctx.lineWidth = subStyle.outline_width;
            ctx.strokeText(sLine, width / 2, lineY);
          }

          // Text Fill
          ctx.fillStyle = subStyle.primary_color || '#FFFFFF';
          ctx.fillText(sLine, width / 2, lineY);
        });
      }
      ctx.restore();
    }
  }, [currentTime, currentScene, activeCue, subStyle]);

  // Main Time Tick Loop
  useEffect(() => {
    const loop = () => {
      if (isPlaying) {
        if (audioRef.current && !audioRef.current.paused) {
          setCurrentTime(audioRef.current.currentTime);
        } else {
          setCurrentTime((prev) => {
            const next = prev + 0.033;
            if (next >= totalDuration) {
              setIsPlaying(false);
              return totalDuration;
            }
            return next;
          });
        }
      }
      renderCanvasFrame();
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, totalDuration, renderCanvasFrame]);

  // Play / Pause Sync
  const togglePlayPause = () => {
    if (isPlaying) {
      setIsPlaying(false);
      audioRef.current?.pause();
    } else {
      if (currentTime >= totalDuration) {
        setCurrentTime(0);
        if (audioRef.current) audioRef.current.currentTime = 0;
      }
      setIsPlaying(true);
      audioRef.current?.play().catch(() => {});
    }
  };

  const seekTo = (time: number) => {
    const clamped = Math.max(0, Math.min(totalDuration, time));
    setCurrentTime(clamped);
    if (audioRef.current) audioRef.current.currentTime = clamped;
    renderCanvasFrame();
  };

  // Apply Preset
  const handleApplyPreset = async (presetId: string) => {
    const preset = STYLE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    const newStyle = { ...subStyle, ...preset.style };
    setSubStyle(newStyle);

    try {
      await api.updateSubtitleStyle(currentProject.id, {
        style: newStyle,
        burn_subtitles: burnSubtitles,
        export_srt_separately: exportSrtSeparately
      });
      updateCurrentProject((prev) => ({
        ...prev,
        subtitle_style: newStyle
      }));
      showToast(`Applied preset: ${preset.name}!`, 'success');
    } catch (err: any) {
      showToast(`Failed to save preset: ${err.message}`, 'error');
    }
  };

  // Save Style Changes
  const handleSaveStyle = async () => {
    try {
      setIsSaving(true);
      const res = await api.updateSubtitleStyle(currentProject.id, {
        style: subStyle,
        burn_subtitles: burnSubtitles,
        export_srt_separately: exportSrtSeparately
      });
      updateCurrentProject((prev) => ({
        ...prev,
        subtitle_style: res.subtitle_style,
        export_settings: {
          ...prev.export_settings,
          burn_subtitles: res.burn_subtitles,
          export_srt_separately: res.export_srt_separately
        }
      }));
      showToast('Subtitle typography & export settings saved!', 'success');
    } catch (err: any) {
      showToast(`Error saving style: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Update Single Cue Text
  const handleUpdateCueText = async (cueId: string, newText: string) => {
    try {
      const res = await api.updateSubtitleCue(currentProject.id, cueId, { text: newText });
      if (res.subtitles) {
        updateCurrentProject((prev) => ({
          ...prev,
          subtitles: res.subtitles
        }));
        showToast('Subtitle cue updated!', 'success');
      }
    } catch (err: any) {
      showToast(`Failed to update cue: ${err.message}`, 'error');
    }
  };

  // Split Cue
  const handleSplitCue = async (cue: SubtitleCue) => {
    const words = cue.text.split(' ');
    if (words.length < 2) {
      showToast('Cannot split single word cue', 'info');
      return;
    }
    const midWord = Math.floor(words.length / 2);
    const textPart1 = words.slice(0, midWord).join(' ');
    const textPart2 = words.slice(midWord).join(' ');
    const splitTime = cue.start_time + (cue.end_time - cue.start_time) / 2;

    try {
      const res = await api.splitSubtitleCue(currentProject.id, cue.id, splitTime, textPart1, textPart2);
      if (res.subtitles) {
        updateCurrentProject((prev) => ({ ...prev, subtitles: res.subtitles }));
        showToast('Cue split into two balanced segments!', 'success');
      }
    } catch (err: any) {
      showToast(`Split failed: ${err.message}`, 'error');
    }
  };

  // Merge Cue with Next
  const handleMergeWithNext = async (currentIndex: number) => {
    if (currentIndex >= subtitles.length - 1) return;
    const cue1 = subtitles[currentIndex];
    const cue2 = subtitles[currentIndex + 1];

    try {
      const res = await api.mergeSubtitleCues(currentProject.id, cue1.id, cue2.id);
      if (res.subtitles) {
        updateCurrentProject((prev) => ({ ...prev, subtitles: res.subtitles }));
        showToast('Merged cues together!', 'success');
      }
    } catch (err: any) {
      showToast(`Merge failed: ${err.message}`, 'error');
    }
  };

  // Master Toggle: Turn Subtitles in Video ON or OFF
  const handleToggleBurnSubtitles = async () => {
    const nextVal = !burnSubtitles;
    setBurnSubtitles(nextVal);
    try {
      await api.updateSubtitleStyle(currentProject.id, {
        style: subStyle,
        burn_subtitles: nextVal,
        export_srt_separately: exportSrtSeparately
      });
      updateCurrentProject((prev) => ({
        ...prev,
        export_settings: {
          ...prev.export_settings,
          burn_subtitles: nextVal
        }
      }));
      showToast(
        nextVal
          ? '✅ Subtitles ENABLED! Subtitles will be displayed and burned into the video.'
          : '🚫 Subtitles DISABLED! Video will be exported clean without any subtitles.',
        nextVal ? 'success' : 'info'
      );
    } catch (err: any) {
      showToast(`Error updating setting: ${err.message}`, 'error');
    }
  };

  // Audio URL
  const narrationUrl = currentProject.narration_audio?.file_path
    ? api.getAssetUrl(currentProject.id, 'audio', currentProject.narration_audio.file_path.split(/[\\/]/).pop() || '')
    : null;

  // Filtered Cues for Search
  const filteredCues = subtitles.filter((c) =>
    c.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Format Timecode mm:ss.ms
  const formatTimecode = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${ms}`;
  };

  return (
    <div className="max-w-7xl mx-auto p-5 space-y-5 overflow-y-auto h-full pb-28">
      {/* Hidden Narration Audio Player */}
      {narrationUrl && (
        <audio
          ref={audioRef}
          src={narrationUrl}
          preload="auto"
          onEnded={() => setIsPlaying(false)}
        />
      )}

      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-amber-950/60 via-purple-950/40 to-studio-900 border border-amber-500/20 p-5 rounded-2xl shadow-lg">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Type className="w-5 h-5 text-amber-400" />
              Step 6: Subtitle Studio &amp; Typography Engine
            </h1>
            <Badge variant="brand">{subtitles.length} Cues</Badge>
          </div>
          <p className="text-xs text-studio-400 max-w-2xl">
            Devanagari/Hindi and English fonts, Hormozi viral word-by-word karaoke bounce, custom colors, positioning, and ASS/SRT formatting.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Master Toggle: Subtitles in Video ON/OFF */}
          <button
            onClick={handleToggleBurnSubtitles}
            className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 shadow-lg ${
              burnSubtitles
                ? 'bg-gradient-to-r from-emerald-950 to-emerald-900 border-emerald-500 text-emerald-300 shadow-emerald-500/20 hover:border-emerald-400'
                : 'bg-gradient-to-r from-red-950 to-red-900 border-red-500/80 text-red-300 shadow-red-500/20 hover:border-red-400'
            }`}
            title="Click to turn subtitles in video ON or OFF"
          >
            {burnSubtitles ? <Eye className="w-4 h-4 text-emerald-400" /> : <EyeOff className="w-4 h-4 text-red-400" />}
            <span>{burnSubtitles ? '🔥 Subtitles: ENABLED (ON)' : '🚫 Subtitles: DISABLED (OFF)'}</span>
          </button>

          <Button
            variant="secondary"
            size="md"
            leftIcon={<ArrowLeft className="w-4 h-4" />}
            onClick={() => setStep(5)}
          >
            Back to Timeline
          </Button>

          <Button
            variant="glow"
            size="md"
            rightIcon={<ArrowRight className="w-4 h-4" />}
            onClick={() => {
              handleSaveStyle();
              saveCurrentProject();
              setStep(7);
            }}
            className="bg-gradient-to-r from-amber-500 via-orange-500 to-indigo-600 font-bold"
          >
            Proceed to Export (Step 7)
          </Button>
        </div>
      </div>

      {/* Subtitles Disabled Alert Banner when turned OFF */}
      {!burnSubtitles && (
        <div className="bg-red-950/40 border border-red-500/40 px-4 py-2.5 rounded-xl text-xs text-red-300 flex items-center justify-between shadow">
          <div className="flex items-center gap-2">
            <EyeOff className="w-4 h-4 text-red-400 shrink-0" />
            <span>
              <strong>Subtitles are currently DISABLED:</strong> Final exported video will be 100% clean with images and motion only (no subtitle text on top).
            </span>
          </div>
          <button
            onClick={handleToggleBurnSubtitles}
            className="underline font-bold hover:text-white shrink-0 ml-3"
          >
            Enable Subtitles
          </button>
        </div>
      )}

      {/* Split Section: Live Video Preview (Left 7 cols) + Typography Customizer (Right 5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: 60 FPS Video & Live Typography Canvas (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <Card variant="glass" className="p-4 space-y-3 border-studio-800">
            <div className="flex items-center justify-between text-xs pb-1 border-b border-studio-800">
              <div className="flex items-center gap-1.5 font-bold text-white">
                <Film className="w-4 h-4 text-cyan-400" />
                <span>Live Subtitle Canvas Preview</span>
              </div>
              <div className="font-mono text-xs text-studio-300">
                <span className="text-amber-400 font-bold">{formatTimecode(currentTime)}</span> / {formatTimecode(totalDuration)}
              </div>
            </div>

            {/* Canvas Viewport Frame */}
            <div
              className={`relative mx-auto rounded-2xl overflow-hidden bg-black border border-studio-800 flex items-center justify-center shadow-2xl ${
                currentProject.aspect_ratio === '9:16'
                  ? 'aspect-[9/16] max-h-[420px]'
                  : currentProject.aspect_ratio === '1:1'
                  ? 'aspect-square max-h-[360px]'
                  : 'aspect-video max-h-[340px] w-full'
              }`}
            >
              <canvas
                ref={canvasRef}
                width={currentProject.aspect_ratio === '9:16' ? 1080 : 1920}
                height={currentProject.aspect_ratio === '9:16' ? 1920 : 1080}
                className="w-full h-full object-contain cursor-pointer"
                onClick={togglePlayPause}
              />

              {/* Play Overlay */}
              {!isPlaying && (
                <div
                  onClick={togglePlayPause}
                  className="absolute inset-0 bg-black/30 flex items-center justify-center cursor-pointer hover:bg-black/20 transition-all"
                >
                  <div className="w-14 h-14 rounded-full bg-amber-600/90 hover:bg-amber-500 text-white flex items-center justify-center shadow-2xl pl-1">
                    <Play className="w-7 h-7 fill-current" />
                  </div>
                </div>
              )}
            </div>

            {/* Transport Control Bar */}
            <div className="space-y-2 pt-1">
              {/* Progress Slider */}
              <div
                className="relative w-full h-2 bg-studio-800 rounded-full cursor-pointer group"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pos = (e.clientX - rect.left) / rect.width;
                  seekTo(pos * totalDuration);
                }}
              >
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-indigo-500 rounded-full relative"
                  style={{ width: `${(currentTime / Math.max(0.1, totalDuration)) * 100}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow" />
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between text-xs text-studio-300">
                <div className="flex items-center gap-2">
                  <button
                    onClick={togglePlayPause}
                    className="w-7 h-7 rounded-lg bg-studio-800 hover:bg-amber-600 text-white flex items-center justify-center transition-colors shadow"
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current pl-0.5" />}
                  </button>
                  <button onClick={() => seekTo(0)} className="p-1 hover:text-white" title="Restart">
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] font-mono text-studio-400">
                    Active Cue: <span className="text-amber-300 font-bold">{activeCue ? `"${activeCue.text.slice(0, 30)}..."` : '(None)'}</span>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={burnSubtitles ? 'success' : 'neutral'} className="text-[10px]">
                    {burnSubtitles ? 'Burned in Video' : 'Hidden from Video'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Quick Preset Selector Grid */}
            <div className="pt-2 border-t border-studio-800 space-y-1.5">
              <span className="text-[11px] font-bold text-studio-300 uppercase tracking-wider block">
                ⚡ Quick Style Presets:
              </span>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {STYLE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleApplyPreset(p.id)}
                    className="p-2 rounded-xl bg-studio-900/90 border border-studio-800 hover:border-amber-500/60 text-center transition-all hover:scale-105 shadow group"
                    title={p.name}
                  >
                    <div className="text-base">{p.icon}</div>
                    <div className="text-[9.5px] font-bold text-studio-200 mt-1 truncate">{p.name.replace(/^[^\s]+/, '')}</div>
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Right: Typography & Settings Tabs (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <Card variant="glass" className="p-4 space-y-3 border-studio-800">
            {/* Tab Headers */}
            <div className="flex items-center gap-1 bg-studio-900 p-1 rounded-xl border border-studio-800 text-xs">
              {[
                { id: 'presets', label: '🎨 Style', icon: Palette },
                { id: 'typography', label: '🔤 Font', icon: Type },
                { id: 'position', label: '📐 Box', icon: Layers },
                { id: 'animation', label: '⚡ Motion', icon: Sparkles },
                { id: 'export', label: '📥 Export', icon: Download },
              ].map((t) => {
                const Icon = t.icon;
                const isTab = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id as any)}
                    className={`flex-1 py-1.5 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 transition-all ${
                      isTab
                        ? 'bg-amber-600 text-white shadow'
                        : 'text-studio-400 hover:text-studio-200'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            {/* TAB 1: PRESET STYLES & HIGHLIGHT COLORS */}
            {activeTab === 'presets' && (
              <div className="space-y-3 text-xs">
                {/* Mode Selector */}
                <div className="space-y-1.5">
                  <label className="font-bold text-studio-200">Highlight &amp; Subtitle Mode:</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'word_karaoke', label: '🎤 Word Karaoke Pop', desc: 'Each spoken word glows live' },
                      { id: 'sentence', label: '📝 Sentence Block', desc: 'Full sentence display' }
                    ].map((m) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          const updated = { ...subStyle, mode: m.id as any };
                          setSubStyle(updated);
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          subStyle.mode === m.id
                            ? 'bg-amber-950/70 border-amber-500 text-white shadow'
                            : 'bg-studio-900 border-studio-800 text-studio-400 hover:text-white'
                        }`}
                      >
                        <div className="font-bold text-xs">{m.label}</div>
                        <div className="text-[10px] text-studio-400">{m.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Colors Grid */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-studio-800">
                  <div className="space-y-1">
                    <label className="text-studio-300 font-medium">Primary Text Color:</label>
                    <div className="flex items-center gap-2 bg-studio-900 p-1.5 rounded-xl border border-studio-800">
                      <input
                        type="color"
                        value={subStyle.primary_color}
                        onChange={(e) => setSubStyle({ ...subStyle, primary_color: e.target.value })}
                        className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                      />
                      <input
                        type="text"
                        value={subStyle.primary_color}
                        onChange={(e) => setSubStyle({ ...subStyle, primary_color: e.target.value })}
                        className="w-full bg-transparent font-mono text-[11px] text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-studio-300 font-medium">Active Karaoke Color:</label>
                    <div className="flex items-center gap-2 bg-studio-900 p-1.5 rounded-xl border border-studio-800">
                      <input
                        type="color"
                        value={subStyle.secondary_color}
                        onChange={(e) => setSubStyle({ ...subStyle, secondary_color: e.target.value })}
                        className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                      />
                      <input
                        type="text"
                        value={subStyle.secondary_color}
                        onChange={(e) => setSubStyle({ ...subStyle, secondary_color: e.target.value })}
                        className="w-full bg-transparent font-mono text-[11px] text-white focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Outline & Shadow */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-studio-800">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-studio-300">Outline Width:</span>
                      <span className="text-amber-400 font-mono">{subStyle.outline_width}px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="8"
                      value={subStyle.outline_width}
                      onChange={(e) => setSubStyle({ ...subStyle, outline_width: parseInt(e.target.value) })}
                      className="w-full accent-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-studio-300">Drop Shadow:</span>
                      <span className="text-amber-400 font-mono">{subStyle.shadow_offset}px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="6"
                      value={subStyle.shadow_offset}
                      onChange={(e) => setSubStyle({ ...subStyle, shadow_offset: parseInt(e.target.value) })}
                      className="w-full accent-amber-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: TYPOGRAPHY & FONTS */}
            {activeTab === 'typography' && (
              <div className="space-y-3 text-xs">
                {/* Font Family Selector */}
                <div className="space-y-1">
                  <label className="font-bold text-studio-200">Font Family:</label>
                  <select
                    value={subStyle.font_family}
                    onChange={(e) => setSubStyle({ ...subStyle, font_family: e.target.value })}
                    className="w-full bg-studio-900 border border-studio-800 rounded-xl px-3 py-2 text-white font-medium focus:border-amber-500 focus:outline-none"
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Font Size Slider */}
                <div className="space-y-1 pt-2 border-t border-studio-800">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-studio-200">Font Size:</span>
                    <span className="text-amber-400 font-mono font-bold">{subStyle.font_size}px</span>
                  </div>
                  <input
                    type="range"
                    min="24"
                    max="72"
                    step="2"
                    value={subStyle.font_size}
                    onChange={(e) => setSubStyle({ ...subStyle, font_size: parseInt(e.target.value) })}
                    className="w-full accent-amber-500"
                  />
                </div>

                {/* Uppercase Toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-studio-800">
                  <span className="font-bold text-studio-200">Force UPPERCASE (All-Caps):</span>
                  <button
                    onClick={() => setSubStyle({ ...subStyle, uppercase: !subStyle.uppercase })}
                    className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                      subStyle.uppercase
                        ? 'bg-amber-600 text-white shadow'
                        : 'bg-studio-900 border border-studio-800 text-studio-400'
                    }`}
                  >
                    {subStyle.uppercase ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: POSITION & BACKGROUND BOX */}
            {activeTab === 'position' && (
              <div className="space-y-3 text-xs">
                {/* Position Selector */}
                <div className="space-y-1.5">
                  <label className="font-bold text-studio-200">Screen Placement:</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'bottom', label: '⬇️ Bottom' },
                      { id: 'center', label: '⏺️ Center' },
                      { id: 'top', label: '⬆️ Top' },
                    ].map((pos) => (
                      <button
                        key={pos.id}
                        onClick={() => setSubStyle({ ...subStyle, position: pos.id as any })}
                        className={`py-2 px-2 rounded-xl border font-bold text-center transition-all ${
                          subStyle.position === pos.id
                            ? 'bg-amber-950 border-amber-500 text-amber-200 shadow'
                            : 'bg-studio-900 border-studio-800 text-studio-400'
                        }`}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Vertical Margin */}
                <div className="space-y-1 pt-2 border-t border-studio-800">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-studio-200">Vertical Margin:</span>
                    <span className="text-amber-400 font-mono font-bold">{subStyle.margin_v}px</span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="180"
                    value={subStyle.margin_v}
                    onChange={(e) => setSubStyle({ ...subStyle, margin_v: parseInt(e.target.value) })}
                    className="w-full accent-amber-500"
                  />
                </div>

                {/* Background Box Toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-studio-800">
                  <span className="font-bold text-studio-200">Background Box:</span>
                  <button
                    onClick={() => setSubStyle({ ...subStyle, background_enabled: !subStyle.background_enabled })}
                    className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                      subStyle.background_enabled
                        ? 'bg-emerald-600 text-white shadow'
                        : 'bg-studio-900 border border-studio-800 text-studio-400'
                    }`}
                  >
                    {subStyle.background_enabled ? 'ENABLED' : 'DISABLED'}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 4: ANIMATION MODE */}
            {activeTab === 'animation' && (
              <div className="space-y-2 text-xs">
                <label className="font-bold text-studio-200">Animated Entrance / Transition:</label>
                <div className="space-y-1.5">
                  {[
                    { id: 'pop', label: '💥 Karaoke Pop & Bounce', desc: 'Active word scales up and glows dynamically' },
                    { id: 'fade', label: '🌊 Smooth Alpha Fade', desc: 'Gentle dissolve in and out per subtitle cue' },
                    { id: 'typewriter', label: '⌨️ Typewriter Reveal', desc: 'Characters reveal sequentially with voice' },
                    { id: 'none', label: '⏹️ Static (Instant)', desc: 'Direct cut with no motion or delay' },
                  ].map((anim) => (
                    <button
                      key={anim.id}
                      onClick={() => setSubStyle({ ...subStyle, animation: anim.id as any })}
                      className={`w-full p-2.5 rounded-xl border text-left transition-all ${
                        subStyle.animation === anim.id
                          ? 'bg-gradient-to-r from-amber-950 to-indigo-950 border-amber-500 text-white shadow'
                          : 'bg-studio-900 border-studio-800 text-studio-400 hover:text-white'
                      }`}
                    >
                      <div className="font-bold text-xs">{anim.label}</div>
                      <div className="text-[10px] text-studio-400">{anim.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 5: EXPORT & BURN SETTINGS */}
            {activeTab === 'export' && (
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-studio-900 border border-studio-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white text-xs">🔥 Burn Subtitles into Video</div>
                      <div className="text-[10.5px] text-studio-400">Hardcode styled subtitles into the MP4 render</div>
                    </div>
                    <button
                      onClick={() => setBurnSubtitles(!burnSubtitles)}
                      className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                        burnSubtitles
                          ? 'bg-emerald-600 text-white shadow'
                          : 'bg-studio-800 text-studio-400'
                      }`}
                    >
                      {burnSubtitles ? 'YES' : 'NO'}
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-studio-900 border border-studio-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white text-xs">📄 Export Separate .SRT File</div>
                      <div className="text-[10.5px] text-studio-400">Include .srt file alongside final video</div>
                    </div>
                    <button
                      onClick={() => setExportSrtSeparately(!exportSrtSeparately)}
                      className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                        exportSrtSeparately
                          ? 'bg-indigo-600 text-white shadow'
                          : 'bg-studio-800 text-studio-400'
                      }`}
                    >
                      {exportSrtSeparately ? 'YES' : 'NO'}
                    </button>
                  </div>
                </div>

                {/* Instant Download Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-studio-800">
                  <a
                    href={api.getSrtExportUrl(currentProject.id)}
                    download
                    className="py-2.5 px-3 rounded-xl bg-studio-900 hover:bg-studio-800 border border-studio-700 text-center text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-colors shadow"
                  >
                    <Download className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Download .SRT</span>
                  </a>

                  <a
                    href={api.getAssExportUrl(currentProject.id)}
                    download
                    className="py-2.5 px-3 rounded-xl bg-studio-900 hover:bg-studio-800 border border-studio-700 text-center text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-colors shadow"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    <span>Download .ASS</span>
                  </a>
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="pt-2 border-t border-studio-800">
              <Button
                variant="glow"
                size="md"
                onClick={handleSaveStyle}
                isLoading={isSaving}
                className="w-full bg-gradient-to-r from-amber-600 to-indigo-600 text-xs font-bold"
              >
                💾 Save Subtitle Style &amp; Settings
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Bottom Section: Interactive Subtitle Cue Sheet & Table Editor */}
      <Card variant="glass" className="p-4 space-y-3 border-studio-800">
        {/* Cue Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-studio-800 text-xs">
          <div className="flex items-center gap-2">
            <Type className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-white">Subtitle Cue Sheet</span>
            <Badge variant="brand">{subtitles.length} Cues</Badge>
            <Badge variant="accent">
              {subtitles.reduce((sum, c) => sum + (c.words?.length || c.text.split(' ').length), 0)} Words
            </Badge>
          </div>

          {/* Search Box */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-studio-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search dialogue / words..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-studio-900 border border-studio-800 rounded-xl pl-8 pr-3 py-1 text-xs text-white placeholder:text-studio-500 w-48 sm:w-64 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Cues List Table */}
        <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
          {filteredCues.map((cue, idx) => {
            const isCurrentlyActive = currentTime >= cue.start_time && currentTime <= cue.end_time;
            const cueDuration = cue.end_time - cue.start_time;

            return (
              <div
                key={cue.id || idx}
                className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isCurrentlyActive && isPlaying
                    ? 'bg-amber-950/70 border-amber-500 shadow-md ring-1 ring-amber-500/50'
                    : 'bg-studio-900/70 border-studio-800/80 hover:border-studio-700'
                }`}
              >
                {/* Left: Timing & Play button */}
                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    onClick={() => seekTo(cue.start_time)}
                    className="w-7 h-7 rounded-lg bg-studio-800 hover:bg-amber-600 text-white flex items-center justify-center transition-colors shadow"
                    title="Play from this cue"
                  >
                    <Play className="w-3.5 h-3.5 fill-current pl-0.5" />
                  </button>

                  <div>
                    <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-white">
                      <span>#{idx + 1}</span>
                      <span className="text-amber-400">{formatTimecode(cue.start_time)}</span>
                      <span className="text-studio-500">→</span>
                      <span className="text-studio-300">{formatTimecode(cue.end_time)}</span>
                    </div>
                    <div className="text-[10px] text-studio-400 font-mono">
                      {cueDuration.toFixed(2)}s duration • {cue.words?.length || cue.text.split(' ').length} words
                    </div>
                  </div>
                </div>

                {/* Center: Inline Editable Text Box */}
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    defaultValue={cue.text}
                    onBlur={(e) => {
                      if (e.target.value !== cue.text) {
                        handleUpdateCueText(cue.id, e.target.value);
                      }
                    }}
                    className="w-full bg-studio-950/80 border border-studio-800 rounded-lg px-3 py-1.5 text-xs text-white font-medium focus:border-amber-500 focus:outline-none"
                  />
                </div>

                {/* Right: Split / Merge Action Buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleSplitCue(cue)}
                    className="p-1.5 rounded-lg bg-studio-800 hover:bg-studio-700 text-studio-300 hover:text-white text-[11px] flex items-center gap-1 transition-colors border border-studio-700"
                    title="Split this cue into two segments"
                  >
                    <Scissors className="w-3 h-3 text-pink-400" />
                    <span>Split</span>
                  </button>

                  <button
                    onClick={() => handleMergeWithNext(idx)}
                    disabled={idx >= subtitles.length - 1}
                    className="p-1.5 rounded-lg bg-studio-800 hover:bg-studio-700 disabled:opacity-30 text-studio-300 hover:text-white text-[11px] flex items-center gap-1 transition-colors border border-studio-700"
                    title="Merge with next subtitle cue"
                  >
                    <Combine className="w-3 h-3 text-cyan-400" />
                    <span>Merge</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};
