import json
import shutil
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from app.models.project import Project
from app.services.settings_service import settings_service

class ProjectService:
    def _sanitize_folder_name(self, name: str) -> str:
        clean = "".join([c if c.isalnum() or c in (" ", "-", "_") else "_" for c in name]).strip()
        return clean or "untitled_project"

    def get_projects_root(self) -> Path:
        settings = settings_service.get_settings()
        root = Path(settings.default_projects_dir)
        root.mkdir(parents=True, exist_ok=True)
        return root

    def get_project_dir(self, project_id: str) -> Optional[Path]:
        root = self.get_projects_root()
        for folder in root.iterdir():
            if folder.is_dir():
                project_json = folder / "project.json"
                if project_json.exists():
                    try:
                        with open(project_json, "r", encoding="utf-8") as f:
                            data = json.load(f)
                            if data.get("id") == project_id:
                                return folder
                    except Exception:
                        continue
        return None

    def list_projects(self) -> List[Dict[str, Any]]:
        root = self.get_projects_root()
        projects = []
        for folder in root.iterdir():
            if folder.is_dir():
                project_json = folder / "project.json"
                if project_json.exists():
                    try:
                        with open(project_json, "r", encoding="utf-8") as f:
                            data = json.load(f)
                            projects.append({
                                "id": data.get("id"),
                                "name": data.get("name"),
                                "updated_at": data.get("updated_at"),
                                "created_at": data.get("created_at"),
                                "language": data.get("language"),
                                "aspect_ratio": data.get("aspect_ratio"),
                                "resolution_preset": data.get("resolution_preset"),
                                "scene_count": len(data.get("scenes", [])),
                                "audio_duration": data.get("narration_audio", {}).get("duration", 0.0),
                                "project_dir": str(folder),
                                "current_step": data.get("current_step", 1)
                            })
                    except Exception as e:
                        print(f"Failed to read project in {folder}: {e}")
        # Sort by updated_at desc
        projects.sort(key=lambda x: str(x.get("updated_at", "")), reverse=True)
        return projects

    def create_project(self, project: Project) -> Project:
        root = self.get_projects_root()
        folder_name = f"{self._sanitize_folder_name(project.name)}_{project.id[:8]}"
        project_dir = root / folder_name
        project_dir.mkdir(parents=True, exist_ok=True)

        # Initialize subdirectories
        (project_dir / "images").mkdir(parents=True, exist_ok=True)
        (project_dir / "audio").mkdir(parents=True, exist_ok=True)
        (project_dir / "subtitles").mkdir(parents=True, exist_ok=True)
        (project_dir / "exports").mkdir(parents=True, exist_ok=True)

        project.project_dir = str(project_dir)
        project.created_at = datetime.now(timezone.utc)
        project.updated_at = datetime.now(timezone.utc)

        self.save_project(project)
        return project

    def get_project(self, project_id: str) -> Optional[Project]:
        pdir = self.get_project_dir(project_id)
        if not pdir:
            return None
        project_json = pdir / "project.json"
        if not project_json.exists():
            return None
        with open(project_json, "r", encoding="utf-8") as f:
            data = json.load(f)
            return Project(**data)

    def save_project(self, project: Project) -> Project:
        if not project.project_dir:
            pdir = self.get_project_dir(project.id)
            if not pdir:
                root = self.get_projects_root()
                pdir = root / f"{self._sanitize_folder_name(project.name)}_{project.id[:8]}"
                pdir.mkdir(parents=True, exist_ok=True)
            project.project_dir = str(pdir)
        else:
            pdir = Path(project.project_dir)
            pdir.mkdir(parents=True, exist_ok=True)

        # Ensure subfolders exist
        (pdir / "images").mkdir(parents=True, exist_ok=True)
        (pdir / "audio").mkdir(parents=True, exist_ok=True)
        (pdir / "subtitles").mkdir(parents=True, exist_ok=True)
        (pdir / "exports").mkdir(parents=True, exist_ok=True)

        project.updated_at = datetime.now(timezone.utc)
        project.version += 1

        project_json = pdir / "project.json"
        with open(project_json, "w", encoding="utf-8") as f:
            json.dump(project.model_dump(mode="json"), f, indent=2, default=str)

        return project

    def delete_project(self, project_id: str) -> bool:
        pdir = self.get_project_dir(project_id)
        if pdir and pdir.exists():
            shutil.rmtree(pdir, ignore_errors=True)
            return True
        return False

project_service = ProjectService()
