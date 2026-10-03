import React, { useState, useEffect } from 'react';
import {
  Film,
  Plus,
  FolderOpen,
  Sparkles,
  Sliders,
  Layers,
  Wand2,
  ChevronRight,
  Activity,
  Download,
  Settings as SettingsIcon,
  Play
} from 'lucide-react';
import { useProject } from './context/ProjectContext';
import { useSettings } from './context/SettingsContext';
import { Header } from './components/layout/Header';
import { StepNavigation } from './components/layout/StepNavigation';
import { StatusBar } from './components/layout/StatusBar';
import { NewProjectModal } from './components/modals/NewProjectModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { ProjectListModal } from './components/modals/ProjectListModal';
import { Step1ProjectInput } from './components/steps/Step1ProjectInput';
import { Step2Alignment } from './components/steps/Step2Alignment';
import { Step3Scenes } from './components/steps/Step3Scenes';
import { Step4Images } from './components/steps/Step4Images';
import { Step5Timeline } from './components/steps/Step5Timeline';
import { Step6Subtitles } from './components/steps/Step6Subtitles';
import { Step7Export } from './components/steps/Step7Export';
import { Button } from './components/common/Button';
import { Card } from './components/common/Card';
import { Badge } from './components/common/Badge';

export const App: React.FC = () => {
  const {
    currentProject,
    currentStep,
    projectsList,
    loadProject,
    saveCurrentProject,
    undo,
    redo,
  } = useProject();

  const { settings } = useSettings();

  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProjectListOpen, setIsProjectListOpen] = useState(false);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Save: Ctrl+S or Cmd+S
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveCurrentProject();
      }
      // Undo: Ctrl+Z or Cmd+Z
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        undo();
      }
      // Redo: Ctrl+Y or Cmd+Shift+Z
      if (
        ((e.ctrlKey || e.metaKey) && e.key === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')
      ) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveCurrentProject, undo, redo]);

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1ProjectInput />;
      case 2:
        return <Step2Alignment />;
      case 3:
        return <Step3Scenes />;
      case 4:
        return <Step4Images />;
      case 5:
        return <Step5Timeline />;
      case 6:
        return <Step6Subtitles />;
      case 7:
        return <Step7Export />;
      default:
        return <Step1ProjectInput />;
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-studio-950 text-studio-100 select-none overflow-hidden font-sans">
      {/* Top Header */}
      <Header
        onOpenNewProject={() => setIsNewProjectOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenProjectList={() => setIsProjectListOpen(true)}
      />

      {/* Main Studio Area */}
      {currentProject ? (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <StepNavigation />
          <main className="flex-1 min-h-0 relative overflow-hidden bg-studio-950/60">
            {renderCurrentStep()}
          </main>
        </div>
      ) : (
        /* Welcome & Project Hub Screen */
        <main className="flex-1 overflow-y-auto p-8 flex items-center justify-center">
          <div className="max-w-4xl w-full space-y-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Hero Header */}
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                <span>Next-Gen AI Story-to-Video Desktop Suite</span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
                Welcome to{' '}
                <span className="text-gradient">StoryReel Studio</span>
              </h1>
              <p className="text-sm text-studio-400 max-w-xl mx-auto leading-relaxed">
                Transform any written story and narration audio into a cinematic video with AI image generation, consistent character bibles, Ken Burns motion, and karaoke-synced subtitles.
              </p>
            </div>

            {/* Action Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                onClick={() => setIsNewProjectOpen(true)}
                className="group p-6 rounded-2xl bg-gradient-to-br from-indigo-950/80 via-studio-900 to-studio-900 border border-indigo-500/30 hover:border-indigo-500/70 shadow-xl hover:shadow-glow-brand transition-all duration-200 cursor-pointer flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/40 group-hover:scale-110 transition-transform">
                    <Plus className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white group-hover:text-indigo-200 transition-colors">
                      Create New Project
                    </h3>
                    <p className="text-xs text-studio-400 mt-1 leading-relaxed">
                      Start fresh: paste your story script in Hindi or English, attach audio, select visual style bible, and customize character descriptions.
                    </p>
                  </div>
                </div>
                <div className="flex items-center text-xs font-bold text-indigo-400 group-hover:text-indigo-300 gap-1 mt-6">
                  <span>Launch Project Wizard</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              <div
                onClick={() => setIsProjectListOpen(true)}
                className="group p-6 rounded-2xl bg-studio-900 border border-studio-800 hover:border-studio-700 hover:bg-studio-850/80 transition-all duration-200 cursor-pointer flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-studio-800 border border-studio-700 flex items-center justify-center text-studio-200 group-hover:scale-110 transition-transform">
                    <FolderOpen className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white group-hover:text-purple-200 transition-colors">
                      Open Existing Project
                    </h3>
                    <p className="text-xs text-studio-400 mt-1 leading-relaxed">
                      Resume editing your stories ({projectsList.length} saved {projectsList.length === 1 ? 'project' : 'projects'} found in local workspace).
                    </p>
                  </div>
                </div>
                <div className="flex items-center text-xs font-bold text-purple-400 group-hover:text-purple-300 gap-1 mt-6">
                  <span>Browse Projects</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>

            {/* Recent Projects Preview if any */}
            {projectsList.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs text-studio-400 font-semibold uppercase tracking-wider">
                  <span>Recent Projects</span>
                  <button
                    onClick={() => setIsProjectListOpen(true)}
                    className="text-indigo-400 hover:text-indigo-300 underline lowercase"
                  >
                    view all ({projectsList.length})
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {projectsList.slice(0, 3).map((p) => (
                    <div
                      key={p.id}
                      onClick={() => loadProject(p.id)}
                      className="p-3.5 rounded-xl bg-studio-900/80 hover:bg-studio-850 border border-studio-800 hover:border-indigo-500/40 cursor-pointer transition-all flex flex-col justify-between group"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-studio-100 group-hover:text-indigo-300 truncate">
                            {p.name}
                          </h4>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-studio-800 text-studio-400 font-mono">
                            {p.aspect_ratio}
                          </span>
                        </div>
                        <p className="text-[11px] text-studio-500">
                          {p.scene_count} scenes • {p.language}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Feature Checklist */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-studio-800/80 text-center">
              <div className="p-3 rounded-xl bg-studio-900/40 border border-studio-800/60 space-y-1">
                <Activity className="w-4 h-4 text-cyan-400 mx-auto" />
                <h5 className="text-xs font-bold text-studio-200">Whisper Sync</h5>
                <p className="text-[10px] text-studio-500">Word-level Hindi/English alignment</p>
              </div>
              <div className="p-3 rounded-xl bg-studio-900/40 border border-studio-800/60 space-y-1">
                <Layers className="w-4 h-4 text-purple-400 mx-auto" />
                <h5 className="text-xs font-bold text-studio-200">Character Bible</h5>
                <p className="text-[10px] text-studio-500">Consistent facial & outfit prompts</p>
              </div>
              <div className="p-3 rounded-xl bg-studio-900/40 border border-studio-800/60 space-y-1">
                <Sliders className="w-4 h-4 text-indigo-400 mx-auto" />
                <h5 className="text-xs font-bold text-studio-200">Ken Burns Motion</h5>
                <p className="text-[10px] text-studio-500">Cinematic pans, zooms & cuts</p>
              </div>
              <div className="p-3 rounded-xl bg-studio-900/40 border border-studio-800/60 space-y-1">
                <Download className="w-4 h-4 text-emerald-400 mx-auto" />
                <h5 className="text-xs font-bold text-studio-200">FFmpeg 4K Engine</h5>
                <p className="text-[10px] text-studio-500">Hardware accelerated export</p>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* Bottom Status Bar */}
      <StatusBar />

      {/* Global Modals */}
      <NewProjectModal
        isOpen={isNewProjectOpen}
        onClose={() => setIsNewProjectOpen(false)}
      />
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
      <ProjectListModal
        isOpen={isProjectListOpen}
        onClose={() => setIsProjectListOpen(false)}
        onOpenNewProject={() => setIsNewProjectOpen(true)}
      />
    </div>
  );
};
