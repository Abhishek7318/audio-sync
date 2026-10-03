import React, { useState } from 'react';
import {
  Sparkles,
  Film,
  Smartphone,
  Square,
  Monitor,
  Check,
  Palette,
  Sliders,
  Type
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Input, Textarea } from '../common/Input';
import { Button } from '../common/Button';
import { useProject } from '../../context/ProjectContext';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const aspectRatios = [
  {
    id: '16:9',
    label: '16:9 Landscape',
    desc: 'YouTube & Desktop Videos (1920x1080)',
    icon: Monitor,
    previewClass: 'w-12 h-7',
  },
  {
    id: '9:16',
    label: '9:16 Vertical',
    desc: 'YouTube Shorts, Reels & TikTok (1080x1920)',
    icon: Smartphone,
    previewClass: 'w-6 h-10',
  },
  {
    id: '1:1',
    label: '1:1 Square',
    desc: 'Instagram & Square Posts (1080x1080)',
    icon: Square,
    previewClass: 'w-8 h-8',
  },
];

import { STYLE_PRESETS } from '../../data/stylePresets';


const languages = [
  { id: 'Hindi', label: 'Hindi (हिन्दी)' },
  { id: 'English', label: 'English' },
  { id: 'Hinglish', label: 'Hinglish (Hindi in Latin script)' },
  { id: 'Spanish', label: 'Spanish (Español)' },
  { id: 'French', label: 'French (Français)' },
  { id: 'German', label: 'German (Deutsch)' },
  { id: 'Japanese', label: 'Japanese (日本語)' },
];

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { createProject } = useProject();

  const [name, setName] = useState('');
  const [language, setLanguage] = useState('Hindi');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1' | '4:5'>('16:9');
  const [resolutionPreset, setResolutionPreset] = useState<'1080p' | '4K' | '720p'>('1080p');
  const [fps, setFps] = useState(30);
  const [stylePreset, setStylePreset] = useState('cinematic_realistic');
  const [customStyle, setCustomStyle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setIsSubmitting(true);
      await createProject({
        name: name.trim(),
        language,
        aspect_ratio: aspectRatio,
        resolution_preset: resolutionPreset,
        fps,
        style_preset: stylePreset,
        custom_style_description: stylePreset === 'custom' ? customStyle : '',
      });
      onClose();
      // Reset form
      setName('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New StoryReel Project"
      subtitle="Configure target platform format, visual art style bible, and language"
      maxWidth="3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Project Name & Language */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <Input
              label="Project Title"
              placeholder="e.g. The Legend of the Lost Temple"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-studio-300 tracking-wide uppercase mb-1.5">
              Story Language
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full bg-studio-900 border border-studio-700/80 rounded-xl px-3.5 py-2 text-sm text-studio-100 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            >
              {languages.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Aspect Ratio Selection */}
        <div>
          <label className="block text-xs font-medium text-studio-300 tracking-wide uppercase mb-2.5">
            Aspect Ratio & Format
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {aspectRatios.map((item) => {
              const isSelected = aspectRatio === item.id;
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  onClick={() => setAspectRatio(item.id as any)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-indigo-600/15 border-indigo-500 shadow-glow-brand ring-1 ring-indigo-500'
                      : 'bg-studio-850/60 border-studio-800 hover:border-studio-700 hover:bg-studio-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs text-studio-200">
                      {item.label}
                    </span>
                    <div
                      className={`border-2 rounded flex items-center justify-center ${
                        item.previewClass
                      } ${
                        isSelected
                          ? 'border-indigo-400 bg-indigo-500/20'
                          : 'border-studio-600 bg-studio-800'
                      }`}
                    >
                      <Icon className="w-3 h-3 text-studio-400" />
                    </div>
                  </div>
                  <p className="text-[11px] text-studio-400 leading-tight">
                    {item.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Resolution & FPS */}
        <div className="grid grid-cols-2 gap-4 bg-studio-850/40 p-4 rounded-xl border border-studio-800">
          <div>
            <label className="block text-xs font-medium text-studio-300 tracking-wide uppercase mb-1.5">
              Target Resolution
            </label>
            <div className="flex gap-2">
              {(['1080p', '4K', '720p'] as const).map((res) => (
                <button
                  type="button"
                  key={res}
                  onClick={() => setResolutionPreset(res)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                    resolutionPreset === res
                      ? 'bg-indigo-600 text-white border-indigo-500'
                      : 'bg-studio-800 text-studio-400 border-studio-700 hover:text-studio-200'
                  }`}
                >
                  {res}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-studio-300 tracking-wide uppercase mb-1.5">
              Framerate (FPS)
            </label>
            <div className="flex gap-2">
              {[24, 30, 60].map((rate) => (
                <button
                  type="button"
                  key={rate}
                  onClick={() => setFps(rate)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                    fps === rate
                      ? 'bg-indigo-600 text-white border-indigo-500'
                      : 'bg-studio-800 text-studio-400 border-studio-700 hover:text-studio-200'
                  }`}
                >
                  {rate} FPS
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Visual Style Preset Selection */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <label className="block text-xs font-medium text-studio-300 tracking-wide uppercase">
              Visual Style Preset (Character & Environment Bible)
            </label>
            <span className="text-[11px] text-indigo-400">
              Injected into all scene prompts
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
            {STYLE_PRESETS.map((preset) => {
              const isSelected = stylePreset === preset.id;
              return (
                <div
                  key={preset.id}
                  onClick={() => setStylePreset(preset.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all relative overflow-hidden group ${
                    isSelected
                      ? 'bg-studio-800 border-indigo-500 shadow-glow-brand ring-1 ring-indigo-500'
                      : 'bg-studio-850/70 border-studio-800 hover:border-studio-700 hover:bg-studio-800/40'
                  }`}
                >
                  {/* Subtle top gradient bar */}
                  <div
                    className={`h-1 absolute top-0 left-0 right-0 bg-gradient-to-r ${preset.gradient}`}
                  />
                  <div className="flex items-center justify-between mb-1 mt-0.5">
                    <span className="font-bold text-xs text-studio-100">
                      {preset.name}
                    </span>
                    {isSelected && (
                      <div className="w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </div>
                  <p className="text-[10.5px] text-studio-400 line-clamp-2 leading-relaxed">
                    {preset.desc}
                  </p>
                </div>
              );
            })}
          </div>

          {stylePreset === 'custom' && (
            <div className="mt-3">
              <Textarea
                label="Custom Style Prompt Definition"
                placeholder="e.g. Masterpiece oil painting, thick impasto strokes, Rembrandt lighting, rich gold and crimson tones, textured canvas..."
                value={customStyle}
                onChange={(e) => setCustomStyle(e.target.value)}
                rows={2}
                required
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-studio-800">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="glow"
            isLoading={isSubmitting}
            disabled={!name.trim()}
            leftIcon={<Sparkles className="w-4 h-4" />}
          >
            Create Studio Project
          </Button>
        </div>
      </form>
    </Modal>
  );
};
