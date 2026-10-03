import React from 'react';
import {
  FolderOpen,
  Plus,
  Trash2,
  Copy,
  Clock,
  ExternalLink,
  Film,
  Calendar,
  Languages
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useProject } from '../../context/ProjectContext';
import { electronBridge } from '../../services/electronBridge';

interface ProjectListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenNewProject: () => void;
}

export const ProjectListModal: React.FC<ProjectListModalProps> = ({
  isOpen,
  onClose,
  onOpenNewProject,
}) => {
  const {
    projectsList,
    loadingProjects,
    loadProject,
    deleteProject,
    duplicateProject,
    currentProject,
  } = useProject();

  const handleOpen = async (id: string) => {
    await loadProject(id);
    onClose();
  };

  const handleOpenFolder = (dirPath: string) => {
    electronBridge.openFolder(dirPath);
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="StoryReel Projects"
      subtitle="Manage, duplicate, open, and review your local story video projects"
      maxWidth="3xl"
    >
      <div className="space-y-4">
        {/* Header Action */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-studio-400">
            {projectsList.length} {projectsList.length === 1 ? 'Project' : 'Projects'} in workspace
          </span>
          <Button
            variant="glow"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => {
              onClose();
              onOpenNewProject();
            }}
          >
            New Project
          </Button>
        </div>

        {/* Project Cards List */}
        <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
          {loadingProjects ? (
            <div className="py-12 text-center text-studio-400">
              <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2" />
              <span>Loading projects...</span>
            </div>
          ) : projectsList.length === 0 ? (
            <div className="py-16 text-center bg-studio-850/40 rounded-2xl border border-dashed border-studio-800 p-8">
              <Film className="w-12 h-12 text-studio-600 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-studio-200">No Projects Yet</h4>
              <p className="text-xs text-studio-400 max-w-sm mx-auto mt-1 mb-4">
                Start by creating your first AI story video project with narration & cinematic imagery.
              </p>
              <Button
                variant="glow"
                size="md"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => {
                  onClose();
                  onOpenNewProject();
                }}
              >
                Create Your First Project
              </Button>
            </div>
          ) : (
            projectsList.map((p) => {
              const isActive = currentProject?.id === p.id;
              return (
                <div
                  key={p.id}
                  className={`p-4 rounded-xl border transition-all duration-150 flex items-center justify-between group ${
                    isActive
                      ? 'bg-indigo-950/40 border-indigo-500/60 shadow-glow-brand ring-1 ring-indigo-500/40'
                      : 'bg-studio-850/60 border-studio-800 hover:border-studio-700 hover:bg-studio-800/60'
                  }`}
                >
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => handleOpen(p.id)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-sm text-studio-100 group-hover:text-indigo-300 transition-colors">
                        {p.name}
                      </h4>
                      {isActive && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          Active
                        </span>
                      )}
                      <span className="text-[11px] px-2 py-0.5 rounded bg-studio-800 text-studio-400 font-mono">
                        {p.aspect_ratio}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-studio-800 text-studio-400">
                        {p.resolution_preset}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-studio-400">
                      <span className="flex items-center gap-1">
                        <Languages className="w-3.5 h-3.5 text-studio-500" />
                        {p.language}
                      </span>
                      <span className="flex items-center gap-1">
                        <Film className="w-3.5 h-3.5 text-studio-500" />
                        {p.scene_count} {p.scene_count === 1 ? 'scene' : 'scenes'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-studio-500" />
                        {formatTime(p.updated_at)}
                      </span>
                    </div>
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleOpen(p.id)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                    >
                      Open
                    </button>
                    <button
                      onClick={() => handleOpenFolder(p.project_dir)}
                      className="p-1.5 text-studio-400 hover:text-studio-100 hover:bg-studio-700/60 rounded-lg transition-colors"
                      title="Reveal project files in explorer"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => duplicateProject(p.id)}
                      className="p-1.5 text-studio-400 hover:text-studio-100 hover:bg-studio-700/60 rounded-lg transition-colors"
                      title="Duplicate project"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete project "${p.name}"? This removes all project files.`)) {
                          deleteProject(p.id);
                        }
                      }}
                      className="p-1.5 text-studio-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors"
                      title="Delete project"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
};
