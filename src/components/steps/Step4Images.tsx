import React, { useState, useRef } from 'react';
import {
  Image as ImageIcon,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Upload,
  Bot,
  Globe,
  Copy,
  Check,
  RefreshCw,
  Eye,
  AlertTriangle,
  Clock,
  Download,
  Sliders,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Layers,
  FolderOpen
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { Scene } from '../../types';
import { api } from '../../services/api';

export const Step4Images: React.FC = () => {
  const { currentProject, updateCurrentProject, setStep, saveCurrentProject } = useProject();
  const { settings } = useSettings();
  const { showToast } = useToast();

  // Mode Selection: 'mode_a' (API/Free Cloud), 'mode_b' (Browser Assist), 'mode_c' (Manual Drag-Drop)
  const [activeMode, setActiveMode] = useState<'mode_a' | 'mode_b' | 'mode_c'>('mode_a');
  const [selectedProvider, setSelectedProvider] = useState<string>(settings.image_provider || 'free_flux');

  // Generation Queue State
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchMessage, setBatchMessage] = useState('');
  const [generatingSceneId, setGeneratingSceneId] = useState<string | null>(null);

  // Fullscreen Zoom Modal
  const [zoomImageScene, setZoomImageScene] = useState<Scene | null>(null);
  const [copiedSceneId, setCopiedSceneId] = useState<string | null>(null);

  // Mode B Browser Assist State
  const [browserAssistIndex, setBrowserAssistIndex] = useState(0);
  const [modeBStrategy, setModeBStrategy] = useState<'desktop_chrome' | 'playwright_browser'>('desktop_chrome');
  const [selectedBrowser, setSelectedBrowser] = useState('Google Chrome');
  const [autoPressEnter, setAutoPressEnter] = useState(true);
  const [autoAdvanceLoop, setAutoAdvanceLoop] = useState(true);
  const [isDetectingDownload, setIsDetectingDownload] = useState(false);
  const [isAutoPasting, setIsAutoPasting] = useState(false);
  const [isAutoWatching, setIsAutoWatching] = useState(false);
  const [isAutoPilotActive, setIsAutoPilotActive] = useState(false);
  const [isOpeningPlaywright, setIsOpeningPlaywright] = useState(false);
  const [isPlaywrightBatchRunning, setIsPlaywrightBatchRunning] = useState(false);
  const isAutoPilotRef = useRef(false);
  const watchIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up watcher interval on unmount
  React.useEffect(() => {
    return () => {
      isAutoPilotRef.current = false;
      if (watchIntervalRef.current) {
        clearInterval(watchIntervalRef.current);
      }
    };
  }, []);

  // Bulk Upload File Input Ref
  const bulkInputRef = useRef<HTMLInputElement | null>(null);
  const singleInputRef = useRef<HTMLInputElement | null>(null);
  const [targetUploadSceneId, setTargetUploadSceneId] = useState<string | null>(null);

  if (!currentProject) return null;

  const scenes: Scene[] = currentProject.scenes || [];
  const readyScenesCount = scenes.filter((s) => s.image_status === 'ready').length;
  const pendingScenesCount = scenes.length - readyScenesCount;

  // Single Scene Image Generation
  const handleGenerateSingle = async (sceneId: string) => {
    try {
      setGeneratingSceneId(sceneId);
      updateCurrentProject((prev) => ({
        ...prev,
        scenes: prev.scenes.map((s) =>
          s.id === sceneId ? { ...s, image_status: 'generating' } : s
        ),
      }));

      const updatedScene = await api.generateSingleImage(currentProject.id, sceneId, selectedProvider);

      updateCurrentProject((prev) => ({
        ...prev,
        scenes: prev.scenes.map((s) => (s.id === sceneId ? updatedScene : s)),
      }));

      showToast(`Image generated for Scene ${updatedScene.scene_number}!`, 'success');
    } catch (err: any) {
      updateCurrentProject((prev) => ({
        ...prev,
        scenes: prev.scenes.map((s) =>
          s.id === sceneId ? { ...s, image_status: 'failed' } : s
        ),
      }));
      showToast(`Generation failed: ${err.message}`, 'error');
    } finally {
      setGeneratingSceneId(null);
    }
  };

  // Batch Image Generation Queue
  const handleGenerateBatch = async () => {
    if (scenes.length === 0) return;

    try {
      setIsGeneratingBatch(true);
      setBatchProgress(5);
      setBatchMessage(`Starting generation queue for ${pendingScenesCount || scenes.length} scenes...`);

      const res = await api.generateBatchImages(currentProject.id, {
        provider: selectedProvider,
        force_all: pendingScenesCount === 0,
      });

      const jobId = res.job_id;
      const pollInterval = setInterval(async () => {
        try {
          const job = await api.getJob(jobId);
          setBatchProgress(job.progress);
          setBatchMessage(job.message);

          if (job.status === 'completed') {
            clearInterval(pollInterval);
            setIsGeneratingBatch(false);
            if (job.result?.scenes) {
              updateCurrentProject((prev) => ({
                ...prev,
                scenes: job.result.scenes,
              }));
            }
            showToast('All scene images generated successfully!', 'success');
          } else if (job.status === 'failed') {
            clearInterval(pollInterval);
            setIsGeneratingBatch(false);
            showToast(`Batch generation stopped: ${job.error}`, 'error');
          }
        } catch (err) {
          clearInterval(pollInterval);
          setIsGeneratingBatch(false);
        }
      }, 800);
    } catch (err: any) {
      setIsGeneratingBatch(false);
      showToast(`Error starting batch generation: ${err.message}`, 'error');
    }
  };

  // Single Scene Upload
  const handleTriggerSingleUpload = (sceneId: string) => {
    setTargetUploadSceneId(sceneId);
    if (singleInputRef.current) {
      singleInputRef.current.click();
    }
  };

  const handleSingleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && targetUploadSceneId) {
      try {
        const updatedScene = await api.uploadSingleSceneImage(
          currentProject.id,
          targetUploadSceneId,
          file
        );
        updateCurrentProject((prev) => ({
          ...prev,
          scenes: prev.scenes.map((s) => (s.id === targetUploadSceneId ? updatedScene : s)),
        }));
        showToast(`Image uploaded for Scene ${updatedScene.scene_number}!`, 'success');
      } catch (err: any) {
        showToast(`Upload failed: ${err.message}`, 'error');
      }
    }
    setTargetUploadSceneId(null);
  };

  // Bulk Upload
  const handleBulkFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      try {
        const res = await api.uploadBulkSceneImages(currentProject.id, files);
        if (res.scenes && res.scenes.length > 0) {
          updateCurrentProject((prev) => {
            const nextScenes = [...prev.scenes];
            res.scenes.forEach((us: Scene) => {
              const idx = nextScenes.findIndex((s) => s.id === us.id);
              if (idx >= 0) nextScenes[idx] = us;
            });
            return { ...prev, scenes: nextScenes };
          });
        }
        showToast(`Auto-matched and attached ${res.matched_count} images to scenes!`, 'success');
      } catch (err: any) {
        showToast(`Bulk upload error: ${err.message}`, 'error');
      }
    }
  };

  // Mode B: Continuous Auto-Pilot Step Execution
  const executeAutoPilotStep = async (targetIndex: number, continuous: boolean) => {
    if (targetIndex >= scenes.length) {
      setIsAutoPilotActive(false);
      isAutoPilotRef.current = false;
      setIsAutoWatching(false);
      showToast('🎉 All scenes completed! Images generated and attached!', 'success');
      return;
    }

    const currentAssistScene = scenes[targetIndex];
    if (!currentAssistScene) return;

    setBrowserAssistIndex(targetIndex);
    setIsAutoPasting(true);
    const startTime = Date.now() / 1000.0;

    try {
      await api.pasteToChrome(currentProject.id, {
        scene_id: currentAssistScene.id,
        prompt: currentAssistScene.image_prompt,
        browser_name: selectedBrowser,
        press_enter: autoPressEnter,
      });

      showToast(`Pasted Scene ${currentAssistScene.scene_number} into ${selectedBrowser}! Waiting for download...`, 'info');
      setIsAutoPasting(false);
      setIsAutoWatching(true);

      if (watchIntervalRef.current) clearInterval(watchIntervalRef.current);

      let attempts = 0;
      watchIntervalRef.current = setInterval(async () => {
        attempts++;
        try {
          const pollRes = await api.pollBrowserDownload(
            currentProject.id,
            currentAssistScene.id,
            startTime
          );

          if (pollRes.status === 'attached' && pollRes.scene) {
            if (watchIntervalRef.current) clearInterval(watchIntervalRef.current);

            updateCurrentProject((prev) => ({
              ...prev,
              scenes: prev.scenes.map((s) => (s.id === currentAssistScene.id ? pollRes.scene : s)),
            }));
            showToast(`🎉 Attached Scene ${currentAssistScene.scene_number}!`, 'success');

            // Check if we should auto-continue to next scene
            if (continuous && isAutoPilotRef.current && targetIndex + 1 < scenes.length) {
              showToast(`Next prompt in 2s: Scene ${scenes[targetIndex + 1].scene_number}...`, 'info');
              setTimeout(() => {
                if (isAutoPilotRef.current) {
                  executeAutoPilotStep(targetIndex + 1, true);
                }
              }, 1800);
            } else {
              setIsAutoWatching(false);
              setIsAutoPilotActive(false);
              isAutoPilotRef.current = false;
              if (targetIndex + 1 < scenes.length) {
                setBrowserAssistIndex(targetIndex + 1);
              }
            }
          } else if (attempts > 180) {
            // Stop watching after 4.5 minutes of inactivity
            if (watchIntervalRef.current) clearInterval(watchIntervalRef.current);
            setIsAutoWatching(false);
            setIsAutoPilotActive(false);
            isAutoPilotRef.current = false;
          }
        } catch (e) {
          // ignore transient errors
        }
      }, 1200);

    } catch (err: any) {
      setIsAutoPasting(false);
      setIsAutoWatching(false);
      setIsAutoPilotActive(false);
      isAutoPilotRef.current = false;
      showToast(`Automation error: ${err.message}`, 'error');
    }
  };

  // Trigger continuous auto pilot
  const handleStartAutoPilot = () => {
    setIsAutoPilotActive(true);
    isAutoPilotRef.current = true;
    executeAutoPilotStep(browserAssistIndex, true);
  };

  // Trigger single scene only
  const handleSingleScenePasteAndWatch = () => {
    setIsAutoPilotActive(false);
    isAutoPilotRef.current = false;
    executeAutoPilotStep(browserAssistIndex, false);
  };

  // Stop auto pilot
  const handleStopAutoPilot = () => {
    setIsAutoPilotActive(false);
    isAutoPilotRef.current = false;
    setIsAutoWatching(false);
    if (watchIntervalRef.current) clearInterval(watchIntervalRef.current);
    showToast('Auto-Pilot paused', 'info');
  };

  // Mode B Browser Assist Download Auto-Detect Manual Trigger
  const handleDetectDownload = async () => {
    const currentAssistScene = scenes[browserAssistIndex];
    if (!currentAssistScene) return;

    try {
      setIsDetectingDownload(true);
      const res = await api.detectBrowserDownload(currentProject.id, currentAssistScene.id);

      if (res.status === 'attached' && res.scene) {
        updateCurrentProject((prev) => ({
          ...prev,
          scenes: prev.scenes.map((s) => (s.id === currentAssistScene.id ? res.scene : s)),
        }));
        showToast(`Detected & attached image for Scene ${currentAssistScene.scene_number}!`, 'success');

        // Advance to next scene
        if (browserAssistIndex < scenes.length - 1) {
          setBrowserAssistIndex(browserAssistIndex + 1);
        }
      } else {
        showToast(res.message || 'No new image found in ~/Downloads yet.', 'info');
      }
    } catch (err: any) {
      showToast(`Detection error: ${err.message}`, 'error');
    } finally {
      setIsDetectingDownload(false);
    }
  };

  // Launch Playwright Browser Window
  const handleLaunchPlaywrightBrowser = async () => {
    try {
      setIsOpeningPlaywright(true);
      const res = await api.openPlaywrightBrowser();
      if (res.status === 'open') {
        showToast('Playwright ChatGPT browser launched! Ready for generation.', 'success');
      } else {
        showToast(res.message || 'Failed to open browser', 'error');
      }
    } catch (err: any) {
      showToast(`Playwright error: ${err.message}`, 'error');
    } finally {
      setIsOpeningPlaywright(false);
    }
  };

  // Playwright Single Scene Generation
  const handlePlaywrightSingleScene = async (sceneId: string, prompt: string) => {
    try {
      setGeneratingSceneId(sceneId);
      updateCurrentProject((prev) => ({
        ...prev,
        scenes: prev.scenes.map((s) => (s.id === sceneId ? { ...s, image_status: 'generating' } : s)),
      }));

      const res = await api.generatePlaywrightScene(currentProject.id, {
        scene_id: sceneId,
        prompt: prompt,
      });

      if (res.status === 'success' && res.scene) {
        updateCurrentProject((prev) => ({
          ...prev,
          scenes: prev.scenes.map((s) => (s.id === sceneId ? res.scene : s)),
        }));
        showToast('Image generated and saved from ChatGPT successfully!', 'success');
      }
    } catch (err: any) {
      updateCurrentProject((prev) => ({
        ...prev,
        scenes: prev.scenes.map((s) => (s.id === sceneId ? { ...s, image_status: 'failed' } : s)),
      }));
      showToast(`Playwright generation failed: ${err.message}`, 'error');
    } finally {
      setGeneratingSceneId(null);
    }
  };

  const isPlaywrightBatchCancelledRef = useRef(false);

  // Stop Playwright Batch Generation
  const handleStopPlaywrightBatch = () => {
    isPlaywrightBatchCancelledRef.current = true;
    setIsPlaywrightBatchRunning(false);
    showToast('Playwright batch stopped by user', 'info');
  };

  // Playwright Hands-Free Batch Generation
  const handlePlaywrightBatchGenerate = async () => {
    try {
      setIsPlaywrightBatchRunning(true);
      isPlaywrightBatchCancelledRef.current = false;
      const pending = scenes.filter((s) => s.image_status !== 'ready');
      const targetScenes = pending.length > 0 ? pending : scenes;

      showToast(`Starting Playwright batch for ${targetScenes.length} scenes...`, 'info');

      for (let i = 0; i < targetScenes.length; i++) {
        if (isPlaywrightBatchCancelledRef.current) {
          showToast('Playwright batch generation stopped.', 'info');
          break;
        }

        const sc = targetScenes[i];
        showToast(`ChatGPT generating Scene ${sc.scene_number} (${i + 1}/${targetScenes.length})...`, 'info');

        try {
          const res = await api.generatePlaywrightScene(currentProject.id, {
            scene_id: sc.id,
            prompt: sc.image_prompt,
          });

          if (isPlaywrightBatchCancelledRef.current) break;

          if (res.status === 'success' && res.scene) {
            updateCurrentProject((prev) => ({
              ...prev,
              scenes: prev.scenes.map((s) => (s.id === sc.id ? res.scene : s)),
            }));
          }
        } catch (sceneErr: any) {
          console.error(`Failed scene ${sc.scene_number}:`, sceneErr);
        }
      }

      if (!isPlaywrightBatchCancelledRef.current) {
        showToast('🎉 All scenes processed in Playwright autonomous browser!', 'success');
      }
    } catch (err: any) {
      showToast(`Batch error: ${err.message}`, 'error');
    } finally {
      setIsPlaywrightBatchRunning(false);
    }
  };

  // Copy prompt helper
  const handleCopyPrompt = (scene: Scene) => {
    navigator.clipboard.writeText(scene.image_prompt);
    setCopiedSceneId(scene.id);
    showToast(`Copied prompt for Scene ${scene.scene_number}`, 'info');
    setTimeout(() => setCopiedSceneId(null), 2000);
  };

  const handleProceed = () => {
    saveCurrentProject();
    setStep(5);
  };

  const getSceneImageUrl = (scene: Scene) => {
    if (!scene.generated_image_path) return null;
    const filename = scene.generated_image_path.split(/[\\/]/).pop();
    if (!filename) return null;
    return `${api.getAssetUrl(currentProject.id, 'images', filename)}?t=${Date.now()}`;
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6 overflow-y-auto h-full pb-24">
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={singleInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleSingleFileSelected}
      />
      <input
        type="file"
        ref={bulkInputRef}
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleBulkFilesSelected}
      />

      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-pink-950/60 via-purple-950/40 to-studio-900 border border-pink-500/20 p-5 rounded-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">
              Step 4: AI Image Generation Studio
            </h1>
            <Badge variant="brand">{readyScenesCount}/{scenes.length} Images Ready</Badge>
            <Badge variant="accent">{currentProject.aspect_ratio}</Badge>
          </div>
          <p className="text-xs text-studio-400 max-w-2xl">
            Generate cinematic images in 3 flexible modes: Automatic Free Cloud Flux / OpenAI DALL-E, Playwright Browser Assist, or Manual Drag & Drop.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="md"
            leftIcon={<ArrowLeft className="w-4 h-4" />}
            onClick={() => setStep(3)}
          >
            Back to Scenes
          </Button>
          <Button
            variant="glow"
            size="md"
            rightIcon={<ArrowRight className="w-4 h-4" />}
            onClick={handleProceed}
            disabled={readyScenesCount === 0}
          >
            Proceed to Motion & Timeline
          </Button>
        </div>
      </div>

      {/* Mode Switcher Tabs Card */}
      <Card variant="glass" className="space-y-4">
        <div className="flex flex-wrap bg-studio-900/90 p-1 rounded-xl border border-studio-800 text-xs">
          <button
            onClick={() => setActiveMode('mode_a')}
            className={`flex-1 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
              activeMode === 'mode_a'
                ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md'
                : 'text-studio-400 hover:text-studio-200'
            }`}
          >
            <Sparkles className="w-4 h-4 text-pink-300" />
            <span>Mode A: Automatic Cloud & API Queue</span>
          </button>

          <button
            onClick={() => setActiveMode('mode_b')}
            className={`flex-1 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
              activeMode === 'mode_b'
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                : 'text-studio-400 hover:text-studio-200'
            }`}
          >
            <Bot className="w-4 h-4 text-cyan-300" />
            <span>Mode B: Playwright Browser Assist</span>
          </button>

          <button
            onClick={() => setActiveMode('mode_c')}
            className={`flex-1 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
              activeMode === 'mode_c'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                : 'text-studio-400 hover:text-studio-200'
            }`}
          >
            <Upload className="w-4 h-4 text-emerald-300" />
            <span>Mode C: Manual Drag & Drop / Bulk Match</span>
          </button>
        </div>

        {/* Mode A Controller */}
        {activeMode === 'mode_a' && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-studio-800 animate-in fade-in">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-studio-200">Image Generation Engine:</span>
                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  className="bg-studio-900 border border-studio-700 rounded-xl px-3 py-1.5 text-xs text-studio-100 font-medium focus:outline-none focus:border-pink-500"
                >
                  <option value="free_flux">Cinematic Flux (100% Free / No Key Needed) ★</option>
                  <option value="openai">OpenAI DALL-E 3 (Requires API Key in Settings)</option>
                </select>
              </div>
              <p className="text-[11px] text-studio-400">
                {selectedProvider === 'free_flux'
                  ? 'High-resolution cinematic flux model (Free, unlimited, 16:9/9:16 aspect ratio)'
                  : 'OpenAI DALL-E 3 official high-definition image generator (~$0.04/image)'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="glow"
                size="md"
                onClick={handleGenerateBatch}
                isLoading={isGeneratingBatch}
                leftIcon={<Sparkles className="w-4 h-4 text-pink-300" />}
              >
                {isGeneratingBatch
                  ? 'Generating Queue...'
                  : pendingScenesCount > 0
                  ? `Generate ${pendingScenesCount} Pending Images`
                  : 'Regenerate All Images'}
              </Button>
            </div>
          </div>
        )}

        {/* Mode B Browser Assist Controller */}
        {activeMode === 'mode_b' && (
          <div className="space-y-4 pt-2 border-t border-studio-800 animate-in fade-in">
            {/* Strategy Switcher */}
            <div className="flex items-center gap-2 bg-studio-900/80 p-1 rounded-xl border border-studio-800 w-fit text-xs">
              <button
                onClick={() => setModeBStrategy('desktop_chrome')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  modeBStrategy === 'desktop_chrome'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-studio-400 hover:text-studio-200'
                }`}
              >
                1. Active Chrome Tab Assist (Auto-Paste & Watch)
              </button>
              <button
                onClick={() => setModeBStrategy('playwright_browser')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  modeBStrategy === 'playwright_browser'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-studio-400 hover:text-studio-200'
                }`}
              >
                2. Playwright 100% Autonomous Bot (Hands-Free)
              </button>
            </div>

            {/* Strategy 1: Active Chrome Tab Assist */}
            {modeBStrategy === 'desktop_chrome' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-studio-900 border border-indigo-500/30 space-y-2 text-xs text-indigo-200">
                  <div className="flex items-start gap-2.5">
                    <Bot className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <span className="font-bold text-white">How Continuous Auto-Pilot Works with ChatGPT:</span>
                      <p className="text-[11px] text-indigo-300/90 leading-relaxed">
                        1. Click <strong className="text-white">"🚀 Start Auto-Pilot (All Scenes Loop)"</strong> — StoryReel Studio focuses Chrome, types into the ChatGPT input box, and submits.<br />
                        2. ChatGPT takes ~15-25s to create the image.<br />
                        3. In ChatGPT, click the <strong>Share/Export icon on the image</strong> → click <strong>Download</strong>.<br />
                        4. StoryReel Studio detects the download from <code>~/Downloads</code>, attaches it to the scene, and <strong>immediately types the next prompt in Chrome!</strong>
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-indigo-500/20 flex items-center justify-between text-[11px] text-indigo-300/80">
                    <span>💡 <strong>Pro Tip for Mac Chrome:</strong> Enable <code>View &gt; Developer &gt; Allow JavaScript from Apple Events</code> in Chrome for 100% instant auto-focus &amp; auto-typing.</span>
                  </div>
                </div>

                {scenes.length > 0 && (
                  <div className="p-4 rounded-xl bg-studio-850 border border-studio-800 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="brand">Scene {scenes[browserAssistIndex]?.scene_number} of {scenes.length}</Badge>
                        <span className="text-xs font-semibold text-studio-200 truncate max-w-md">
                          "{scenes[browserAssistIndex]?.story_text}"
                        </span>
                      </div>

                      {/* Settings & Options */}
                      <div className="flex flex-wrap items-center gap-4 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-studio-400 font-medium">Browser:</span>
                          <select
                            value={selectedBrowser}
                            onChange={(e) => setSelectedBrowser(e.target.value)}
                            className="bg-studio-900 border border-studio-700 rounded-lg px-2 py-1 text-xs text-studio-200 focus:outline-none focus:border-indigo-500"
                          >
                            <option value="Google Chrome">Google Chrome</option>
                            <option value="Arc">Arc Browser</option>
                            <option value="Brave Browser">Brave</option>
                            <option value="Microsoft Edge">Microsoft Edge</option>
                            <option value="Safari">Safari</option>
                          </select>
                        </div>

                        <label className="flex items-center gap-1.5 cursor-pointer text-studio-300 select-none">
                          <input
                            type="checkbox"
                            checked={autoPressEnter}
                            onChange={(e) => setAutoPressEnter(e.target.checked)}
                            className="rounded border-studio-700 bg-studio-900 text-indigo-500 focus:ring-0"
                          />
                          <span>Auto-Press Enter</span>
                        </label>

                        <label className="flex items-center gap-1.5 cursor-pointer text-studio-300 select-none">
                          <input
                            type="checkbox"
                            checked={autoAdvanceLoop}
                            onChange={(e) => setAutoAdvanceLoop(e.target.checked)}
                            className="rounded border-studio-700 bg-studio-900 text-indigo-500 focus:ring-0"
                          />
                          <span>Auto-Next Prompt</span>
                        </label>
                      </div>
                    </div>

                    {/* Prompt Preview Box */}
                    <div className="p-3 rounded-lg bg-studio-900/90 border border-studio-800 space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-studio-400">
                        <span className="font-bold text-studio-300">Prompt for Scene {scenes[browserAssistIndex]?.scene_number}:</span>
                        <button
                          onClick={() => handleCopyPrompt(scenes[browserAssistIndex])}
                          className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{copiedSceneId === scenes[browserAssistIndex]?.id ? 'Copied!' : 'Copy'}</span>
                        </button>
                      </div>
                      <p className="text-xs text-studio-300 font-mono line-clamp-2">
                        {scenes[browserAssistIndex]?.image_prompt}
                      </p>
                    </div>

                    {/* Live Watching Status Radar / Auto-Pilot Banner */}
                    {(isAutoWatching || isAutoPilotActive) && (
                      <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-pulse">
                        <div className="flex items-center gap-2.5 text-xs text-emerald-300">
                          <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                          </span>
                          <div>
                            <span className="font-bold block">
                              {isAutoPilotActive
                                ? `Auto-Pilot Active (Scene ${scenes[browserAssistIndex]?.scene_number}/${scenes.length})`
                                : `Watching Downloads for Scene ${scenes[browserAssistIndex]?.scene_number}`}
                            </span>
                            <span className="text-[11px] text-emerald-400/80">
                              {isAutoPilotActive
                                ? 'Download the image in ChatGPT — StoryReel Studio will auto-attach and type the next prompt immediately!'
                                : 'Download the image in ChatGPT to auto-attach.'}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleStopAutoPilot}
                          className="text-xs text-rose-300 hover:text-rose-200 border border-rose-500/30 hover:bg-rose-950/40"
                        >
                          ⏹️ Stop Auto-Pilot
                        </Button>
                      </div>
                    )}

                    {/* Mode B Actions Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {isAutoPilotActive ? (
                          <Button
                            variant="secondary"
                            size="md"
                            onClick={handleStopAutoPilot}
                            leftIcon={<AlertCircle className="w-4 h-4 text-rose-400" />}
                            className="border-rose-500/40 text-rose-300"
                          >
                            ⏹️ Stop Auto-Pilot Loop
                          </Button>
                        ) : (
                          <Button
                            variant="glow"
                            size="md"
                            onClick={handleStartAutoPilot}
                            isLoading={isAutoPasting}
                            leftIcon={<Sparkles className="w-4 h-4 text-cyan-300" />}
                            className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 shadow-lg shadow-indigo-500/25 font-bold"
                          >
                            🚀 Start Auto-Pilot (All Scenes Loop)
                          </Button>
                        )}

                        <Button
                          variant="outline"
                          size="md"
                          onClick={handleSingleScenePasteAndWatch}
                          isLoading={isAutoPasting && !isAutoPilotActive}
                          leftIcon={<Bot className="w-4 h-4 text-indigo-400" />}
                        >
                          Paste Current Scene Only
                        </Button>

                        <Button
                          variant="secondary"
                          size="md"
                          onClick={handleDetectDownload}
                          isLoading={isDetectingDownload}
                          leftIcon={<RefreshCw className="w-4 h-4 text-emerald-400" />}
                        >
                          Detect Download
                        </Button>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setBrowserAssistIndex(Math.max(0, browserAssistIndex - 1))}
                          disabled={browserAssistIndex === 0 || isAutoPilotActive}
                        >
                          Previous
                        </Button>

                        <span className="text-xs text-studio-400 font-mono px-1">
                          {browserAssistIndex + 1} / {scenes.length}
                        </span>

                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setBrowserAssistIndex(Math.min(scenes.length - 1, browserAssistIndex + 1))}
                          disabled={browserAssistIndex >= scenes.length - 1 || isAutoPilotActive}
                        >
                          Next Scene
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Strategy 2: Playwright 100% Autonomous Bot */}
            {modeBStrategy === 'playwright_browser' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-studio-900 border border-purple-500/30 space-y-2 text-xs text-purple-200">
                  <div className="flex items-start gap-2.5">
                    <Globe className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <span className="font-bold text-white">Playwright 100% Hands-Free Autonomous Browser:</span>
                      <p className="text-[11px] text-purple-300/90 leading-relaxed">
                        Launches a dedicated automated browser window with a persistent ChatGPT login. Playwright types the prompt, submits, waits for generation to finish, and <strong>downloads the image automatically</strong> without requiring any clicks from you!
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-studio-850 border border-studio-800 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-studio-200">Autonomous ChatGPT Browser Controller:</span>
                      <p className="text-[11px] text-studio-400">
                        Log in once in the launched window, then click Batch Generate.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="md"
                        onClick={handleLaunchPlaywrightBrowser}
                        isLoading={isOpeningPlaywright}
                        disabled={isPlaywrightBatchRunning}
                        leftIcon={<Globe className="w-4 h-4 text-cyan-400" />}
                      >
                        🌐 Launch ChatGPT Window
                      </Button>

                      {isPlaywrightBatchRunning ? (
                        <Button
                          variant="secondary"
                          size="md"
                          onClick={handleStopPlaywrightBatch}
                          leftIcon={<AlertCircle className="w-4 h-4 text-rose-400" />}
                          className="border-rose-500/40 text-rose-300 hover:bg-rose-950/40 font-bold"
                        >
                          ⏹️ Stop Hands-Free Batch
                        </Button>
                      ) : (
                        <Button
                          variant="glow"
                          size="md"
                          onClick={handlePlaywrightBatchGenerate}
                          leftIcon={<Sparkles className="w-4 h-4 text-purple-300" />}
                          className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-500/25 font-bold"
                        >
                          ⚡ Run 100% Hands-Free Batch
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Playwright Running Status Banner */}
                  {isPlaywrightBatchRunning && (
                    <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-500/40 flex items-center justify-between gap-3 animate-pulse">
                      <div className="flex items-center gap-2.5 text-xs text-purple-300">
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
                        </span>
                        <div>
                          <span className="font-bold block">
                            Autonomous Playwright Bot is Running...
                          </span>
                          <span className="text-[11px] text-purple-300/80">
                            Typing prompt, scrolling, waiting for generation, and downloading images automatically.
                          </span>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleStopPlaywrightBatch}
                        className="text-xs text-rose-300 hover:text-rose-200 border border-rose-500/30 hover:bg-rose-950/40"
                      >
                        ⏹️ Stop
                      </Button>
                    </div>
                  )}

                  {/* Scene-by-scene single trigger */}
                  <div className="pt-2 border-t border-studio-800 flex items-center justify-between text-xs">
                    <span className="text-studio-400">
                      Or generate for selected Scene {scenes[browserAssistIndex]?.scene_number}:
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePlaywrightSingleScene(scenes[browserAssistIndex]?.id, scenes[browserAssistIndex]?.image_prompt)}
                      isLoading={generatingSceneId === scenes[browserAssistIndex]?.id}
                      leftIcon={<Bot className="w-3.5 h-3.5 text-purple-400" />}
                    >
                      Generate Scene {scenes[browserAssistIndex]?.scene_number} Hands-Free
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mode C Manual Drag-Drop Controller */}
        {activeMode === 'mode_c' && (
          <div className="space-y-3 pt-2 border-t border-studio-800 animate-in fade-in">
            <div
              onClick={() => bulkInputRef.current?.click()}
              className="border-2 border-dashed border-emerald-500/40 hover:border-emerald-500 bg-emerald-950/15 hover:bg-emerald-950/30 rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 group"
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                <Upload className="w-6 h-6 text-emerald-400" />
              </div>
              <p className="text-sm font-bold text-emerald-300">
                Bulk Drag & Drop / Upload All Images
              </p>
              <p className="text-xs text-studio-400 mt-0.5">
                Drop multiple image files (e.g. <code>scene_01.png</code>, <code>scene_2.jpg</code>, <code>03.webp</code>) — StoryReel Studio automatically matches filename numbers to each scene!
              </p>
            </div>
          </div>
        )}

        {/* Batch Generation Progress Bar */}
        {isGeneratingBatch && (
          <div className="space-y-2 pt-2 border-t border-studio-800 animate-in fade-in">
            <div className="flex items-center justify-between text-xs">
              <span className="text-pink-300 font-medium">{batchMessage}</span>
              <span className="text-studio-400 font-mono">{Math.round(batchProgress)}%</span>
            </div>
            <div className="w-full bg-studio-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 h-full transition-all duration-300 rounded-full"
                style={{ width: `${batchProgress}%` }}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Scenes Gallery Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {scenes.map((scene) => {
          const imageUrl = getSceneImageUrl(scene);
          const isGeneratingThis = generatingSceneId === scene.id || (isGeneratingBatch && scene.image_status === 'generating');

          return (
            <Card
              key={scene.id}
              variant="glass"
              className="space-y-3 relative group overflow-hidden border-studio-800 hover:border-pink-500/40 transition-all duration-200 flex flex-col justify-between"
            >
              {/* Scene Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-studio-800 border border-studio-700 flex items-center justify-center text-xs font-bold text-studio-200">
                    {scene.scene_number}
                  </div>
                  <span className="text-xs font-bold text-studio-200">
                    Scene {scene.scene_number}
                  </span>
                  <span className="text-[10px] font-mono text-studio-400">
                    ({scene.duration.toFixed(1)}s)
                  </span>
                </div>

                {scene.image_status === 'ready' ? (
                  <Badge variant="success" icon={<CheckCircle2 className="w-3 h-3" />}>
                    Ready
                  </Badge>
                ) : isGeneratingThis ? (
                  <Badge variant="accent">
                    <span className="animate-spin mr-1">⏳</span> Generating
                  </Badge>
                ) : scene.image_status === 'failed' ? (
                  <Badge variant="danger" icon={<AlertCircle className="w-3 h-3" />}>
                    Failed
                  </Badge>
                ) : (
                  <Badge variant="warning">Pending</Badge>
                )}
              </div>

              {/* Image Preview / Placeholder Canvas */}
              <div
                className={`relative w-full rounded-xl overflow-hidden bg-studio-900 border border-studio-800/80 flex items-center justify-center group/img ${
                  currentProject.aspect_ratio === '9:16'
                    ? 'aspect-[9/16] max-h-72'
                    : currentProject.aspect_ratio === '1:1'
                    ? 'aspect-square max-h-56'
                    : 'aspect-video max-h-48'
                }`}
              >
                {imageUrl && scene.image_status === 'ready' ? (
                  <>
                    <img
                      src={imageUrl}
                      alt={`Scene ${scene.scene_number}`}
                      className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-300"
                    />
                    <div
                      onClick={() => setZoomImageScene(scene)}
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 flex items-center justify-center cursor-pointer transition-opacity backdrop-blur-xs"
                    >
                      <div className="px-3 py-1.5 rounded-lg bg-black/70 border border-white/20 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xl">
                        <Eye className="w-3.5 h-3.5" />
                        <span>Fullscreen Preview</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-4 space-y-2">
                    {isGeneratingThis ? (
                      <div className="space-y-2">
                        <div className="animate-spin w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full mx-auto" />
                        <span className="text-xs text-pink-300 font-medium block">
                          AI Generating Scene {scene.scene_number}...
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <ImageIcon className="w-8 h-8 text-studio-600 mx-auto" />
                        <p className="text-xs text-studio-400 font-medium">No Image Generated</p>
                        <p className="text-[10px] text-studio-500 font-mono">
                          Click Generate or Upload below
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Story text excerpt */}
              <p className="text-xs text-studio-300 font-medium line-clamp-2 leading-relaxed">
                "{scene.story_text}"
              </p>

              {/* Prompt snippet & Copy */}
              <div className="p-2 rounded-lg bg-studio-900/80 border border-studio-800 text-[10.5px] text-studio-400 flex items-center justify-between gap-2">
                <span className="truncate font-mono">{scene.image_prompt}</span>
                <button
                  onClick={() => handleCopyPrompt(scene)}
                  className="p-1 hover:text-studio-100 shrink-0"
                  title="Copy Prompt"
                >
                  {copiedSceneId === scene.id ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>

              {/* Card Actions */}
              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="glow"
                  size="sm"
                  onClick={() => handleGenerateSingle(scene.id)}
                  isLoading={isGeneratingThis}
                  leftIcon={<Sparkles className="w-3.5 h-3.5 text-pink-300" />}
                  className="flex-1"
                >
                  {scene.image_status === 'ready' ? 'Regenerate' : 'Generate'}
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleTriggerSingleUpload(scene.id)}
                  leftIcon={<Upload className="w-3.5 h-3.5 text-studio-400" />}
                  title="Upload / Replace Image"
                >
                  Upload
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Fullscreen Zoom Image Modal */}
      {zoomImageScene && (
        <Modal
          isOpen={!!zoomImageScene}
          onClose={() => setZoomImageScene(null)}
          title={`Scene ${zoomImageScene.scene_number} – High Resolution Preview`}
          subtitle={`Duration: ${zoomImageScene.duration.toFixed(1)}s • Aspect Ratio: ${currentProject.aspect_ratio}`}
          maxWidth="4xl"
        >
          <div className="space-y-4">
            <div className="relative rounded-2xl overflow-hidden bg-black border border-studio-800 flex items-center justify-center max-h-[70vh]">
              {getSceneImageUrl(zoomImageScene) && (
                <img
                  src={getSceneImageUrl(zoomImageScene)!}
                  alt={`Scene ${zoomImageScene.scene_number}`}
                  className="max-h-[70vh] w-auto object-contain"
                />
              )}
            </div>

            <div className="p-4 rounded-xl bg-studio-850 border border-studio-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-studio-200">Story Script:</span>
                <span className="text-purple-300 font-mono">
                  {zoomImageScene.camera_shot.toUpperCase()} • {zoomImageScene.camera_motion.type.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-studio-300 leading-relaxed">
                "{zoomImageScene.story_text}"
              </p>
              <div className="pt-2 border-t border-studio-800 text-[11px] text-studio-400 font-mono">
                <span className="text-studio-500">PROMPT: </span>
                {zoomImageScene.image_prompt}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
