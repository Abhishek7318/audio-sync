import React, { useState } from 'react';
import {
  Key,
  Folder,
  Cpu,
  Eye,
  EyeOff,
  CheckCircle2,
  Save,
  HardDrive,
  Sparkles,
  Bot
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';
import { electronBridge } from '../../services/electronBridge';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { settings, updateSettings, systemStatus } = useSettings();
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    default_projects_dir: settings.default_projects_dir,
    llm_provider: settings.llm_provider,
    llm_model: settings.llm_model,
    image_provider: settings.image_provider,
    image_model: settings.image_model,
    whisper_model_size: settings.whisper_model_size,
    whisper_device: settings.whisper_device,
    api_keys: {
      openai_api_key: settings.api_keys?.openai_api_key || '',
      anthropic_api_key: settings.api_keys?.anthropic_api_key || '',
      gemini_api_key: settings.api_keys?.gemini_api_key || '',
      stability_api_key: settings.api_keys?.stability_api_key || '',
      replicate_api_key: settings.api_keys?.replicate_api_key || '',
    },
  });

  const [showKeys, setShowKeys] = useState<{ [key: string]: boolean }>({});
  const [isSaving, setIsSaving] = useState(false);

  const toggleShowKey = (key: string) => {
    setShowKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSelectFolder = async () => {
    const dir = await electronBridge.selectDirectory('Choose Projects Storage Folder');
    if (dir) {
      setFormData((prev) => ({ ...prev, default_projects_dir: dir }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await updateSettings(formData);
      showToast('Settings saved successfully (API keys securely encrypted)', 'success');
      onClose();
    } catch (err: any) {
      showToast(`Failed to save settings: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Studio Settings & AI Keys"
      subtitle="Configure AI providers, encrypted API keys, Whisper speech engine, and paths"
      maxWidth="3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* API Keys Configuration */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Key className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-studio-100 uppercase tracking-wide">
              API Keys (Encrypted Locally)
            </h3>
          </div>

          <div className="space-y-3 bg-studio-850/40 p-4 rounded-xl border border-studio-800">
            {/* Gemini */}
            <div className="relative">
              <Input
                label="Google Gemini API Key (Recommended for Scene Breakdown)"
                type={showKeys['gemini'] ? 'text' : 'password'}
                placeholder="AIzaSy..."
                value={formData.api_keys.gemini_api_key}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    api_keys: { ...prev.api_keys, gemini_api_key: e.target.value },
                  }))
                }
                rightIcon={
                  <button
                    type="button"
                    onClick={() => toggleShowKey('gemini')}
                    className="hover:text-studio-200"
                  >
                    {showKeys['gemini'] ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                }
              />
            </div>

            {/* OpenAI */}
            <div>
              <Input
                label="OpenAI API Key (GPT-4o Breakdown & DALL-E 3 Images)"
                type={showKeys['openai'] ? 'text' : 'password'}
                placeholder="sk-proj-..."
                value={formData.api_keys.openai_api_key}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    api_keys: { ...prev.api_keys, openai_api_key: e.target.value },
                  }))
                }
                rightIcon={
                  <button
                    type="button"
                    onClick={() => toggleShowKey('openai')}
                    className="hover:text-studio-200"
                  >
                    {showKeys['openai'] ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                }
              />
            </div>

            {/* Anthropic */}
            <div>
              <Input
                label="Anthropic Claude API Key"
                type={showKeys['anthropic'] ? 'text' : 'password'}
                placeholder="sk-ant-..."
                value={formData.api_keys.anthropic_api_key}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    api_keys: { ...prev.api_keys, anthropic_api_key: e.target.value },
                  }))
                }
                rightIcon={
                  <button
                    type="button"
                    onClick={() => toggleShowKey('anthropic')}
                    className="hover:text-studio-200"
                  >
                    {showKeys['anthropic'] ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                }
              />
            </div>

            {/* Stability & Replicate */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <Input
                label="Stability AI Key (SD3 / Ultra)"
                type={showKeys['stability'] ? 'text' : 'password'}
                placeholder="sk-..."
                value={formData.api_keys.stability_api_key}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    api_keys: { ...prev.api_keys, stability_api_key: e.target.value },
                  }))
                }
                rightIcon={
                  <button
                    type="button"
                    onClick={() => toggleShowKey('stability')}
                    className="hover:text-studio-200"
                  >
                    {showKeys['stability'] ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                }
              />

              <Input
                label="Replicate API Token (Flux.1)"
                type={showKeys['replicate'] ? 'text' : 'password'}
                placeholder="r8_..."
                value={formData.api_keys.replicate_api_key}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    api_keys: { ...prev.api_keys, replicate_api_key: e.target.value },
                  }))
                }
                rightIcon={
                  <button
                    type="button"
                    onClick={() => toggleShowKey('replicate')}
                    className="hover:text-studio-200"
                  >
                    {showKeys['replicate'] ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                }
              />
            </div>
          </div>
        </div>

        {/* AI Provider Defaults */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-studio-850/40 p-4 rounded-xl border border-studio-800 space-y-3">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-purple-400" />
              <h4 className="text-xs font-bold text-studio-200 uppercase tracking-wide">
                Scene Breakdown LLM
              </h4>
            </div>
            <div>
              <label className="block text-xs text-studio-400 mb-1">Provider</label>
              <select
                value={formData.llm_provider}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    llm_provider: e.target.value as any,
                  }))
                }
                className="w-full bg-studio-900 border border-studio-700/80 rounded-xl px-3 py-2 text-xs text-studio-100"
              >
                <option value="gemini">Google Gemini (Fast & Highly Capable)</option>
                <option value="openai">OpenAI (GPT-4o / GPT-4o-mini)</option>
                <option value="anthropic">Anthropic Claude 3.5 Sonnet</option>
                <option value="mock">Local Demo Mock Engine (No API Key needed)</option>
              </select>
            </div>
          </div>

          <div className="bg-studio-850/40 p-4 rounded-xl border border-studio-800 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-pink-400" />
              <h4 className="text-xs font-bold text-studio-200 uppercase tracking-wide">
                Image Generation Engine
              </h4>
            </div>
            <div>
              <label className="block text-xs text-studio-400 mb-1">Default Mode</label>
              <select
                value={formData.image_provider}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    image_provider: e.target.value as any,
                  }))
                }
                className="w-full bg-studio-900 border border-studio-700/80 rounded-xl px-3 py-2 text-xs text-studio-100"
              >
                <option value="openai">Mode A: OpenAI DALL-E 3 (Automatic API)</option>
                <option value="replicate_flux">Mode A: Replicate Flux Schnell / Pro</option>
                <option value="stability">Mode A: Stability AI SD3 Ultra</option>
                <option value="browser_assist">Mode B: Playwright Browser Assist (ChatGPT Web)</option>
                <option value="manual">Mode C: Manual Drag & Drop</option>
              </select>
            </div>
          </div>
        </div>

        {/* Speech Alignment & Storage Folder */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-studio-850/40 p-4 rounded-xl border border-studio-800 space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <h4 className="text-xs font-bold text-studio-200 uppercase tracking-wide">
                Whisper Speech Engine
              </h4>
            </div>
            <div>
              <label className="block text-xs text-studio-400 mb-1">Model Size</label>
              <select
                value={formData.whisper_model_size}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    whisper_model_size: e.target.value,
                  }))
                }
                className="w-full bg-studio-900 border border-studio-700/80 rounded-xl px-3 py-2 text-xs text-studio-100"
              >
                <option value="tiny">Tiny (Fastest, low memory)</option>
                <option value="base">Base (Balanced - Recommended)</option>
                <option value="small">Small (High precision)</option>
                <option value="medium">Medium (Great for Hindi accents)</option>
                <option value="large-v3">Large-v3 (Maximum multilingual precision)</option>
              </select>
            </div>
          </div>

          <div className="bg-studio-850/40 p-4 rounded-xl border border-studio-800 space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Folder className="w-4 h-4 text-amber-400" />
              <h4 className="text-xs font-bold text-studio-200 uppercase tracking-wide">
                Projects Storage Directory
              </h4>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={formData.default_projects_dir}
                className="flex-1 bg-studio-900 border border-studio-700/80 rounded-xl px-3 py-1.5 text-xs text-studio-300 font-mono"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleSelectFolder}
              >
                Browse
              </Button>
            </div>
          </div>
        </div>

        {/* System Diagnostics */}
        <div className="p-3 rounded-xl bg-studio-900/80 border border-studio-800 flex items-center justify-between text-xs text-studio-300">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-indigo-400" />
            <span>FFmpeg:</span>
            <span className={systemStatus.ffmpeg ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
              {systemStatus.ffmpeg ? 'Installed & Ready' : 'Not detected'}
            </span>
          </div>
          <div className="text-[11px] text-studio-500">
            Backend Port: 8765
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-studio-800">
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button
            type="submit"
            variant="glow"
            isLoading={isSaving}
            leftIcon={<Save className="w-4 h-4" />}
          >
            Save Settings
          </Button>
        </div>
      </form>
    </Modal>
  );
};
