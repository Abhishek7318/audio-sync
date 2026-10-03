import json
import os
from pathlib import Path
from cryptography.fernet import Fernet
from app.config import SETTINGS_FILE, SECRET_KEY_FILE, DEFAULT_PROJECTS_DIR
from app.models.settings import AppSettings, ApiKeys

class SettingsService:
    def __init__(self):
        self._fernet = self._init_crypto()

    def _init_crypto(self) -> Fernet:
        if not SECRET_KEY_FILE.exists():
            key = Fernet.generate_key()
            SECRET_KEY_FILE.write_bytes(key)
        else:
            key = SECRET_KEY_FILE.read_bytes()
        return Fernet(key)

    def _encrypt(self, text: str) -> str:
        if not text:
            return ""
        try:
            return self._fernet.encrypt(text.encode()).decode()
        except Exception:
            return text

    def _decrypt(self, token: str) -> str:
        if not token:
            return ""
        try:
            return self._fernet.decrypt(token.encode()).decode()
        except Exception:
            return token

    def get_settings(self) -> AppSettings:
        if not SETTINGS_FILE.exists():
            default_settings = AppSettings(
                default_projects_dir=str(DEFAULT_PROJECTS_DIR)
            )
            self.save_settings(default_settings)
            return default_settings

        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            # Decrypt API keys
            if "api_keys" in data and isinstance(data["api_keys"], dict):
                for k, v in data["api_keys"].items():
                    if v and isinstance(v, str) and v.startswith("enc:"):
                        data["api_keys"][k] = self._decrypt(v[4:])

            return AppSettings(**data)
        except Exception as e:
            print(f"Error loading settings: {e}")
            return AppSettings(default_projects_dir=str(DEFAULT_PROJECTS_DIR))

    def save_settings(self, settings: AppSettings) -> AppSettings:
        data = settings.model_dump()
        
        # Encrypt API keys before writing to disk
        if "api_keys" in data and isinstance(data["api_keys"], dict):
            encrypted_keys = {}
            for k, v in data["api_keys"].items():
                if v:
                    encrypted_keys[k] = f"enc:{self._encrypt(v)}"
                else:
                    encrypted_keys[k] = None
            data["api_keys"] = encrypted_keys

        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

        return settings

settings_service = SettingsService()
