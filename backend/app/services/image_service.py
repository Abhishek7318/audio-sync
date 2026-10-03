import os
import re
import io
import time
import shutil
import urllib.parse
import httpx
from pathlib import Path
from typing import List, Dict, Any, Optional
from PIL import Image
from app.models.project import Project, Scene
from app.services.project_service import project_service
from app.services.settings_service import settings_service

class ImageService:
    def _clean_prompt(self, prompt: str) -> str:
        """
        Clean prompt for API generation, removing extraneous parameters
        """
        cleaned = re.sub(r'--ar\s+\d+:\d+', '', prompt).strip()
        cleaned = re.sub(r'--v\s+\d+', '', cleaned).strip()
        return cleaned

    def _get_target_resolution(self, aspect_ratio: str) -> tuple[int, int]:
        """
        Returns (width, height) matching aspect ratio
        """
        if aspect_ratio == "9:16":
            return (1080, 1920)
        elif aspect_ratio == "1:1":
            return (1080, 1080)
        elif aspect_ratio == "4:5":
            return (1080, 1350)
        return (1920, 1080) # Default 16:9

    def optimize_and_save_image(self, input_image_bytes_or_path: Any, output_path: Path, aspect_ratio: str) -> Path:
        """
        Validates, crops/resizes, and saves the image to project images directory
        """
        target_w, target_h = self._get_target_resolution(aspect_ratio)

        if isinstance(input_image_bytes_or_path, (str, Path)):
            img = Image.open(input_image_bytes_or_path)
        else:
            img = Image.open(io.BytesIO(input_image_bytes_or_path))

        # Convert to RGB if needed
        if img.mode in ("RGBA", "P", "LA"):
            img = img.convert("RGB")

        # Calculate crop to match target aspect ratio without distortion
        img_w, img_h = img.size
        target_aspect = target_w / target_h
        current_aspect = img_w / img_h

        if abs(current_aspect - target_aspect) > 0.02:
            if current_aspect > target_aspect:
                # Image is too wide: crop left & right
                new_w = int(img_h * target_aspect)
                offset = (img_w - new_w) // 2
                img = img.crop((offset, 0, offset + new_w, img_h))
            else:
                # Image is too tall: crop top & bottom
                new_h = int(img_w / target_aspect)
                offset = (img_h - new_h) // 2
                img = img.crop((0, offset, img_w, offset + new_h))

        # Resize with high quality Lanczos filter
        img = img.resize((target_w, target_h), Image.Resampling.LANCZOS)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        img.save(output_path, "PNG", quality=95)
        return output_path

    async def generate_image_free_flux(self, prompt: str, output_path: Path, aspect_ratio: str = "16:9") -> Path:
        """
        Generate image using 100% Free High-Resolution Cinematic Flux Engine (No API key needed)
        """
        target_w, target_h = self._get_target_resolution(aspect_ratio)
        cleaned_prompt = self._clean_prompt(prompt)
        encoded_prompt = urllib.parse.quote(cleaned_prompt)

        # Free high-performance Flux endpoint with seed & parameters
        seed = int(time.time() * 1000) % 999999
        url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width={target_w}&height={target_h}&seed={seed}&nologo=true&enhance=true&model=flux"

        async with httpx.AsyncClient(timeout=60.0) as client:
            res = await client.get(url)
            if res.status_code != 200:
                raise RuntimeError(f"Free image service returned status {res.status_code}")
            return self.optimize_and_save_image(res.content, output_path, aspect_ratio)

    async def generate_image_openai(self, prompt: str, output_path: Path, aspect_ratio: str = "16:9") -> Path:
        """
        Generate image using OpenAI DALL-E 3
        """
        from openai import OpenAI
        settings = settings_service.get_settings()
        api_key = settings.api_keys.openai_api_key
        if not api_key:
            raise ValueError("OpenAI API key is required for DALL-E 3")

        size = "1792x1024" if aspect_ratio == "16:9" else "1024x1792" if aspect_ratio == "9:16" else "1024x1024"
        client = OpenAI(api_key=api_key)

        res = client.images.generate(
            model="dall-e-3",
            prompt=self._clean_prompt(prompt),
            size=size,
            quality="standard",
            n=1
        )
        image_url = res.data[0].url
        if not image_url:
            raise RuntimeError("DALL-E 3 returned empty image URL")

        async with httpx.AsyncClient(timeout=60.0) as client_http:
            img_res = await client_http.get(image_url)
            return self.optimize_and_save_image(img_res.content, output_path, aspect_ratio)

    async def generate_image_for_scene(
        self,
        project_id: str,
        scene_id: str,
        provider: Optional[str] = None
    ) -> Scene:
        """
        Generates and assigns image for a specific scene
        """
        project = project_service.get_project(project_id)
        if not project:
            raise ValueError(f"Project not found: {project_id}")

        scene = next((s for s in project.scenes if s.id == scene_id), None)
        if not scene:
            raise ValueError(f"Scene not found: {scene_id}")

        pdir = Path(project.project_dir)
        images_dir = pdir / "images"
        images_dir.mkdir(parents=True, exist_ok=True)

        filename = f"scene_{scene.scene_number:02d}.png"
        output_path = images_dir / filename

        settings = settings_service.get_settings()
        chosen_provider = provider or settings.image_provider or "free_flux"

        scene.image_status = "generating"
        project_service.save_project(project)

        try:
            if chosen_provider == "openai" and settings.api_keys.openai_api_key:
                await self.generate_image_openai(scene.image_prompt, output_path, project.aspect_ratio)
            else:
                # 100% Free Cinematic Flux Engine (Default)
                await self.generate_image_free_flux(scene.image_prompt, output_path, project.aspect_ratio)

            scene.generated_image_path = str(output_path)
            scene.image_status = "ready"
        except Exception as e:
            print(f"Image generation failed for Scene {scene.scene_number}: {e}")
            scene.image_status = "failed"
            scene.notes = str(e)
            raise e
        finally:
            project_service.save_project(project)

        return scene

    def assign_image_to_scene(
        self,
        project_id: str,
        scene_id: str,
        image_bytes_or_path: Any,
        original_filename: str = "image.png"
    ) -> Scene:
        """
        Assigns manual or uploaded image to a scene (Mode C)
        """
        project = project_service.get_project(project_id)
        if not project:
            raise ValueError(f"Project not found: {project_id}")

        scene = next((s for s in project.scenes if s.id == scene_id), None)
        if not scene:
            raise ValueError(f"Scene not found: {scene_id}")

        pdir = Path(project.project_dir)
        images_dir = pdir / "images"
        images_dir.mkdir(parents=True, exist_ok=True)

        filename = f"scene_{scene.scene_number:02d}.png"
        output_path = images_dir / filename

        self.optimize_and_save_image(image_bytes_or_path, output_path, project.aspect_ratio)

        scene.generated_image_path = str(output_path)
        scene.image_status = "ready"
        project_service.save_project(project)
        return scene

    def bulk_assign_images(
        self,
        project_id: str,
        file_paths_or_bytes: List[tuple[str, Any]]
    ) -> List[Scene]:
        """
        Smart bulk image matcher (Mode C): extracts scene numbers from filenames
        and automatically maps them to respective scenes (e.g. scene_01.png -> Scene 1)
        """
        project = project_service.get_project(project_id)
        if not project:
            raise ValueError(f"Project not found: {project_id}")

        updated_scenes = []

        for filename, data in file_paths_or_bytes:
            # Extract numbers from filename (e.g. "scene_02.png" -> 2, "img_3.jpg" -> 3)
            match = re.search(r'(\d+)', filename)
            if match:
                scene_num = int(match.group(1))
                matching_scene = next((s for s in project.scenes if s.scene_number == scene_num), None)
                if matching_scene:
                    self.assign_image_to_scene(project_id, matching_scene.id, data, filename)
                    updated_scenes.append(matching_scene)

        return updated_scenes

    def check_browser_downloads_for_new_image(self, project_id: str, scene_id: str, downloads_dir: Optional[Path] = None) -> Optional[Scene]:
        """
        Checks ~/Downloads for recently saved images (Mode B Playwright / Browser Assist)
        """
        d_dir = downloads_dir or (Path.home() / "Downloads")
        if not d_dir.exists():
            return None

        # Find image files modified in the last 60 seconds
        now = time.time()
        recent_images = []
        for f in d_dir.iterdir():
            if f.is_file() and f.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp"):
                try:
                    mtime = f.stat().st_mtime
                    if now - mtime < 120: # modified in last 2 minutes
                        recent_images.append((mtime, f))
                except Exception:
                    continue

        if not recent_images:
            return None

        recent_images.sort(key=lambda x: x[0], reverse=True)
        latest_image_path = recent_images[0][1]

        return self.assign_image_to_scene(project_id, scene_id, latest_image_path, latest_image_path.name)

image_service = ImageService()
