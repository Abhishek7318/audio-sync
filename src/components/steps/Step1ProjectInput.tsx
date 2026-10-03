import React, { useState, useEffect } from 'react';
import {
  FileText,
  Upload,
  Music,
  User,
  Plus,
  Trash2,
  Sparkles,
  ArrowRight,
  Info,
  CheckCircle2,
  Volume2,
  Palette,
  Sliders,
  ChevronDown,
  ChevronUp,
  Mic,
  Radio,
  Play,
  Pause,
  Bot
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { Input, Textarea } from '../common/Input';
import { Badge } from '../common/Badge';
import { electronBridge } from '../../services/electronBridge';
import { CharacterProfile } from '../../types';
import { api } from '../../services/api';
import { STYLE_PRESETS, getStylePresetById, getDefaultStyleBible } from '../../data/stylePresets';

export const Step1ProjectInput: React.FC = () => {
  const { currentProject, updateCurrentProject, setStep, saveCurrentProject } = useProject();
  const { showToast } = useToast();

  const [showBibleDetails, setShowBibleDetails] = useState(false);
  const [newCharName, setNewCharName] = useState('');

  // Audio Mode: 'upload' or 'tts'
  const [audioInputMode, setAudioInputMode] = useState<'upload' | 'tts'>('upload');
  const [selectedVoice, setSelectedVoice] = useState('hi-IN-MadhurNeural');
  const [speechSpeed, setSpeechSpeed] = useState(0); // -20 to +20 %
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);
  const [voicesList, setVoicesList] = useState<any[]>([]);

  if (!currentProject) return null;

  // Load TTS voices on mount
  useEffect(() => {
    api.getTTSVoices()
      .then((data) => {
        setVoicesList(data);
        // Default voice based on project language
        if (currentProject.language.toLowerCase().includes('hindi')) {
          setSelectedVoice('hi-IN-MadhurNeural');
        } else {
          setSelectedVoice('en-US-ChristopherNeural');
        }
      })
      .catch((err) => console.error('Failed to load TTS voices:', err));
  }, [currentProject.language]);

  const rawText = currentProject.story_raw_text || '';
  const wordCount = rawText.trim() ? rawText.trim().split(/\s+/).length : 0;
  const charCount = rawText.length;
  const estimatedScenes = Math.max(1, Math.ceil(wordCount / 22)); // ~22 words per 6-8s scene

  // Audio picker handler
  const handleSelectAudio = async () => {
    const selected = await electronBridge.selectAudioFile();
    if (selected) {
      const filename = selected.split(/[\\/]/).pop() || 'narration.mp3';
      try {
        const audioTrack = await api.uploadAudio(currentProject.id, undefined, selected);
        updateCurrentProject((prev) => ({
          ...prev,
          narration_audio: audioTrack,
        }));
        showToast(`Loaded audio file: ${filename}`, 'success');
      } catch (err: any) {
        showToast(`Failed to load audio: ${err.message}`, 'error');
      }
    }
  };

  // Browser file input fallback
  const handleAudioFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const audioTrack = await api.uploadAudio(currentProject.id, file);
        updateCurrentProject((prev) => ({
          ...prev,
          narration_audio: audioTrack,
        }));
        showToast(`Uploaded audio: ${file.name}`, 'success');
      } catch (err: any) {
        showToast(`Failed to upload audio: ${err.message}`, 'error');
      }
    }
  };

  // Generate TTS Handler
  const handleGenerateTTS = async () => {
    if (!currentProject.story_raw_text.trim()) {
      showToast('Please enter your story text first before generating voice narration', 'error');
      return;
    }

    try {
      setIsGeneratingTTS(true);
      const audioTrack = await api.generateTTS(currentProject.id, {
        text: currentProject.story_raw_text,
        voice: selectedVoice,
        speed_rate: speechSpeed,
      });

      updateCurrentProject((prev) => ({
        ...prev,
        narration_audio: audioTrack,
      }));

      showToast(`AI Narration generated successfully (${audioTrack.duration.toFixed(1)}s)`, 'success');
    } catch (err: any) {
      showToast(`TTS Generation failed: ${err.message}`, 'error');
    } finally {
      setIsGeneratingTTS(false);
    }
  };

  // Character Management
  const handleAddCharacter = () => {
    if (!newCharName.trim()) return;
    const newChar: CharacterProfile = {
      id: Math.random().toString(36).substring(2, 9),
      name: newCharName.trim(),
      aliases: [],
      age_appearance: 'Late 20s, tall, athletic build',
      physical_description: 'Sharp facial features, deep dark brown eyes, messy black hair with side fade',
      clothing_style: 'Dark fitted leather jacket over a charcoal henley shirt, rugged cargo pants',
      key_colors: ['charcoal', 'deep indigo', 'matte black'],
      personality_vibe: 'Determined, enigmatic, vigilant',
    };

    updateCurrentProject((prev) => ({
      ...prev,
      characters: [...prev.characters, newChar],
    }));
    setNewCharName('');
    showToast(`Added character "${newChar.name}" to Bible`, 'info');
  };

  const handleUpdateCharacter = (id: string, field: keyof CharacterProfile, value: any) => {
    updateCurrentProject((prev) => ({
      ...prev,
      characters: prev.characters.map((c) =>
        c.id === id ? { ...c, [field]: value } : c
      ),
    }));
  };

  const handleRemoveCharacter = (id: string) => {
    updateCurrentProject((prev) => ({
      ...prev,
      characters: prev.characters.filter((c) => c.id !== id),
    }));
  };

  const handleProceed = () => {
    if (!currentProject.story_raw_text.trim()) {
      showToast('Please enter your story text first', 'error');
      return;
    }
    saveCurrentProject();
    setStep(2);
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6 overflow-y-auto h-full pb-20">
      {/* Top Banner / Goal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-studio-900 border border-indigo-500/20 p-5 rounded-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">
              Step 1: Story Text & Narration Audio
            </h1>
            <Badge variant="brand">{currentProject.language}</Badge>
            <Badge variant="neutral">{currentProject.aspect_ratio}</Badge>
          </div>
          <p className="text-xs text-studio-400 max-w-2xl">
            Input your story narration text, provide an audio recording for precise word-level synchronization, and customize the Character & Style Bible.
          </p>
        </div>

        <Button
          variant="glow"
          size="md"
          rightIcon={<ArrowRight className="w-4 h-4" />}
          onClick={handleProceed}
          disabled={!currentProject.story_raw_text.trim()}
        >
          Proceed to Alignment
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Story Input */}
        <div className="lg:col-span-7 space-y-6">
          <Card variant="glass" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-studio-100 uppercase tracking-wide">
                  Full Story Script
                </h3>
              </div>
              <div className="flex items-center gap-3 text-xs text-studio-400 font-mono">
                <span>{wordCount} words</span>
                <span>•</span>
                <span>{charCount} chars</span>
                <span>•</span>
                <span className="text-indigo-400 font-semibold">~{estimatedScenes} scenes</span>
              </div>
            </div>

            <Textarea
              rows={12}
              placeholder="Paste your story narration script here in Hindi, English, or Hinglish...&#10;&#10;Example (Hindi):&#10;एक घने जंगल के बीच, एक प्राचीन मंदिर की परछाईं में विक्रम खड़ा था। उसने अपने हाथ में पकड़े पुराने नक्शे को देखा...&#10;&#10;Example (English):&#10;Deep inside the dense mountain forest, shadows danced around an ancient monolithic temple. Vikram gripped the worn parchment tightly..."
              value={currentProject.story_raw_text}
              onChange={(e) =>
                updateCurrentProject((prev) => ({
                  ...prev,
                  story_raw_text: e.target.value,
                }))
              }
              className="font-sans leading-relaxed text-sm"
            />

            <div className="flex items-center justify-between text-xs text-studio-400 bg-studio-900/60 p-3 rounded-xl border border-studio-800">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>
                  Tip: Paragraph breaks and punctuation will help the LLM create natural scene boundaries (3–12 seconds each).
                </span>
              </div>
            </div>
          </Card>

          {/* Audio Input: Dual Mode (Upload or AI Voice TTS) */}
          <Card variant="glass" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-studio-100 uppercase tracking-wide">
                  Narration Audio Track
                </h3>
              </div>
              {currentProject.narration_audio.original_filename && (
                <Badge variant="success" icon={<CheckCircle2 className="w-3 h-3" />}>
                  {currentProject.narration_audio.duration.toFixed(1)}s Attached
                </Badge>
              )}
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex bg-studio-900/80 p-1 rounded-xl border border-studio-800 text-xs">
              <button
                type="button"
                onClick={() => setAudioInputMode('upload')}
                className={`flex-1 py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  audioInputMode === 'upload'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-studio-400 hover:text-studio-200'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Audio File</span>
              </button>

              <button
                type="button"
                onClick={() => setAudioInputMode('tts')}
                className={`flex-1 py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  audioInputMode === 'tts'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm'
                    : 'text-studio-400 hover:text-studio-200'
                }`}
              >
                <Bot className="w-3.5 h-3.5 text-pink-300" />
                <span>Generate AI Voice (TTS)</span>
              </button>
            </div>

            {audioInputMode === 'upload' ? (
              /* Option A: File Upload / Drag-Drop */
              <div
                onClick={handleSelectAudio}
                className="border-2 border-dashed border-studio-700/80 hover:border-indigo-500/60 bg-studio-850/40 hover:bg-studio-800/60 rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 group"
              >
                <div className="w-12 h-12 rounded-xl bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <Upload className="w-6 h-6 text-indigo-400" />
                </div>

                {currentProject.narration_audio.original_filename ? (
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-indigo-300">
                      {currentProject.narration_audio.original_filename}
                    </p>
                    <p className="text-xs text-studio-400">
                      Click to replace audio file (MP3, WAV, M4A, AAC, FLAC)
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-studio-200">
                      Click or drag & drop narration audio file
                    </p>
                    <p className="text-xs text-studio-400">
                      Supports MP3, WAV, M4A, AAC, FLAC (Hindi / English speech)
                    </p>
                  </div>
                )}

                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  id="browser-audio-input"
                  onChange={handleAudioFileInput}
                />
              </div>
            ) : (
              /* Option B: AI Voice Text-to-Speech */
              <div className="p-4 rounded-2xl bg-studio-850/60 border border-purple-500/20 space-y-4 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-purple-400 animate-pulse" />
                    <span className="text-xs font-bold text-studio-200 uppercase tracking-wide">
                      AI Story Voice Narration
                    </span>
                  </div>
                  <span className="text-[11px] text-purple-300 bg-purple-500/15 px-2 py-0.5 rounded-full border border-purple-500/30">
                    No Audio File Required
                  </span>
                </div>

                {/* Voice Selector */}
                <div className="space-y-1.5">
                  <label className="block text-xs text-studio-400 font-medium">
                    Choose Natural Voice:
                  </label>
                  <select
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="w-full bg-studio-900 border border-studio-700 rounded-xl px-3 py-2 text-xs text-studio-100 font-medium focus:outline-none focus:border-purple-500"
                  >
                    {voicesList.length > 0 ? (
                      voicesList.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} {v.recommended ? '★ (Recommended)' : ''}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="hi-IN-MadhurNeural">Madhur (Hindi Male - Deep & Cinematic)</option>
                        <option value="hi-IN-SwaraNeural">Swara (Hindi Female - Expressive Storyteller)</option>
                        <option value="en-US-ChristopherNeural">Christopher (US Male - Cinematic)</option>
                        <option value="en-US-JennyNeural">Jenny (US Female - Warm)</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Speed adjustment slider */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-studio-400">
                    <span>Narration Pace:</span>
                    <span className="font-mono text-purple-300">
                      {speechSpeed > 0 ? `+${speechSpeed}%` : `${speechSpeed}%`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-25"
                    max="25"
                    step="5"
                    value={speechSpeed}
                    onChange={(e) => setSpeechSpeed(parseInt(e.target.value))}
                    className="w-full accent-purple-500 h-1.5 bg-studio-800 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-studio-500 font-mono">
                    <span>Slower (-25%)</span>
                    <span>Normal (0%)</span>
                    <span>Faster (+25%)</span>
                  </div>
                </div>

                {/* Generate Button */}
                <Button
                  type="button"
                  variant="glow"
                  size="md"
                  onClick={handleGenerateTTS}
                  isLoading={isGeneratingTTS}
                  disabled={!currentProject.story_raw_text.trim()}
                  leftIcon={<Sparkles className="w-4 h-4 text-pink-300" />}
                  className="w-full"
                >
                  {isGeneratingTTS ? 'Generating Speech from Story...' : 'Generate Voice Narration Now'}
                </Button>

                {currentProject.narration_audio.original_filename && (
                  <div className="flex items-center justify-between text-xs bg-studio-900/80 p-2.5 rounded-xl border border-studio-800 text-studio-300">
                    <div className="flex items-center gap-2 truncate">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="truncate">{currentProject.narration_audio.original_filename}</span>
                    </div>
                    <span className="text-purple-300 font-mono font-bold shrink-0">
                      {currentProject.narration_audio.duration.toFixed(1)}s
                    </span>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column (5 cols): Style Bible & Character Consistency */}
        <div className="lg:col-span-5 space-y-6">
          {/* Style Bible Card */}
          <Card variant="glass" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-pink-400" />
                <h3 className="text-sm font-bold text-studio-100 uppercase tracking-wide">
                  Visual Style Bible
                </h3>
              </div>
              <Badge variant="accent">{getStylePresetById(currentProject.style_bible.preset_name).name}</Badge>
            </div>

            <div className="space-y-3 text-xs">
              {/* Preset Selector Dropdown & Quick Badges */}
              <div>
                <label className="block text-studio-400 font-medium mb-1.5">Art Style Preset</label>
                <select
                  value={currentProject.style_bible.preset_name}
                  onChange={(e) => {
                    const presetId = e.target.value;
                    const defaultBible = getDefaultStyleBible(presetId);
                    updateCurrentProject((prev) => ({
                      ...prev,
                      style_bible: {
                        ...defaultBible,
                        custom_description:
                          presetId === 'custom'
                            ? prev.style_bible.custom_description || ''
                            : defaultBible.custom_description,
                      },
                    }));
                    showToast(`Applied ${getStylePresetById(presetId).name}`, 'info');
                  }}
                  className="w-full bg-studio-900 border border-studio-700/80 rounded-xl px-3 py-2 text-xs text-studio-100 focus:outline-none focus:border-indigo-500"
                >
                  {STYLE_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick Style Chips */}
              <div className="flex flex-wrap gap-1.5">
                {STYLE_PRESETS.map((preset) => {
                  const isSelected = currentProject.style_bible.preset_name === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        const defaultBible = getDefaultStyleBible(preset.id);
                        updateCurrentProject((prev) => ({
                          ...prev,
                          style_bible: {
                            ...defaultBible,
                            custom_description:
                              preset.id === 'custom'
                                ? prev.style_bible.custom_description || ''
                                : defaultBible.custom_description,
                          },
                        }));
                        showToast(`Applied ${preset.name}`, 'info');
                      }}
                      className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400 font-semibold'
                          : 'bg-studio-850 hover:bg-studio-800 text-studio-400 hover:text-studio-200 border border-studio-800'
                      }`}
                    >
                      {preset.name.split(' (')[0]}
                    </button>
                  );
                })}
              </div>

              {/* Active Preset Summary Banner */}
              <div className="bg-studio-900/90 border border-studio-800 p-3 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-indigo-300 font-semibold text-[11px]">
                    Active Medium & Render:
                  </span>
                  <span className="text-studio-500 text-[10px]">Injected into all scenes</span>
                </div>
                <p className="text-[11px] text-studio-200 leading-relaxed italic bg-studio-950/60 p-2 rounded-lg border border-studio-850">
                  "{currentProject.style_bible.art_medium}"
                </p>
              </div>

              {/* Custom Description textarea if custom selected */}
              {currentProject.style_bible.preset_name === 'custom' && (
                <div className="pt-1">
                  <Textarea
                    label="Custom Style Prompt Definition"
                    rows={2}
                    placeholder="e.g. Masterpiece oil painting, thick impasto strokes, Rembrandt lighting, rich gold and crimson tones..."
                    value={currentProject.style_bible.custom_description || ''}
                    onChange={(e) =>
                      updateCurrentProject((prev) => ({
                        ...prev,
                        style_bible: {
                          ...prev.style_bible,
                          custom_description: e.target.value,
                          art_medium: e.target.value || prev.style_bible.art_medium,
                        },
                      }))
                    }
                  />
                </div>
              )}

              {/* Fine-tune Details Accordion */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-studio-400 font-medium">Fine-tune Lighting, Lens & Medium</span>
                  <button
                    onClick={() => setShowBibleDetails(!showBibleDetails)}
                    className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 text-[11px]"
                  >
                    {showBibleDetails ? 'Hide Details' : 'Customize Bible'}
                    {showBibleDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>

                {showBibleDetails && (
                  <div className="space-y-2.5 pt-2 border-t border-studio-800 animate-in fade-in">
                    <Input
                      label="Art Medium / Aesthetic"
                      value={currentProject.style_bible.art_medium}
                      onChange={(e) =>
                        updateCurrentProject((prev) => ({
                          ...prev,
                          style_bible: { ...prev.style_bible, art_medium: e.target.value },
                        }))
                      }
                    />
                    <Input
                      label="Lighting"
                      value={currentProject.style_bible.lighting}
                      onChange={(e) =>
                        updateCurrentProject((prev) => ({
                          ...prev,
                          style_bible: { ...prev.style_bible, lighting: e.target.value },
                        }))
                      }
                    />
                    <Input
                      label="Color Palette"
                      value={currentProject.style_bible.color_palette}
                      onChange={(e) =>
                        updateCurrentProject((prev) => ({
                          ...prev,
                          style_bible: { ...prev.style_bible, color_palette: e.target.value },
                        }))
                      }
                    />
                    <Input
                      label="Camera & Lens"
                      value={currentProject.style_bible.camera_lens}
                      onChange={(e) =>
                        updateCurrentProject((prev) => ({
                          ...prev,
                          style_bible: { ...prev.style_bible, camera_lens: e.target.value },
                        }))
                      }
                    />
                    <Textarea
                      label="Negative Prompt Filter"
                      rows={2}
                      value={currentProject.style_bible.negative_prompt}
                      onChange={(e) =>
                        updateCurrentProject((prev) => ({
                          ...prev,
                          style_bible: { ...prev.style_bible, negative_prompt: e.target.value },
                        }))
                      }
                    />
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          const defaultBible = getDefaultStyleBible(currentProject.style_bible.preset_name);
                          updateCurrentProject((prev) => ({
                            ...prev,
                            style_bible: defaultBible,
                          }));
                          showToast('Reset Style Bible to preset defaults', 'info');
                        }}
                        className="text-[11px] text-studio-400 hover:text-rose-300 underline"
                      >
                        Reset to preset defaults
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Character Bible Card (Consistency across all images) */}
          <Card variant="glass" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-studio-100 uppercase tracking-wide">
                  Character Bible
                </h3>
              </div>
              <span className="text-[11px] text-studio-400">
                {currentProject.characters.length} characters
              </span>
            </div>

            <p className="text-xs text-studio-400">
              Define recurring characters with fixed facial features, age, clothing, and colors so they look consistent across every AI-generated scene.
            </p>

            {/* Add Character input */}
            <div className="flex gap-2">
              <Input
                placeholder="Character Name (e.g. Vikram / Maya)"
                value={newCharName}
                onChange={(e) => setNewCharName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCharacter()}
              />
              <Button
                variant="secondary"
                size="md"
                onClick={handleAddCharacter}
                disabled={!newCharName.trim()}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Add
              </Button>
            </div>

            {/* Characters List */}
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {currentProject.characters.length === 0 ? (
                <div className="p-4 rounded-xl bg-studio-900/60 border border-studio-800 text-center text-xs text-studio-500">
                  No recurring characters defined yet. Add key characters to keep their face & clothing consistent.
                </div>
              ) : (
                currentProject.characters.map((char) => (
                  <div
                    key={char.id}
                    className="p-3.5 rounded-xl bg-studio-850/80 border border-studio-800 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-indigo-300">
                        {char.name}
                      </span>
                      <button
                        onClick={() => handleRemoveCharacter(char.id)}
                        className="p-1 text-studio-500 hover:text-rose-400 rounded transition-colors"
                        title="Delete character"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <input
                        type="text"
                        placeholder="Appearance & Age (e.g. Late 20s, sharp jawline, brown eyes)"
                        value={char.physical_description}
                        onChange={(e) =>
                          handleUpdateCharacter(char.id, 'physical_description', e.target.value)
                        }
                        className="w-full bg-studio-900 border border-studio-800 rounded-lg px-2.5 py-1 text-xs text-studio-200 placeholder-studio-600"
                      />
                      <input
                        type="text"
                        placeholder="Clothing style & Colors (e.g. Dark hooded jacket, charcoal shirt)"
                        value={char.clothing_style}
                        onChange={(e) =>
                          handleUpdateCharacter(char.id, 'clothing_style', e.target.value)
                        }
                        className="w-full bg-studio-900 border border-studio-800 rounded-lg px-2.5 py-1 text-xs text-studio-200 placeholder-studio-600"
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
