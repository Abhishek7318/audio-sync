import React, { useState } from 'react';
import {
  Layers,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Copy,
  Check,
  Download,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  Camera,
  Film,
  Video,
  FileText,
  Share2,
  Table,
  Grid,
  Bot,
  Youtube,
  Clock,
  User,
  Palette
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { Input, Textarea } from '../common/Input';
import { Scene, CameraMotion } from '../../types';
import { api } from '../../services/api';

export const Step3Scenes: React.FC = () => {
  const { currentProject, updateCurrentProject, setStep, saveCurrentProject } = useProject();
  const { settings } = useSettings();
  const { showToast } = useToast();

  // Breakdown State
  const [isBreakingDown, setIsBreakingDown] = useState(false);
  const [breakdownProgress, setBreakdownProgress] = useState(0);
  const [breakdownMessage, setBreakdownMessage] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string>(settings.llm_provider || 'gemini');

  // UI View Mode: 'cards' or 'table'
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Single Scene Prompt Regenerate Modal
  const [regenModalScene, setRegenModalScene] = useState<Scene | null>(null);
  const [regenInstruction, setRegenInstruction] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);

  // YouTube SEO Modal
  const [isSeoModalOpen, setIsSeoModalOpen] = useState(false);
  const [seoData, setSeoData] = useState<any | null>(null);
  const [isLoadingSeo, setIsLoadingSeo] = useState(false);

  if (!currentProject) return null;

  const scenes: Scene[] = currentProject.scenes || [];

  // Trigger LLM Scene Breakdown
  const handleRunBreakdown = async () => {
    if (!currentProject.story_raw_text.trim()) {
      showToast('Please enter your story text first in Step 1', 'error');
      return;
    }

    try {
      setIsBreakingDown(true);
      setBreakdownProgress(15);
      setBreakdownMessage('Sending story script to LLM Engine...');

      const res = await api.breakdownScenes(currentProject.id, {
        provider: selectedProvider,
      });

      const jobId = res.job_id;
      const pollInterval = setInterval(async () => {
        try {
          const job = await api.getJob(jobId);
          setBreakdownProgress(job.progress);
          setBreakdownMessage(job.message);

          if (job.status === 'completed') {
            clearInterval(pollInterval);
            setIsBreakingDown(false);
            if (job.result?.scenes) {
              updateCurrentProject((prev) => ({
                ...prev,
                scenes: job.result.scenes,
              }));
            }
            showToast(`Generated ${job.result?.scenes_count || 0} cinematic scenes!`, 'success');
          } else if (job.status === 'failed') {
            clearInterval(pollInterval);
            setIsBreakingDown(false);
            showToast(`Breakdown error: ${job.error}`, 'error');
          }
        } catch (err) {
          clearInterval(pollInterval);
          setIsBreakingDown(false);
        }
      }, 600);
    } catch (err: any) {
      setIsBreakingDown(false);
      showToast(`Failed to trigger breakdown: ${err.message}`, 'error');
    }
  };

  // Copy Single Prompt
  const handleCopyPrompt = (scene: Scene) => {
    navigator.clipboard.writeText(scene.image_prompt);
    setCopiedId(scene.id);
    showToast(`Copied prompt for Scene ${scene.scene_number}`, 'info');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Copy All Prompts
  const handleCopyAllPrompts = () => {
    if (scenes.length === 0) return;
    const formatted = scenes
      .map(
        (s) =>
          `[Scene ${s.scene_number}] (${s.duration}s)\n${s.story_text}\nPROMPT: ${s.image_prompt}\n`
      )
      .join('\n---\n\n');

    navigator.clipboard.writeText(formatted);
    showToast(`Copied all ${scenes.length} scene prompts to clipboard!`, 'success');
  };

  // Export Prompts as TXT
  const handleExportTxt = () => {
    if (scenes.length === 0) return;
    const content = scenes
      .map(
        (s) =>
          `=== SCENE ${s.scene_number} (${s.start_time}s - ${s.end_time}s | ${s.duration}s) ===\n` +
          `Text: ${s.story_text}\n` +
          `Shot: ${s.camera_shot} | Motion: ${s.camera_motion.type}\n` +
          `Prompt: ${s.image_prompt}\n\n`
      )
      .join('');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentProject.name.replace(/\s+/g, '_')}_Prompts.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported prompts as .txt', 'success');
  };

  // Export Prompts as CSV
  const handleExportCsv = () => {
    if (scenes.length === 0) return;
    const headers = ['Scene', 'Start_Time', 'End_Time', 'Duration', 'Story_Text', 'Camera_Shot', 'Camera_Motion', 'Image_Prompt'];
    const rows = scenes.map((s) => [
      s.scene_number,
      s.start_time,
      s.end_time,
      s.duration,
      `"${s.story_text.replace(/"/g, '""')}"`,
      s.camera_shot,
      s.camera_motion.type,
      `"${s.image_prompt.replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentProject.name.replace(/\s+/g, '_')}_Prompts.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported prompts as .csv', 'success');
  };

  // Single Scene Prompt Regenerate Action
  const handleRegeneratePromptSubmit = async () => {
    if (!regenModalScene) return;
    try {
      setIsRegenerating(true);
      const res = await api.regeneratePrompt(
        currentProject.id,
        regenModalScene.id,
        regenInstruction
      );

      updateCurrentProject((prev) => ({
        ...prev,
        scenes: prev.scenes.map((s) =>
          s.id === regenModalScene.id ? { ...s, image_prompt: res.image_prompt } : s
        ),
      }));

      showToast(`Regenerated prompt for Scene ${regenModalScene.scene_number}`, 'success');
      setRegenModalScene(null);
      setRegenInstruction('');
    } catch (err: any) {
      showToast(`Regeneration failed: ${err.message}`, 'error');
    } finally {
      setIsRegenerating(false);
    }
  };

  // Scene Field Update Helper
  const handleUpdateSceneField = (sceneId: string, field: keyof Scene, value: any) => {
    updateCurrentProject((prev) => ({
      ...prev,
      scenes: prev.scenes.map((s) => (s.id === sceneId ? { ...s, [field]: value } : s)),
    }));
  };

  // Move Scene Up/Down
  const handleMoveScene = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= scenes.length) return;

    updateCurrentProject((prev) => {
      const nextScenes = [...prev.scenes];
      const temp = nextScenes[index];
      nextScenes[index] = nextScenes[targetIdx];
      nextScenes[targetIdx] = temp;

      // Re-index scene numbers
      return {
        ...prev,
        scenes: nextScenes.map((s, idx) => ({ ...s, scene_number: idx + 1 })),
      };
    });
  };

  // Delete Scene
  const handleDeleteScene = (sceneId: string) => {
    updateCurrentProject((prev) => ({
      ...prev,
      scenes: prev.scenes
        .filter((s) => s.id !== sceneId)
        .map((s, idx) => ({ ...s, scene_number: idx + 1 })),
    }));
    showToast('Scene deleted', 'info');
  };

  // YouTube SEO Generator
  const handleOpenYoutubeSEO = async () => {
    try {
      setIsLoadingSeo(true);
      setIsSeoModalOpen(true);
      const data = await api.getYoutubeSEO(currentProject.id);
      setSeoData(data);
    } catch (err: any) {
      showToast(`SEO Generation failed: ${err.message}`, 'error');
    } finally {
      setIsLoadingSeo(false);
    }
  };

  const handleProceed = () => {
    saveCurrentProject();
    setStep(4);
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6 overflow-y-auto h-full pb-24">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-purple-950/60 via-indigo-950/40 to-studio-900 border border-purple-500/20 p-5 rounded-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">
              Step 3: LLM Scene Breakdown & Prompt Bible
            </h1>
            <Badge variant="accent">{scenes.length} Scenes</Badge>
            <Badge variant="brand">{currentProject.style_bible.preset_name}</Badge>
          </div>
          <p className="text-xs text-studio-400 max-w-2xl">
            AI splits your story into 3–12s cinematic scenes and injects the Character & Style Bible into every image prompt.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="md"
            leftIcon={<ArrowLeft className="w-4 h-4" />}
            onClick={() => setStep(2)}
          >
            Back to Alignment
          </Button>
          <Button
            variant="glow"
            size="md"
            rightIcon={<ArrowRight className="w-4 h-4" />}
            onClick={handleProceed}
            disabled={scenes.length === 0}
          >
            Proceed to Image Gen
          </Button>
        </div>
      </div>

      {/* AI Breakdown Controller Card */}
      <Card variant="glass" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-studio-100">
                LLM Scene Breakdown & Prompt Generator
              </h3>
              <p className="text-xs text-studio-400">
                Injects {currentProject.characters.length} characters and '{currentProject.style_bible.preset_name}' style into every scene prompt.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="bg-studio-900 border border-studio-700 rounded-xl px-3 py-1.5 text-xs text-studio-100 focus:outline-none focus:border-purple-500"
            >
              <option value="gemini">Google Gemini 1.5 Flash (Fast)</option>
              <option value="openai">OpenAI GPT-4o (High Precision)</option>
              <option value="anthropic">Anthropic Claude 3.5 Sonnet</option>
              <option value="mock">Smart Cinematic Engine (100% Free)</option>
            </select>

            <Button
              variant="glow"
              size="sm"
              onClick={handleRunBreakdown}
              isLoading={isBreakingDown}
              leftIcon={<Sparkles className="w-4 h-4 text-pink-300" />}
            >
              Run Scene Breakdown
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        {isBreakingDown && (
          <div className="space-y-2 pt-2 border-t border-studio-800 animate-in fade-in">
            <div className="flex items-center justify-between text-xs">
              <span className="text-purple-300 font-medium">{breakdownMessage}</span>
              <span className="text-studio-400 font-mono">{Math.round(breakdownProgress)}%</span>
            </div>
            <div className="w-full bg-studio-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-purple-500 via-indigo-500 to-pink-400 h-full transition-all duration-300 rounded-full"
                style={{ width: `${breakdownProgress}%` }}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Toolbar & Bulk Actions */}
      {scenes.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-studio-900/60 p-3 rounded-2xl border border-studio-800 text-xs">
          {/* Left: View Mode Toggle & Stats */}
          <div className="flex items-center gap-3">
            <div className="flex bg-studio-850 p-0.5 rounded-xl border border-studio-700/60">
              <button
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
                  viewMode === 'cards'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-studio-400 hover:text-studio-200'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                <span>Card View</span>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
                  viewMode === 'table'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-studio-400 hover:text-studio-200'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>Table View</span>
              </button>
            </div>

            <span className="text-studio-400 font-mono">
              Total Duration: {scenes.reduce((a, s) => a + s.duration, 0).toFixed(1)}s
            </span>
          </div>

          {/* Right: Export & Copy Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyAllPrompts}
              leftIcon={<Copy className="w-3.5 h-3.5 text-indigo-400" />}
            >
              Copy All Prompts
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportTxt}
              leftIcon={<Download className="w-3.5 h-3.5 text-emerald-400" />}
            >
              .TXT
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              leftIcon={<Download className="w-3.5 h-3.5 text-emerald-400" />}
            >
              .CSV
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleOpenYoutubeSEO}
              leftIcon={<Youtube className="w-3.5 h-3.5 text-rose-400" />}
            >
              YouTube Metadata
            </Button>
          </div>
        </div>
      )}

      {/* Main Scenes Content */}
      {scenes.length === 0 ? (
        <Card variant="glass" className="p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-purple-600/15 border border-purple-500/30 flex items-center justify-center mx-auto text-purple-400">
            <Layers className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-studio-100">No Scenes Generated Yet</h3>
            <p className="text-xs text-studio-400 max-w-md mx-auto">
              Click <strong>"Run Scene Breakdown"</strong> above. The LLM will split your story into 3-12s scenes and generate consistent image prompts.
            </p>
          </div>
          <Button
            variant="glow"
            size="md"
            onClick={handleRunBreakdown}
            isLoading={isBreakingDown}
            leftIcon={<Sparkles className="w-4 h-4 text-pink-300" />}
          >
            Generate Scenes Now
          </Button>
        </Card>
      ) : viewMode === 'cards' ? (
        /* Rich Cards Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {scenes.map((scene, index) => (
            <Card
              key={scene.id}
              variant="glass"
              className="space-y-4 relative group border-studio-800 hover:border-purple-500/40 transition-all duration-200"
            >
              {/* Card Header: Scene Number, Timecode, Shot & Motion */}
              <div className="flex items-center justify-between border-b border-studio-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-xs font-extrabold text-white shadow-sm">
                    {scene.scene_number}
                  </div>
                  <div>
                    <span className="font-bold text-xs text-studio-200">
                      Scene {scene.scene_number}
                    </span>
                    <span className="text-[11px] font-mono text-purple-300 ml-2">
                      {scene.start_time.toFixed(1)}s - {scene.end_time.toFixed(1)}s ({scene.duration.toFixed(1)}s)
                    </span>
                  </div>
                </div>

                {/* Move & Delete Buttons */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleMoveScene(index, 'up')}
                    disabled={index === 0}
                    className="p-1 text-studio-500 hover:text-studio-200 disabled:opacity-20 rounded"
                    title="Move Scene Up"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleMoveScene(index, 'down')}
                    disabled={index === scenes.length - 1}
                    className="p-1 text-studio-500 hover:text-studio-200 disabled:opacity-20 rounded"
                    title="Move Scene Down"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteScene(scene.id)}
                    className="p-1 text-studio-500 hover:text-rose-400 rounded transition-colors ml-1"
                    title="Delete Scene"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Story excerpt */}
              <div className="p-2.5 rounded-xl bg-studio-900/80 border border-studio-800/60 text-xs text-studio-300 font-medium leading-relaxed">
                "{scene.story_text}"
              </div>

              {/* Tags: Shot, Motion, Mood, Characters */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {/* Camera Shot Selector */}
                <select
                  value={scene.camera_shot}
                  onChange={(e) => handleUpdateSceneField(scene.id, 'camera_shot', e.target.value)}
                  className="bg-studio-900 border border-studio-800 rounded-lg px-2 py-1 text-[11px] text-studio-200"
                >
                  <option value="wide">Wide Shot</option>
                  <option value="medium">Medium Shot</option>
                  <option value="close_up">Close-Up</option>
                  <option value="extreme_close_up">Extreme Close-Up</option>
                  <option value="over_shoulder">Over Shoulder</option>
                  <option value="aerial">Aerial Drone View</option>
                </select>

                {/* Camera Motion Selector */}
                <select
                  value={scene.camera_motion.type}
                  onChange={(e) =>
                    handleUpdateSceneField(scene.id, 'camera_motion', {
                      ...scene.camera_motion,
                      type: e.target.value,
                    })
                  }
                  className="bg-studio-900 border border-studio-800 rounded-lg px-2 py-1 text-[11px] text-purple-300 font-medium"
                >
                  <option value="zoom_in">Slow Zoom In</option>
                  <option value="zoom_out">Slow Zoom Out</option>
                  <option value="pan_left">Pan Left</option>
                  <option value="pan_right">Pan Right</option>
                  <option value="slow_drift">Slow Drift</option>
                  <option value="subtle_tilt">Subtle Tilt</option>
                </select>

                {scene.characters_present && scene.characters_present.map((char) => (
                  <span
                    key={char}
                    className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10.5px] font-semibold flex items-center gap-1"
                  >
                    <User className="w-3 h-3" />
                    {char}
                  </span>
                ))}
              </div>

              {/* Image Prompt Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-studio-400 uppercase tracking-wider text-[10px]">
                    Image Generation Prompt:
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setRegenModalScene(scene)}
                      className="text-purple-400 hover:text-purple-300 flex items-center gap-1 text-[11px] font-medium"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Refine</span>
                    </button>
                    <button
                      onClick={() => handleCopyPrompt(scene)}
                      className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 text-[11px] font-medium"
                    >
                      {copiedId === scene.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedId === scene.id ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <textarea
                  rows={4}
                  value={scene.image_prompt}
                  onChange={(e) => handleUpdateSceneField(scene.id, 'image_prompt', e.target.value)}
                  className="w-full bg-studio-900 border border-studio-800 focus:border-purple-500/80 rounded-xl p-3 text-xs text-studio-100 font-sans leading-relaxed focus:outline-none focus:ring-1 focus:ring-purple-500/20 resize-none"
                />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        /* Compact Table View */
        <Card variant="glass" className="overflow-x-auto p-0">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-studio-800 bg-studio-900/90 text-studio-400 uppercase tracking-wider text-[10px]">
                <th className="p-3 w-12 text-center">#</th>
                <th className="p-3 w-28">Time / Duration</th>
                <th className="p-3 w-1/4">Story Script</th>
                <th className="p-3 w-32">Shot & Motion</th>
                <th className="p-3">Prompt</th>
                <th className="p-3 w-20 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-studio-800/60">
              {scenes.map((scene, idx) => (
                <tr key={scene.id} className="hover:bg-studio-850/50 transition-colors">
                  <td className="p-3 text-center font-bold text-indigo-400">{scene.scene_number}</td>
                  <td className="p-3 font-mono text-[11px] text-purple-300">
                    {scene.start_time.toFixed(1)}s - {scene.end_time.toFixed(1)}s
                    <div className="text-[10px] text-studio-500">({scene.duration.toFixed(1)}s)</div>
                  </td>
                  <td className="p-3 text-studio-200 font-medium leading-relaxed">
                    {scene.story_text}
                  </td>
                  <td className="p-3 space-y-1">
                    <span className="inline-block px-1.5 py-0.5 rounded bg-studio-800 text-studio-300 text-[10px]">
                      {scene.camera_shot}
                    </span>
                    <span className="inline-block px-1.5 py-0.5 rounded bg-purple-950/40 border border-purple-500/30 text-purple-300 text-[10px] block">
                      {scene.camera_motion.type}
                    </span>
                  </td>
                  <td className="p-3">
                    <input
                      type="text"
                      value={scene.image_prompt}
                      onChange={(e) => handleUpdateSceneField(scene.id, 'image_prompt', e.target.value)}
                      className="w-full bg-studio-900 border border-studio-800 rounded-lg px-2.5 py-1 text-xs text-studio-100 font-sans focus:outline-none focus:border-purple-500"
                    />
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => handleCopyPrompt(scene)}
                      className="p-1.5 text-studio-400 hover:text-indigo-300 rounded"
                      title="Copy prompt"
                    >
                      {copiedId === scene.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Single Prompt Regeneration Modal */}
      {regenModalScene && (
        <Modal
          isOpen={!!regenModalScene}
          onClose={() => setRegenModalScene(null)}
          title={`Refine Prompt – Scene ${regenModalScene.scene_number}`}
          subtitle="Provide specific directions or changes to enhance this prompt"
          maxWidth="lg"
        >
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-studio-850 border border-studio-800 text-xs text-studio-300">
              "{regenModalScene.story_text}"
            </div>

            <Textarea
              label="Custom Instruction for AI"
              placeholder="e.g. Make it more intense, add heavy rain reflections on Vikram's leather jacket, closeup on eye reflection..."
              value={regenInstruction}
              onChange={(e) => setRegenInstruction(e.target.value)}
              rows={3}
              autoFocus
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-studio-800">
              <Button variant="ghost" onClick={() => setRegenModalScene(null)}>
                Cancel
              </Button>
              <Button
                variant="glow"
                onClick={handleRegeneratePromptSubmit}
                isLoading={isRegenerating}
                leftIcon={<Sparkles className="w-4 h-4 text-pink-300" />}
              >
                Regenerate Prompt
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* YouTube SEO Metadata Modal */}
      <Modal
        isOpen={isSeoModalOpen}
        onClose={() => setIsSeoModalOpen(false)}
        title="YouTube Title, Description & Thumbnail Prompt"
        subtitle="Optimized YouTube packaging ready to copy & publish"
        maxWidth="2xl"
      >
        <div className="space-y-4">
          {isLoadingSeo ? (
            <div className="py-12 text-center text-studio-400">
              <div className="animate-spin w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-2" />
              <span>Generating YouTube packaging...</span>
            </div>
          ) : seoData ? (
            <div className="space-y-4 text-xs">
              {/* Titles */}
              <div className="space-y-2">
                <label className="font-bold text-studio-300 uppercase">Suggested Titles:</label>
                <div className="p-3 rounded-xl bg-studio-850 border border-studio-800 flex items-center justify-between">
                  <span className="font-semibold text-studio-100">{seoData.title_hi}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(seoData.title_hi);
                      showToast('Copied Hindi Title', 'info');
                    }}
                    className="p-1 text-studio-400 hover:text-studio-100"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="p-3 rounded-xl bg-studio-850 border border-studio-800 flex items-center justify-between">
                  <span className="font-semibold text-studio-100">{seoData.title_en}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(seoData.title_en);
                      showToast('Copied English Title', 'info');
                    }}
                    className="p-1 text-studio-400 hover:text-studio-100"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-studio-300 uppercase">Description with Timestamps:</label>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(seoData.description);
                      showToast('Copied Description', 'info');
                    }}
                    className="text-indigo-400 hover:text-indigo-300 text-xs font-semibold"
                  >
                    Copy Description
                  </button>
                </div>
                <textarea
                  rows={6}
                  readOnly
                  value={seoData.description}
                  className="w-full bg-studio-900 border border-studio-800 rounded-xl p-3 text-xs text-studio-200 font-mono"
                />
              </div>

              {/* Thumbnail Prompt */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-studio-300 uppercase">Thumbnail Image Prompt:</label>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(seoData.thumbnail_prompt);
                      showToast('Copied Thumbnail Prompt', 'info');
                    }}
                    className="text-purple-400 hover:text-purple-300 text-xs font-semibold"
                  >
                    Copy Prompt
                  </button>
                </div>
                <textarea
                  rows={2}
                  readOnly
                  value={seoData.thumbnail_prompt}
                  className="w-full bg-studio-900 border border-studio-800 rounded-xl p-3 text-xs text-studio-200"
                />
              </div>
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  );
};
