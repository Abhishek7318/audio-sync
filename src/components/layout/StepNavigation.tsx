import React from 'react';
import {
  FileText,
  Activity,
  Layers,
  Image as ImageIcon,
  Sliders,
  Type,
  Download,
  CheckCircle2
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { useSettings } from '../../context/SettingsContext';

const stepsMeta = [
  {
    step: 1,
    titleEn: 'Story Input',
    titleHi: 'कहानी और ऑडियो',
    desc: 'Text & Audio',
    icon: FileText,
  },
  {
    step: 2,
    titleEn: 'Alignment',
    titleHi: 'ऑडियो मिलान',
    desc: 'Whisper Sync',
    icon: Activity,
  },
  {
    step: 3,
    titleEn: 'Scenes & Prompts',
    titleHi: 'दृश्य और प्रॉम्प्ट',
    desc: 'LLM Story Breakdown',
    icon: Layers,
  },
  {
    step: 4,
    titleEn: 'Images Studio',
    titleHi: 'चित्र निर्माण',
    desc: 'AI Generation Queue',
    icon: ImageIcon,
  },
  {
    step: 5,
    titleEn: 'Motion & Timeline',
    titleHi: 'मोशन और टाइमलाइन',
    desc: 'Ken Burns & Cuts',
    icon: Sliders,
  },
  {
    step: 6,
    titleEn: 'Subtitles',
    titleHi: 'सबटाइटल',
    desc: 'Karaoke & Ass Styling',
    icon: Type,
  },
  {
    step: 7,
    titleEn: 'Export',
    titleHi: 'वीडियो एक्सपोर्ट',
    desc: 'FFmpeg 4K / 1080p',
    icon: Download,
  },
];

export const StepNavigation: React.FC = () => {
  const { currentProject, currentStep, setStep } = useProject();
  const { settings } = useSettings();

  const isHindi = settings.ui_language === 'hi';

  if (!currentProject) return null;

  return (
    <nav className="h-16 bg-studio-900/90 border-b border-studio-800/80 px-4 flex items-center justify-between z-20 backdrop-blur-md">
      <div className="flex items-center gap-1.5 w-full max-w-6xl mx-auto justify-between overflow-x-auto py-1">
        {stepsMeta.map((item) => {
          const isActive = currentStep === item.step;
          const isCompleted = currentStep > item.step;
          const Icon = item.icon;

          return (
            <button
              key={item.step}
              onClick={() => setStep(item.step)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-200 group text-left relative shrink-0 ${
                isActive
                  ? 'bg-indigo-600/15 border border-indigo-500/40 text-white shadow-sm shadow-indigo-500/10'
                  : isCompleted
                  ? 'hover:bg-studio-800/60 text-studio-200 border border-transparent'
                  : 'hover:bg-studio-800/40 text-studio-400 border border-transparent'
              }`}
            >
              {/* Step number / icon badge */}
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-transform group-hover:scale-105 ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-glow-brand'
                    : isCompleted
                    ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-studio-800 text-studio-400 border border-studio-700'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Icon className="w-3.5 h-3.5" />
                )}
              </div>

              {/* Title & subtitle */}
              <div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-xs font-bold leading-none ${
                      isActive
                        ? 'text-indigo-300'
                        : isCompleted
                        ? 'text-studio-200'
                        : 'text-studio-400'
                    }`}
                  >
                    {isHindi ? item.titleHi : item.titleEn}
                  </span>
                </div>
                <span className="text-[10px] text-studio-500 font-medium block mt-0.5 leading-none">
                  {item.desc}
                </span>
              </div>

              {/* Active pill under indicator */}
              {isActive && (
                <div className="absolute -bottom-1 left-3 right-3 h-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
