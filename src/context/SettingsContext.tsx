import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppSettings } from '../types';
import { api } from '../services/api';

interface SettingsContextType {
  settings: AppSettings;
  loading: boolean;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  reloadSettings: () => Promise<void>;
  systemStatus: {
    ffmpeg: boolean;
    ffmpeg_path?: string;
    backendOnline: boolean;
  };
}

const defaultSettings: AppSettings = {
  default_projects_dir: '',
  theme: 'dark',
  ui_language: 'en',
  llm_provider: 'gemini',
  llm_model: 'gemini-1.5-flash',
  image_provider: 'openai',
  image_model: 'dall-e-3',
  api_keys: {
    openai_api_key: '',
    anthropic_api_key: '',
    gemini_api_key: '',
    stability_api_key: '',
    replicate_api_key: '',
  },
  whisper_model_size: 'base',
  whisper_device: 'auto',
  auto_save_interval_seconds: 10,
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [systemStatus, setSystemStatus] = useState({
    ffmpeg: false,
    ffmpeg_path: '',
    backendOnline: false,
  });

  const reloadSettings = async () => {
    try {
      const data = await api.getSettings();
      setSettings(data);
      const sys = await api.getSystemCheck();
      setSystemStatus({
        ffmpeg: !!sys.ffmpeg,
        ffmpeg_path: sys.ffmpeg_path || '',
        backendOnline: true,
      });
    } catch (err) {
      console.error('Failed to load settings:', err);
      setSystemStatus((prev) => ({ ...prev, backendOnline: false }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reloadSettings();
  }, []);

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    const merged = { ...settings, ...newSettings };
    setSettings(merged);
    try {
      const saved = await api.saveSettings(merged);
      setSettings(saved);
    } catch (err) {
      console.error('Failed to save settings to backend:', err);
      throw err;
    }
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        loading,
        updateSettings,
        reloadSettings,
        systemStatus,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
