import React from 'react';
import {
  Film,
  FolderOpen,
  Plus,
  Save,
  Settings as SettingsIcon,
  Undo2,
  Redo2,
  Sparkles,
  CheckCircle2,
  Clock,
  ChevronRight,
  Globe
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { useSettings } from '../../context/SettingsContext';
import { Button } from '../common/Button';

interface HeaderProps {
  onOpenNewProject: () => void;
  onOpenSettings: () => void;
  onOpenProjectList: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenNewProject,
  onOpenSettings,
  onOpenProjectList,
}) => {
  const {
    currentProject,
    isSaving,
    lastSaved,
    isDirty,
    undo,
    redo,
    canUndo,
    canRedo,
    saveCurrentProject,
  } = useProject();

  const { settings, updateSettings } = useSettings();

  const toggleLanguage = () => {
    updateSettings({
      ui_language: settings.ui_language === 'en' ? 'hi' : 'en',
    });
  };

  return (
    <header className="h-14 bg-studio-900/95 border-b border-studio-800/80 px-4 flex items-center justify-between z-30 select-none backdrop-blur-md">
      {/* Left: Brand & Project Selector */}
      <div className="flex items-center gap-3">
        <div
          onClick={onOpenProjectList}
          className="flex items-center gap-2.5 cursor-pointer group px-2 py-1.5 rounded-xl hover:bg-studio-800/60 transition-colors"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-md shadow-indigo-600/30 group-hover:scale-105 transition-transform">
            <Film className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm tracking-tight text-gradient">
                StoryReel
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30">
                Studio
              </span>
            </div>
          </div>
        </div>

        {currentProject && (
          <>
            <ChevronRight className="w-4 h-4 text-studio-600" />
            <div className="flex items-center gap-2 max-w-xs">
              <span
                className="text-sm font-semibold text-studio-200 truncate cursor-pointer hover:text-indigo-300 transition-colors"
                onClick={onOpenProjectList}
                title={currentProject.name}
              >
                {currentProject.name}
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-studio-800 text-studio-400 border border-studio-700 font-mono">
                {currentProject.aspect_ratio}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Center: Save Status & Undo/Redo */}
      <div className="flex items-center gap-2">
        {currentProject && (
          <>
            <div className="flex items-center gap-1 bg-studio-850 border border-studio-700/60 rounded-xl p-0.5 mr-2">
              <button
                onClick={undo}
                disabled={!canUndo}
                className="p-1.5 text-studio-400 hover:text-studio-100 disabled:opacity-30 rounded-lg hover:bg-studio-800 transition-all"
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                className="p-1.5 text-studio-400 hover:text-studio-100 disabled:opacity-30 rounded-lg hover:bg-studio-800 transition-all"
                title="Redo (Ctrl+Y)"
              >
                <Redo2 className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-xl bg-studio-850/80 border border-studio-800 text-studio-400">
              {isSaving ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  <span className="text-amber-300">Saving...</span>
                </>
              ) : isDirty ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Unsaved changes</span>
                  <button
                    onClick={() => saveCurrentProject()}
                    className="ml-1 text-indigo-400 hover:text-indigo-300 underline font-semibold"
                  >
                    Save now
                  </button>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-studio-300">
                    {lastSaved
                      ? `Saved ${lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                      : 'Autosaved'}
                  </span>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Right: Actions & Settings */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleLanguage}
          className="px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-studio-850 hover:bg-studio-800 text-studio-300 border border-studio-700/60 flex items-center gap-1.5 transition-colors"
          title="Toggle Language"
        >
          <Globe className="w-3.5 h-3.5 text-indigo-400" />
          <span>{settings.ui_language === 'en' ? 'EN' : 'हिन्दी'}</span>
        </button>

        <Button
          variant="secondary"
          size="sm"
          leftIcon={<FolderOpen className="w-4 h-4 text-studio-400" />}
          onClick={onOpenProjectList}
        >
          Projects
        </Button>

        <Button
          variant="glow"
          size="sm"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={onOpenNewProject}
        >
          New Project
        </Button>

        <button
          onClick={onOpenSettings}
          className="p-2 text-studio-400 hover:text-studio-100 hover:bg-studio-800/80 rounded-xl transition-colors"
          title="Settings"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
