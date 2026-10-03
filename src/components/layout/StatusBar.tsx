import React from 'react';
import { Radio, HardDrive, Clapperboard, Clock, Cpu } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { useSettings } from '../../context/SettingsContext';

export const StatusBar: React.FC = () => {
  const { currentProject } = useProject();
  const { systemStatus, settings } = useSettings();

  const totalDuration = currentProject
    ? currentProject.scenes.reduce((acc, s) => acc + (s.duration || 0), 0) ||
      currentProject.narration_audio.duration ||
      0
    : 0;

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <footer className="h-7 bg-studio-950 border-t border-studio-800/80 px-4 flex items-center justify-between text-[11px] text-studio-400 font-medium select-none z-20">
      {/* Left: Backend & Engine Diagnostics */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div
            className={`w-2 h-2 rounded-full ${
              systemStatus.backendOnline ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-rose-500'
            }`}
          />
          <span className={systemStatus.backendOnline ? 'text-studio-300' : 'text-rose-400'}>
            {systemStatus.backendOnline ? 'AI Backend 127.0.0.1:8765' : 'Backend Disconnected'}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-studio-500" />
          <span className={systemStatus.ffmpeg ? 'text-studio-300' : 'text-amber-400'}>
            {systemStatus.ffmpeg ? 'FFmpeg Ready' : 'FFmpeg Not Found'}
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 text-studio-500">
          <HardDrive className="w-3.5 h-3.5" />
          <span>LLM: {settings.llm_provider.toUpperCase()}</span>
        </div>
      </div>

      {/* Right: Project Telemetry */}
      {currentProject ? (
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Clapperboard className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-studio-300">
              {currentProject.scenes.length} Scenes
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-studio-300 font-mono">
              {formatDuration(totalDuration)}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-2 font-mono text-studio-400">
            <span>{currentProject.resolution_preset}</span>
            <span>•</span>
            <span>{currentProject.fps} FPS</span>
            <span>•</span>
            <span className="uppercase text-indigo-400">{currentProject.language}</span>
          </div>
        </div>
      ) : (
        <span className="text-studio-500">No project open</span>
      )}
    </footer>
  );
};
