import os
import re
import json
import httpx
from typing import List, Dict, Any, Optional
from app.models.project import Project, Scene, CameraMotion, CharacterProfile, StyleBible
from app.services.settings_service import settings_service

STYLE_PRESET_CONFIGS: Dict[str, Dict[str, str]] = {
    "cinematic_realistic": {
        "prompt_lead": "Cinematic 35mm movie still, {shot_type} shot of",
        "quality_suffix": "photorealistic 8k movie still, cinematic atmosphere, masterpiece cinematography",
        "art_medium": "35mm anamorphic photography, photorealistic 8k movie still, ultra detailed, Panavision lens",
        "lighting": "dramatic volumetric cinematic lighting, subtle atmospheric haze, natural rim light",
        "color_palette": "rich color grading, natural tones, cinematic teal and orange shadow accents",
        "camera_lens": "35mm anamorphic prime lens, shallow depth of field, f/1.8 aperture bokeh",
        "negative_prompt": "cartoon, anime, 3d render, drawing, blurry, low quality, deformed anatomy, extra limbs, bad hands, watermark, text",
    },
    "anime_ghibli": {
        "prompt_lead": "Hand-drawn Studio Ghibli anime illustration, {shot_type} key visual of",
        "quality_suffix": "Studio Ghibli anime masterpiece, Makoto Shinkai aesthetic, key visual, 2D animation art, highly detailed",
        "art_medium": "Japanese anime illustration, Studio Ghibli aesthetic, Makoto Shinkai style, hand-drawn 2D animation cel, painterly gouache background",
        "lighting": "soft golden sunbeams, ethereal luminescent lighting, vibrant god rays, atmospheric bloom",
        "color_palette": "vibrant lush greens, bright sky blues, warm pastel tones, rich hand-painted colors",
        "camera_lens": "dynamic anime cinematic composition, wide angle anime framing, cel-shaded depth",
        "negative_prompt": "photorealistic, 3d render, cgi, real life photo, blurry, bad anatomy, deformed eyes, watermark, signature",
    },
    "3d_pixar": {
        "prompt_lead": "3D Pixar Disney animated movie render, {shot_type} shot of",
        "quality_suffix": "Pixar Disney 3D animation render, Octane Render, Ray Tracing, 8k resolution, stylized 3D masterpiece",
        "art_medium": "3D Pixar Disney animation style, stylized character design, smooth subsurface scattering clay render, Octane render 3D",
        "lighting": "warm inviting studio key lighting, soft rim light, gentle ambient occlusion",
        "color_palette": "rich saturated cheerful colors, warm whimsical palette, Pixar color script",
        "camera_lens": "virtual 50mm animated camera lens, clean cinematic depth of field, smooth rendering",
        "negative_prompt": "photorealistic, live action photo, flat 2d anime, ugly, deformed, dark, gritty, noisy, low resolution, watermark",
    },
    "dark_horror": {
        "prompt_lead": "Dark gothic eerie {shot_type} shot of",
        "quality_suffix": "dark gothic horror cinematic still, eerie atmospheric masterpiece, 8k, ultra detailed",
        "art_medium": "dark gothic realism, sinister atmospheric concept art, eerie cinematic mood",
        "lighting": "dramatic chiaroscuro lighting, deep harsh shadows, creeping mist, candle glow, moonlight rim",
        "color_palette": "desaturated muted grim tones, blood red accents, cold obsidian blacks, ghostly blues",
        "camera_lens": "24mm wide angle perspective, Dutch angle framing, unsettling claustrophobic depth",
        "negative_prompt": "bright, cheerful, cartoon, anime, saturated colors, low quality, bad anatomy, text, watermark",
    },
    "watercolor": {
        "prompt_lead": "Delicate watercolor fairytale illustration on textured paper, {shot_type} view of",
        "quality_suffix": "traditional watercolor storybook illustration, wet-on-wet technique, fine ink outlines, artistic masterpiece",
        "art_medium": "delicate watercolor painting on textured rough cotton paper, fine expressive ink linework, fairytale storybook illustration",
        "lighting": "soft diffuse morning watercolor wash, gentle pastel luminescence, dappled sunlight",
        "color_palette": "dreamy pastel watercolors, soft lavender, mint green, blush pink, golden ochre",
        "camera_lens": "storybook illustration composition, artistic vignette border, whimsical framing",
        "negative_prompt": "photorealistic, 3d cgi render, dark, gritty, harsh shadows, neon, deformed, watermark, text",
    },
    "cyberpunk_retro": {
        "prompt_lead": "Cyberpunk retro-futuristic {shot_type} shot of",
        "quality_suffix": "cyberpunk synthwave masterpiece, neon city aesthetic, Unreal Engine 5 render, 8k wallpaper",
        "art_medium": "cyberpunk synthwave aesthetic, dystopian sci-fi cinematic render, wet asphalt reflections, retro-futurism",
        "lighting": "vibrant neon glow, electric cyan and hot magenta backlights, volumetric laser beams, holographic illumination",
        "color_palette": "electric cyan, hot neon pink, deep midnight purple, glowing amber, dark chrome",
        "camera_lens": "anamorphic lens with prominent horizontal neon flares, moody rain-slicked perspective",
        "negative_prompt": "daylight, medieval, cartoon, flat colors, low detail, blurry, deformed anatomy, bad hands, watermark",
    },
    "oil_painting": {
        "prompt_lead": "Classic fine art oil painting on textured canvas, {shot_type} composition of",
        "quality_suffix": "classical oil painting masterpiece, thick textured brushwork, oil on canvas, gallery fine art",
        "art_medium": "fine oil painting on heavy canvas, visible thick impasto brushstrokes, classical fine art masterpiece, Rembrandt style",
        "lighting": "dramatic golden hour Rembrandt lighting, directional master light, rich warm glow",
        "color_palette": "rich Venetian oil palette, deep umber, ochre, royal crimson, burnished gold",
        "camera_lens": "classical fine art canvas composition, painterly atmospheric perspective",
        "negative_prompt": "digital photo, 3d render, anime, cartoon, flat vector, modern, low quality, watermark, text",
    },
    "vintage_comic": {
        "prompt_lead": "Vintage graphic novel comic book panel with bold ink outlines and halftone dots, {shot_type} of",
        "quality_suffix": "vintage comic book splash art, graphic novel illustration, Ben-Day dots, master inkwork",
        "art_medium": "vintage 1980s American comic book art, bold black ink contour lines, Ben-Day halftone dot pattern, graphic novel splash panel",
        "lighting": "high-contrast comic book graphic lighting, dramatic cell shading, hard edge shadows",
        "color_palette": "bold four-color CMYK printing palette, punchy primary red, cobalt blue, vivid yellow",
        "camera_lens": "dynamic comic panel framing, extreme action angles, bold perspective lines",
        "negative_prompt": "photorealistic, 3d render, soft watercolor, blurry, messy anatomy, watermark, bad linework",
    },
    "hyper_fantasy": {
        "prompt_lead": "Epic mythological fantasy concept art, {shot_type} shot of",
        "quality_suffix": "epic fantasy matte painting masterpiece, 8k concept art, ArtStation trending, majestic lighting",
        "art_medium": "high fantasy concept art, digital matte painting, majestic mythological scale, Lord of the Rings aesthetic",
        "lighting": "magical glowing runes, ethereal celestial light, dramatic god rays piercing clouds",
        "color_palette": "mythic gold, sapphire skies, emerald forests, ancient stone textures",
        "camera_lens": "epic cinematic wide angle, grandiose scale, sweeping atmospheric depth",
        "negative_prompt": "modern, sci-fi, cartoon, anime, low resolution, bad proportions, watermark, text",
    },
    "custom": {
        "prompt_lead": "Custom artistic {shot_type} composition of",
        "quality_suffix": "highly detailed masterpiece, top tier quality",
        "art_medium": "custom art style as specified by user prompt",
        "lighting": "custom atmospheric lighting",
        "color_palette": "custom harmonious color palette",
        "camera_lens": "custom lens and camera perspective",
        "negative_prompt": "blurry, low quality, deformed anatomy, extra limbs, bad hands, watermark, signature, text, out of frame",
    }
}

