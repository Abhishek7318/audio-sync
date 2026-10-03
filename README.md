# StoryReel Studio 🎬

> Next-Generation Desktop AI Video Creation Suite turning written stories + narration audio into high-quality, subtitled videos with AI-generated images and cinematic Ken Burns motion.

---

## 📁 Project Architecture

```
videostudio/
├── backend/                  # Local Python (FastAPI) Backend Engine
│   ├── app/
│   │   ├── models/           # Pydantic v2 domain schemas (Project, Scene, StyleBible, Settings, Jobs)
│   │   ├── routers/          # REST Endpoints (Projects CRUD, Settings, Jobs, Audio, Scenes, Subtitles, Export)
│   │   ├── services/         # Services (Project storage, Settings crypto, Job queue)
│   │   ├── config.py         # App configuration & directory management
│   │   └── main.py           # FastAPI application & static asset streamer
│   ├── tests/                # Unit and Integration test suite
│   ├── requirements.txt      # Python dependencies
│   └── run.py                # Standalone backend launcher
├── electron/                 # Electron Desktop Wrapper
│   ├── main.cjs              # Main process (spawns Python backend, handles native dialogs)
│   └── preload.cjs           # Secure contextBridge IPC layer
├── src/                      # React + TypeScript Frontend (Vite)
│   ├── components/
│   │   ├── common/           # Button, Card, Input, Modal, Badge
│   │   ├── layout/           # Header, StepNavigation, StatusBar
│   │   ├── modals/           # NewProjectModal, SettingsModal, ProjectListModal
│   │   └── steps/            # 7-Step studio workflow components
│   ├── context/              # ProjectContext, SettingsContext, ToastContext
│   ├── services/             # API client & Electron IPC bridge
│   ├── types/                # TypeScript interface definitions
│   ├── App.tsx               # Main Studio workspace shell
│   └── index.css             # Obsidian dark design system & animations
├── package.json              # NPM dependencies & scripts
├── vite.config.ts            # Vite bundler configuration
└── tsconfig.json             # TypeScript compiler settings
```

---

## 🚀 Quick Start & Installation

### Prerequisites
1. **Node.js**: v18+ (v20+ recommended)
2. **Python**: 3.10+ (3.11/3.12/3.14 supported)
3. **FFmpeg**: Bundled or installed in system PATH (`brew install ffmpeg` on macOS, `choco install ffmpeg` on Windows, `apt install ffmpeg` on Linux)

### Setup Instructions

1. **Install Python Environment & Dependencies**:
   ```bash
   # Create virtual environment
   python3 -m venv venv

   # Activate virtual environment
   # On macOS/Linux:
   source venv/bin/activate
   # On Windows:
   venv\Scripts\activate

   # Install dependencies
   pip install -r backend/requirements.txt
   ```

2. **Install Frontend & Electron Dependencies**:
   ```bash
   npm install
   ```

3. **Launch in Development Mode**:
   ```bash
   # Runs Python backend, Vite dev server, and Electron app concurrently:
   npm run dev
   ```

   *Or run backend and frontend in separate terminals:*
   - **Terminal 1 (Backend)**:
     ```bash
     ./venv/bin/python backend/run.py
     ```
   - **Terminal 2 (Frontend/Electron)**:
     ```bash
     npm run dev:ui
     ```

---

## 🧪 Running Tests

```bash
# Run backend unit tests & API integration tests
./venv/bin/python -m unittest discover backend/tests

# Run frontend TypeScript type checking & production build verification
npm run build:ui
```

---

## 📦 Stage 1 Delivery Summary
- **Data Models**: Complete JSON schemas for Project, Scene, CharacterProfile, StyleBible, AudioTrack, SubtitleCue, SubtitleStyle, ExportSettings, and Async Jobs.
- **Project Storage Engine**: Local disk storage per project in `~/StoryReelProjects/<project_name>_<id>` containing `project.json` (with debounced autosave), plus dedicated `/images`, `/audio`, `/subtitles`, and `/exports` subfolders.
- **Backend API**: FastAPI server running on `127.0.0.1:8765` with health check, encrypted settings persistence (Fernet encryption for API keys), project CRUD, duplication, deletion, and asset streaming endpoints.
- **Electron + React UI**: Modern studio dark mode UI with bilingual support (English/Hindi), 7-step wizard navigation, aspect ratio preview cards (16:9, 9:16, 1:1), visual style presets, Character Bible manager, and global keyboard shortcuts (`Ctrl+S`, `Ctrl+Z`, `Ctrl+Y`).
