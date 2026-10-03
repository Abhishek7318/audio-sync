import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Project, ProjectSummary, Scene } from '../types';
import { api } from '../services/api';
import { useToast } from './ToastContext';
import { getDefaultStyleBible } from '../data/stylePresets';

interface ProjectContextType {
  currentProject: Project | null;
  projectsList: ProjectSummary[];
  loadingProjects: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  isDirty: boolean;
  currentStep: number;
  setStep: (step: number) => void;
  refreshProjectsList: () => Promise<void>;
  createProject: (params: {
    name: string;
    language: string;
    aspect_ratio: '16:9' | '9:16' | '1:1' | '4:5';
    resolution_preset: '1080p' | '4K' | '720p';
    fps: number;
    style_preset: string;
    custom_style_description?: string;
  }) => Promise<Project>;
  loadProject: (projectId: string) => Promise<void>;
  saveCurrentProject: (explicitProject?: Project) => Promise<void>;
  updateCurrentProject: (updater: (prev: Project) => Project) => void;
  closeProject: () => void;
  deleteProject: (projectId: string) => Promise<void>;
  duplicateProject: (projectId: string) => Promise<void>;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [projectsList, setProjectsList] = useState<ProjectSummary[]>([]);
  const [loadingProjects, setLoadingProjects] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [currentStep, setCurrentStepState] = useState<number>(1);

  // Undo / Redo history stacks
  const [undoStack, setUndoStack] = useState<Project[]>([]);
  const [redoStack, setRedoStack] = useState<Project[]>([]);

  const { showToast } = useToast();
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const refreshProjectsList = useCallback(async () => {
    try {
      setLoadingProjects(true);
      const list = await api.listProjects();
      setProjectsList(list);
    } catch (err) {
      console.error('Failed to list projects:', err);
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    refreshProjectsList();
  }, [refreshProjectsList]);

  // Autosave when isDirty is true
  useEffect(() => {
    if (!isDirty || !currentProject) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        setIsSaving(true);
        await api.updateProject(currentProject.id, currentProject);
        setIsDirty(false);
        setLastSaved(new Date());
      } catch (err) {
        console.error('Autosave failed:', err);
      } finally {
        setIsSaving(false);
      }
    }, 3000); // 3-second debounce autosave

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [currentProject, isDirty]);

  const setStep = (step: number) => {
    setCurrentStepState(step);
    if (currentProject && currentProject.current_step !== step) {
      updateCurrentProject((prev) => ({ ...prev, current_step: step }));
    }
  };

  const createProject = async (params: {
    name: string;
    language: string;
    aspect_ratio: '16:9' | '9:16' | '1:1' | '4:5';
    resolution_preset: '1080p' | '4K' | '720p';
    fps: number;
    style_preset: string;
    custom_style_description?: string;
  }): Promise<Project> => {
    const width = params.aspect_ratio === '16:9' ? 1920 : params.aspect_ratio === '9:16' ? 1080 : 1080;
    const height = params.aspect_ratio === '16:9' ? 1080 : params.aspect_ratio === '9:16' ? 1920 : 1080;

    const newProjData: Partial<Project> = {
      name: params.name || 'Untitled Story',
      language: params.language,
      aspect_ratio: params.aspect_ratio,
      resolution_preset: params.resolution_preset,
      fps: params.fps,
      style_bible: getDefaultStyleBible(params.style_preset, params.custom_style_description),
      export_settings: {
        preset: params.aspect_ratio === '9:16' ? 'shorts_vertical' : 'youtube_1080p',
        width,
        height,
        fps: params.fps,
        video_bitrate: '12M',
        audio_bitrate: '320k',
        codec: 'libx264',
        burn_subtitles: true,
        export_srt_separately: true,
        normalize_audio: true,
        target_lufs: -14.0
      },
      scenes: [],
      characters: [],
      subtitles: [],
      current_step: 1
    };

    try {
      const created = await api.createProject(newProjData);
      setCurrentProject(created);
      setCurrentStepState(1);
      setUndoStack([]);
      setRedoStack([]);
      setIsDirty(false);
      setLastSaved(new Date());
      await refreshProjectsList();
      showToast(`Created project "${created.name}"`, 'success');
      return created;
    } catch (err: any) {
      showToast(`Failed to create project: ${err.message}`, 'error');
      throw err;
    }
  };

  const loadProject = async (projectId: string) => {
    try {
      const proj = await api.getProject(projectId);
      setCurrentProject(proj);
      setCurrentStepState(proj.current_step || 1);
      setUndoStack([]);
      setRedoStack([]);
      setIsDirty(false);
      setLastSaved(new Date());
      showToast(`Opened project "${proj.name}"`, 'info');
    } catch (err: any) {
      showToast(`Failed to load project: ${err.message}`, 'error');
    }
  };

  const saveCurrentProject = async (explicitProject?: Project) => {
    const toSave = explicitProject || currentProject;
    if (!toSave) return;
    try {
      setIsSaving(true);
      const saved = await api.updateProject(toSave.id, toSave);
      setCurrentProject(saved);
      setIsDirty(false);
      setLastSaved(new Date());
      await refreshProjectsList();
      showToast('Project saved successfully', 'success');
    } catch (err: any) {
      showToast(`Failed to save project: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const updateCurrentProject = (updater: (prev: Project) => Project) => {
    if (!currentProject) return;
    
    // Save previous snapshot for undo
    setUndoStack((prev) => [...prev.slice(-30), currentProject]);
    setRedoStack([]); // clear redo on new change

    setCurrentProject((prev) => {
      if (!prev) return prev;
      const updated = updater(prev);
      return updated;
    });
    setIsDirty(true);
  };

  const undo = () => {
    if (undoStack.length === 0 || !currentProject) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev, currentProject]);
    setUndoStack((prev) => prev.slice(0, -1));
    setCurrentProject(previous);
    setIsDirty(true);
  };

  const redo = () => {
    if (redoStack.length === 0 || !currentProject) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev, currentProject]);
    setRedoStack((prev) => prev.slice(0, -1));
    setCurrentProject(next);
    setIsDirty(true);
  };

  const closeProject = () => {
    if (currentProject && isDirty) {
      // Promptly save before closing
      api.updateProject(currentProject.id, currentProject);
    }
    setCurrentProject(null);
    setCurrentStepState(1);
    setUndoStack([]);
    setRedoStack([]);
    setIsDirty(false);
    refreshProjectsList();
  };

  const deleteProject = async (projectId: string) => {
    try {
      await api.deleteProject(projectId);
      if (currentProject?.id === projectId) {
        setCurrentProject(null);
      }
      await refreshProjectsList();
      showToast('Project deleted', 'info');
    } catch (err: any) {
      showToast(`Failed to delete project: ${err.message}`, 'error');
    }
  };

  const duplicateProject = async (projectId: string) => {
    try {
      const dup = await api.duplicateProject(projectId);
      await refreshProjectsList();
      showToast(`Duplicated as "${dup.name}"`, 'success');
    } catch (err: any) {
      showToast(`Failed to duplicate project: ${err.message}`, 'error');
    }
  };

  return (
    <ProjectContext.Provider
      value={{
        currentProject,
        projectsList,
        loadingProjects,
        isSaving,
        lastSaved,
        isDirty,
        currentStep,
        setStep,
        refreshProjectsList,
        createProject,
        loadProject,
        saveCurrentProject,
        updateCurrentProject,
        closeProject,
        deleteProject,
        duplicateProject,
        undo,
        redo,
        canUndo: undoStack.length > 0,
        canRedo: redoStack.length > 0,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};
