import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Scissors,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Sliders,
  ZoomIn,
  ZoomOut,
  MoveLeft,
  MoveRight,
  Music,
  Mic,
  Type,
  Layers,
  Check,
  Film,
  Eye,
  Trash2,
  Plus,
  RefreshCw,
  Repeat,
  GripVertical,
  GripHorizontal,
  LayoutTemplate,
  Monitor,
  Maximize,
  Minimize,
  SlidersHorizontal,
  Video,
  Wand2,
  ChevronLeft,
  ChevronRight,
  SplitSquareVertical
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Scene, CameraMotion, SubtitleCue } from '../../types';
import { api } from '../../services/api';

export const Step5Timeline: React.FC = () => {
  const { currentProject, updateCurrentProject, setStep, saveCurrentProject } = useProject();
  const { showToast } = useToast();

  // Mode: Pro Studio Fullscreen Workspace vs Standard Page
  const [isProEditingMode, setIsProEditingMode] = useState(true);

  // Resizable Split Panel Percentages
  // Top Height % (Top Panels vs Bottom Timeline)
  const [splitTopHeightPct, setSplitTopHeightPct] = useState(54); // 54% top, 46% bottom
  // Top Left Width % (Video Preview vs Motion Inspector)
  const [splitLeftWidthPct, setSplitLeftWidthPct] = useState(58); // 58% video, 42% inspector

  // Dragging Splitter States
  const [isDraggingVerticalSplitter, setIsDraggingVerticalSplitter] = useState(false);
  const [isDraggingHorizontalSplitter, setIsDraggingHorizontalSplitter] = useState(false);

  // Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0.0);
  const [timelineZoom, setTimelineZoom] = useState(1.0); // 0.5x to 3x
  const [isLooping, setIsLooping] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [masterVolume, setMasterVolume] = useState(1.0);
  const [bgmVolume, setBgmVolume] = useState(0.25);
  const [autoDucking, setAutoDucking] = useState(true);
  const [autoScrollTimeline, setAutoScrollTimeline] = useState(true);

  // Clip Trimming / Duration Dragging State
  const [resizingClip, setResizingClip] = useState<{
    sceneIndex: number;
    initialX: number;
    initialDuration: number;
    initialWidth: number;
    handle: 'left' | 'right';
    currentDeltaSec: number;
  } | null>(null);

  // Playhead Scrubber Drag State
  const [isScrubbingPlayhead, setIsScrubbingPlayhead] = useState(false);

  // Selected Scene for Inspector
  const [selectedSceneIndex, setSelectedSceneIndex] = useState(0);

  // Media Refs & Workspace Refs
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const topSectionRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const bgmInputRef = useRef<HTMLInputElement | null>(null);

  // Cached Loaded Images Map: url -> HTMLImageElement
  const loadedImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());

  if (!currentProject) return null;

  const scenes: Scene[] = currentProject.scenes || [];
  const totalDuration = scenes.length > 0
    ? scenes[scenes.length - 1].end_time
    : (currentProject.narration_audio?.duration || 10.0);

  const selectedScene = scenes[selectedSceneIndex] || scenes[0];

  // Helper: Image URL
  const getSceneImageUrl = (scene: Scene) => {
    if (!scene.generated_image_path) return null;
    const filename = scene.generated_image_path.split(/[\\/]/).pop();
    if (!filename) return null;
    return api.getAssetUrl(currentProject.id, 'images', filename);
  };

  // Preload Scene Images into memory for 60 FPS Canvas Rendering
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

  // Find Current Scene and Subtitle at currentTime
  const currentSceneIndex = scenes.findIndex(
    (s) => currentTime >= s.start_time && currentTime < s.end_time
  );
  const activeScene = currentSceneIndex >= 0 ? scenes[currentSceneIndex] : scenes[scenes.length - 1] || null;

  const currentSubtitle = currentProject.subtitles?.find(
    (c) => currentTime >= c.start_time && currentTime <= c.end_time
  );

  // Easing function for smooth Ken Burns motion (ease-in-out cosine)
  const easeInOut = (t: number) => 0.5 * (1 - Math.cos(Math.PI * t));

  // Canvas Render Loop (60 FPS Ken Burns Motion & Real-time Compositor)
  const renderCanvasFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.fillStyle = '#090a0f';
    ctx.fillRect(0, 0, width, height);

    if (!activeScene) return;

    const imgUrl = getSceneImageUrl(activeScene);
    const img = imgUrl ? loadedImagesRef.current.get(imgUrl) : null;

    if (img && img.complete && img.naturalWidth > 0) {
      // Calculate normalized progress within active scene [0.0 -> 1.0]
      const sceneDuration = Math.max(0.2, activeScene.duration);
      const rawProgress = Math.max(0.0, Math.min(1.0, (currentTime - activeScene.start_time) / sceneDuration));
      const progress = easeInOut(rawProgress);

      const motion = activeScene.camera_motion || { type: 'zoom_in', speed: 'medium', intensity: 1.25 };
      const maxZoom = motion.intensity || (motion.speed === 'slow' ? 1.15 : motion.speed === 'fast' ? 1.40 : 1.25);

      ctx.save();
      // Clip to canvas area
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
        // Static
        currentScale = 1.0;
      }

      // Apply transform centered
      ctx.translate(width / 2 + offsetX, height / 2 + offsetY);
      ctx.scale(currentScale, currentScale);

      // Draw image to cover canvas
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

      // Handle Transitions (e.g. Dip to black / Fade at scene start)
      if (activeScene.transition_in && activeScene.transition_in !== 'cut') {
        const transDur = activeScene.transition_duration || 0.5;
        const transProgress = (currentTime - activeScene.start_time) / transDur;

        if (transProgress < 1.0) {
          if (activeScene.transition_in === 'dip_black') {
            const alpha = 1.0 - transProgress;
            ctx.fillStyle = `rgba(0, 0, 0, ${alpha.toFixed(2)})`;
            ctx.fillRect(0, 0, width, height);
          } else if (activeScene.transition_in === 'crossfade') {
            const alpha = 1.0 - transProgress;
            ctx.fillStyle = `rgba(15, 15, 25, ${alpha.toFixed(2)})`;
            ctx.fillRect(0, 0, width, height);
          }
        }
      }
    } else {
      // Placeholder Canvas Graphic if no image
      ctx.fillStyle = '#13151f';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = '#6366f1';
      ctx.font = 'bold 24px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Scene ${activeScene.scene_number}`, width / 2, height / 2 - 20);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px Inter, sans-serif';
      ctx.fillText('No image generated yet', width / 2, height / 2 + 15);
    }
  }, [currentTime, activeScene]);

  // Main Animation / Time Tick Loop
  useEffect(() => {
    const loop = () => {
      if (isPlaying) {
        if (audioRef.current && !audioRef.current.paused) {
          setCurrentTime(audioRef.current.currentTime);
        } else {
          setCurrentTime((prev) => {
            const next = prev + 0.033;
            if (next >= totalDuration) {
              if (isLooping) {
                if (audioRef.current) audioRef.current.currentTime = 0;
                return 0.0;
              }
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
  }, [isPlaying, totalDuration, isLooping, renderCanvasFrame]);

  // Auto-scroll Timeline Track Container to follow Playhead smoothly
  useEffect(() => {
    if (!autoScrollTimeline || !isPlaying) return;
    const container = timelineScrollRef.current;
    if (!container) return;

    // Playhead X is currentTime * 40 * timelineZoom
    const playheadX = currentTime * 40 * timelineZoom;
    const targetScroll = playheadX - (container.clientWidth / 2);

    container.scrollLeft = Math.max(0, targetScroll);
  }, [currentTime, isPlaying, timelineZoom, autoScrollTimeline]);

  // Handle Dragging Vertical Splitter (Top Sections vs Bottom Timeline)
  useEffect(() => {
    if (!isDraggingVerticalSplitter) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!workspaceRef.current) return;
      const rect = workspaceRef.current.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const newPct = (relativeY / rect.height) * 100;
      setSplitTopHeightPct(Math.max(25, Math.min(80, newPct)));
    };

    const handleMouseUp = () => {
      setIsDraggingVerticalSplitter(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingVerticalSplitter]);

  // Handle Dragging Horizontal Splitter (Top-Left Video vs Top-Right Inspector)
  useEffect(() => {
    if (!isDraggingHorizontalSplitter) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!topSectionRef.current) return;
      const rect = topSectionRef.current.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const newPct = (relativeX / rect.width) * 100;
      setSplitLeftWidthPct(Math.max(30, Math.min(75, newPct)));
    };

    const handleMouseUp = () => {
      setIsDraggingHorizontalSplitter(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingHorizontalSplitter]);

  // Clip Trimming / Duration Resizing Mouse Handler
  useEffect(() => {
    if (!resizingClip) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaPx = e.clientX - resizingClip.initialX;
      const deltaSec = deltaPx / (40 * timelineZoom);

      if (resizingClip.handle === 'right') {
        const rawNewDur = resizingClip.initialDuration + deltaSec;
        const newDur = Math.max(0.5, Math.round(rawNewDur * 10) / 10);

        const updatedScenes = [...scenes];
        const targetScene = updatedScenes[resizingClip.sceneIndex];
        if (targetScene) {
          targetScene.duration = newDur;
          let currT = targetScene.start_time;
          for (let i = resizingClip.sceneIndex; i < updatedScenes.length; i++) {
            updatedScenes[i].start_time = Math.round(currT * 1000) / 1000;
            updatedScenes[i].end_time = Math.round((currT + updatedScenes[i].duration) * 1000) / 1000;
            currT = updatedScenes[i].end_time;
          }
          updateCurrentProject((prev) => ({ ...prev, scenes: updatedScenes }));
        }

        setResizingClip((prev) => prev ? { ...prev, currentDeltaSec: deltaSec } : null);
      } else if (resizingClip.handle === 'left' && resizingClip.sceneIndex > 0) {
        const prevIdx = resizingClip.sceneIndex - 1;
        const updatedScenes = [...scenes];
        const prevScene = updatedScenes[prevIdx];
        const currScene = updatedScenes[resizingClip.sceneIndex];

        if (prevScene && currScene) {
          const totalTwoDuration = prevScene.duration + currScene.duration;
          const newPrevDur = Math.max(0.5, Math.min(totalTwoDuration - 0.5, prevScene.duration + deltaSec));
          const newCurrDur = Math.max(0.5, totalTwoDuration - newPrevDur);

          prevScene.duration = Math.round(newPrevDur * 10) / 10;
          currScene.duration = Math.round(newCurrDur * 10) / 10;

          let currT = prevScene.start_time;
          for (let i = prevIdx; i < updatedScenes.length; i++) {
            updatedScenes[i].start_time = Math.round(currT * 1000) / 1000;
            updatedScenes[i].end_time = Math.round((currT + updatedScenes[i].duration) * 1000) / 1000;
            currT = updatedScenes[i].end_time;
          }
          updateCurrentProject((prev) => ({ ...prev, scenes: updatedScenes }));
        }

        setResizingClip((prev) => prev ? { ...prev, currentDeltaSec: deltaSec } : null);
      }
    };

    const handleMouseUp = async () => {
      if (resizingClip) {
        const scene = scenes[resizingClip.sceneIndex];
        if (scene) {
          try {
            const res = await api.updateSceneDuration(currentProject.id, scene.id, scene.duration);
            if (res.scenes) {
              updateCurrentProject((prev) => ({
                ...prev,
                scenes: res.scenes,
                subtitles: res.subtitles || prev.subtitles,
              }));
              showToast(`Scene #${scene.scene_number} duration adjusted to ${scene.duration.toFixed(1)}s!`, 'success');
            }
          } catch (err: any) {
            showToast(`Failed to save duration: ${err.message}`, 'error');
          }
        }
      }
      setResizingClip(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingClip, scenes, timelineZoom, currentProject.id]);

  // Playhead Scrubber Drag Listener
  useEffect(() => {
    if (!isScrubbingPlayhead) return;

    const handleScrubMove = (e: MouseEvent) => {
      const container = timelineScrollRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const relativeX = e.clientX - rect.left + container.scrollLeft;
      const newTime = Math.max(0, Math.min(totalDuration, relativeX / (40 * timelineZoom)));
      seekTo(newTime);
    };

    const handleScrubUp = () => {
      setIsScrubbingPlayhead(false);
    };

    window.addEventListener('mousemove', handleScrubMove);
    window.addEventListener('mouseup', handleScrubUp);
    return () => {
      window.removeEventListener('mousemove', handleScrubMove);
      window.removeEventListener('mouseup', handleScrubUp);
    };
  }, [isScrubbingPlayhead, totalDuration, timelineZoom]);

  // Audio Play / Pause Sync
  const togglePlayPause = () => {
    if (isPlaying) {
      setIsPlaying(false);
      audioRef.current?.pause();
      bgmAudioRef.current?.pause();
    } else {
      if (currentTime >= totalDuration) {
        setCurrentTime(0);
        if (audioRef.current) audioRef.current.currentTime = 0;
      }
      setIsPlaying(true);
      audioRef.current?.play().catch(() => {});
      bgmAudioRef.current?.play().catch(() => {});
    }
  };

  // Keyboard Shortcuts (Space: Play/Pause, S: Split, J/L: Step, F: Fullscreen, M: Toggle Editing Mode)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        setIsFullscreen((prev) => !prev);
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        setIsProEditingMode((prev) => !prev);
      } else if (e.code === 'KeyS' && activeScene) {
        e.preventDefault();
        handleSplitScene(activeScene.id, currentTime);
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyJ') {
        e.preventDefault();
        seekTo(Math.max(0, currentTime - 0.5));
      } else if (e.code === 'ArrowRight' || e.code === 'KeyL') {
        e.preventDefault();
        seekTo(Math.min(totalDuration, currentTime + 0.5));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, currentTime, totalDuration, activeScene]);

  // Seek To Timestamp
  const seekTo = (time: number) => {
    const clamped = Math.max(0, Math.min(totalDuration, time));
    setCurrentTime(clamped);
    if (audioRef.current) {
      audioRef.current.currentTime = clamped;
    }
    if (bgmAudioRef.current) {
      bgmAudioRef.current.currentTime = clamped % (bgmAudioRef.current.duration || 10);
    }
    renderCanvasFrame();
  };

  // Split Scene at Playhead
  const handleSplitScene = async (sceneId: string, splitTime: number) => {
    try {
      const res = await api.splitScene(currentProject.id, sceneId, splitTime);
      if (res.scenes) {
        updateCurrentProject((prev) => ({ ...prev, scenes: res.scenes }));
        showToast('Scene split at playhead position!', 'success');
      }
    } catch (err: any) {
      showToast(`Cannot split: ${err.message}`, 'error');
    }
  };

  // Update Scene Camera Motion
  const handleUpdateMotion = async (motionType: CameraMotion['type'], speed: CameraMotion['speed'] = 'medium') => {
    if (!selectedScene) return;
    try {
      const updatedMotion = {
        type: motionType,
        speed: speed,
        intensity: speed === 'slow' ? 1.15 : speed === 'fast' ? 1.40 : 1.25,
      };
      const res = await api.updateSceneMotion(currentProject.id, selectedScene.id, updatedMotion);
      if (res.scene) {
        updateCurrentProject((prev) => ({
          ...prev,
          scenes: prev.scenes.map((s) => (s.id === selectedScene.id ? res.scene : s)),
        }));
        showToast(`Camera motion updated to ${motionType.replace('_', ' ')}!`, 'success');
      }
    } catch (err: any) {
      showToast(`Failed to update motion: ${err.message}`, 'error');
    }
  };

  // Update Scene Transition
  const handleUpdateTransition = async (transitionIn: string, duration: number = 0.5) => {
    if (!selectedScene) return;
    try {
      const res = await api.updateSceneTransition(currentProject.id, selectedScene.id, transitionIn, duration);
      if (res.scene) {
        updateCurrentProject((prev) => ({
          ...prev,
          scenes: prev.scenes.map((s) => (s.id === selectedScene.id ? res.scene : s)),
        }));
        showToast(`Transition set to ${transitionIn}!`, 'success');
      }
    } catch (err: any) {
      showToast(`Failed to update transition: ${err.message}`, 'error');
    }
  };

  const [isAutoFitting, setIsAutoFitting] = useState(false);

  // Auto-Fit Audio Duration & Apply Cinematic Camera Motions to All Scenes
  const handleAutoFitAudioAndCinematicMotions = async () => {
    try {
      setIsAutoFitting(true);
      const res = await api.autoFitAudioAndMotion(currentProject.id);
      if (res.scenes) {
        updateCurrentProject((prev) => ({
          ...prev,
          scenes: res.scenes,
          subtitles: res.subtitles || prev.subtitles,
        }));
        showToast('🎉 All scenes fitted to voice audio duration with dynamic cinematic camera motions & live teleprompter sync!', 'success');
      }
    } catch (err: any) {
      showToast(`Auto-fit error: ${err.message}`, 'error');
    } finally {
      setIsAutoFitting(false);
    }
  };

  // Batch Animation State
  const [isBatchAnimating, setIsBatchAnimating] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchMessage, setBatchMessage] = useState('');
  const [batchParticlePreset, setBatchParticlePreset] = useState<string>('auto');
  const [isAnimatingSingle, setIsAnimatingSingle] = useState(false);

  // Batch Animate All Scenes Handler
  const handleAnimateAllScenes = async () => {
    try {
      setIsBatchAnimating(true);
      setBatchProgress(10);
      setBatchMessage('Starting 3D motion & atmospheric VFX engine...');

      const res = await api.animateBatchScenes(currentProject.id, {
        motion_mode: 'cinematic_vfx',
        particle_effect: batchParticlePreset,
      });

      const jobId = res.job_id;
      const poll = setInterval(async () => {
        try {
          const job = await api.getJob(jobId);
          setBatchProgress(job.progress);
          setBatchMessage(job.message);

          if (job.status === 'completed') {
            clearInterval(poll);
            setIsBatchAnimating(false);
            if (job.result?.scenes) {
              updateCurrentProject((prev) => ({
                ...prev,
                scenes: job.result.scenes,
              }));
            }
            showToast('🎉 All scenes converted to 3D motion video clips!', 'success');
          } else if (job.status === 'failed') {
            clearInterval(poll);
            setIsBatchAnimating(false);
            showToast(`Batch animation failed: ${job.error}`, 'error');
          }
        } catch {
          clearInterval(poll);
          setIsBatchAnimating(false);
        }
      }, 700);
    } catch (err: any) {
      setIsBatchAnimating(false);
      showToast(`Animation error: ${err.message}`, 'error');
    }
  };

  // Single Scene Animate Handler
  const handleAnimateSingleScene = async (particleEffect?: string) => {
    if (!selectedScene) return;
    try {
      setIsAnimatingSingle(true);
      const res = await api.animateSingleScene(
        currentProject.id,
        selectedScene.id,
        'cinematic_vfx',
        particleEffect || selectedScene.particle_effect || 'none'
      );
      if (res.scene) {
        updateCurrentProject((prev) => ({
          ...prev,
          scenes: prev.scenes.map((s) => (s.id === selectedScene.id ? res.scene : s)),
        }));
        showToast(`Scene ${selectedScene.scene_number} animated to video clip!`, 'success');
      }
    } catch (err: any) {
      showToast(`Animation failed: ${err.message}`, 'error');
    } finally {
      setIsAnimatingSingle(false);
    }
  };

  // Update Particle Effect Handler
  const handleUpdateParticleEffect = async (effect: string) => {
    if (!selectedScene) return;
    try {
      const res = await api.updateParticleEffect(currentProject.id, selectedScene.id, effect);
      if (res.scene) {
        updateCurrentProject((prev) => ({
          ...prev,
          scenes: prev.scenes.map((s) => (s.id === selectedScene.id ? res.scene : s)),
        }));
        showToast(`Effect set to ${effect.replace('_', ' ')}`, 'info');
      }
    } catch (err: any) {
      showToast(`Failed to update effect: ${err.message}`, 'error');
    }
  };

  // Reorder Scenes (Move left / right)
  const handleMoveScene = async (currentIndex: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= scenes.length) return;

    const newScenes = [...scenes];
    const [moved] = newScenes.splice(currentIndex, 1);
    newScenes.splice(targetIndex, 0, moved);

    try {
      const sceneIds = newScenes.map((s) => s.id);
      const res = await api.reorderScenes(currentProject.id, sceneIds);
      if (res.scenes) {
        updateCurrentProject((prev) => ({ ...prev, scenes: res.scenes }));
        setSelectedSceneIndex(targetIndex);
        showToast(`Moved Scene to position ${targetIndex + 1}`, 'info');
      }
    } catch (err: any) {
      showToast(`Failed to reorder: ${err.message}`, 'error');
    }
  };

  // BGM Upload Handler
  const handleBgmSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const res = await api.uploadBGM(currentProject.id, file);
        if (res.background_music) {
          updateCurrentProject((prev) => ({
            ...prev,
            background_music: res.background_music,
          }));
          showToast(`Background music "${res.filename}" uploaded!`, 'success');
        }
      } catch (err: any) {
        showToast(`BGM upload error: ${err.message}`, 'error');
      }
    }
  };

  // Format Timecode mm:ss.ms
  const formatTimecode = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${ms}`;
  };

  // Audio URLs
  const narrationUrl = currentProject.narration_audio?.file_path
    ? api.getAssetUrl(currentProject.id, 'audio', currentProject.narration_audio.file_path.split(/[\\/]/).pop() || '')
    : null;

  const bgmUrl = currentProject.background_music?.file_path
    ? api.getAssetUrl(currentProject.id, 'audio', currentProject.background_music.file_path.split(/[\\/]/).pop() || '')
    : null;

  // Timeline track total width calculated accurately for all tracks
  const pxPerSec = 40 * timelineZoom;
  const trackCanvasWidthPx = Math.max(1200, Math.ceil((totalDuration + 5) * pxPerSec));

  return (
    <div
      ref={workspaceRef}
      className={`relative w-full select-none flex flex-col bg-[#07080d] text-slate-100 ${
        isProEditingMode
          ? 'fixed inset-0 z-50 h-screen w-screen overflow-hidden'
          : 'h-full max-w-7xl mx-auto p-4 space-y-4 overflow-y-auto pb-24'
      }`}
    >
      {/* Hidden Audio Players for Sync */}
      {narrationUrl && (
        <audio
          ref={audioRef}
          src={narrationUrl}
          preload="auto"
          onEnded={() => {
            if (!isLooping) setIsPlaying(false);
          }}
        />
      )}
      {bgmUrl && (
        <audio
          ref={bgmAudioRef}
          src={bgmUrl}
          preload="auto"
          loop
          onPlay={() => {
            if (bgmAudioRef.current) {
              bgmAudioRef.current.volume = autoDucking && currentSubtitle ? bgmVolume * 0.25 : bgmVolume;
            }
          }}
        />
      )}

      {/* Hidden BGM File Input */}
      <input
        type="file"
        ref={bgmInputRef}
        accept="audio/*"
        className="hidden"
        onChange={handleBgmSelected}
      />

      {/* ─────────────────────────────────────────────────────────────
          1. TOP APP BAR / STUDIO TOOLBAR
      ───────────────────────────────────────────────────────────── */}
      <div className="shrink-0 h-13 px-4 py-2 bg-studio-950/95 border-b border-studio-800 flex items-center justify-between gap-3 shadow-md z-30">
        {/* Left: Project Title & Scene Count */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center shadow-md shadow-cyan-500/20">
            <Film className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-bold text-white truncate max-w-[200px] sm:max-w-xs">
                {currentProject.name || 'Untitled Story'}
              </span>
              <Badge variant="brand">{scenes.length} Scenes</Badge>
              <Badge variant="accent">{currentProject.aspect_ratio}</Badge>
            </div>
            <div className="text-[10.5px] text-studio-400 font-mono flex items-center gap-1.5">
              <span>Step 5: Multi-Track Timeline &amp; Ken Burns Studio</span>
            </div>
          </div>
        </div>

        {/* Center: Digital Timecode Readout */}
        <div className="flex items-center gap-2 bg-black/70 border border-studio-800 px-3 py-1 rounded-xl shadow-inner font-mono text-xs">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-cyan-400 font-bold">{formatTimecode(currentTime)}</span>
          </div>
          <span className="text-studio-600">/</span>
          <span className="text-studio-300">{formatTimecode(totalDuration)}</span>
        </div>

        {/* Right: Quick Actions & Navigation */}
        <div className="flex items-center gap-2">
          {/* Particle Preset Selector for Batch */}
          <select
            value={batchParticlePreset}
            onChange={(e) => setBatchParticlePreset(e.target.value)}
            className="bg-studio-900 border border-studio-700/80 rounded-lg px-2 py-1 text-xs text-amber-300 font-medium focus:outline-none"
            title="Choose atmospheric particle VFX for all scenes"
          >
            <option value="auto">✨ Auto Mood VFX</option>
            <option value="fire_embers">🔥 Fire Embers</option>
            <option value="mystic_dust">✨ Mystic Dust</option>
            <option value="cinematic_rain">🌧️ Rain Streaks</option>
            <option value="fog_mist">🌫️ Rolling Fog</option>
            <option value="light_leaks">☀️ Light Leaks</option>
            <option value="film_grain">🎞️ 35mm Grain</option>
            <option value="none">🚫 No Particles</option>
          </select>

          {/* Animate All Scenes Button */}
          <Button
            variant="glow"
            size="sm"
            onClick={handleAnimateAllScenes}
            isLoading={isBatchAnimating}
            leftIcon={<Video className="w-3.5 h-3.5 text-amber-300" />}
            className="bg-gradient-to-r from-amber-600 via-orange-600 to-indigo-600 text-xs font-bold shadow-amber-500/20"
            title="Convert all scene images into 3D motion video clips with atmospheric VFX"
          >
            {isBatchAnimating ? `Animating (${batchProgress.toFixed(0)}%)...` : '⚡ Animate All Scenes'}
          </Button>

          {/* Auto-Fit Button */}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleAutoFitAudioAndCinematicMotions}
            isLoading={isAutoFitting}
            leftIcon={<Sparkles className="w-3.5 h-3.5 text-cyan-300" />}
            className="text-xs font-semibold"
            title="Auto align scene durations with speech & apply cinematic camera motions"
          >
            🪄 Auto-Fit
          </Button>

          {/* Reset Panels Layout */}
          <button
            onClick={() => {
              setSplitTopHeightPct(54);
              setSplitLeftWidthPct(58);
              showToast('Workspace panel layout reset to default!', 'info');
            }}
            className="p-1.5 rounded-lg bg-studio-900 hover:bg-studio-800 text-studio-400 hover:text-white transition-colors border border-studio-800"
            title="Reset split panel layout sizes"
          >
            <SplitSquareVertical className="w-4 h-4" />
          </button>

          {/* Toggle Editing Mode Button */}
          <button
            onClick={() => setIsProEditingMode(!isProEditingMode)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 ${
              isProEditingMode
                ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300 shadow-md shadow-cyan-500/20'
                : 'bg-studio-900 border-studio-700 text-studio-300 hover:border-cyan-500'
            }`}
            title="Toggle between Pro Fullscreen Workspace and Page View (M)"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>{isProEditingMode ? 'Pro Studio ON' : 'Pro Studio OFF'}</span>
          </button>

          {/* Back to Images */}
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
            onClick={() => setStep(4)}
          >
            Images
          </Button>

          {/* Proceed to Subtitles */}
          <Button
            variant="glow"
            size="sm"
            rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            onClick={() => {
              saveCurrentProject();
              setStep(6);
            }}
          >
            Subtitles
          </Button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. PRO RESIZABLE WORKSPACE (TOP ROW + BOTTOM TIMELINE)
      ───────────────────────────────────────────────────────────── */}
      <div className={`flex-1 flex flex-col min-h-0 relative ${isProEditingMode ? 'h-[calc(100vh-3.25rem)]' : 'min-h-[720px]'}`}>
        
        {/* ── TOP SECTION: (Top-Left: Video Preview & HUD + Top-Right: Scene Inspector) ── */}
        <div
          ref={topSectionRef}
          style={{ height: `${splitTopHeightPct}%` }}
          className="flex min-h-[220px] relative overflow-hidden bg-studio-950/60"
        >
          {/* ── TOP-LEFT: 60 FPS VIDEO PREVIEW & TELEPROMPTER HUD ── */}
          <div
            style={{ width: `${splitLeftWidthPct}%` }}
            className="h-full flex flex-col min-w-[280px] p-2.5 space-y-2 relative overflow-hidden border-r border-studio-800"
          >
            {/* Canvas Viewport Frame */}
            <div className="flex-1 min-h-0 bg-black/90 rounded-xl border border-studio-800 flex items-center justify-center relative overflow-hidden shadow-inner group">
              <canvas
                ref={canvasRef}
                width={currentProject.aspect_ratio === '9:16' ? 1080 : 1920}
                height={currentProject.aspect_ratio === '9:16' ? 1920 : 1080}
                className="max-h-full max-w-full object-contain cursor-pointer transition-transform"
                onClick={togglePlayPause}
              />

              {/* Center Play Overlay when Paused */}
              {!isPlaying && (
                <div
                  onClick={togglePlayPause}
                  className="absolute inset-0 bg-black/30 flex items-center justify-center cursor-pointer hover:bg-black/20 transition-all"
                >
                  <div className="w-14 h-14 rounded-full bg-indigo-600/90 hover:bg-indigo-500 text-white flex items-center justify-center shadow-2xl hover:scale-110 transition-transform pl-1">
                    <Play className="w-7 h-7 fill-current" />
                  </div>
                </div>
              )}

              {/* Scene Badge & Camera Motion Overlay */}
              {activeScene && (
                <div className="absolute top-2 left-2 flex items-center gap-1.5 pointer-events-none">
                  <div className="px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md border border-white/10 text-white text-[10px] font-bold flex items-center gap-1.5">
                    <span>Scene {activeScene.scene_number} / {scenes.length}</span>
                    {isPlaying && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping inline-block" />}
                  </div>
                  <div className="px-2 py-0.5 rounded-md bg-indigo-950/90 backdrop-blur-md border border-indigo-500/40 text-indigo-300 text-[10px] font-mono">
                    {activeScene.camera_motion?.type.toUpperCase().replace('_', ' ')}
                  </div>
                </div>
              )}
            </div>

            {/* Live Script Teleprompter HUD Bar */}
            {activeScene && (
              <div className="shrink-0 bg-studio-900/90 border border-cyan-500/30 rounded-xl p-2 shadow-md backdrop-blur-sm relative overflow-hidden">
                <div className="flex items-center justify-between text-[11px] pb-1 border-b border-studio-800/80 mb-1">
                  <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
                    <Film className="w-3 h-3" />
                    <span>Scene #{activeScene.scene_number}</span>
                    {isPlaying && (
                      <span className="text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.2 rounded font-mono font-bold">
                        LIVE
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10.5px] font-mono text-studio-400">
                    <span className="text-indigo-300">
                      🎥 {activeScene.camera_motion?.type.replace('_', ' ').toUpperCase()} ({activeScene.camera_motion?.speed})
                    </span>
                    <span className="text-cyan-300 font-semibold">
                      ⏳ {(Math.max(0, activeScene.end_time - currentTime)).toFixed(1)}s left
                    </span>
                  </div>
                </div>

                {/* Spoken Word Highlighting Teleprompter */}
                <div className="text-xs font-medium text-white leading-snug line-clamp-2 min-h-[32px] flex items-center">
                  <p>
                    {(() => {
                      const cue = currentProject.subtitles?.find(
                        (c) => c.text === activeScene.story_text || (currentTime >= c.start_time && currentTime <= c.end_time)
                      );
                      if (cue && cue.words && cue.words.length > 0) {
                        return cue.words.map((w, wIdx) => {
                          const isPast = currentTime >= w.end;
                          const isCurrentWord = currentTime >= w.start && currentTime < w.end;
                          return (
                            <span
                              key={wIdx}
                              className={`inline-block mr-1 transition-all duration-100 ${
                                isCurrentWord
                                  ? 'text-cyan-300 font-bold scale-105 underline decoration-cyan-400 decoration-2'
                                  : isPast
                                  ? 'text-slate-100 font-medium'
                                  : 'text-studio-400 opacity-70'
                              }`}
                            >
                              {w.word}
                            </span>
                          );
                        });
                      }
                      return activeScene.story_text || 'No script text for this scene.';
                    })()}
                  </p>
                </div>
              </div>
            )}

            {/* Transport Control Bar */}
            <div className="shrink-0 flex items-center justify-between text-xs text-studio-300 bg-studio-900/70 border border-studio-800 px-3 py-1.5 rounded-xl">
              <div className="flex items-center gap-2.5">
                <button
                  onClick={togglePlayPause}
                  className="w-7 h-7 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition-colors shadow"
                  title="Play / Pause (Space)"
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current pl-0.5" />}
                </button>

                <button
                  onClick={() => seekTo(0)}
                  className="p-1 hover:text-white transition-colors"
                  title="Restart (0s)"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => setIsLooping(!isLooping)}
                  className={`p-1 transition-colors ${isLooping ? 'text-indigo-400 font-bold' : 'hover:text-white'}`}
                  title="Loop Playback"
                >
                  <Repeat className="w-3.5 h-3.5" />
                </button>

                <div className="font-mono text-[11px] font-bold text-studio-100 pl-1">
                  <span className="text-cyan-400">{formatTimecode(currentTime)}</span>
                  <span className="text-studio-500 mx-1">/</span>
                  <span>{formatTimecode(totalDuration)}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Split Shortcut Button */}
                {activeScene && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSplitScene(activeScene.id, currentTime)}
                    leftIcon={<Scissors className="w-3 h-3 text-pink-400" />}
                    className="text-[11px] py-1 px-2 h-7"
                  >
                    Split (S)
                  </Button>
                )}

                {/* Volume Slider */}
                <div className="flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-studio-400" />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={masterVolume}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setMasterVolume(val);
                      if (audioRef.current) audioRef.current.volume = val;
                    }}
                    className="w-14 h-1 bg-studio-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── DRAGGABLE HORIZONTAL SPLITTER BAR (Between Video & Inspector) ── */}
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              setIsDraggingHorizontalSplitter(true);
            }}
            className="w-2 relative shrink-0 bg-studio-900/80 hover:bg-cyan-500/60 active:bg-cyan-400 transition-colors cursor-col-resize flex items-center justify-center z-30 group"
            title="Drag left/right to resize video screen vs motion inspector"
          >
            <div className="w-0.5 h-8 bg-studio-600 group-hover:bg-white rounded-full transition-colors" />
          </div>

          {/* ── TOP-RIGHT: SCENE INSPECTOR & KEN BURNS MOTION STUDIO ── */}
          <div
            style={{ width: `${100 - splitLeftWidthPct}%` }}
            className="h-full flex flex-col min-w-[260px] p-2.5 overflow-y-auto space-y-3 bg-studio-950/80"
          >
            {selectedScene ? (
              <>
                {/* Inspector Header */}
                <div className="flex items-center justify-between pb-2 border-b border-studio-800">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 flex items-center justify-center font-bold text-xs">
                      {selectedScene.scene_number}
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white">
                        Scene #{selectedScene.scene_number} Inspector
                      </h3>
                      <p className="text-[10px] text-studio-400 font-mono">
                        {selectedScene.duration.toFixed(1)}s • {formatTimecode(selectedScene.start_time)} - {formatTimecode(selectedScene.end_time)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleMoveScene(selectedSceneIndex, 'left')}
                      disabled={selectedSceneIndex === 0}
                      className="p-1 rounded-md bg-studio-800 hover:bg-studio-700 disabled:opacity-30 text-studio-200"
                      title="Move Scene Left"
                    >
                      <MoveLeft className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleMoveScene(selectedSceneIndex, 'right')}
                      disabled={selectedSceneIndex >= scenes.length - 1}
                      className="p-1 rounded-md bg-studio-800 hover:bg-studio-700 disabled:opacity-30 text-studio-200"
                      title="Move Scene Right"
                    >
                      <MoveRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Cinematic Camera Motion Grid */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-studio-200">Camera Motion:</span>
                    <span className="text-cyan-400 font-mono text-[10.5px]">
                      {selectedScene.camera_motion?.type.toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    {[
                      { id: 'zoom_in', label: '🔍 Zoom In', desc: 'Slow cinematic push' },
                      { id: 'zoom_out', label: '🔎 Zoom Out', desc: 'Reveals wider scene' },
                      { id: 'pan_left', label: '⬅️ Pan Left', desc: 'Slide right to left' },
                      { id: 'pan_right', label: '➡️ Pan Right', desc: 'Slide left to right' },
                      { id: 'pan_up', label: '⬆️ Tilt Up', desc: 'Vertical reveal up' },
                      { id: 'pan_down', label: '⬇️ Tilt Down', desc: 'Vertical reveal down' },
                      { id: 'slow_drift', label: '↗️ Drift', desc: 'Dramatic diagonal' },
                      { id: 'static', label: '⏹️ Static', desc: 'No camera motion' },
                    ].map((m) => {
                      const isSelected = selectedScene.camera_motion?.type === m.id;
                      return (
                        <button
                          key={m.id}
                          onClick={() => handleUpdateMotion(m.id as any, selectedScene.camera_motion?.speed || 'medium')}
                          className={`p-2 rounded-lg border text-left transition-all ${
                            isSelected
                              ? 'bg-gradient-to-r from-indigo-950 to-purple-950 border-indigo-500 text-white shadow'
                              : 'bg-studio-900 border-studio-800 text-studio-300 hover:border-studio-700'
                          }`}
                        >
                          <div className="font-semibold text-[11px]">{m.label}</div>
                          <div className="text-[9.5px] text-studio-400 truncate">{m.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Motion Speed Selector */}
                <div className="space-y-1.5 pt-1 border-t border-studio-800">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-studio-200">Motion Speed &amp; Zoom:</span>
                    <span className="text-studio-400 font-mono text-[10px]">
                      {selectedScene.camera_motion?.speed || 'medium'} ({(selectedScene.camera_motion?.intensity || 1.25).toFixed(2)}x)
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 bg-studio-900 p-1 rounded-lg border border-studio-800 text-xs">
                    {(['slow', 'medium', 'fast'] as const).map((spd) => (
                      <button
                        key={spd}
                        onClick={() => handleUpdateMotion(selectedScene.camera_motion?.type || 'zoom_in', spd)}
                        className={`flex-1 py-1 rounded font-medium capitalize text-[10.5px] transition-all ${
                          selectedScene.camera_motion?.speed === spd
                            ? 'bg-indigo-600 text-white shadow'
                            : 'text-studio-400 hover:text-studio-200'
                        }`}
                      >
                        {spd} ({spd === 'slow' ? '1.15x' : spd === 'medium' ? '1.25x' : '1.40x'})
                      </button>
                    ))}
                  </div>
                </div>

                {/* Scene Transition Selector */}
                <div className="space-y-1.5 pt-1 border-t border-studio-800">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-studio-200">Transition In:</span>
                    <span className="text-purple-300 font-mono text-[10px]">
                      {selectedScene.transition_in.toUpperCase()} ({selectedScene.transition_duration}s)
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1 text-[10px]">
                    {[
                      { id: 'cut', label: 'Cut (None)' },
                      { id: 'crossfade', label: 'Crossfade' },
                      { id: 'dip_black', label: 'Dip Black' },
                      { id: 'wipe_left', label: 'Wipe Left' },
                      { id: 'wipe_right', label: 'Wipe Right' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handleUpdateTransition(t.id, selectedScene.transition_duration || 0.5)}
                        className={`py-1 px-1.5 rounded border text-center transition-all truncate ${
                          selectedScene.transition_in === t.id
                            ? 'bg-purple-900/70 border-purple-500 text-purple-200 font-bold'
                            : 'bg-studio-900 border-studio-800 text-studio-400 hover:text-studio-200'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Atmospheric VFX & 3D Motion Video Clip Generator */}
                <div className="space-y-2 pt-2 border-t border-studio-800 bg-studio-900/60 p-3 rounded-xl border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Atmospheric VFX & Motion</span>
                    </div>
                    {selectedScene.video_clip_path ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-950 border border-emerald-500/40 text-emerald-300 font-bold">
                        🎥 3D Clip Ready
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-studio-800 text-studio-400">
                        Static Image
                      </span>
                    )}
                  </div>

                  {/* Particle Preset Selector */}
                  <div className="space-y-1">
                    <span className="text-[10.5px] text-studio-400 font-medium">Particle Effect:</span>
                    <div className="grid grid-cols-2 gap-1 text-[10px]">
                      {[
                        { id: 'none', label: '🚫 No Particles' },
                        { id: 'fire_embers', label: '🔥 Fire Embers' },
                        { id: 'mystic_dust', label: '✨ Mystic Dust' },
                        { id: 'cinematic_rain', label: '🌧️ Rain Streaks' },
                        { id: 'fog_mist', label: '🌫️ Rolling Fog' },
                        { id: 'light_leaks', label: '☀️ Light Leaks' },
                        { id: 'film_grain', label: '🎞️ 35mm Grain' },
                      ].map((ef) => (
                        <button
                          key={ef.id}
                          type="button"
                          onClick={() => handleUpdateParticleEffect(ef.id)}
                          className={`p-1.5 rounded-lg border text-left truncate transition-all ${
                            (selectedScene.particle_effect || 'none') === ef.id
                              ? 'bg-amber-950/70 border-amber-500/60 text-amber-200 font-bold shadow'
                              : 'bg-studio-850 border-studio-800 text-studio-400 hover:text-studio-200 hover:border-studio-700'
                          }`}
                        >
                          {ef.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Generate 3D Video Clip Button */}
                  <Button
                    variant="glow"
                    size="sm"
                    className="w-full bg-gradient-to-r from-amber-600 via-orange-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md mt-1"
                    onClick={() => handleAnimateSingleScene()}
                    isLoading={isAnimatingSingle}
                    leftIcon={<Video className="w-3.5 h-3.5" />}
                  >
                    {isAnimatingSingle ? 'Rendering 3D Motion Clip...' : selectedScene.video_clip_path ? '🔄 Re-render 3D Motion Clip' : '⚡ Render 3D Video Motion Clip'}
                  </Button>
                </div>

                {/* Scene Script Snippet */}
                <div className="p-2.5 rounded-lg bg-studio-900/80 border border-studio-800 text-xs space-y-1">
                  <span className="text-[9.5px] font-bold text-studio-400 uppercase tracking-wider block">Script:</span>
                  <p className="text-studio-200 line-clamp-3 leading-relaxed italic text-[11px]">
                    "{selectedScene.story_text}"
                  </p>
                </div>
              </>
            ) : (
              <div className="text-center p-6 text-studio-400 text-xs">
                Select a scene on the timeline to inspect motion and transitions.
              </div>
            )}
          </div>
        </div>

        {/* ── DRAGGABLE VERTICAL SPLITTER BAR (Between Top Panels & Bottom Timeline) ── */}
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            setIsDraggingVerticalSplitter(true);
          }}
          className="h-2 relative shrink-0 bg-studio-900 hover:bg-cyan-500/60 active:bg-cyan-400 transition-colors cursor-row-resize flex items-center justify-center z-30 group"
          title="Drag up/down to adjust timeline height vs video/inspector screen"
        >
          <div className="h-0.5 w-16 bg-studio-600 group-hover:bg-white rounded-full transition-colors" />
        </div>

        {/* ── BOTTOM SECTION: FULL-WIDTH MULTI-TRACK TIMELINE ── */}
        <div
          style={{ height: `${100 - splitTopHeightPct}%` }}
          className="flex-1 min-h-[160px] flex flex-col overflow-hidden bg-[#0a0b12] border-t border-studio-800 relative shadow-inner"
        >
          {/* Timeline Header Toolbar */}
          <div className="shrink-0 h-9 px-3 bg-studio-950/90 border-b border-studio-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-bold text-white text-[11px]">Multi-Track Timeline</span>
              <Badge variant="brand" className="text-[9.5px] px-1.5 py-0">{scenes.length} CLIPS</Badge>
              {isPlaying && (
                <span className="text-[9px] bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-500/40 font-mono font-bold animate-pulse">
                  PLAYING SCENE {activeScene?.scene_number || 1}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Auto-Scroll Toggle */}
              <button
                onClick={() => setAutoScrollTimeline(!autoScrollTimeline)}
                className={`px-2 py-0.5 rounded text-[10.5px] font-bold border transition-all flex items-center gap-1 ${
                  autoScrollTimeline
                    ? 'bg-cyan-950 border-cyan-500/50 text-cyan-300'
                    : 'bg-studio-900 border-studio-800 text-studio-400'
                }`}
                title="Follow playhead automatically during playback"
              >
                <span>🎯 Auto-Scroll:</span>
                <span>{autoScrollTimeline ? 'ON' : 'OFF'}</span>
              </button>

              {/* Zoom Controls */}
              <div className="flex items-center gap-1 bg-studio-900 px-1.5 py-0.5 rounded border border-studio-800">
                <ZoomOut
                  className="w-3 h-3 text-studio-400 cursor-pointer hover:text-white"
                  onClick={() => setTimelineZoom((prev) => Math.max(0.5, prev - 0.25))}
                />
                <span className="text-[10px] font-mono text-studio-300 w-8 text-center">
                  {timelineZoom.toFixed(1)}x
                </span>
                <ZoomIn
                  className="w-3 h-3 text-studio-400 cursor-pointer hover:text-white"
                  onClick={() => setTimelineZoom((prev) => Math.min(3.0, prev + 0.25))}
                />
              </div>

              {/* BGM Upload Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => bgmInputRef.current?.click()}
                leftIcon={<Music className="w-3 h-3 text-emerald-400" />}
                className="text-[10.5px] py-0.5 px-2 h-6"
              >
                {currentProject.background_music?.file_path ? 'Change BGM' : 'Add BGM'}
              </Button>
            </div>
          </div>

          {/* Unified Timeline Tracks: Sticky Track Column + Scrollable Multi-Track Canvas */}
          <div className="flex-1 flex overflow-hidden relative">
            {/* 1. STICKY LEFT TRACK HEADERS COLUMN */}
            <div className="w-28 sm:w-32 shrink-0 bg-studio-950 border-r border-studio-800 z-20 flex flex-col py-1 select-none shadow-md">
              {/* Ruler Header */}
              <div className="h-6 px-2.5 flex items-center gap-1 text-[10px] font-mono font-bold text-studio-400 border-b border-studio-800/60">
                <span>⏱️ Ruler</span>
              </div>

              {/* Video Track Header */}
              <div className="h-16 px-2.5 flex flex-col justify-center gap-0.5 border-b border-studio-800/60">
                <div className="flex items-center gap-1 text-[11px] font-bold text-indigo-300">
                  <Film className="w-3 h-3 text-indigo-400" />
                  <span>Video Track</span>
                </div>
                <span className="text-[9.5px] text-studio-400 font-mono">{scenes.length} clips</span>
              </div>

              {/* Voice Track Header */}
              <div className="h-12 px-2.5 flex flex-col justify-center gap-0.5 border-b border-studio-800/60">
                <div className="flex items-center gap-1 text-[11px] font-bold text-pink-300">
                  <Mic className="w-3 h-3 text-pink-400" />
                  <span>Voice Track</span>
                </div>
                <span className="text-[9.5px] text-pink-400/80 font-mono">Audio &amp; Cues</span>
              </div>

              {/* BGM Track Header */}
              <div className="h-11 px-2.5 flex flex-col justify-center gap-0.5">
                <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-300">
                  <Music className="w-3 h-3 text-emerald-400" />
                  <span>BGM Track</span>
                </div>
                <span className="text-[9px] text-emerald-400/80 font-mono">Soundtrack</span>
              </div>
            </div>

            {/* 2. HORIZONTALLY SCROLLABLE TIMELINE TRACK CANVAS */}
            <div
              ref={timelineScrollRef}
              className="flex-1 overflow-x-auto overflow-y-hidden select-none relative py-1 bg-[#06070c]"
            >
              {/* Inner Full Canvas (Width = trackCanvasWidthPx) */}
              <div
                className="relative space-y-1.5 pb-2"
                style={{ width: `${trackCanvasWidthPx}px` }}
              >
                {/* Track 0: Time Ruler */}
                <div
                  className="h-6 border-b border-studio-800 relative text-[9px] font-mono text-studio-500 cursor-pointer"
                  style={{ width: `${trackCanvasWidthPx}px` }}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const clickedTime = Math.max(0, Math.min(totalDuration, clickX / pxPerSec));
                    seekTo(clickedTime);
                  }}
                >
                  {Array.from({ length: Math.ceil(totalDuration) + 2 }).map((_, sec) => {
                    if (sec % 5 !== 0 && timelineZoom < 1.5) return null;
                    return (
                      <div
                        key={sec}
                        className="absolute top-0 flex flex-col items-center select-none pointer-events-none"
                        style={{ left: `${sec * pxPerSec}px` }}
                      >
                        <span className="text-[8.5px] text-studio-400 font-mono">{formatTimecode(sec)}</span>
                        <div className="w-px h-2 bg-studio-700 mt-0.5" />
                      </div>
                    );
                  })}
                </div>

                {/* Track 1: Scenes & Ken Burns Video Track Clips */}
                <div
                  className="relative h-16 bg-studio-900/50 rounded-lg border border-studio-800/80 p-0.5 overflow-hidden"
                  style={{ width: `${trackCanvasWidthPx}px` }}
                >
                  {scenes.map((scene, idx) => {
                    const leftPx = scene.start_time * pxPerSec;
                    const widthPx = Math.max(28, scene.duration * pxPerSec);
                    const isSelected = selectedSceneIndex === idx;
                    const isCurrentlyPlaying = currentSceneIndex === idx;
                    const sceneProgress = Math.min(100, Math.max(0, ((currentTime - scene.start_time) / Math.max(0.1, scene.duration)) * 100));
                    const isBeingResized = resizingClip?.sceneIndex === idx;
                    const imgUrl = getSceneImageUrl(scene);

                    return (
                      <div
                        key={scene.id}
                        onClick={() => {
                          setSelectedSceneIndex(idx);
                          seekTo(scene.start_time);
                        }}
                        className={`absolute top-0.5 bottom-0.5 rounded-lg overflow-hidden border cursor-pointer transition-all flex flex-col justify-between p-1 select-none group ${
                          isBeingResized
                            ? 'border-cyan-300 bg-cyan-950/90 shadow-[0_0_20px_rgba(6,182,212,0.6)] ring-2 ring-cyan-300 z-20'
                            : isCurrentlyPlaying && isPlaying
                            ? 'border-cyan-400 bg-cyan-950/70 shadow-[0_0_15px_rgba(6,182,212,0.45)] ring-2 ring-cyan-400/80 z-10'
                            : isSelected
                            ? 'border-indigo-500 bg-indigo-950/70 shadow-lg ring-2 ring-indigo-500/40 z-10'
                            : 'border-studio-800 bg-studio-850 hover:border-studio-700'
                        }`}
                        style={{ left: `${leftPx}px`, width: `${widthPx}px` }}
                      >
                        {/* Left Resize Handle (Boundary Push/Pull) */}
                        {idx > 0 && (
                          <div
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setResizingClip({
                                sceneIndex: idx,
                                initialX: e.clientX,
                                initialDuration: scene.duration,
                                initialWidth: widthPx,
                                handle: 'left',
                                currentDeltaSec: 0,
                              });
                            }}
                            className="absolute left-0 top-0 bottom-0 w-2.5 z-30 cursor-ew-resize hover:bg-cyan-500/60 flex items-center justify-center group-hover:opacity-100 opacity-40 transition-all"
                            title="Drag to adjust boundary with previous scene"
                          >
                            <div className="w-0.5 h-6 bg-cyan-300 rounded-full shadow" />
                          </div>
                        )}

                        {/* Background Thumbnail Image */}
                        {imgUrl && (
                          <img
                            src={imgUrl}
                            alt={`Scene ${scene.scene_number}`}
                            className={`absolute inset-0 w-full h-full object-cover transition-all pointer-events-none ${
                              isCurrentlyPlaying && isPlaying ? 'opacity-40 scale-105' : 'opacity-30 group-hover:opacity-40'
                            }`}
                          />
                        )}

                        {/* Clip Header */}
                        <div className="relative z-10 flex items-center justify-between text-[10px]">
                          <div className="flex items-center gap-1">
                            <span className={`font-bold px-1 rounded text-[9px] ${
                              isCurrentlyPlaying && isPlaying ? 'bg-cyan-500 text-black font-extrabold' : 'bg-black/75 text-white'
                            }`}>
                              #{scene.scene_number}
                            </span>
                            {isCurrentlyPlaying && isPlaying && (
                              <span className="bg-red-500 text-white text-[7.5px] font-bold px-1 rounded animate-pulse">
                                LIVE
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-cyan-300 bg-black/75 px-1 rounded text-[9.5px] font-bold">
                            {scene.duration.toFixed(1)}s
                          </span>
                        </div>

                        {/* Script Snippet Line */}
                        <div className="relative z-10 text-[8.5px] text-studio-200 truncate max-w-full font-sans opacity-90 pointer-events-none">
                          {scene.story_text}
                        </div>

                        {/* Clip Footer */}
                        <div className="relative z-10 flex items-center justify-between text-[8.5px]">
                          <span className="text-indigo-300 font-mono truncate max-w-[70px]">
                            {scene.camera_motion?.type.replace('_', ' ')}
                          </span>
                          {scene.transition_in !== 'cut' && (
                            <span className="bg-purple-950/90 border border-purple-500/40 text-purple-300 px-1 rounded text-[8px]">
                              {scene.transition_in}
                            </span>
                          )}
                        </div>

                        {/* Internal Live Progress Bar */}
                        {isCurrentlyPlaying && (
                          <div className="absolute bottom-0 left-0 right-0 h-1 bg-studio-900/80 z-20">
                            <div
                              className="h-full bg-gradient-to-r from-cyan-400 to-indigo-400"
                              style={{ width: `${sceneProgress}%` }}
                            />
                          </div>
                        )}

                        {/* Right Resize Handle (Drag to Extend / Shrink Duration) */}
                        <div
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setResizingClip({
                              sceneIndex: idx,
                              initialX: e.clientX,
                              initialDuration: scene.duration,
                              initialWidth: widthPx,
                              handle: 'right',
                              currentDeltaSec: 0,
                            });
                          }}
                          className="absolute right-0 top-0 bottom-0 w-3 z-30 cursor-ew-resize hover:bg-cyan-500/70 bg-studio-800/40 border-l border-cyan-500/40 flex items-center justify-center group-hover:opacity-100 opacity-70 transition-all shadow-md"
                          title="Drag to stretch/shrink scene duration (kheech ke duration kam / zyada karein)"
                        >
                          <div className="w-0.5 h-4 bg-white/90 rounded-full pointer-events-none" />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Track 2: Voice Narration Audio Track with Waveform & Cues */}
                <div
                  className="relative h-12 bg-studio-900/50 rounded-lg border border-studio-800/80 p-0.5 overflow-hidden"
                  style={{ width: `${trackCanvasWidthPx}px` }}
                >
                  {/* Audio Waveform Background */}
                  <div className="absolute inset-0 flex items-center px-1 pointer-events-none opacity-40">
                    {(() => {
                      const totalBars = Math.max(50, Math.floor(trackCanvasWidthPx / 4));
                      const peaks = currentProject.narration_audio?.waveform_data || [];
                      return Array.from({ length: totalBars }).map((_, bIdx) => {
                        const peakIdx = peaks.length > 0 ? Math.floor((bIdx / totalBars) * peaks.length) : 0;
                        const rawPeak = peaks.length > 0 ? peaks[peakIdx] : Math.abs(Math.sin(bIdx * 0.25) * Math.cos(bIdx * 0.1));
                        const heightPct = Math.max(15, Math.min(95, rawPeak * 100));
                        const barTime = (bIdx / totalBars) * totalDuration;
                        const isPlayed = barTime <= currentTime;

                        return (
                          <div
                            key={bIdx}
                            className="flex-1 mx-[1px] rounded-full transition-colors"
                            style={{
                              height: `${heightPct}%`,
                              backgroundColor: isPlayed ? '#f472b6' : '#64748b',
                            }}
                          />
                        );
                      });
                    })()}
                  </div>

                  {/* Overlaid Subtitle & Speech Cues */}
                  {currentProject.subtitles && currentProject.subtitles.length > 0 ? (
                    currentProject.subtitles.map((cue, idx) => {
                      const leftPx = cue.start_time * pxPerSec;
                      const widthPx = Math.max(24, (cue.end_time - cue.start_time) * pxPerSec);
                      const isCueActive = currentTime >= cue.start_time && currentTime <= cue.end_time;

                      return (
                        <div
                          key={cue.id || idx}
                          onClick={() => seekTo(cue.start_time)}
                          className={`absolute top-0.5 bottom-0.5 rounded px-1.5 flex items-center justify-between text-[10px] cursor-pointer overflow-hidden transition-all backdrop-blur-[2px] ${
                            isCueActive && isPlaying
                              ? 'bg-pink-900/85 border-2 border-pink-400 text-white shadow-md z-10 font-bold'
                              : 'bg-pink-950/45 border border-pink-500/35 hover:border-pink-400 text-pink-200 hover:bg-pink-950/60'
                          }`}
                          style={{ left: `${leftPx}px`, width: `${widthPx}px` }}
                          title={`"${cue.text}" (${cue.start_time.toFixed(1)}s - ${cue.end_time.toFixed(1)}s)`}
                        >
                          <span className="truncate font-medium">{cue.text}</span>
                          <span className="text-[8.5px] font-mono opacity-75 shrink-0 pl-1">
                            {(cue.end_time - cue.start_time).toFixed(1)}s
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-[10px] text-studio-400 pl-3 font-mono relative z-10 flex items-center h-full">
                      🎙️ Continuous Voice Narration Track ({formatTimecode(totalDuration)})
                    </div>
                  )}
                </div>

                {/* Track 3: Background Music Track */}
                <div
                  className="relative h-11 bg-studio-900/50 rounded-lg border border-studio-800/80 p-0.5 overflow-hidden"
                  style={{ width: `${trackCanvasWidthPx}px` }}
                >
                  {currentProject.background_music?.file_path ? (
                    <div
                      className="h-full rounded-md bg-emerald-950/50 border border-emerald-500/40 px-3 flex items-center justify-between text-xs text-emerald-200"
                    >
                      <div className="flex items-center gap-2">
                        <Music className="w-3 h-3 text-emerald-400" />
                        <span className="font-semibold text-[10.5px]">
                          {currentProject.background_music.file_path.split(/[\\/]/).pop()}
                        </span>
                        <Badge variant="success" className="text-[8.5px] py-0 px-1">Auto-Ducking Active (-18dB)</Badge>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[9.5px] text-studio-400">Vol:</span>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={bgmVolume}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setBgmVolume(val);
                            if (bgmAudioRef.current) bgmAudioRef.current.volume = val;
                          }}
                          className="w-14 h-1 bg-studio-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => bgmInputRef.current?.click()}
                      className="h-full rounded-md border border-dashed border-studio-700 hover:border-emerald-500/50 px-3 flex items-center justify-center gap-1.5 text-xs text-studio-400 hover:text-emerald-300 cursor-pointer transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Click to add background music soundtrack</span>
                    </div>
                  )}
                </div>

                {/* 3. RED PLAYHEAD SCRUBBER LINE ACROSS ALL TRACKS */}
                <div
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setIsScrubbingPlayhead(true);
                  }}
                  className="absolute top-0 bottom-0 w-1 bg-red-500 z-40 flex flex-col items-center cursor-ew-resize group pointer-events-auto"
                  style={{ left: `${currentTime * pxPerSec}px` }}
                >
                  <div className="w-3.5 h-3.5 bg-red-500 rounded-full -mt-1 shadow-lg shadow-red-500/80 flex items-center justify-center group-hover:scale-125 transition-transform cursor-grab">
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  </div>
                  {/* Playhead Timecode Bubble */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/95 border border-red-500/50 text-red-300 text-[9.5px] font-mono px-1.5 py-0.2 rounded shadow-lg -mt-5 pointer-events-none whitespace-nowrap font-bold">
                    {formatTimecode(currentTime)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Tooltip Indicator while Drag-Trimming */}
      {resizingClip && (
        <div className="fixed bottom-12 right-12 z-50 bg-cyan-950 border border-cyan-400 px-4 py-2.5 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-2.5 text-white text-xs font-bold animate-pulse">
          <Sparkles className="w-4 h-4 text-cyan-300" />
          <span>
            Resizing Scene #{scenes[resizingClip.sceneIndex]?.scene_number}:{' '}
            <span className="text-cyan-300">{scenes[resizingClip.sceneIndex]?.duration.toFixed(1)}s</span>{' '}
            ({resizingClip.currentDeltaSec >= 0 ? '+' : ''}{resizingClip.currentDeltaSec.toFixed(1)}s)
          </span>
        </div>
      )}
    </div>
  );
};