class LLMService:
    def _get_preset_config(self, preset_name: str) -> Dict[str, str]:
        return STYLE_PRESET_CONFIGS.get(preset_name, STYLE_PRESET_CONFIGS["cinematic_realistic"])

    DEFAULT_GENERIC_MEDIUM = "photorealistic digital photography, 8k resolution, ultra detailed"
    DEFAULT_GENERIC_LIGHTING = "dramatic volumetric cinematic lighting"
    DEFAULT_GENERIC_PALETTE = "rich color grading, natural tones"
    DEFAULT_GENERIC_LENS = "35mm anamorphic lens, shallow depth of field"

    def _resolve_style_bible(self, style_bible: StyleBible) -> Dict[str, str]:
        preset_name = style_bible.preset_name or "cinematic_realistic"
        cfg = self._get_preset_config(preset_name)

        is_custom = (preset_name == "custom")
        is_realistic = (preset_name == "cinematic_realistic")

        # Resolve art medium
        if style_bible.art_medium and style_bible.art_medium != self.DEFAULT_GENERIC_MEDIUM:
            art_medium = style_bible.art_medium
        elif is_realistic:
            art_medium = style_bible.art_medium or cfg.get("art_medium", "")
        elif is_custom:
            art_medium = style_bible.custom_description or style_bible.art_medium or "custom artistic masterpiece"
        else:
            art_medium = cfg.get("art_medium", "")

        # Resolve lighting
        if style_bible.lighting and style_bible.lighting != self.DEFAULT_GENERIC_LIGHTING:
            lighting = style_bible.lighting
        elif is_realistic or is_custom:
            lighting = style_bible.lighting or cfg.get("lighting", "")
        else:
            lighting = cfg.get("lighting", "")

        # Resolve color palette
        if style_bible.color_palette and style_bible.color_palette != self.DEFAULT_GENERIC_PALETTE:
            palette = style_bible.color_palette
        elif is_realistic or is_custom:
            palette = style_bible.color_palette or cfg.get("color_palette", "")
        else:
            palette = cfg.get("color_palette", "")

        # Resolve camera lens
        if style_bible.camera_lens and style_bible.camera_lens != self.DEFAULT_GENERIC_LENS:
            lens = style_bible.camera_lens
        elif is_realistic or is_custom:
            lens = style_bible.camera_lens or cfg.get("camera_lens", "")
        else:
            lens = cfg.get("camera_lens", "")

        return {
            "preset_name": preset_name,
            "art_medium": art_medium,
            "lighting": lighting,
            "color_palette": palette,
            "camera_lens": lens,
            "quality_suffix": cfg.get("quality_suffix", "highly detailed, 8k resolution"),
            "prompt_lead": cfg.get("prompt_lead", "Cinematic {shot_type} shot of")
        }

    def _get_prompt_lead(self, style_bible: StyleBible, shot_type: str = "wide") -> str:
        resolved = self._resolve_style_bible(style_bible)
        return resolved["prompt_lead"].format(shot_type=shot_type)

    def _get_style_prompt_suffix(self, style_bible: StyleBible, aspect_ratio: str) -> str:
        """
        Constructs the consistent visual style description to append to every prompt
        """
        resolved = self._resolve_style_bible(style_bible)
        parts = []

        if resolved["art_medium"]:
            parts.append(resolved["art_medium"])
        if resolved["lighting"]:
            parts.append(resolved["lighting"])
        if resolved["color_palette"]:
            parts.append(resolved["color_palette"])
        if resolved["camera_lens"]:
            parts.append(resolved["camera_lens"])
        if style_bible.custom_description and style_bible.preset_name == "custom":
            parts.append(style_bible.custom_description)

        ar_tag = f"--ar {aspect_ratio}" if aspect_ratio in ("16:9", "9:16", "1:1", "4:5") else "--ar 16:9"
        parts.append(f"{ar_tag}, {resolved['quality_suffix']}")

        return ", ".join(parts)

    def _get_character_description(self, character_name: str, characters: List[CharacterProfile]) -> str:
        """
        Finds matching character in Bible and returns fixed physical appearance
        """
        for char in characters:
            if char.name.lower() == character_name.lower() or any(a.lower() == character_name.lower() for a in char.aliases):
                desc_parts = [f"{char.name} ({char.age_appearance})"]
                if char.physical_description:
                    desc_parts.append(char.physical_description)
                if char.clothing_style:
                    desc_parts.append(f"wearing {char.clothing_style}")
                if char.key_colors:
                    desc_parts.append(f"key colors: {', '.join(char.key_colors)}")
                return ", ".join(desc_parts)
        return character_name

    def _build_prompt_prompt(self, project: Project) -> str:
        """
        Constructs system prompt instructions for LLM story breakdown
        """
        characters_bible_str = "\n".join([
            f"- Character: {c.name} | Age/Look: {c.age_appearance} | Features: {c.physical_description} | Outfit: {c.clothing_style} | Vibe: {c.personality_vibe}"
            for c in project.characters
        ]) or "None specified (create new consistent descriptions if characters appear)."

        cfg = self._get_preset_config(project.style_bible.preset_name)
        art_medium = project.style_bible.art_medium or cfg.get("art_medium", "")
        lighting = project.style_bible.lighting or cfg.get("lighting", "")
        lens = project.style_bible.camera_lens or cfg.get("camera_lens", "")
        palette = project.style_bible.color_palette or cfg.get("color_palette", "")
        sample_lead = cfg.get("prompt_lead", "Cinematic {shot_type} shot of").format(shot_type="wide")
        sample_quality = cfg.get("quality_suffix", "8k resolution, masterpiece")

        total_audio_dur = project.narration_audio.duration or len(project.story_raw_text.split()) * 0.4

        prompt = f"""You are a master film director, visual storyboard artist, and AI prompt engineer for StoryReel Studio.
Split the following narration script into cohesive, cinematic scenes (3 to 12 seconds per scene).

CRITICAL VISUAL ART STYLE BIBLE (MANDATORY ENFORCEMENT):
- Selected Preset: '{project.style_bible.preset_name}'
- Art Medium & Technique: {art_medium}
- Lighting: {lighting}
- Color Grading & Palette: {palette}
- Camera / Lens / Composition: {lens}
{f"- Custom Style Notes: {project.style_bible.custom_description}" if project.style_bible.custom_description else ""}

RULES:
1. Create a new scene whenever location, time, mood, or camera perspective changes.
2. Total scenes must cover the entire story from 0.0s to {total_audio_dur:.1f}s.
3. EVERY SINGLE SCENE "image_prompt" MUST STRICTLY MATCH THE ART MEDIUM '{project.style_bible.preset_name}'!
   - If Anime / Ghibli: Start with "Hand-drawn Studio Ghibli anime illustration, [shot_type] visual of..."
   - If 3D Pixar: Start with "3D Pixar Disney animated movie render, [shot_type] shot of..."
   - If Watercolor: Start with "Delicate watercolor fairytale storybook illustration, [shot_type] view of..."
   - If Cyberpunk: Start with "Retro cyberpunk synthwave neon, [shot_type] shot of..."
   - If Dark Horror: Start with "Dark gothic eerie horror concept art, [shot_type] shot of..."
   - If Oil Painting: Start with "Classic oil painting masterpiece with impasto on canvas, [shot_type] of..."
   - If Vintage Comic: Start with "Vintage comic book graphic novel panel with bold ink outlines and halftone dots, [shot_type] of..."
   - If Hyper Fantasy: Start with "Epic mythological high fantasy digital matte painting, [shot_type] of..."
   - If Cinematic Realistic: Start with "Cinematic 35mm movie still, [shot_type] shot of..."
   DO NOT write "photorealistic" or "photograph" if the chosen style is Anime, Pixar 3D, Watercolor, Oil Painting, or Comic Book!
4. INJECT the Character Bible descriptions for every character present in the scene for 100% visual consistency.
5. Camera shots must vary dynamically: wide, medium, close_up, extreme_close_up, over_shoulder, aerial.
6. Camera motions must vary: zoom_in, zoom_out, pan_left, pan_right, pan_up, pan_down, slow_drift.
7. Prompts must end with: ", --ar {project.aspect_ratio}, {sample_quality}".

CHARACTER BIBLE:
{characters_bible_str}

STORY TEXT ({project.language}):
\"\"\"
{project.story_raw_text}
\"\"\"

RETURN A VALID JSON OBJECT with this EXACT schema:
{{
  "scenes": [
    {{
      "scene_number": 1,
      "story_text": "Sentence or paragraph for this scene in original language",
      "start_time": 0.0,
      "end_time": 6.5,
      "duration": 6.5,
      "location": "Brief location name",
      "time_of_day": "day | night | golden_hour | dusk | dawn",
      "characters_present": ["Character Name 1"],
      "mood": "mysterious | epic | tense | emotional | joyful | dramatic",
      "camera_shot": "wide | medium | close_up | aerial",
      "camera_motion": {{
        "type": "zoom_in",
        "speed": "slow",
        "intensity": 1.0
      }},
      "image_prompt": "{sample_lead} [character with exact Bible description] standing in [location with scene action], {lighting}, --ar {project.aspect_ratio}, {sample_quality}",
      "transition_in": "crossfade"
    }}
  ]
}}
"""
        return prompt

    async def breakdown_story(self, project: Project, provider: Optional[str] = None) -> List[Scene]:
        """
        Execute story breakdown using configured LLM provider (Gemini / OpenAI / Claude / Local Smart Heuristic)
        """
        settings = settings_service.get_settings()
        chosen_provider = provider or settings.llm_provider or "gemini"

        # Try API providers if configured, otherwise smart local engine
        if chosen_provider == "gemini" and settings.api_keys.gemini_api_key:
            try:
                return await self._breakdown_gemini(project, settings.api_keys.gemini_api_key)
            except Exception as e:
                print(f"Gemini LLM error: {e}, falling back to Smart Heuristic Engine...")
        elif chosen_provider == "openai" and settings.api_keys.openai_api_key:
            try:
                return await self._breakdown_openai(project, settings.api_keys.openai_api_key)
            except Exception as e:
                print(f"OpenAI LLM error: {e}, falling back to Smart Heuristic Engine...")
        elif chosen_provider == "anthropic" and settings.api_keys.anthropic_api_key:
            try:
                return await self._breakdown_claude(project, settings.api_keys.anthropic_api_key)
            except Exception as e:
                print(f"Claude LLM error: {e}, falling back to Smart Heuristic Engine...")

        # Robust Smart Local Heuristic Engine (100% Free / Instant)
        return self._breakdown_local_smart(project)

    async def _breakdown_gemini(self, project: Project, api_key: str) -> List[Scene]:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash", generation_config={"response_mime_type": "application/json"})
        prompt = self._build_prompt_prompt(project)
        response = model.generate_content(prompt)
        data = json.loads(response.text)
        return [Scene(**s) for s in data.get("scenes", [])]

    async def _breakdown_openai(self, project: Project, api_key: str) -> List[Scene]:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        prompt = self._build_prompt_prompt(project)
        response = client.chat.completions.create(
            model="gpt-4o",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": "You are a professional film director and prompt engineer."},
                {"role": "user", "content": prompt}
            ]
        )
        content = response.choices[0].message.content
        data = json.loads(content)
        return [Scene(**s) for s in data.get("scenes", [])]

    async def _breakdown_claude(self, project: Project, api_key: str) -> List[Scene]:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        prompt = self._build_prompt_prompt(project)
        response = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=4000,
            messages=[{"role": "user", "content": prompt}]
        )
        content = response.content[0].text
        # Extract JSON from response
        match = re.search(r'\{.*\}', content, re.DOTALL)
        if match:
            data = json.loads(match.group(0))
            return [Scene(**s) for s in data.get("scenes", [])]
        raise ValueError("Could not parse JSON from Claude response")

    def _breakdown_local_smart(self, project: Project) -> List[Scene]:
        """
        Smart heuristic scene builder matching audio cues, duration constraints (3-12s),
        and injecting the Character & Style Bible.
        """
        from app.services.alignment_service import alignment_service

        cues = project.subtitles
        total_dur = project.narration_audio.duration

        if not cues:
            cues = alignment_service.estimate_proportional_alignment(project.story_raw_text, total_dur or 30.0)

        scenes: List[Scene] = []
        style_suffix = self._get_style_prompt_suffix(project.style_bible, project.aspect_ratio)

        # Camera shot rotation
        camera_shots = ["wide", "medium", "close_up", "over_shoulder", "aerial"]
        camera_motions = [
            ("zoom_in", "slow"),
            ("pan_left", "slow"),
            ("zoom_out", "slow"),
            ("pan_right", "medium"),
            ("slow_drift", "slow"),
            ("subtle_tilt", "slow")
        ]

        current_scene_cues: List[Any] = []
        current_scene_num = 1

        for i, cue in enumerate(cues):
            current_scene_cues.append(cue)
            scene_duration = current_scene_cues[-1].end_time - current_scene_cues[0].start_time

            # Scene break rule: if duration >= 5s or it is the last cue or paragraph break
            is_last = (i == len(cues) - 1)
            is_long_enough = scene_duration >= 5.0 or (is_last and scene_duration >= 2.5)

            if is_long_enough or is_last:
                start_time = round(current_scene_cues[0].start_time, 2)
                end_time = round(current_scene_cues[-1].end_time, 2)
                duration = round(end_time - start_time, 2)
                combined_text = " ".join([c.text for c in current_scene_cues])

                # Determine characters present from Character Bible
                present_chars = []
                char_prompt_injections = []
                for char in project.characters:
                    if char.name.lower() in combined_text.lower() or any(a.lower() in combined_text.lower() for a in char.aliases):
                        present_chars.append(char.name)
                        char_prompt_injections.append(self._get_character_description(char.name, project.characters))

                # Rotate shot & motion
                shot_type = camera_shots[(current_scene_num - 1) % len(camera_shots)]
                motion_type, motion_speed = camera_motions[(current_scene_num - 1) % len(camera_motions)]

                # Build rich style-consistent prompt
                lead_prefix = self._get_prompt_lead(project.style_bible, shot_type)
                subject_desc = ", ".join(char_prompt_injections) if char_prompt_injections else "narrative subject in dramatic action"
                image_prompt = f"{lead_prefix} {subject_desc}, illustrating the scene: '{combined_text[:120]}...', {style_suffix}"

                scenes.append(Scene(
                    scene_number=current_scene_num,
                    story_text=combined_text,
                    start_time=start_time,
                    end_time=end_time,
                    duration=duration,
                    location="Scenic environment",
                    time_of_day="golden_hour" if current_scene_num % 2 == 0 else "day",
                    characters_present=present_chars,
                    mood="dramatic" if current_scene_num % 3 == 0 else "mysterious",
                    camera_shot=shot_type,
                    camera_motion=CameraMotion(type=motion_type, speed=motion_speed),
                    image_prompt=image_prompt,
                    transition_in="crossfade" if current_scene_num > 1 else "cut"
                ))

                current_scene_num += 1
                current_scene_cues = []

        return scenes

    async def regenerate_single_prompt(self, scene: Scene, project: Project, instruction: Optional[str] = None) -> str:
        """
        Regenerate or enhance a single scene prompt with user custom instruction
        """
        lead_prefix = self._get_prompt_lead(project.style_bible, scene.camera_shot)
        style_suffix = self._get_style_prompt_suffix(project.style_bible, project.aspect_ratio)
        char_desc = ", ".join([self._get_character_description(c, project.characters) for c in scene.characters_present]) if scene.characters_present else "scene subject"

        base_prompt = f"{lead_prefix} {char_desc} in {scene.location}, {scene.mood} atmosphere, {scene.time_of_day} lighting"
        if instruction:
            base_prompt += f", {instruction}"
        base_prompt += f", {style_suffix}"
        return base_prompt

    async def generate_youtube_seo(self, project: Project) -> Dict[str, Any]:
        """
        Generate YouTube Title (Hindi + English), Description with timestamps, Tags, and Thumbnail Prompt
        """
        title_hi = f"{project.name} | दिल दहला देने वाली कहानी | StoryReel"
        title_en = f"{project.name} - Cinematic Story Video (4K)"

        # Generate timestamps
        timestamps = []
        for s in project.scenes:
            mins = int(s.start_time // 60)
            secs = int(s.start_time % 60)
            timestamps.append(f"{mins:02d}:{secs:02d} - Scene {s.scene_number}: {s.location or s.story_text[:30]}")

        description = f"""🎬 {project.name}

Enjoy this cinematic AI-generated story video created with StoryReel Studio.

⏱️ TIMESTAMPS:
{chr(10).join(timestamps)}

✨ Style: {project.style_bible.preset_name}
🌐 Audio: {project.language}
🎞️ Resolution: {project.resolution_preset} ({project.fps} FPS)

#AIStory #HindiKahani #Cinematic #StoryReelStudio #Animation
"""

        tags = ["AI Video", "Storytelling", "Cinematic Story", "Hindi Story", "AI Animation", "Short Film", "4K Video"]

        thumbnail_prompt = f"YouTube Clickable Thumbnail, bold high-contrast cinematic masterpiece featuring {project.characters[0].name if project.characters else 'main hero'}, dramatic lighting, intense expression, text overlay space, 8k resolution, vibrant colors, 16:9 aspect ratio"

        return {
            "title_hi": title_hi,
            "title_en": title_en,
            "description": description,
            "tags": tags,
            "thumbnail_prompt": thumbnail_prompt
        }

llm_service = LLMService()
