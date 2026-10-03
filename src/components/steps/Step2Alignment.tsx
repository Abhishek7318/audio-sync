import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Activity,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Plus,
  Minus,
  Scissors,
  Merge,
  Clock,
  Music,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  FileText
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { SubtitleCue, WordTimestamp } from '../../types';
import { api } from '../../services/api';

export const Step2Alignment: React.FC = () => {
  const { currentProject, updateCurrentProject, setStep, saveCurrentProject } = useProject();
  const { settings } = useSettings();
  const { showToast } = useToast();

  // Audio Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1); // 1x to 4x

  // Alignment Job State
  const [isAligning, setIsAligning] = useState(false);
  const [alignProgress, setAlignProgress] = useState(0);
  const [alignMessage, setAlignMessage] = useState('');
  const [activeCueId, setActiveCueId] = useState<string | null>(null);

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  if (!currentProject) return null;

  const audioTrack = currentProject.narration_audio;
  const cues: SubtitleCue[] = currentProject.subtitles || [];
  const waveformPeaks = audioTrack.waveform_data || [];

  // Construct audio source URL
  const audioSrc = audioTrack.file_path
    ? api.getAssetUrl(
        currentProject.id,
        'audio',
        audioTrack.file_path.split(/[\\/]/).pop() || 'narration_audio.mp3'
      )
    : undefined;

  // Initialize or update duration
  useEffect(() => {
    if (audioTrack.duration > 0) {
      setDuration(audioTrack.duration);
    }
  }, [audioTrack.duration]);

  // Audio time update loop
  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const time = audioRef.current.currentTime;
    setCurrentTime(time);

    // Find active cue
    const active = cues.find((c) => time >= c.start_time && time <= c.end_time);
    setActiveCueId(active ? active.id : null);
  };

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch((err) => {
        console.error('Audio playback failed:', err);
      });
      setIsPlaying(true);
    }
  };

  const seekTo = (time: number) => {
    const clamped = Math.max(0, Math.min(duration || 100, time));
    if (audioRef.current) {
      audioRef.current.currentTime = clamped;
    }
    setCurrentTime(clamped);
  };

  const playCueClip = (cue: SubtitleCue) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = cue.start_time;
    audioRef.current.play();
    setIsPlaying(true);

    const checkEnd = () => {
      if (audioRef.current && audioRef.current.currentTime >= cue.end_time) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else if (isPlaying) {
        requestAnimationFrame(checkEnd);
      }
    };
    requestAnimationFrame(checkEnd);
  };

  // Render Waveform Canvas
  useEffect(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const peaks = waveformPeaks.length > 0 ? waveformPeaks : Array(200).fill(0.2);
    const totalPeaks = peaks.length;
    const barWidth = Math.max(2, (width / totalPeaks) * zoomLevel);
    const gap = 1.5;

    // Draw background grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Draw Waveform Bars
    peaks.forEach((peak, index) => {
      const x = index * (barWidth + gap);
      if (x > width) return;

      const barHeight = Math.max(3, peak * (height * 0.78));
      const y = (height - barHeight) / 2;

      // Check if this peak is before current playhead
      const peakTime = (index / totalPeaks) * (duration || 1);
      const isPlayed = peakTime <= currentTime;

      const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
      if (isPlayed) {
        gradient.addColorStop(0, '#818cf8'); // indigo-400
        gradient.addColorStop(1, '#c084fc'); // purple-400
      } else {
        gradient.addColorStop(0, '#38415c'); // studio-600
        gradient.addColorStop(1, '#262c40'); // studio-700
      }

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 2);
      ctx.fill();
    });

    // Draw Sentence Boundary Markers
    cues.forEach((cue, index) => {
      if (!duration) return;
      const startX = (cue.start_time / duration) * width;
      const endX = (cue.end_time / duration) * width;

      // Draw active segment highlight
      if (currentTime >= cue.start_time && currentTime <= cue.end_time) {
        ctx.fillStyle = 'rgba(99, 102, 241, 0.15)';
        ctx.fillRect(startX, 0, endX - startX, height);
      }

      // Start marker line
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 2]);
      ctx.beginPath();
      ctx.moveTo(startX, 0);
      ctx.lineTo(startX, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label
      ctx.fillStyle = '#a5b4fc';
      ctx.font = '10px sans-serif';
      ctx.fillText(`${index + 1}`, startX + 4, 14);
    });

    // Draw Playhead Line
    if (duration > 0) {
      const playheadX = (currentTime / duration) * width;
      ctx.strokeStyle = '#38bdf8'; // cyan-400
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();

      // Playhead handle
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(playheadX, 6, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [currentTime, duration, waveformPeaks, cues, zoomLevel]);

  // Handle Waveform Canvas Click / Scrubbing
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = waveformCanvasRef.current;
    if (!canvas || !duration) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const targetPercent = clickX / rect.width;
    const targetTime = targetPercent * duration;
    seekTo(targetTime);
  };

  // Run Speech Alignment (Whisper or Heuristic)
  const handleRunAlignment = async (useWhisperApi: boolean = false) => {
    try {
      setIsAligning(true);
      setAlignProgress(15);
      setAlignMessage('Initializing speech alignment engine...');

      const res = await api.alignAudio(currentProject.id, {
        story_text: currentProject.story_raw_text,
        use_whisper_api: useWhisperApi,
        mode: useWhisperApi ? 'whisper_api' : 'auto',
      });

      // Poll job progress
      const jobId = res.job_id;
      const pollInterval = setInterval(async () => {
        try {
          const job = await api.getJob(jobId);
          setAlignProgress(job.progress);
          setAlignMessage(job.message);

          if (job.status === 'completed') {
            clearInterval(pollInterval);
            setIsAligning(false);
            if (job.result?.cues) {
              updateCurrentProject((prev) => ({
                ...prev,
                subtitles: job.result.cues,
                narration_audio: { ...prev.narration_audio, aligned: true },
              }));
            }
            showToast('Speech alignment completed successfully!', 'success');
          } else if (job.status === 'failed') {
            clearInterval(pollInterval);
            setIsAligning(false);
            showToast(`Alignment failed: ${job.error}`, 'error');
          }
        } catch (err) {
          clearInterval(pollInterval);
          setIsAligning(false);
        }
      }, 500);
    } catch (err: any) {
      setIsAligning(false);
      showToast(`Error starting alignment: ${err.message}`, 'error');
    }
  };

  // Timestamp Nudge & Edit Handlers
  const handleNudge = (cueId: string, type: 'start' | 'end', delta: number) => {
    updateCurrentProject((prev) => ({
      ...prev,
      subtitles: prev.subtitles.map((cue) => {
        if (cue.id === cueId) {
          const newStart = type === 'start' ? Math.max(0, cue.start_time + delta) : cue.start_time;
          const newEnd = type === 'end' ? Math.max(newStart + 0.2, cue.end_time + delta) : cue.end_time;
          return {
            ...cue,
            start_time: round2(newStart),
            end_time: round2(newEnd),
          };
        }
        return cue;
      }),
    }));
  };

  const handleUpdateCueText = (cueId: string, newText: string) => {
    updateCurrentProject((prev) => ({
      ...prev,
      subtitles: prev.subtitles.map((c) =>
        c.id === cueId ? { ...c, text: newText } : c
      ),
    }));
  };

  const handleSplitCue = (cueId: string) => {
    const cue = cues.find((c) => c.id === cueId);
    if (!cue) return;
    const words = cue.text.split(' ');
    if (words.length < 2) return;

    const mid = Math.ceil(words.length / 2);
    const text1 = words.slice(0, mid).join(' ');
    const text2 = words.slice(mid).join(' ');
    const midTime = (cue.start_time + cue.end_time) / 2;

    const newCue1: SubtitleCue = {
      id: cue.id,
      start_time: cue.start_time,
      end_time: round2(midTime),
      text: text1,
      words: [],
    };
    const newCue2: SubtitleCue = {
      id: Math.random().toString(36).substring(2, 9),
      start_time: round2(midTime),
      end_time: cue.end_time,
      text: text2,
      words: [],
    };

    updateCurrentProject((prev) => ({
      ...prev,
      subtitles: prev.subtitles.flatMap((c) => (c.id === cueId ? [newCue1, newCue2] : [c])),
    }));
    showToast('Sentence cue split into two', 'info');
  };

  const handleMergeNext = (cueIndex: number) => {
    if (cueIndex >= cues.length - 1) return;
    const c1 = cues[cueIndex];
    const c2 = cues[cueIndex + 1];

    const mergedCue: SubtitleCue = {
      id: c1.id,
      start_time: c1.start_time,
      end_time: c2.end_time,
      text: `${c1.text} ${c2.text}`,
      words: [...c1.words, ...c2.words],
    };

    updateCurrentProject((prev) => {
      const nextCues = [...prev.subtitles];
      nextCues.splice(cueIndex, 2, mergedCue);
      return { ...prev, subtitles: nextCues };
    });
    showToast('Merged with next sentence', 'info');
  };

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  const round2 = (num: number) => Math.round(num * 100) / 100;

  const handleProceed = () => {
    saveCurrentProject();
    setStep(3);
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6 overflow-y-auto h-full pb-20">
      {/* Hidden Audio Element */}
      <audio
        ref={audioRef}
        src={audioSrc}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (d && !isNaN(d)) setDuration(d);
        }}
      />

      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-studio-900 border border-indigo-500/20 p-5 rounded-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">
              Step 2: Speech Alignment & Waveform Sync
            </h1>
            {audioTrack.aligned ? (
              <Badge variant="success" icon={<CheckCircle2 className="w-3 h-3" />}>
                Aligned
              </Badge>
            ) : (
              <Badge variant="warning">Pending Alignment</Badge>
            )}
          </div>
          <p className="text-xs text-studio-400 max-w-2xl">
            Synchronize every sentence and word with exact timestamps. Play the audio, inspect timestamps, and nudge boundaries.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="md"
            leftIcon={<ArrowLeft className="w-4 h-4" />}
            onClick={() => setStep(1)}
          >
            Back to Step 1
          </Button>
          <Button
            variant="glow"
            size="md"
            rightIcon={<ArrowRight className="w-4 h-4" />}
            onClick={handleProceed}
          >
            Proceed to Scenes
          </Button>
        </div>
      </div>

      {/* Alignment Action Card / Trigger */}
      <Card variant="glass" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-studio-100">
                AI Speech Alignment Engine
              </h3>
              <p className="text-xs text-studio-400">
                Generates exact start/end timestamps for {cues.length || 'story'} sentences.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleRunAlignment(false)}
              isLoading={isAligning}
              leftIcon={<Sparkles className="w-4 h-4 text-cyan-400" />}
            >
              Smart Cadence Align (Free)
            </Button>

            <Button
              variant="glow"
              size="sm"
              onClick={() => handleRunAlignment(true)}
              isLoading={isAligning}
              leftIcon={<Activity className="w-4 h-4 text-white" />}
            >
              Run Whisper Sync (Word-Level)
            </Button>
          </div>
        </div>

        {/* Alignment Progress Bar */}
        {isAligning && (
          <div className="space-y-2 pt-2 border-t border-studio-800 animate-in fade-in">
            <div className="flex items-center justify-between text-xs">
              <span className="text-indigo-300 font-medium">{alignMessage}</span>
              <span className="text-studio-400 font-mono">{Math.round(alignProgress)}%</span>
            </div>
            <div className="w-full bg-studio-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 h-full transition-all duration-300 rounded-full"
                style={{ width: `${alignProgress}%` }}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Waveform Visualizer & Audio Player */}
      <Card variant="glass" className="space-y-4">
        <div className="flex items-center justify-between text-xs text-studio-400">
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-purple-400" />
            <span className="font-semibold text-studio-200">
              {audioTrack.original_filename || 'Narration Audio'}
            </span>
            <span>•</span>
            <span className="font-mono text-indigo-300 font-semibold">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoomLevel((prev) => Math.max(1, prev - 0.5))}
              className="p-1.5 text-studio-400 hover:text-studio-200 hover:bg-studio-800 rounded-lg transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] text-studio-400">{zoomLevel}x</span>
            <button
              onClick={() => setZoomLevel((prev) => Math.min(4, prev + 0.5))}
              className="p-1.5 text-studio-400 hover:text-studio-200 hover:bg-studio-800 rounded-lg transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Waveform Canvas */}
        <div className="relative w-full h-32 bg-studio-900/90 rounded-xl border border-studio-800 overflow-hidden cursor-crosshair group">
          <canvas
            ref={waveformCanvasRef}
            width={1100}
            height={128}
            onClick={handleCanvasClick}
            className="w-full h-full block"
          />
        </div>

        {/* Audio Player Controls */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => seekTo(currentTime - 5)}
              className="p-2 text-studio-400 hover:text-studio-100 hover:bg-studio-800 rounded-xl transition-colors"
              title="Rewind 5s"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={togglePlayPause}
              className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 active:scale-95 transition-all"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>

            <button
              onClick={() => seekTo(currentTime + 5)}
              className="p-2 text-studio-400 hover:text-studio-100 hover:bg-studio-800 rounded-xl transition-colors"
              title="Forward 5s"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          {/* Volume Control */}
          <div className="flex items-center gap-2 text-studio-400">
            <button
              onClick={() => {
                if (audioRef.current) {
                  audioRef.current.muted = !isMuted;
                  setIsMuted(!isMuted);
                }
              }}
              className="p-1.5 hover:text-studio-200"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setVolume(val);
                if (audioRef.current) audioRef.current.volume = val;
                setIsMuted(false);
              }}
              className="w-20 accent-indigo-500 h-1 bg-studio-800 rounded-lg cursor-pointer"
            />
          </div>
        </div>
      </Card>

      {/* Sentence Segments & Karaoke Transcript Editor */}
      <Card variant="glass" className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-studio-100 uppercase tracking-wide">
              Sentence Alignment & Karaoke Cues ({cues.length} segments)
            </h3>
          </div>
          <span className="text-xs text-studio-400">
            Click any sentence play button to isolate & listen
          </span>
        </div>

        {cues.length === 0 ? (
          <div className="p-8 text-center bg-studio-900/60 rounded-xl border border-dashed border-studio-800 space-y-3">
            <Activity className="w-8 h-8 text-studio-600 mx-auto" />
            <p className="text-xs text-studio-400">
              No alignment cues generated yet. Click "Smart Cadence Align" or "Run Whisper Sync" above.
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {cues.map((cue, index) => {
              const isActive = activeCueId === cue.id;
              const cueDuration = round2(cue.end_time - cue.start_time);

              return (
                <div
                  key={cue.id}
                  className={`p-4 rounded-xl border transition-all duration-150 space-y-3 ${
                    isActive
                      ? 'bg-indigo-950/40 border-indigo-500/60 shadow-glow-brand ring-1 ring-indigo-500/30'
                      : 'bg-studio-850/60 border-studio-800 hover:border-studio-700'
                  }`}
                >
                  {/* Top Row: Sentence index, Text, Play Clip button */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 flex-1">
                      <div className="w-6 h-6 rounded-lg bg-studio-800 border border-studio-700 flex items-center justify-center text-xs font-bold text-studio-300 shrink-0">
                        {index + 1}
                      </div>

                      <input
                        type="text"
                        value={cue.text}
                        onChange={(e) => handleUpdateCueText(cue.id, e.target.value)}
                        className="flex-1 bg-transparent border-b border-transparent focus:border-indigo-500 text-sm text-studio-100 font-medium focus:outline-none px-1 py-0.5"
                      />
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => playCueClip(cue)}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Play Clip</span>
                      </button>

                      <button
                        onClick={() => handleSplitCue(cue.id)}
                        className="p-1.5 text-studio-400 hover:text-studio-100 hover:bg-studio-800 rounded-lg transition-colors"
                        title="Split sentence at halfway mark"
                      >
                        <Scissors className="w-3.5 h-3.5" />
                      </button>

                      {index < cues.length - 1 && (
                        <button
                          onClick={() => handleMergeNext(index)}
                          className="p-1.5 text-studio-400 hover:text-studio-100 hover:bg-studio-800 rounded-lg transition-colors"
                          title="Merge with next sentence"
                        >
                          <Merge className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Word-level karaoke pills (if available) */}
                  {cue.words && cue.words.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {cue.words.map((w, wIdx) => {
                        const isWordActive = currentTime >= w.start && currentTime <= w.end;
                        return (
                          <span
                            key={wIdx}
                            onClick={() => seekTo(w.start)}
                            className={`px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer transition-all ${
                              isWordActive
                                ? 'bg-amber-400/20 text-amber-300 border border-amber-400/50 font-bold scale-105'
                                : 'bg-studio-900 text-studio-400 hover:text-studio-200 border border-studio-800'
                            }`}
                            title={`${w.start}s - ${w.end}s`}
                          >
                            {w.word}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Bottom Row: Timestamp nudgers */}
                  <div className="flex items-center justify-between text-xs text-studio-400 pt-2 border-t border-studio-800/60 font-mono">
                    {/* Start Time Nudge */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] uppercase tracking-wider text-studio-500 font-sans">
                        Start:
                      </span>
                      <button
                        onClick={() => handleNudge(cue.id, 'start', -0.1)}
                        className="p-1 rounded bg-studio-900 hover:bg-studio-800 border border-studio-800"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-studio-200 font-bold px-1">{cue.start_time.toFixed(2)}s</span>
                      <button
                        onClick={() => handleNudge(cue.id, 'start', 0.1)}
                        className="p-1 rounded bg-studio-900 hover:bg-studio-800 border border-studio-800"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* End Time Nudge */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] uppercase tracking-wider text-studio-500 font-sans">
                        End:
                      </span>
                      <button
                        onClick={() => handleNudge(cue.id, 'end', -0.1)}
                        className="p-1 rounded bg-studio-900 hover:bg-studio-800 border border-studio-800"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-studio-200 font-bold px-1">{cue.end_time.toFixed(2)}s</span>
                      <button
                        onClick={() => handleNudge(cue.id, 'end', 0.1)}
                        className="p-1 rounded bg-studio-900 hover:bg-studio-800 border border-studio-800"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Duration Badge */}
                    <div className="text-indigo-400 font-semibold font-sans text-xs">
                      Duration: {cueDuration}s
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};
