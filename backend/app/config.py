import os
from pathlib import Path

# Base App directories
HOME_DIR = Path.home()
APP_DATA_DIR = HOME_DIR / ".storyreel"
APP_DATA_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_PROJECTS_DIR = HOME_DIR / "StoryReelProjects"
DEFAULT_PROJECTS_DIR.mkdir(parents=True, exist_ok=True)

SETTINGS_FILE = APP_DATA_DIR / "settings.json"
SECRET_KEY_FILE = APP_DATA_DIR / ".secret_key"

SERVER_HOST = os.getenv("STORYREEL_HOST", "127.0.0.1")
SERVER_PORT = int(os.getenv("STORYREEL_PORT", "8765"))
